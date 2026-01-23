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
  dataGeracao?: string;
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

