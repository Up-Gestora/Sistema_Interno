import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import multer from 'multer';

// Carregar variáveis de ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const STORAGE_ROOT_DIR = process.env.STORAGE_ROOT_DIR
  ? resolve(process.env.STORAGE_ROOT_DIR)
  : __dirname;
const UPLOADS_ROOT_DIR = join(STORAGE_ROOT_DIR, 'uploads');
const assinafyUpload = multer({ storage: multer.memoryStorage() });
const reportCoverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const REPORT_COVER_UPLOAD_DIR = join(UPLOADS_ROOT_DIR, 'report-covers');
const REPORT_COVER_DATA_DIR = join(STORAGE_ROOT_DIR, 'data');
const REPORT_COVER_META_FILE = join(REPORT_COVER_DATA_DIR, 'report-covers.json');
const DEFAULT_DATA_DIR = join(__dirname, 'data');
const DEFAULT_REPORT_COVER_META_FILE = join(DEFAULT_DATA_DIR, 'report-covers.json');
const PORT_SHARED_STORAGE_FILE = join(REPORT_COVER_DATA_DIR, 'port-shared-storage.json');
const DEFAULT_PORT_SHARED_STORAGE_FILE = join(DEFAULT_DATA_DIR, 'port-shared-storage.json');
const PORT_SHARED_HISTORY_DIR = join(REPORT_COVER_DATA_DIR, 'port-shared-storage-history');
const PORT_SHARED_ALLOWED_KEYS = new Set([
  'asaas_config',
  'asaas_pagamentos_cache_v1',
  'clientes',
  'credito_update_workspace_v1',
  'estrategias',
  'dashboard_asaas_cache_v1',
  'financeiro_recebedores_saidas_custom_v1',
  'inter_manual_lancamentos_v1',
  'lamina_storage_snapshot_v1',
  'links_uteis_v1',
  'saidas_manual_lancamentos_v1',
]);
const PORT_SHARED_VERSIONED_KEYS = new Set([
  'inter_manual_lancamentos_v1',
  'saidas_manual_lancamentos_v1',
]);
const REPORT_COVER_ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const REPORT_COVER_DEFAULT_ADJUSTMENT = { scale: 1, offsetX: 0, offsetY: 0 };

let reportCoverItems = [];
let reportCoverInitialized = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeReportCoverAdjustment = (adjustment) => {
  const scaleRaw = Number(adjustment?.scale);
  const offsetXRaw = Number(adjustment?.offsetX);
  const offsetYRaw = Number(adjustment?.offsetY);

  const scale = Number.isFinite(scaleRaw)
    ? clamp(scaleRaw, 1, 2.5)
    : REPORT_COVER_DEFAULT_ADJUSTMENT.scale;
  const offsetX = Number.isFinite(offsetXRaw) ? offsetXRaw : REPORT_COVER_DEFAULT_ADJUSTMENT.offsetX;
  const offsetY = Number.isFinite(offsetYRaw) ? offsetYRaw : REPORT_COVER_DEFAULT_ADJUSTMENT.offsetY;

  return { scale, offsetX, offsetY };
};

const toPublicReportCoverItem = (item) => ({
  id: item.id,
  name: item.name,
  url: item.url,
  mimeType: item.mimeType,
  sizeBytes: item.sizeBytes,
  createdAt: item.createdAt,
  adjustment: normalizeReportCoverAdjustment(item.adjustment),
});

const extractFilenameFromUrl = (url) => {
  if (typeof url !== 'string') return '';
  const clean = url.split('?')[0].split('#')[0];
  return clean.split('/').pop() || '';
};

const ensureFileWithFallback = async (targetFile, fallbackFile, defaultValueFactory) => {
  try {
    await fs.access(targetFile);
    return;
  } catch {
    // File does not exist yet.
  }

  if (targetFile !== fallbackFile) {
    try {
      await fs.copyFile(fallbackFile, targetFile);
      return;
    } catch {
      // Fallback file does not exist or cannot be copied.
    }
  }

  await fs.writeFile(targetFile, defaultValueFactory(), 'utf-8');
};

const ensureReportCoverStorage = async () => {
  await fs.mkdir(REPORT_COVER_UPLOAD_DIR, { recursive: true });
  await fs.mkdir(REPORT_COVER_DATA_DIR, { recursive: true });

  await ensureFileWithFallback(
    REPORT_COVER_META_FILE,
    DEFAULT_REPORT_COVER_META_FILE,
    () => JSON.stringify({ items: [] }, null, 2),
  );
};

const ensurePortSharedStorage = async () => {
  await fs.mkdir(REPORT_COVER_DATA_DIR, { recursive: true });

  await ensureFileWithFallback(
    PORT_SHARED_STORAGE_FILE,
    DEFAULT_PORT_SHARED_STORAGE_FILE,
    () => JSON.stringify({ values: {} }, null, 2),
  );
};

const loadPortSharedStorage = async () => {
  await ensurePortSharedStorage();
  try {
    const content = await fs.readFile(PORT_SHARED_STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    const values = parsed?.values;
    return values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  } catch (error) {
    console.error('Erro ao ler armazenamento compartilhado:', error.message);
    return {};
  }
};

const persistPortSharedStorage = async (values) => {
  await ensurePortSharedStorage();
  await fs.writeFile(PORT_SHARED_STORAGE_FILE, JSON.stringify({ values }, null, 2), 'utf-8');
};

const buildHistoryTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const persistPortSharedHistoryEntry = async ({
  key,
  action,
  previousValue,
  nextValue,
}) => {
  if (!PORT_SHARED_VERSIONED_KEYS.has(key)) return;

  await fs.mkdir(PORT_SHARED_HISTORY_DIR, { recursive: true });
  const timestampIso = new Date().toISOString();
  const filename = `${key}_${buildHistoryTimestamp()}_${randomUUID().slice(0, 8)}.json`;
  const payload = {
    key,
    action,
    timestamp: timestampIso,
    previousValue,
    nextValue,
  };

  await fs.writeFile(
    join(PORT_SHARED_HISTORY_DIR, filename),
    JSON.stringify(payload, null, 2),
    'utf-8',
  );
};

const buildPortSharedStoragePayload = (values, keys) =>
  keys.reduce((acc, key) => {
    acc[key] = {
      exists: Object.prototype.hasOwnProperty.call(values, key),
      value: Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
    };
    return acc;
  }, {});

const loadReportCoverItemsFromDisk = async () => {
  try {
    const content = await fs.readFile(REPORT_COVER_META_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    return items
      .map((item) => {
        const mimeType = REPORT_COVER_ALLOWED_MIME[item?.mimeType] ? item.mimeType : 'image/jpeg';
        const id = typeof item?.id === 'string' && item.id ? item.id : randomUUID();
        const name = typeof item?.name === 'string' && item.name ? item.name : `capa-${id}`;
        const createdAt = typeof item?.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : new Date().toISOString();
        const sizeBytesRaw = Number(item?.sizeBytes);
        const sizeBytes = Number.isFinite(sizeBytesRaw) && sizeBytesRaw >= 0 ? sizeBytesRaw : 0;
        const extension = REPORT_COVER_ALLOWED_MIME[mimeType];

        let fileName = typeof item?.fileName === 'string' && item.fileName ? item.fileName : '';
        if (!fileName) {
          fileName = extractFilenameFromUrl(item?.url);
        }
        if (!fileName) {
          fileName = `${id}.${extension}`;
        }

        return {
          id,
          name,
          url: `/uploads/report-covers/${fileName}`,
          mimeType,
          sizeBytes,
          createdAt,
          adjustment: normalizeReportCoverAdjustment(item?.adjustment),
          fileName,
        };
      })
      .filter((item) => typeof item.id === 'string' && typeof item.fileName === 'string');
  } catch (error) {
    console.error('❌ Erro ao ler metadata de capas:', error.message);
    return [];
  }
};

const persistReportCoverItems = async () => {
  const payload = {
    items: reportCoverItems.map((item) => ({
      ...toPublicReportCoverItem(item),
      fileName: item.fileName,
    })),
  };

  await fs.writeFile(REPORT_COVER_META_FILE, JSON.stringify(payload, null, 2), 'utf-8');
};

const initializeReportCoverRepository = async () => {
  if (reportCoverInitialized) return;

  await ensureReportCoverStorage();
  reportCoverItems = await loadReportCoverItemsFromDisk();
  reportCoverInitialized = true;
};

const ensureReportCoverRepositoryReady = async () => {
  if (!reportCoverInitialized) {
    await initializeReportCoverRepository();
  }
};

const CREDIT_GPT_DEFAULT_BASE_URL = process.env.GPT_API_BASE_URL || 'https://api.openai.com/v1';
const CREDIT_GPT_DEFAULT_MODEL = process.env.GPT_MODEL || 'gpt-5';
const CREDIT_MAX_FUNDS_PER_REQUEST = 40;
const CREDIT_SUMMARY_MIN_LINES = 7;
const CREDIT_SUMMARY_MAX_LINES = 10;
const CREDIT_IMPACT_MAX_ITEMS = 5;
const CREDIT_DESCRIPTIVE_TEXT_MAX_CHARS = 2200;
const CREDIT_PORTFOLIO_CONTEXT_MAX_CHARS = 1800;
const CREDIT_PORTFOLIO_CONTEXT_FETCH_TIMEOUT_MS = 25000;
const CREDIT_MAIN_REQUEST_TIMEOUT_MS = 45000;
const CREDIT_SUMMARY_FALLBACK_LINES = [
  'Resultado do mes: desempenho em linha com o carrego esperado da carteira de credito.',
  'Micro (emissores/carteira): nao houve evento idiossincratico relevante nos principais emissores.',
  'Micro (setores/spreads): alocacao seletiva no primario e secundario, com ajuste tatico de risco.',
  'Macro (juros/inflacao): movimento da curva local influenciou a marcacao a mercado e os premios.',
  'Risco e liquidez: carteira manteve perfil defensivo, foco em qualidade e controle de concentracao.',
  'Perspectiva: estrategia segue disciplinada, priorizando ativos com melhor relacao risco-retorno.',
  'Monitoramento: seguimos atentos a atividade, politica monetaria e eventos corporativos.',
];
const MODEL_WITH_FIXED_TEMPERATURE = /^gpt-5/i;

const asSingleHeaderString = (value) => {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
};

const normalizeUrlBase = (value) => value.replace(/\/+$/, '');

const buildCreditChatCompletionsUrl = (baseUrlRaw) => {
  const normalized = normalizeUrlBase(baseUrlRaw || CREDIT_GPT_DEFAULT_BASE_URL);
  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
};

const supportsCustomTemperature = (model) => !MODEL_WITH_FIXED_TEMPERATURE.test(String(model || ''));

const sanitizeCreditSummaryLine = (line) => (
  String(line || '')
    .replace(/^[\-\*\u2022]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
);

const sanitizeCreditDescriptiveText = (value) => {
  if (typeof value !== 'string') return '';
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return '';
  return normalized.slice(0, CREDIT_DESCRIPTIVE_TEXT_MAX_CHARS);
};

const sanitizeCreditPortfolioContextText = (value) => {
  if (typeof value !== 'string') return '';
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return '';
  return normalized.slice(0, CREDIT_PORTFOLIO_CONTEXT_MAX_CHARS);
};

const pushUniqueCreditSummaryLine = (target, line) => {
  const cleaned = sanitizeCreditSummaryLine(line);
  if (!cleaned) return;
  if (target.includes(cleaned)) return;
  target.push(cleaned);
};

const normalizeCreditSummaryLines = (value) => {
  const lines = [];

  if (Array.isArray(value)) {
    value.forEach((line) => {
      pushUniqueCreditSummaryLine(lines, line);
    });
  } else if (typeof value === 'string') {
    value.split('\n').forEach((line) => {
      pushUniqueCreditSummaryLine(lines, line);
    });
  }

  const merged = Array.isArray(value)
    ? value.map((line) => sanitizeCreditSummaryLine(line)).join(' ')
    : String(value || '');

  if (lines.length < CREDIT_SUMMARY_MIN_LINES) {
    merged.split(/(?<=[.!?])\s+/).forEach((line) => {
      if (lines.length < CREDIT_SUMMARY_MAX_LINES) {
        pushUniqueCreditSummaryLine(lines, line);
      }
    });
  }

  if (lines.length < CREDIT_SUMMARY_MIN_LINES) {
    merged.split(/[;:]\s+/).forEach((line) => {
      if (lines.length < CREDIT_SUMMARY_MAX_LINES) {
        pushUniqueCreditSummaryLine(lines, line);
      }
    });
  }

  if (lines.length < CREDIT_SUMMARY_MIN_LINES) {
    CREDIT_SUMMARY_FALLBACK_LINES.forEach((line) => {
      if (lines.length < CREDIT_SUMMARY_MIN_LINES) {
        pushUniqueCreditSummaryLine(lines, line);
      }
    });
  }

  return lines.slice(0, CREDIT_SUMMARY_MAX_LINES);
};

const normalizeCreditPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const normalizeCreditImpactItems = (value) => {
  const lines = [];

  const pushLine = (line) => {
    const cleaned = sanitizeCreditSummaryLine(line);
    if (!cleaned) return;
    if (lines.includes(cleaned)) return;
    lines.push(cleaned);
  };

  if (Array.isArray(value)) {
    value.forEach((line) => pushLine(line));
  } else if (typeof value === 'string') {
    value.split(/\n|;|\|/).forEach((line) => pushLine(line));
  }

  return lines.slice(0, CREDIT_IMPACT_MAX_ITEMS);
};

const deriveExcessOverCdi = (excess, perf, cdi) => {
  if (excess !== null) return excess;
  if (perf === null || cdi === null) return null;
  return perf - cdi;
};

const formatSignedCreditValue = (value) => {
  if (!Number.isFinite(value)) return '--';
  const signal = value > 0 ? '+' : '';
  return `${signal}${value.toFixed(2)}`;
};

const formatCreditPercent = (value) => {
  if (value === null) return '--';
  return `${formatSignedCreditValue(value)}%`;
};

const formatCreditPp = (value) => {
  if (value === null) return '--';
  return `${formatSignedCreditValue(value)} pp`;
};

const normalizeCreditUsage = (usage) => {
  const promptTokensRaw = Number(usage?.prompt_tokens ?? usage?.promptTokens ?? 0);
  const completionTokensRaw = Number(usage?.completion_tokens ?? usage?.completionTokens ?? 0);
  const totalTokensRaw = Number(usage?.total_tokens ?? usage?.totalTokens ?? 0);

  if (
    !Number.isFinite(promptTokensRaw) ||
    !Number.isFinite(completionTokensRaw) ||
    !Number.isFinite(totalTokensRaw)
  ) {
    return null;
  }

  return {
    promptTokens: Math.max(0, Math.round(promptTokensRaw)),
    completionTokens: Math.max(0, Math.round(completionTokensRaw)),
    totalTokens: Math.max(0, Math.round(totalTokensRaw)),
  };
};

const mergeCreditUsages = (...usageEntries) => {
  const valid = usageEntries.filter((entry) => entry && typeof entry === 'object');
  if (!valid.length) return null;
  const merged = valid.reduce((acc, usage) => ({
    promptTokens: acc.promptTokens + Number(usage.promptTokens || 0),
    completionTokens: acc.completionTokens + Number(usage.completionTokens || 0),
    totalTokens: acc.totalTokens + Number(usage.totalTokens || 0),
  }), {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  });

  return {
    promptTokens: Math.max(0, Math.round(merged.promptTokens)),
    completionTokens: Math.max(0, Math.round(merged.completionTokens)),
    totalTokens: Math.max(0, Math.round(merged.totalTokens)),
  };
};

const callCreditChatCompletions = async ({
  apiKey,
  baseUrlRaw,
  requestPayload,
  timeoutMs,
}) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let providerResponse;
  try {
    providerResponse = await fetch(buildCreditChatCompletionsUrl(baseUrlRaw), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'api-key': apiKey,
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Sistema-Interno/1.0.0',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }

  let providerData;
  const providerContentType = providerResponse.headers.get('content-type') || '';
  if (providerContentType.includes('application/json')) {
    providerData = await providerResponse.json();
  } else {
    providerData = { message: await providerResponse.text() };
  }

  if (!providerResponse.ok) {
    const providerMessage =
      providerData?.error?.message ||
      providerData?.error ||
      providerData?.message ||
      `Falha no provedor GPT (${providerResponse.status})`;
    throw new Error(String(providerMessage));
  }

  return {
    providerData,
    normalizedContent: normalizeCreditProviderContent(providerData),
    usage: normalizeCreditUsage(providerData?.usage),
  };
};

const extractJsonFromModelContent = (content) => {
  if (typeof content !== 'string') return null;
  const text = content.trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Continue with extraction attempts.
  }

  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch?.[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1]);
    } catch {
      // Continue with extraction attempts.
    }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue with extraction attempts.
    }
  }

  return null;
};

const normalizeCreditProviderContent = (payload) => {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('\n')
      .trim();
  }

  if (typeof payload?.output_text === 'string') {
    return payload.output_text;
  }

  return '';
};

const normalizeFundNameForMatching = (value) => (
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
);

const normalizeCnpjForMatching = (value) => String(value || '').replace(/\D/g, '').slice(0, 14);

const formatCnpjFromDigits = (value) => {
  const digits = normalizeCnpjForMatching(value);
  if (digits.length !== 14) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

const CREDIT_MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const getCreditMonthName = (month) => CREDIT_MONTH_NAMES[month - 1] || `mes ${month}`;

const buildAutoCreditPortfolioContextByFund = async ({
  mesNumero,
  anoNumero,
  fundos,
  apiKey,
  baseUrlRaw,
  model,
}) => {
  if (!Array.isArray(fundos) || !fundos.length) {
    return {
      contextByFundId: new Map(),
      usage: null,
    };
  }

  const requestPayload = {
    model,
    messages: [
      {
        role: 'system',
        content: [
          'Voce eh um analista de fundos de credito.',
          'Para cada fundo, monte um contexto da ultima carteira aberta usando informacoes publicas normalmente divulgadas pelo mercado.',
          'Priorize: devedores/emissores com maior contribuicao positiva, devedores/emissores com maior pressao negativa, ativos que mais subiram e ativos que menos subiram/caíram.',
          'Nao invente nomes ou numeros: se nao encontrar dados publicos confiaveis, escreva exatamente "nao encontrado em fonte publica".',
          'Retorne SOMENTE JSON valido, sem markdown.',
          'Formato obrigatorio:',
          '{"funds":[{"id":"","portfolioContext":"", "confidence":0.0}]}',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          periodo: {
            mes: mesNumero,
            ano: anoNumero,
            mesNome: getCreditMonthName(mesNumero),
          },
          funds: fundos.map((item) => ({
            id: item.id,
            name: item.name,
            cnpj: formatCnpjFromDigits(item.cnpj),
          })),
        }),
      },
    ],
  };

  if (supportsCustomTemperature(model)) {
    requestPayload.temperature = 0;
  }

  try {
    const { normalizedContent, usage } = await callCreditChatCompletions({
      apiKey,
      baseUrlRaw,
      requestPayload,
      timeoutMs: CREDIT_PORTFOLIO_CONTEXT_FETCH_TIMEOUT_MS,
    });
    const parsedPayload = extractJsonFromModelContent(normalizedContent);
    const modelFunds = Array.isArray(parsedPayload?.funds) ? parsedPayload.funds : [];
    const contextByFundId = new Map();

    fundos.forEach((fund, index) => {
      const matchById = modelFunds.find((item) => String(item?.id || '') === fund.id);
      const matchByName = modelFunds.find((item) => (
        normalizeFundNameForMatching(item?.name || item?.inputName) === normalizeFundNameForMatching(fund.name)
      ));
      const matchByCnpj = modelFunds.find((item) => (
        normalizeCnpjForMatching(item?.cnpj || item?.inputCnpj) === fund.cnpj
      ));
      const source = matchById || matchByName || matchByCnpj || modelFunds[index] || null;
      const portfolioContext = sanitizeCreditPortfolioContextText(source?.portfolioContext || '');
      contextByFundId.set(fund.id, portfolioContext);
    });

    return {
      contextByFundId,
      usage,
    };
  } catch (error) {
    console.error('Falha ao buscar automaticamente contexto da carteira aberta:', error?.message || error);
    return {
      contextByFundId: new Map(),
      usage: null,
    };
  }
};

const buildCreditGroupSummaryFromItems = (mes, items) => {
  const lines = [];

  (Array.isArray(items) ? items : []).forEach((item) => {
    const fundName = String(item?.normalizedName || item?.inputName || '').trim();
    if (!fundName) return;

    const rawSummarySeed = Array.isArray(item?.summaryLines) && item.summaryLines.length
      ? item.summaryLines
      : (item?.summary || item?.groupSnippet || '');
    const normalizedSummaryLines = normalizeCreditSummaryLines(rawSummarySeed);
    const performanceMesPct = normalizeCreditPercent(item?.performanceMesPct);
    const cdiMesPct = normalizeCreditPercent(item?.cdiMesPct);
    const excessoCdiPct = deriveExcessOverCdi(
      normalizeCreditPercent(item?.excessoCdiPct),
      performanceMesPct,
      cdiMesPct,
    );
    const fatoresAlta = normalizeCreditImpactItems(item?.fatoresAlta);
    const fatoresBaixa = normalizeCreditImpactItems(item?.fatoresBaixa);
    const principalFator = sanitizeCreditSummaryLine(item?.principalFator || '');
    const devedoresMaisImpactaramPositivo = normalizeCreditImpactItems(item?.devedoresMaisImpactaramPositivo);
    const devedoresMaisImpactaramNegativo = normalizeCreditImpactItems(item?.devedoresMaisImpactaramNegativo);
    const ativosMaisSubiram = normalizeCreditImpactItems(item?.ativosMaisSubiram);
    const ativosMenosSubiram = normalizeCreditImpactItems(item?.ativosMenosSubiram);
    const textoDescritivo = sanitizeCreditDescriptiveText(item?.textoDescritivo || '');

    lines.push(`- *${fundName}:*`);
    if (performanceMesPct !== null || cdiMesPct !== null || excessoCdiPct !== null) {
      lines.push(
        `  - Performance mes: ${formatCreditPercent(performanceMesPct)} | CDI mes: ${formatCreditPercent(cdiMesPct)} | Acima do CDI: ${formatCreditPp(excessoCdiPct)}`,
      );
    }
    if (principalFator) {
      lines.push(`  - Fator-chave do mes: ${principalFator}`);
    }
    if (fatoresAlta.length) {
      lines.push(`  - Vetores de alta: ${fatoresAlta.join('; ')}`);
    }
    if (fatoresBaixa.length) {
      lines.push(`  - Vetores de baixa: ${fatoresBaixa.join('; ')}`);
    }
    if (devedoresMaisImpactaramPositivo.length) {
      lines.push(`  - Devedores/emissores que mais contribuíram: ${devedoresMaisImpactaramPositivo.join('; ')}`);
    }
    if (devedoresMaisImpactaramNegativo.length) {
      lines.push(`  - Devedores/emissores que mais pressionaram: ${devedoresMaisImpactaramNegativo.join('; ')}`);
    }
    if (ativosMaisSubiram.length) {
      lines.push(`  - Ativos que mais subiram: ${ativosMaisSubiram.join('; ')}`);
    }
    if (ativosMenosSubiram.length) {
      lines.push(`  - Ativos que menos subiram/caíram: ${ativosMenosSubiram.join('; ')}`);
    }
    if (textoDescritivo) {
      lines.push(`  - Leitura descritiva: ${textoDescritivo}`);
    }

    if (!normalizedSummaryLines.length) {
      lines.push('  - Resumo ainda nao disponivel.');
      return;
    }

    normalizedSummaryLines.forEach((summaryLine) => {
      lines.push(`  - ${summaryLine}`);
    });
  });

  if (!lines.length) return '';
  return [`*resumo dos fundos de credito em ${getCreditMonthName(mes)}:*`, ...lines].join('\n');
};

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
let dashboardCache = {
  timestamp: 0,
  ambiente: '',
  apiKey: '',
  customersMap: {},
  overdueSet: new Set(),
};

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_ROOT_DIR));

// Log de requisições (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Endpoint de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend está funcionando!' });
});
app.post('/api/port-shared-storage/bulk', async (req, res) => {
  try {
    const requestedKeys = Array.isArray(req.body?.keys) ? req.body.keys : [...PORT_SHARED_ALLOWED_KEYS];
    const keys = requestedKeys.filter((key) => typeof key === 'string' && PORT_SHARED_ALLOWED_KEYS.has(key));
    const values = await loadPortSharedStorage();

    return res.json({
      items: buildPortSharedStoragePayload(values, keys),
    });
  } catch (error) {
    console.error('Erro ao carregar armazenamento compartilhado em lote:', error);
    return res.status(500).json({ error: 'Erro ao carregar armazenamento compartilhado.' });
  }
});

app.get('/api/port-shared-storage/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!PORT_SHARED_ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ error: 'Chave de armazenamento nao permitida.' });
    }

    const values = await loadPortSharedStorage();
    return res.json({
      key,
      exists: Object.prototype.hasOwnProperty.call(values, key),
      value: Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
    });
  } catch (error) {
    console.error('Erro ao carregar armazenamento compartilhado:', error);
    return res.status(500).json({ error: 'Erro ao carregar armazenamento compartilhado.' });
  }
});

app.put('/api/port-shared-storage/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!PORT_SHARED_ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ error: 'Chave de armazenamento nao permitida.' });
    }

    const values = await loadPortSharedStorage();
    const previousValue = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    const nextValue = req.body?.value ?? null;

    values[key] = nextValue;
    await persistPortSharedStorage(values);

    try {
      if (JSON.stringify(previousValue) !== JSON.stringify(nextValue)) {
        await persistPortSharedHistoryEntry({
          key,
          action: 'put',
          previousValue,
          nextValue,
        });
      }
    } catch (historyError) {
      console.error('Erro ao salvar historico de armazenamento compartilhado:', historyError);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao salvar armazenamento compartilhado:', error);
    return res.status(500).json({ error: 'Erro ao salvar armazenamento compartilhado.' });
  }
});

app.delete('/api/port-shared-storage/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!PORT_SHARED_ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ error: 'Chave de armazenamento nao permitida.' });
    }

    const values = await loadPortSharedStorage();
    const previousValue = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    delete values[key];
    await persistPortSharedStorage(values);

    try {
      if (previousValue !== null) {
        await persistPortSharedHistoryEntry({
          key,
          action: 'delete',
          previousValue,
          nextValue: null,
        });
      }
    } catch (historyError) {
      console.error('Erro ao salvar historico de armazenamento compartilhado:', historyError);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao remover armazenamento compartilhado:', error);
    return res.status(500).json({ error: 'Erro ao remover armazenamento compartilhado.' });
  }
});

app.get('/api/benchmark/ibov', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query || {};

    if (typeof dataInicio !== 'string' || typeof dataFim !== 'string' || !dataInicio || !dataFim) {
      return res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    }

    const inicio = new Date(`${dataInicio}T00:00:00`);
    const fim = new Date(`${dataFim}T23:59:59`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) {
      return res.status(400).json({ error: 'Periodo invalido para busca do IBOV.' });
    }

    // Margem para cobrir finais de semana/feriados do mercado.
    const period1 = Math.floor((inicio.getTime() - 5 * 24 * 60 * 60 * 1000) / 1000);
    const period2 = Math.floor((fim.getTime() + 5 * 24 * 60 * 60 * 1000) / 1000);

    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${period1}&period2=${period2}&interval=1d&events=history`;
    const response = await fetch(yahooUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Sistema-Interno/1.0.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Falha ao consultar fonte do IBOV.' });
    }

    const payload = await response.json();
    const serie = payload?.chart?.result?.[0];
    const timestamps = Array.isArray(serie?.timestamp) ? serie.timestamp : [];
    const closes = Array.isArray(serie?.indicators?.quote?.[0]?.close)
      ? serie.indicators.quote[0].close
      : [];

    const pontos = timestamps
      .map((ts, index) => ({
        timestamp: Number(ts) * 1000,
        close: Number(closes[index]),
      }))
      .filter((item) => Number.isFinite(item.timestamp) && Number.isFinite(item.close) && item.close > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (pontos.length < 2) {
      return res.status(404).json({ error: 'Serie do IBOV insuficiente para o periodo informado.' });
    }

    const inicioMs = inicio.getTime();
    const fimMs = fim.getTime();
    const primeiro = pontos.find((item) => item.timestamp >= inicioMs) || pontos[0];
    const ultimo = [...pontos].reverse().find((item) => item.timestamp <= fimMs) || pontos[pontos.length - 1];

    if (!primeiro || !ultimo || primeiro.close <= 0) {
      return res.status(422).json({ error: 'Nao foi possivel calcular a variacao do IBOV.' });
    }

    const variacao = ((ultimo.close - primeiro.close) / primeiro.close) * 100;

    return res.json({
      variacao,
      primeiro: {
        data: new Date(primeiro.timestamp).toISOString().split('T')[0],
        valor: primeiro.close,
      },
      ultimo: {
        data: new Date(ultimo.timestamp).toISOString().split('T')[0],
        valor: ultimo.close,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar IBOV:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar IBOV.' });
  }
});

app.get('/api/relatorios/capas', async (req, res) => {
  try {
    await ensureReportCoverRepositoryReady();
    return res.json({ items: reportCoverItems.map(toPublicReportCoverItem) });
  } catch (error) {
    console.error('❌ Erro ao listar capas:', error);
    return res.status(500).json({ error: 'Erro ao listar capas do repositorio local.' });
  }
});

app.post('/api/relatorios/capas', (req, res, next) => {
  reportCoverUpload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo excede o limite de 10MB.' });
    }

    return res.status(400).json({ error: 'Falha no upload da imagem.' });
  });
}, async (req, res) => {
  try {
    await ensureReportCoverRepositoryReady();

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo nao enviado.' });
    }

    const extension = REPORT_COVER_ALLOWED_MIME[req.file.mimetype];
    if (!extension) {
      return res.status(400).json({ error: 'Formato invalido. Use JPG, PNG ou WEBP.' });
    }

    const id = randomUUID();
    const fileName = `${id}.${extension}`;
    const filePath = join(REPORT_COVER_UPLOAD_DIR, fileName);

    await fs.writeFile(filePath, req.file.buffer);

    const item = {
      id,
      name: req.file.originalname || `capa-${id}.${extension}`,
      url: `/uploads/report-covers/${fileName}`,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      createdAt: new Date().toISOString(),
      adjustment: { ...REPORT_COVER_DEFAULT_ADJUSTMENT },
      fileName,
    };

    reportCoverItems = [item, ...reportCoverItems];
    await persistReportCoverItems();

    return res.status(201).json({ item: toPublicReportCoverItem(item) });
  } catch (error) {
    console.error('❌ Erro ao salvar capa:', error);
    return res.status(500).json({ error: 'Erro ao salvar capa no repositorio local.' });
  }
});

app.patch('/api/relatorios/capas/:id/ajuste', async (req, res) => {
  try {
    await ensureReportCoverRepositoryReady();

    const id = req.params.id;
    const coverIndex = reportCoverItems.findIndex((item) => item.id === id);
    if (coverIndex < 0) {
      return res.status(404).json({ error: 'Capa nao encontrada.' });
    }

    const adjustment = req.body?.adjustment;
    const scale = Number(adjustment?.scale);
    const offsetX = Number(adjustment?.offsetX);
    const offsetY = Number(adjustment?.offsetY);

    if (!Number.isFinite(scale) || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
      return res.status(400).json({ error: 'Ajuste invalido. Envie scale, offsetX e offsetY numericos.' });
    }
    if (scale < 1 || scale > 2.5) {
      return res.status(400).json({ error: 'Ajuste invalido. scale deve ficar entre 1 e 2.5.' });
    }

    const normalized = normalizeReportCoverAdjustment({ scale, offsetX, offsetY });
    reportCoverItems[coverIndex] = {
      ...reportCoverItems[coverIndex],
      adjustment: normalized,
    };

    await persistReportCoverItems();
    return res.json({ item: toPublicReportCoverItem(reportCoverItems[coverIndex]) });
  } catch (error) {
    console.error('❌ Erro ao atualizar ajuste da capa:', error);
    return res.status(500).json({ error: 'Erro ao atualizar ajuste da capa.' });
  }
});

app.delete('/api/relatorios/capas/:id', async (req, res) => {
  try {
    await ensureReportCoverRepositoryReady();

    const id = req.params.id;
    const coverIndex = reportCoverItems.findIndex((item) => item.id === id);
    if (coverIndex < 0) {
      return res.status(404).json({ error: 'Capa nao encontrada.' });
    }

    const [cover] = reportCoverItems.splice(coverIndex, 1);
    const fileName = cover?.fileName || extractFilenameFromUrl(cover?.url);
    const filePath = join(REPORT_COVER_UPLOAD_DIR, fileName);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    await persistReportCoverItems();
    return res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir capa:', error);
    return res.status(500).json({ error: 'Erro ao excluir capa.' });
  }
});

// Endpoint proxy para API do Asaas
app.post('/api/asaas/proxy', async (req, res) => {
  try {
    const { endpoint, method = 'GET', params, body: requestBody } = req.body;
    const apiKey = req.headers['x-asaas-api-key'] || process.env.ASAAS_API_KEY;
    const ambiente = req.headers['x-asaas-ambiente'] || process.env.ASAAS_AMBIENTE || 'production';

    console.log('📥 Requisição recebida:', { endpoint, method, ambiente, hasApiKey: !!apiKey });

    // Validar API Key
    if (!apiKey) {
      console.error('❌ API Key não fornecida');
      return res.status(400).json({ 
        error: 'API Key do Asaas não fornecida. Configure via header X-Asaas-Api-Key ou variável de ambiente ASAAS_API_KEY' 
      });
    }

    // Validar endpoint
    if (!endpoint || typeof endpoint !== 'string') {
      console.error('❌ Endpoint inválido:', endpoint);
      return res.status(400).json({ error: 'Endpoint é obrigatório' });
    }

    // URLs base da API do Asaas
    const baseUrls = {
      sandbox: 'https://sandbox.asaas.com/api/v3',
      production: 'https://api.asaas.com/v3', // URL oficial da API
    };

    const baseUrl = baseUrls[ambiente] || baseUrls.production;
    
    // Construir URL completa
    let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    // Adicionar query params se existirem
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    console.log('🌐 Fazendo requisição para:', url);

    // Fazer requisição à API do Asaas
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Sistema-Interno/1.0.0', // Recomendado pela documentação
      },
    };

    // Adicionar body se for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && requestBody) {
      fetchOptions.body = JSON.stringify(requestBody);
    }

    let response;
    try {
      // Usar node-fetch para compatibilidade
      response = await fetch(url, fetchOptions);
    } catch (fetchError) {
      console.error('❌ Erro ao fazer fetch:', fetchError);
      throw new Error(`Erro de conexão: ${fetchError.message}`);
    }

    // Ler resposta
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    console.log(`✅ Resposta recebida: ${response.status} ${response.statusText}`);

    // Retornar status e dados
    res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ Erro no proxy Asaas:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Erro ao fazer requisição à API do Asaas',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoint proxy para API do Assinafy
app.post('/api/assinafy/proxy', async (req, res) => {
  try {
    const { endpoint, method = 'GET', params, body: requestBody } = req.body || {};
    const apiKey = req.headers['x-assinafy-api-key'] || process.env.ASSINAFY_API_KEY;
    const ambiente = req.headers['x-assinafy-ambiente'] || process.env.ASSINAFY_AMBIENTE || 'production';

    if (!apiKey) {
      return res.status(400).json({
        error: 'API Key do Assinafy não fornecida. Configure via header X-Assinafy-Api-Key ou variável de ambiente ASSINAFY_API_KEY',
      });
    }

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Endpoint é obrigatório' });
    }

    const baseUrls = {
      sandbox: 'https://api-staging.assinafy.com.br/v1',
      production: 'https://api.assinafy.com.br/v1',
    };

    const baseUrl = baseUrls[ambiente] || baseUrls.production;

    let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Sistema-Interno/1.0.0',
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && requestBody) {
      fetchOptions.body = JSON.stringify(requestBody);
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type');
    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ Erro no proxy Assinafy:', error);
    return res.status(500).json({
      error: 'Erro ao fazer requisição à API do Assinafy',
      message: error.message,
    });
  }
});

// Endpoint upload de documento para Assinafy
app.post('/api/assinafy/upload', assinafyUpload.single('file'), async (req, res) => {
  try {
    const apiKey = req.headers['x-assinafy-api-key'] || process.env.ASSINAFY_API_KEY;
    const ambiente = req.headers['x-assinafy-ambiente'] || process.env.ASSINAFY_AMBIENTE || 'production';
    const accountId = req.body?.accountId;

    if (!apiKey) {
      return res.status(400).json({
        error: 'API Key do Assinafy não fornecida. Configure via header X-Assinafy-Api-Key ou variável de ambiente ASSINAFY_API_KEY',
      });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'Workspace Account ID é obrigatório.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado.' });
    }

    const baseUrls = {
      sandbox: 'https://api-staging.assinafy.com.br/v1',
      production: 'https://api.assinafy.com.br/v1',
    };

    const baseUrl = baseUrls[ambiente] || baseUrls.production;
    const url = `${baseUrl}/accounts/${accountId}/documents`;

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);
    if (req.body?.name) {
      formData.append('name', req.body.name);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'User-Agent': 'Sistema-Interno/1.0.0',
      },
      body: formData,
    });

    const contentType = response.headers.get('content-type');
    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ Erro no upload Assinafy:', error);
    return res.status(500).json({
      error: 'Erro ao enviar documento para o Assinafy',
      message: error.message,
    });
  }
});

// Endpoint de resumo para o Dashboard (contatos + inadimplência)
app.post('/api/credito/resumos', async (req, res) => {
  try {
    const { mes, ano, fundos, onlyValidation = false } = req.body || {};

    const mesNumero = Number(mes);
    const anoNumero = Number(ano);
    if (!Number.isInteger(mesNumero) || mesNumero < 1 || mesNumero > 12) {
      return res.status(400).json({ error: 'Mes invalido. Informe valor entre 1 e 12.' });
    }
    if (!Number.isInteger(anoNumero) || anoNumero < 2000 || anoNumero > 2100) {
      return res.status(400).json({ error: 'Ano invalido.' });
    }

    if (!Array.isArray(fundos) || !fundos.length) {
      return res.status(400).json({ error: 'Informe ao menos um fundo para processar.' });
    }
    if (fundos.length > CREDIT_MAX_FUNDS_PER_REQUEST) {
      return res.status(400).json({
        error: `Limite excedido. Envie no maximo ${CREDIT_MAX_FUNDS_PER_REQUEST} fundos por requisicao.`,
      });
    }

    const fundosNormalizados = fundos
      .map((item, index) => ({
        id: typeof item?.id === 'string' && item.id ? item.id : `fund_${index + 1}`,
        name: typeof item?.name === 'string' ? item.name.trim() : '',
        cnpj: normalizeCnpjForMatching(item?.cnpj),
        portfolioContext: '',
      }))
      .filter((item) => item.name && item.cnpj.length === 14);

    if (!fundosNormalizados.length) {
      return res.status(400).json({ error: 'Nenhum fundo valido foi informado. Envie nome e CNPJ (14 digitos).' });
    }

    const apiKey = asSingleHeaderString(req.headers['x-gpt-api-key']) || process.env.GPT_API_KEY || '';
    const baseUrlRaw =
      asSingleHeaderString(req.headers['x-gpt-base-url']) ||
      process.env.GPT_API_BASE_URL ||
      CREDIT_GPT_DEFAULT_BASE_URL;
    const model =
      asSingleHeaderString(req.headers['x-gpt-model']) ||
      process.env.GPT_MODEL ||
      CREDIT_GPT_DEFAULT_MODEL;

    if (!apiKey) {
      return res.status(400).json({
        error: 'API Key GPT nao fornecida. Configure via header X-Gpt-Api-Key ou variavel GPT_API_KEY.',
      });
    }

    let autoPortfolioContextByFundId = new Map();
    let autoContextUsage = null;
    if (!onlyValidation) {
      const autoContextResult = await buildAutoCreditPortfolioContextByFund({
        mesNumero,
        anoNumero,
        fundos: fundosNormalizados,
        apiKey,
        baseUrlRaw,
        model,
      });
      autoPortfolioContextByFundId = autoContextResult.contextByFundId;
      autoContextUsage = autoContextResult.usage;
    }

    const fundosComPortfolioContext = fundosNormalizados.map((item) => ({
      ...item,
      portfolioContext: sanitizeCreditPortfolioContextText(
        autoPortfolioContextByFundId.get(item.id) || '',
      ),
    }));

    const requestPayload = {
      model,
      messages: [
        {
          role: 'system',
          content: onlyValidation
            ? [
                'Voce eh um assistente financeiro. Identifique se nome e CNPJ de cada fundo parecem corretos.',
                'Retorne cada fundo com o mesmo campo id recebido no input.',
                'Retorne SOMENTE JSON valido, sem markdown ou texto extra.',
                'Formato obrigatorio:',
                '{"funds":[{"id":"","inputName":"","inputCnpj":"","recognized":true,"normalizedName":"","normalizedCnpj":"","confidence":0.0,"summaryLines":[],"groupSnippet":"","performanceMesPct":null,"cdiMesPct":null,"excessoCdiPct":null,"fatoresAlta":[],"fatoresBaixa":[],"principalFator":"","textoDescritivo":"","devedoresMaisImpactaramPositivo":[],"devedoresMaisImpactaramNegativo":[],"ativosMaisSubiram":[],"ativosMenosSubiram":[]}],"groupSummary":""}',
              ].join(' ')
            : [
                'Voce eh um redator financeiro para comunicacao interna de mesa de credito.',
                'Retorne cada fundo com o mesmo campo id recebido no input.',
                'Para cada fundo, preencha summaryLines com 7 a 10 linhas descritivas e objetivas.',
                'As linhas devem cobrir obrigatoriamente: resultado do mes; fatores microeconomicos (emissores/carteira); fatores microeconomicos (setores/spreads); fatores macroeconomicos (juros/inflacao/atividade/cambio); risco e posicionamento; perspectiva.',
                'Use portfolioContext (enviado automaticamente pelo sistema com base na ultima carteira aberta) como principal fonte para identificar devedores/emissores e ativos que mais contribuíram positiva e negativamente.',
                'Se portfolioContext vier vazio, NAO invente nomes especificos de devedores/ativos: escreva "nao encontrado automaticamente na ultima carteira aberta".',
                'Preencha tambem: performanceMesPct (retorno do mes em %), cdiMesPct (CDI do mes em %), excessoCdiPct (diferenca em pontos percentuais), fatoresAlta (2 a 5 vetores positivos), fatoresBaixa (2 a 5 vetores negativos), principalFator (frase curta do maior driver), textoDescritivo (1 a 2 paragrafos com leitura do mes), devedoresMaisImpactaramPositivo (2 a 5 itens), devedoresMaisImpactaramNegativo (2 a 5 itens), ativosMaisSubiram (2 a 5 itens) e ativosMenosSubiram (2 a 5 itens).',
                'No campo groupSummary, gere um unico TXT para copia e cola com o formato:',
                '*resumo dos fundos de credito em <mes>:*',
                '- *<nome do fundo>:*',
                '  - linha 1',
                '  - linha 2',
                'Mantenha a ordem de fundos recebida.',
                'Retorne SOMENTE JSON valido, sem markdown ou texto extra.',
                'Formato obrigatorio:',
                '{"funds":[{"id":"","inputName":"","inputCnpj":"","recognized":true,"normalizedName":"","normalizedCnpj":"","confidence":0.0,"performanceMesPct":0.0,"cdiMesPct":0.0,"excessoCdiPct":0.0,"fatoresAlta":["..."],"fatoresBaixa":["..."],"principalFator":"...","textoDescritivo":"...","devedoresMaisImpactaramPositivo":["..."],"devedoresMaisImpactaramNegativo":["..."],"ativosMaisSubiram":["..."],"ativosMenosSubiram":["..."],"summaryLines":["Resultado do mes: ...","Micro (emissores/carteira): ...","Micro (setores/spreads): ...","Macro (juros/inflacao): ...","Risco e posicionamento: ...","Perspectiva: ..."],"groupSnippet":"texto curto"}],"groupSummary":"*resumo dos fundos de credito em <mes>:*\\n- *<fundo>:*\\n  - linha 1\\n  - linha 2"}',
              ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            periodo: {
              mes: mesNumero,
              ano: anoNumero,
              mesNome: getCreditMonthName(mesNumero),
            },
            onlyValidation: Boolean(onlyValidation),
            funds: fundosComPortfolioContext.map((item) => ({
              id: item.id,
              name: item.name,
              cnpj: formatCnpjFromDigits(item.cnpj),
              portfolioContext: item.portfolioContext || '',
            })),
          }),
        },
      ],
    };

    if (supportsCustomTemperature(model)) {
      requestPayload.temperature = onlyValidation ? 0 : 0.2;
    }

    const { normalizedContent, usage: mainUsage } = await callCreditChatCompletions({
      apiKey,
      baseUrlRaw,
      requestPayload,
      timeoutMs: CREDIT_MAIN_REQUEST_TIMEOUT_MS,
    });
    const usage = mergeCreditUsages(autoContextUsage, mainUsage);
    const parsedModelPayload = extractJsonFromModelContent(normalizedContent);
    const modelFunds = Array.isArray(parsedModelPayload?.funds) ? parsedModelPayload.funds : [];

    const items = fundosNormalizados.map((inputFund, index) => {
      const matchedById = modelFunds.find((fund) => String(fund?.id || '') === inputFund.id);
      const matchedByCnpj = modelFunds.find(
        (fund) =>
          normalizeCnpjForMatching(fund?.inputCnpj || fund?.normalizedCnpj || fund?.cnpj) === inputFund.cnpj,
      );
      const matchedByName = modelFunds.find(
        (fund) =>
          normalizeFundNameForMatching(fund?.inputName || fund?.normalizedName) ===
          normalizeFundNameForMatching(inputFund.name)
      );
      const fundData = matchedById || matchedByCnpj || matchedByName || modelFunds[index] || null;

      const recognized = Boolean(fundData?.recognized);
      const normalizedName =
        typeof fundData?.normalizedName === 'string' && fundData.normalizedName.trim()
          ? fundData.normalizedName.trim()
          : inputFund.name;
      const normalizedCnpjRaw =
        typeof fundData?.normalizedCnpj === 'string' && fundData.normalizedCnpj.trim()
          ? normalizeCnpjForMatching(fundData.normalizedCnpj)
          : inputFund.cnpj;
      const normalizedCnpj = formatCnpjFromDigits(normalizedCnpjRaw);

      const confidenceRaw = Number(fundData?.confidence);
      const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;
      const performanceMesPct = onlyValidation
        ? null
        : normalizeCreditPercent(
          fundData?.performanceMesPct ??
          fundData?.monthPerformancePct ??
          fundData?.performancePct ??
          fundData?.returnPct,
        );
      const cdiMesPct = onlyValidation
        ? null
        : normalizeCreditPercent(fundData?.cdiMesPct ?? fundData?.cdiPct ?? fundData?.benchmarkCdiPct);
      const excessoCdiPct = onlyValidation
        ? null
        : deriveExcessOverCdi(
          normalizeCreditPercent(
            fundData?.excessoCdiPct ??
            fundData?.excessOverCdiPct ??
            fundData?.alphaVsCdiPct,
          ),
          performanceMesPct,
          cdiMesPct,
        );
      const fatoresAlta = onlyValidation
        ? []
        : normalizeCreditImpactItems(
          fundData?.fatoresAlta ??
          fundData?.driversUp ??
          fundData?.fatoresPositivos,
        );
      const fatoresBaixa = onlyValidation
        ? []
        : normalizeCreditImpactItems(
          fundData?.fatoresBaixa ??
          fundData?.driversDown ??
          fundData?.fatoresNegativos,
        );
      const principalFator = onlyValidation
        ? ''
        : sanitizeCreditSummaryLine(
          fundData?.principalFator ??
          fundData?.keyTakeaway ??
          fundData?.majorDriver ??
          '',
        );
      const textoDescritivo = onlyValidation
        ? ''
        : sanitizeCreditDescriptiveText(
          fundData?.textoDescritivo ??
          fundData?.descriptiveText ??
          fundData?.analiseDescritiva ??
          '',
        );
      const textoDescritivoFinal = onlyValidation
        ? ''
        : (
          textoDescritivo ||
          sanitizeCreditDescriptiveText(
            fundData?.summary ??
            '',
          )
        );
      const devedoresMaisImpactaramPositivo = onlyValidation
        ? []
        : normalizeCreditImpactItems(
          fundData?.devedoresMaisImpactaramPositivo ??
          fundData?.devedoresPositivos ??
          fundData?.topContributorsUp ??
          fundData?.topDebtorsUp,
        );
      const devedoresMaisImpactaramNegativo = onlyValidation
        ? []
        : normalizeCreditImpactItems(
          fundData?.devedoresMaisImpactaramNegativo ??
          fundData?.devedoresNegativos ??
          fundData?.topContributorsDown ??
          fundData?.topDebtorsDown,
        );
      const ativosMaisSubiram = onlyValidation
        ? []
        : normalizeCreditImpactItems(
          fundData?.ativosMaisSubiram ??
          fundData?.topAssetsUp ??
          fundData?.bestPerformers,
        );
      const ativosMenosSubiram = onlyValidation
        ? []
        : normalizeCreditImpactItems(
          fundData?.ativosMenosSubiram ??
          fundData?.topAssetsDown ??
          fundData?.worstPerformers,
        );
      const fallbackSemCarteira = inputFund.portfolioContext
        ? 'nao identificado no contexto automatico da ultima carteira aberta'
        : 'nao encontrado automaticamente na ultima carteira aberta';
      const devedoresMaisImpactaramPositivoFinal = onlyValidation
        ? []
        : (devedoresMaisImpactaramPositivo.length ? devedoresMaisImpactaramPositivo : [fallbackSemCarteira]);
      const devedoresMaisImpactaramNegativoFinal = onlyValidation
        ? []
        : (devedoresMaisImpactaramNegativo.length ? devedoresMaisImpactaramNegativo : [fallbackSemCarteira]);
      const ativosMaisSubiramFinal = onlyValidation
        ? []
        : (ativosMaisSubiram.length ? ativosMaisSubiram : [fallbackSemCarteira]);
      const ativosMenosSubiramFinal = onlyValidation
        ? []
        : (ativosMenosSubiram.length ? ativosMenosSubiram : [fallbackSemCarteira]);
      const rawSummarySource = Array.isArray(fundData?.summaryLines) && fundData.summaryLines.length
        ? fundData.summaryLines
        : (
          typeof fundData?.summary === 'string' && fundData.summary.trim()
            ? fundData.summary
            : (
              typeof fundData?.textoDescritivo === 'string' && fundData.textoDescritivo.trim()
                ? fundData.textoDescritivo
                : fundData?.groupSnippet
            )
        );
      const summaryLines = onlyValidation ? [] : normalizeCreditSummaryLines(rawSummarySource);
      const fallbackSummary =
        typeof fundData?.groupSnippet === 'string' && fundData.groupSnippet.trim()
          ? fundData.groupSnippet.trim()
          : (typeof fundData?.summary === 'string' ? fundData.summary.trim() : '');
      const summary = summaryLines.length ? summaryLines.join('\n') : fallbackSummary;
      const groupSnippet = summaryLines[0] || fallbackSummary;

      return {
        id: inputFund.id,
        inputName: inputFund.name,
        inputCnpj: formatCnpjFromDigits(inputFund.cnpj),
        recognized,
        normalizedName,
        normalizedCnpj,
        confidence,
        summaryLines,
        summary,
        groupSnippet,
        performanceMesPct,
        cdiMesPct,
        excessoCdiPct,
        fatoresAlta: onlyValidation ? [] : (fatoresAlta.length ? fatoresAlta : [fallbackSemCarteira]),
        fatoresBaixa: onlyValidation ? [] : (fatoresBaixa.length ? fatoresBaixa : [fallbackSemCarteira]),
        principalFator,
        textoDescritivo: textoDescritivoFinal,
        devedoresMaisImpactaramPositivo: devedoresMaisImpactaramPositivoFinal,
        devedoresMaisImpactaramNegativo: devedoresMaisImpactaramNegativoFinal,
        ativosMaisSubiram: ativosMaisSubiramFinal,
        ativosMenosSubiram: ativosMenosSubiramFinal,
        portfolioContextUsed: inputFund.portfolioContext || '',
      };
    });

    const groupSummary = onlyValidation ? '' : buildCreditGroupSummaryFromItems(mesNumero, items);

    return res.json({
      items,
      groupSummary,
      model,
      usage,
    });
  } catch (error) {
    const message =
      error?.name === 'AbortError'
        ? 'Tempo limite ao consultar API GPT.'
        : error?.message || 'Falha ao gerar resumo de credito.';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/asaas/dashboard-data', async (req, res) => {
  try {
    const { customerIds } = req.body || {};
    const apiKey = req.headers['x-asaas-api-key'] || process.env.ASAAS_API_KEY;
    const ambiente = req.headers['x-asaas-ambiente'] || process.env.ASAAS_AMBIENTE || 'production';

    if (!apiKey) {
      return res.status(400).json({
        error: 'API Key do Asaas não fornecida. Configure via header X-Asaas-Api-Key ou variável de ambiente ASAAS_API_KEY',
      });
    }

    const baseUrls = {
      sandbox: 'https://sandbox.asaas.com/api/v3',
      production: 'https://api.asaas.com/v3',
    };

    const baseUrl = baseUrls[ambiente] || baseUrls.production;

    const buildUrl = (endpoint, params) => {
      let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      if (params && Object.keys(params).length > 0) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, String(value));
          }
        });
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }
      return url;
    };

    const asaasGet = async (endpoint, params) => {
      const url = buildUrl(endpoint, params);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'Sistema-Interno/1.0.0',
        },
      });

      if (!response.ok) {
        let errorMessage = `Erro na API: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorData.errors?.[0]?.description || errorMessage;
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }

      return response.json();
    };

    const buscarPaginado = async (endpoint, params) => {
      const limit = 100;
      let offset = 0;
      const todos = [];

      while (true) {
        const resposta = await asaasGet(endpoint, { ...params, limit, offset });
        todos.push(...(resposta.data || []));
        if (!resposta.hasMore) break;
        offset += limit;
      }

      return todos;
    };

    const agora = Date.now();
    const cacheValido =
      dashboardCache.timestamp > 0 &&
      agora - dashboardCache.timestamp < DASHBOARD_CACHE_TTL_MS &&
      dashboardCache.apiKey === apiKey &&
      dashboardCache.ambiente === ambiente;

    if (!cacheValido) {
      const clientes = await buscarPaginado('/customers', {});
      const pagamentosVencidos = await buscarPaginado('/payments', { status: 'OVERDUE' });

      const customersMap = {};
      clientes.forEach((cliente) => {
        customersMap[cliente.id] = {
          email: cliente.email,
          telefone: cliente.mobilePhone || cliente.phone,
        };
      });

      const overdueSet = new Set(pagamentosVencidos.map((pagamento) => pagamento.customer));

      dashboardCache = {
        timestamp: agora,
        ambiente,
        apiKey,
        customersMap,
        overdueSet,
      };
    }

    const ids = Array.isArray(customerIds) ? customerIds : Object.keys(dashboardCache.customersMap);
    const contatos = {};
    const status = {};

    ids.forEach((id) => {
      if (dashboardCache.customersMap[id]) {
        contatos[id] = dashboardCache.customersMap[id];
      }
      status[id] = dashboardCache.overdueSet.has(id) ? 'Inad' : 'OK';
    });

    return res.json({
      contatos,
      status,
      cacheAt: dashboardCache.timestamp,
      ttlMs: DASHBOARD_CACHE_TTL_MS,
    });
  } catch (error) {
    console.error('❌ Erro no dashboard-data:', error);
    return res.status(500).json({
      error: 'Erro ao carregar dados do Asaas',
      message: error.message,
    });
  }
});

// Servir arquivos estáticos em produção (se necessário)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

// Iniciar servidor
const startServer = async () => {
  try {
    await initializeReportCoverRepository();
    await ensurePortSharedStorage();
  } catch (error) {
    console.error('Erro ao inicializar repositorio de capas:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Servidor backend rodando na porta ${PORT}`);
    console.log(`Endpoint proxy: http://localhost:${PORT}/api/asaas/proxy`);
    console.log('Configure a API Key do Asaas via variavel de ambiente ASAAS_API_KEY ou header X-Asaas-Api-Key');
  });
};

startServer();

