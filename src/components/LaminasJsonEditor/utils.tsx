import type { ReactNode } from 'react';
import type { EstrategiaDiariaEntry } from '../../services/estrategiaDiariaPlanilhaService';
import { STRATEGY_DATA_KEY, TEMPLATE_PADRAO } from './constants';
import type { DailyMetrics, LaminaChart, LaminaIntro, LaminaTemplate } from './types';

export function normalizarTemplate(dados: LaminaTemplate): LaminaTemplate {
  return {
    ...TEMPLATE_PADRAO,
    ...dados,
    header: { ...TEMPLATE_PADRAO.header, ...dados.header },
    intro: Array.isArray(dados.intro) && dados.intro.length ? dados.intro : TEMPLATE_PADRAO.intro,
    comentarios:
      Array.isArray(dados.comentarios) && dados.comentarios.length ? dados.comentarios : TEMPLATE_PADRAO.comentarios,
    kpis: Array.isArray(dados.kpis) && dados.kpis.length ? dados.kpis : TEMPLATE_PADRAO.kpis,
    chart: {
      ...TEMPLATE_PADRAO.chart,
      ...dados.chart,
      data: Array.isArray(dados.chart?.data) && dados.chart.data.length ? dados.chart.data : TEMPLATE_PADRAO.chart.data,
    },
    resumoMensal:
      Array.isArray(dados.resumoMensal) && dados.resumoMensal.length ? dados.resumoMensal : TEMPLATE_PADRAO.resumoMensal,
    tabelaPerformance: {
      headers: dados.tabelaPerformance?.headers || TEMPLATE_PADRAO.tabelaPerformance.headers,
      rows: dados.tabelaPerformance?.rows || TEMPLATE_PADRAO.tabelaPerformance.rows,
    },
    atribuicao: {
      ...TEMPLATE_PADRAO.atribuicao,
      ...dados.atribuicao,
      itens:
        Array.isArray(dados.atribuicao?.itens) && dados.atribuicao.itens.length
          ? dados.atribuicao.itens
          : TEMPLATE_PADRAO.atribuicao.itens,
    },
    operacional: {
      ...TEMPLATE_PADRAO.operacional,
      ...dados.operacional,
      itens:
        Array.isArray(dados.operacional?.itens) && dados.operacional.itens.length
          ? dados.operacional.itens
          : TEMPLATE_PADRAO.operacional.itens,
    },
    rodape: { ...TEMPLATE_PADRAO.rodape, ...dados.rodape },
  };
}

export const formatPercent = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

export const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${formatPercent(value)}`;

export const formatRatio = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const placeholderRegex = /\{\{\s*([\w.-]+)\s*\}\}|\[([\w.-]+)\]/g;

const aplicarPlaceholders = (texto: string, placeholders: Record<string, string>) => {
  if (typeof texto !== 'string') {
    if (texto === null || texto === undefined) return '';
    return String(texto);
  }
  return texto.replace(placeholderRegex, (match, key1, key2) => {
    const key = key1 || key2;
    if (!key) return match;
    const value = placeholders[key];
    return value === undefined ? match : value;
  });
};

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const formatMesAno = (iso: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const raw = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  const cleaned = raw.replace('.', '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export const loadEntriesMap = (): Record<string, EstrategiaDiariaEntry[]> => {
  const raw = localStorage.getItem(STRATEGY_DATA_KEY) || sessionStorage.getItem(STRATEGY_DATA_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, EstrategiaDiariaEntry[]>;
  } catch {
    return {};
  }
};

export const normalizeEntries = (entries: EstrategiaDiariaEntry[] | unknown) => {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((item): item is EstrategiaDiariaEntry => !!item && typeof item.data === 'string')
    .map((item) => {
    const cdiRate = item.resultadoCdi || 0;
    const fatorCalculado = cdiRate > 0 ? 1 + cdiRate : 0;

    return {
      ...item,
      resultadoCdi: cdiRate,
      resultadoIfix: item.resultadoIfix || 0,
      fatorDiario: fatorCalculado,
    };
    });
};

export const aplicarDadosDiarios = (base: LaminaTemplate, metrics: DailyMetrics): LaminaTemplate => {
  const kpisAtualizados = base.kpis.map((kpi) => {
    const label = normalizeLabel(kpi.label);

    if (label.includes('drawdown')) {
      return { ...kpi, value: formatPercent(metrics.drawdownMaximo * 100) };
    }

    if (label.includes('volatilidade')) {
      return { ...kpi, value: formatPercent(metrics.volatilidadeAnual * 100) };
    }

    if (label.includes('retorno acumulado')) {
      return { ...kpi, value: formatPercent(metrics.resultadoCarteira * 100) };
    }

    if (label.includes('indice de sharpe')) {
      return { ...kpi, value: formatRatio(metrics.sharpe) };
    }

    if (label.includes('alpha') && (label.includes('ifix') || !label.includes('cdi'))) {
      return { ...kpi, value: formatPercent(metrics.alphaIfix * 100) };
    }

    return kpi;
  });

  const placeholders = metrics.placeholders || {};

  const headerAtualizado = {
    ...base.header,
    titulo: aplicarPlaceholders(base.header.titulo, placeholders),
    subtitulo: aplicarPlaceholders(base.header.subtitulo, placeholders),
    periodo: aplicarPlaceholders(base.header.periodo, placeholders),
    destaque: aplicarPlaceholders(base.header.destaque, placeholders),
  };

  const comentariosAtualizados = base.comentarios.map((item) => ({
    ...item,
    texto: aplicarPlaceholders(item.texto, placeholders),
  }));

  const tabelaAtualizada = metrics.tabelaPerformanceRows?.length
    ? { ...base.tabelaPerformance, rows: metrics.tabelaPerformanceRows }
    : base.tabelaPerformance;

  const chartAtualizado = metrics.chartData.length
    ? {
        ...base.chart,
        data: metrics.chartData,
        subtitle: formatSignedPercent(metrics.resultadoCarteira * 100),
      }
    : base.chart;

  return {
    ...base,
    header: headerAtualizado,
    kpis: kpisAtualizados,
    resumoMensal: base.resumoMensal,
    chart: chartAtualizado,
    comentarios: comentariosAtualizados,
    tabelaPerformance: tabelaAtualizada,
  };
};

const benchmarkRegex = /\bIFIX\b/gi;

const substituirBenchmark = (valor: string, benchmark: string) => {
  if (!valor) return valor;
  return valor.replace(benchmarkRegex, benchmark);
};

export const aplicarBenchmarkLabel = (base: LaminaTemplate, benchmark: string): LaminaTemplate => {
  const safeBenchmark = benchmark?.trim();
  if (!safeBenchmark) return base;
  const normalizedBenchmark = safeBenchmark.toUpperCase();
  const replace = (valor: string) => substituirBenchmark(valor, normalizedBenchmark);
  const updateIntro = (item: LaminaIntro) => ({
    ...item,
    texto: replace(item.texto),
    destaques: item.destaques?.map((destaque) => replace(destaque)),
  });

  return {
    ...base,
    header: {
      ...base.header,
      titulo: replace(base.header.titulo),
      subtitulo: replace(base.header.subtitulo),
      periodo: replace(base.header.periodo),
      destaque: replace(base.header.destaque),
    },
    intro: base.intro.map(updateIntro),
    publicoAlvo: replace(base.publicoAlvo),
    kpis: base.kpis.map((kpi) => {
      const labelNormalizado = normalizeLabel(kpi.label);
      const label = replace(kpi.label);
      const value = labelNormalizado.includes('benchmark') ? normalizedBenchmark : replace(kpi.value);
      return { ...kpi, label, value };
    }),
    chart: {
      ...base.chart,
      title: replace(base.chart.title),
      subtitle: replace(base.chart.subtitle),
    },
    resumoMensal: base.resumoMensal.map((item) => ({
      ...item,
      label: replace(item.label),
      value: replace(item.value),
    })),
    tabelaPerformance: {
      ...base.tabelaPerformance,
      headers: base.tabelaPerformance.headers.map(replace),
      rows: base.tabelaPerformance.rows.map((row) => row.map(replace)),
    },
    mesTitulo: replace(base.mesTitulo),
    comentarios: base.comentarios.map(updateIntro),
    atribuicao: {
      ...base.atribuicao,
      title: replace(base.atribuicao.title),
      itens: base.atribuicao.itens.map((item) => ({
        ...item,
        label: replace(item.label),
      })),
    },
    operacional: {
      ...base.operacional,
      titulo: replace(base.operacional.titulo),
      itens: base.operacional.itens.map(replace),
    },
    rodape: {
      ...base.rodape,
      texto: replace(base.rodape.texto),
      codigo: replace(base.rodape.codigo),
      logo: base.rodape.logo,
    },
  };
};

export function renderTextoComDestaques(texto: string, destaques?: string[]) {
  const safeTexto = typeof texto === 'string' ? texto : texto ? String(texto) : '';
  if (!destaques || destaques.length === 0) {
    return safeTexto;
  }

  const lowerTexto = safeTexto.toLowerCase();
  let cursor = 0;
  const nodes: ReactNode[] = [];

  while (cursor < safeTexto.length) {
    let proximoInicio = -1;
    let proximoFim = -1;
    let destaqueAtual = '';

    for (const destaque of destaques) {
      const indice = lowerTexto.indexOf(destaque.toLowerCase(), cursor);
      if (indice !== -1 && (proximoInicio === -1 || indice < proximoInicio)) {
        proximoInicio = indice;
        proximoFim = indice + destaque.length;
        destaqueAtual = safeTexto.slice(indice, indice + destaque.length);
      }
    }

    if (proximoInicio === -1) {
      nodes.push(safeTexto.slice(cursor));
      break;
    }

    if (proximoInicio > cursor) {
      nodes.push(safeTexto.slice(cursor, proximoInicio));
    }

    nodes.push(
      <strong key={`destaque-${cursor}-${proximoInicio}`} className="lamina-highlight">
        {destaqueAtual}
      </strong>
    );

    cursor = proximoFim;
  }

  return nodes;
}





