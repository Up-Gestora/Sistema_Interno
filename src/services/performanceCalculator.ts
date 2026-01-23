import { DadosPerformance, ResultadoPerformance, PeriodoPerformance, Aporte } from '../types/performance';
import { formatCurrency, formatDate } from '../utils/calculations';

const APORTE_GRANDE_PERCENTUAL = 30; // 30% do patrimônio inicial

export function calcularPerformance(dados: DadosPerformance): ResultadoPerformance {
  const { patrimonioInicial, patrimonioFinal, descontos, aportes, cdi = 0, taxaPerformance = 0.25 } = dados;

  // Ordenar aportes por data
  const aportesOrdenados = [...aportes].sort((a, b) => 
    new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  // Verificar se há aporte grande
  const temAporteGrande = aportesOrdenados.some(aporte => {
    const percentual = (aporte.valor / patrimonioInicial) * 100;
    return percentual >= APORTE_GRANDE_PERCENTUAL;
  });

  let periodosSeparados: PeriodoPerformance[] | undefined;
  let periodoTotal: PeriodoPerformance;

  if (temAporteGrande && aportesOrdenados.length > 0) {
    // Calcular períodos separados
    const primeiroAporteGrande = aportesOrdenados.find(aporte => {
      const percentual = (aporte.valor / patrimonioInicial) * 100;
      return percentual >= APORTE_GRANDE_PERCENTUAL;
    })!;

    const dataAporte = new Date(primeiroAporteGrande.data);
    const dataInicio = new Date(dados.dataInicio);
    const dataFim = new Date(dados.dataFim);

    // Calcular dias até o aporte e após o aporte
    const diasTotal = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24));
    const diasAteAporte = Math.ceil((dataAporte.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24));
    const diasAposAporte = diasTotal - diasAteAporte;

    // Estimar patrimônio no momento do aporte (proporcional)
    const patrimonioAteAporte = patrimonioInicial + 
      ((patrimonioFinal - patrimonioInicial - primeiroAporteGrande.valor) * (diasAteAporte / diasTotal));

    // Período 1: até o aporte
    const rendimentoPeriodo1 = patrimonioAteAporte - patrimonioInicial;
    const rendimentoPercentualPeriodo1 = (rendimentoPeriodo1 / patrimonioInicial) * 100;

    // Período 2: após o aporte
    const patrimonioInicialPeriodo2 = patrimonioAteAporte + primeiroAporteGrande.valor;
    const rendimentoPeriodo2 = patrimonioFinal - patrimonioInicialPeriodo2;
    const rendimentoPercentualPeriodo2 = (rendimentoPeriodo2 / patrimonioInicialPeriodo2) * 100;

    periodosSeparados = [
      {
        periodo: `Até ${formatDate(primeiroAporteGrande.data)}`,
        patrimonioInicial,
        patrimonioFinal: patrimonioAteAporte,
        rendimento: rendimentoPeriodo1,
        rendimentoPercentual: rendimentoPercentualPeriodo1,
      },
      {
        periodo: `Após ${formatDate(primeiroAporteGrande.data)}`,
        patrimonioInicial: patrimonioInicialPeriodo2,
        patrimonioFinal,
        rendimento: rendimentoPeriodo2,
        rendimentoPercentual: rendimentoPercentualPeriodo2,
      },
    ];
  }

  // Calcular período total
  const patrimonioLiquido = patrimonioFinal - descontos;
  const rendimentoTotal = patrimonioLiquido - patrimonioInicial;
  const rendimentoPercentualTotal = (rendimentoTotal / patrimonioInicial) * 100;

  periodoTotal = {
    periodo: 'Período Total',
    patrimonioInicial,
    patrimonioFinal: patrimonioLiquido,
    rendimento: rendimentoTotal,
    rendimentoPercentual: rendimentoPercentualTotal,
  };

  // Calcular rendimento acima do CDI
  const rendimentoAcimaCDI = rendimentoPercentualTotal - cdi;
  const rendimentoAcimaCDIPercentual = rendimentoAcimaCDI;

  // Calcular taxa de performance
  const valorTaxa = rendimentoAcimaCDI > 0 
    ? (rendimentoAcimaCDI / 100) * patrimonioInicial * taxaPerformance
    : 0;

  return {
    clienteNome: dados.clienteNome || 'Cliente',
    periodoTotal,
    periodosSeparados,
    temAporteGrande,
    rendimentoAcimaCDI: rendimentoAcimaCDI / 100,
    rendimentoAcimaCDIPercentual,
    taxaCalculada: taxaPerformance * 100,
    valorTaxa,
    dataInicio: dados.dataInicio,
    dataFim: dados.dataFim,
  };
}

export function calcularPercentualAporte(aporte: Aporte, patrimonioInicial: number): number {
  return (aporte.valor / patrimonioInicial) * 100;
}

