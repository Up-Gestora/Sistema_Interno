export type LaminaIntro = {
  texto: string;
  destaques?: string[];
};

export type LaminaKpi = {
  label: string;
  value: string;
};

export type LaminaResumo = {
  label: string;
  value: string;
};

export type LaminaTabela = {
  headers: string[];
  rows: string[][];
};

export type LaminaChart = {
  title: string;
  subtitle: string;
  data: Array<{ label: string; tatica: number; ifix: number; cdi: number }>;
};

export type LaminaAtribuicao = {
  title: string;
  itens: Array<{ label: string; value: number; color: string }>;
};

export type LaminaTemplate = {
  header: {
    logo: string;
    titulo: string;
    subtitulo: string;
    periodo: string;
    destaque: string;
  };
  intro: LaminaIntro[];
  publicoAlvo: string;
  kpis: LaminaKpi[];
  chart: LaminaChart;
  resumoMensal: LaminaResumo[];
  tabelaPerformance: LaminaTabela;
  mesTitulo: string;
  comentarios: LaminaIntro[];
  atribuicao: LaminaAtribuicao;
  operacional: {
    titulo: string;
    itens: string[];
  };
  rodape: {
    texto: string;
    codigo: string;
    logo: string;
  };
};

export type LaminaLayoutItem = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LaminaLayoutMap = Record<string, LaminaLayoutItem>;

export type LaminaLogoAssets = {
  topo?: string | null;
  rodape?: string | null;
};

export type LaminaBlockItem = {
  id: string;
  label: string;
};

export type DailyMetrics = {
  drawdownMaximo: number;
  volatilidadeAnual: number;
  sharpe: number;
  resultadoCarteira: number;
  alphaIfix: number;
  chartData: LaminaChart['data'];
  drawdownSeries: Array<{ label: string; drawdown: number }>;
  tabelaPerformanceRows: LaminaTabela['rows'];
  placeholders: Record<string, string>;
  totalDias: number;
};


























