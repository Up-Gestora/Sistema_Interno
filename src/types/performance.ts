export interface Aporte {
  id: string;
  valor: number;
  data: string;
  percentualPatrimonio?: number;
}

export interface DadosPerformance {
  clienteId: string;
  clienteNome?: string;
  patrimonioInicial: number;
  patrimonioFinal: number;
  descontos: number;
  aportes: Aporte[];
  dataInicio: string;
  dataFim: string;
  cdi?: number;
  ifix?: number;
  taxaPerformance?: number; // 20-30%
}

export interface PeriodoPerformance {
  periodo: string;
  patrimonioInicial: number;
  patrimonioFinal: number;
  rendimento: number;
  rendimentoPercentual: number;
}

export interface ResultadoPerformance {
  clienteNome: string;
  periodoTotal: PeriodoPerformance;
  periodosSeparados?: PeriodoPerformance[];
  temAporteGrande: boolean;
  rendimentoAcimaCDI: number;
  rendimentoAcimaCDIPercentual: number;
  taxaCalculada: number;
  valorTaxa: number;
  dataInicio: string;
  dataFim: string;
}

