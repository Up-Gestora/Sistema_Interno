import { savePortSharedStorageValue } from './portSharedStorage';

export interface CreditoGptConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface CreditoFundoInput {
  id: string;
  name: string;
  cnpj: string;
}

export interface CreditoResumoItem {
  id: string;
  inputName: string;
  inputCnpj: string;
  recognized: boolean;
  normalizedName: string;
  normalizedCnpj: string;
  confidence: number;
  summaryLines: string[];
  summary: string;
  groupSnippet: string;
  performanceMesPct: number | null;
  cdiMesPct: number | null;
  excessoCdiPct: number | null;
  fatoresAlta: string[];
  fatoresBaixa: string[];
  principalFator: string;
  textoDescritivo: string;
  devedoresMaisImpactaramPositivo: string[];
  devedoresMaisImpactaramNegativo: string[];
  ativosMaisSubiram: string[];
  ativosMenosSubiram: string[];
  portfolioContextUsed: string;
}

export interface CreditoResumoUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CreditoResumoResponse {
  items: CreditoResumoItem[];
  groupSummary: string;
  model: string;
  usage: CreditoResumoUsage | null;
}

export interface CreditoWorkspaceFundo {
  id: string;
  nome: string;
  cnpj: string;
  selecionado: boolean;
  status: 'nao-validado' | 'confirmado' | 'revisar';
  nomeNormalizado: string;
  confianca: number | null;
  resumoLinhas: string[];
  resumoTexto: string;
  performanceMesPct: number | null;
  cdiMesPct: number | null;
  excessoCdiPct: number | null;
  fatoresAlta: string[];
  fatoresBaixa: string[];
  principalFator: string;
  textoDescritivo: string;
  devedoresMaisImpactaramPositivo: string[];
  devedoresMaisImpactaramNegativo: string[];
  ativosMaisSubiram: string[];
  ativosMenosSubiram: string[];
  carteiraAbertaResumo: string;
}

export interface CreditoWorkspaceSnapshot {
  mes: number;
  ano: number;
  fundos: CreditoWorkspaceFundo[];
  resumoConsolidado: string;
  updatedAt: string;
}

type CreditoResumoRequestPayload = {
  mes: number;
  ano: number;
  fundos: CreditoFundoInput[];
  onlyValidation?: boolean;
};

const CREDITO_GPT_CONFIG_KEY = 'credito_update_gpt_config_v1';
const CREDITO_WORKSPACE_KEY = 'credito_update_workspace_v1';
const DEFAULT_GPT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_GPT_MODEL = 'gpt-5';

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    if (typeof data?.error === 'string' && data.error) {
      return data.error;
    }
    if (typeof data?.message === 'string' && data.message) {
      return data.message;
    }
  } catch {
    // ignore
  }

  return `Falha na requisicao (${response.status})`;
};

export function getCreditoGptDefaultConfig(): CreditoGptConfig {
  return {
    apiKey: '',
    baseUrl: DEFAULT_GPT_BASE_URL,
    model: DEFAULT_GPT_MODEL,
  };
}

export function getCreditoGptConfig(): CreditoGptConfig | null {
  const raw = localStorage.getItem(CREDITO_GPT_CONFIG_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CreditoGptConfig>;
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()
        ? parsed.baseUrl.trim()
        : DEFAULT_GPT_BASE_URL,
      model: typeof parsed.model === 'string' && parsed.model.trim()
        ? parsed.model.trim()
        : DEFAULT_GPT_MODEL,
    };
  } catch {
    return null;
  }
}

export function saveCreditoGptConfig(config: CreditoGptConfig): void {
  const payload: CreditoGptConfig = {
    apiKey: config.apiKey.trim(),
    baseUrl: config.baseUrl.trim() || DEFAULT_GPT_BASE_URL,
    model: config.model.trim() || DEFAULT_GPT_MODEL,
  };

  localStorage.setItem(CREDITO_GPT_CONFIG_KEY, JSON.stringify(payload));
}

export function removeCreditoGptConfig(): void {
  localStorage.removeItem(CREDITO_GPT_CONFIG_KEY);
}

const clampMes = (mes: unknown): number => {
  const parsed = Number(mes);
  if (!Number.isInteger(parsed)) return new Date().getMonth() + 1;
  return Math.max(1, Math.min(12, parsed));
};

const clampAno = (ano: unknown): number => {
  const parsed = Number(ano);
  const anoAtual = new Date().getFullYear();
  if (!Number.isInteger(parsed)) return anoAtual;
  return Math.max(2000, Math.min(2100, parsed));
};

const toTexto = (valor: unknown): string => (typeof valor === 'string' ? valor : '');

const toConfianca = (valor: unknown): number | null => {
  const parsed = Number(valor);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
};

const toPercentual = (valor: unknown): number | null => {
  const parsed = Number(valor);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const toResumoLinhas = (valor: unknown): string[] => {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
};

const toTextoLista = (valor: unknown): string[] => {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

const clampTexto = (valor: unknown, limite = 3000): string => {
  const texto = toTexto(valor).trim();
  if (!texto) return '';
  return texto.slice(0, limite);
};

const toUsage = (valor: unknown): CreditoResumoUsage | null => {
  if (!valor || typeof valor !== 'object') return null;
  const usage = valor as Record<string, unknown>;
  const promptTokens = Math.max(0, Number(usage.promptTokens));
  const completionTokens = Math.max(0, Number(usage.completionTokens));
  const totalTokens = Math.max(0, Number(usage.totalTokens));

  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens) || !Number.isFinite(totalTokens)) {
    return null;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
};

export function getCreditoWorkspaceSnapshot(): CreditoWorkspaceSnapshot | null {
  const raw = localStorage.getItem(CREDITO_WORKSPACE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CreditoWorkspaceSnapshot>;
    const fundos = Array.isArray(parsed.fundos) ? parsed.fundos : [];

    return {
      mes: clampMes(parsed.mes),
      ano: clampAno(parsed.ano),
      fundos: fundos
        .map((item, index) => {
          if (!item || typeof item !== 'object') return null;
          const statusRaw = item.status;
          const status =
            statusRaw === 'confirmado' || statusRaw === 'revisar' || statusRaw === 'nao-validado'
              ? statusRaw
              : 'nao-validado';

          return {
            id: toTexto(item.id) || `workspace_fundo_${index + 1}`,
            nome: toTexto(item.nome),
            cnpj: toTexto(item.cnpj),
            selecionado: typeof item.selecionado === 'boolean' ? item.selecionado : true,
            status,
            nomeNormalizado: toTexto(item.nomeNormalizado),
            confianca: toConfianca(item.confianca),
            resumoLinhas: toResumoLinhas(item.resumoLinhas),
            resumoTexto: toTexto(item.resumoTexto),
            performanceMesPct: toPercentual(item.performanceMesPct),
            cdiMesPct: toPercentual(item.cdiMesPct),
            excessoCdiPct: toPercentual(item.excessoCdiPct),
            fatoresAlta: toTextoLista(item.fatoresAlta),
            fatoresBaixa: toTextoLista(item.fatoresBaixa),
            principalFator: toTexto(item.principalFator),
            textoDescritivo: clampTexto(item.textoDescritivo),
            devedoresMaisImpactaramPositivo: toTextoLista(item.devedoresMaisImpactaramPositivo),
            devedoresMaisImpactaramNegativo: toTextoLista(item.devedoresMaisImpactaramNegativo),
            ativosMaisSubiram: toTextoLista(item.ativosMaisSubiram),
            ativosMenosSubiram: toTextoLista(item.ativosMenosSubiram),
            carteiraAbertaResumo: clampTexto(item.carteiraAbertaResumo),
          };
        })
        .filter((item): item is CreditoWorkspaceFundo => !!item),
      resumoConsolidado: toTexto(parsed.resumoConsolidado),
      updatedAt: toTexto(parsed.updatedAt) || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveCreditoWorkspaceSnapshot(
  snapshot: Omit<CreditoWorkspaceSnapshot, 'updatedAt'>
): Promise<void> {
  const payload: CreditoWorkspaceSnapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };

  await savePortSharedStorageValue(CREDITO_WORKSPACE_KEY, payload);
}

async function solicitarResumoCredito(
  payload: CreditoResumoRequestPayload,
  config: CreditoGptConfig
): Promise<CreditoResumoResponse> {
  const response = await fetch('/api/credito/resumos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Gpt-Api-Key': config.apiKey.trim(),
      'X-Gpt-Base-Url': (config.baseUrl || DEFAULT_GPT_BASE_URL).trim(),
      'X-Gpt-Model': (config.model || DEFAULT_GPT_MODEL).trim(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = await response.json() as Partial<CreditoResumoResponse>;
  return {
    items: Array.isArray(data?.items)
      ? data.items.map((item, index) => ({
        id: toTexto(item?.id) || `fund_${index + 1}`,
        inputName: toTexto(item?.inputName),
        inputCnpj: toTexto(item?.inputCnpj),
        recognized: Boolean(item?.recognized),
        normalizedName: toTexto(item?.normalizedName),
        normalizedCnpj: toTexto(item?.normalizedCnpj),
        confidence: Number.isFinite(Number(item?.confidence)) ? Number(item?.confidence) : 0,
        summaryLines: toResumoLinhas(item?.summaryLines),
        summary: toTexto(item?.summary),
        groupSnippet: toTexto(item?.groupSnippet),
        performanceMesPct: toPercentual(item?.performanceMesPct),
        cdiMesPct: toPercentual(item?.cdiMesPct),
        excessoCdiPct: toPercentual(item?.excessoCdiPct),
        fatoresAlta: toTextoLista(item?.fatoresAlta),
        fatoresBaixa: toTextoLista(item?.fatoresBaixa),
        principalFator: toTexto(item?.principalFator),
        textoDescritivo: clampTexto(item?.textoDescritivo),
        devedoresMaisImpactaramPositivo: toTextoLista(item?.devedoresMaisImpactaramPositivo),
        devedoresMaisImpactaramNegativo: toTextoLista(item?.devedoresMaisImpactaramNegativo),
        ativosMaisSubiram: toTextoLista(item?.ativosMaisSubiram),
        ativosMenosSubiram: toTextoLista(item?.ativosMenosSubiram),
        portfolioContextUsed: clampTexto(item?.portfolioContextUsed),
      }))
      : [],
    groupSummary: typeof data?.groupSummary === 'string' ? data.groupSummary : '',
    model: typeof data?.model === 'string' ? data.model : DEFAULT_GPT_MODEL,
    usage: toUsage(data?.usage),
  };
}

export async function validarFundosCredito(
  mes: number,
  ano: number,
  fundos: CreditoFundoInput[],
  config: CreditoGptConfig
): Promise<CreditoResumoResponse> {
  return solicitarResumoCredito(
    {
      mes,
      ano,
      fundos,
      onlyValidation: true,
    },
    config
  );
}

export async function gerarResumosFundosCredito(
  mes: number,
  ano: number,
  fundos: CreditoFundoInput[],
  config: CreditoGptConfig
): Promise<CreditoResumoResponse> {
  return solicitarResumoCredito(
    {
      mes,
      ano,
      fundos,
      onlyValidation: false,
    },
    config
  );
}
