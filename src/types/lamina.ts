export type CampoValor = {
  label: string;
  value: string;
};

export type PerformanceRow = {
  periodo: string;
  tatico: string;
  ifix: string;
  cdi: string;
  alpha: string;
};

export type LaminaCabecalho = {
  nomeCarteira?: string;
  slogan?: string;
  mesReferencia?: string;
  destaque?: string;
  descricao?: string;
  comentarios?: string;
  trackRecord?: string;
};

export type LaminaPlanilhaDados = {
  cabecalho: LaminaCabecalho;
  metricas: CampoValor[];
  resumoMensal: CampoValor[];
  performance: PerformanceRow[];
};

