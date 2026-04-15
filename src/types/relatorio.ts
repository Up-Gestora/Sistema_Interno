export interface RelatorioMensal {
  id?: string;
  clienteId: string;
  clienteNome?: string;
  mes: number;
  ano: number;
  resumoMacro: string;
  patrimonioTotal: number;
  resultadoMes: number;
  resultadoPercentual?: number; // Percentual do resultado do mês
  resumoTexto: string;
  cdiMensal?: number; // CDI mensal para comparação
  textoAcimaCDI?: string; // Texto quando resultado > CDI
  textoAbaixoCDI?: string; // Texto quando resultado <= CDI
  estrategias?: RelatorioMensalEstrategia[];
  dataGeracao?: string;
}

export interface RelatorioPeriodico {
  id?: string;
  tituloCapa: string;
  mes: number;
  ano: number;
  resumoTexto: string;
  resumoImagens: Array<{ id: string; src: string }>;
  dataGeracao?: string;
}

export interface CamposCompartilhadosProducaoRelatorio {
  mes: number;
  ano: number;
  resumoMacro: string;
  cdiMensal: string;
  textoAcimaCDI: string;
  textoAbaixoCDI: string;
}

export interface RelatorioMensalEstrategia {
  titulo: string;
  patrimonioTotal: number;
  resultadoMes: number;
  resultadoPercentual?: number;
  resumoTexto?: string;
  resumoImagens?: Array<{ id: string; src: string }>;
}

export interface TemplateRelatorio {
  cliente: string;
  mesAno: string;
  resumoMacro: string;
  patrimonioTotal: string;
  resultadoMes: string;
  resumoTexto: string;
  dataGeracao: string;
}

