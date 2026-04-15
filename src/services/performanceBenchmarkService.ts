import { buscarCDI, buscarIFIX } from './cdiIfixService';

export type BenchmarkTipo = 'CDI' | 'IFIX' | 'IBOV' | 'MANUAL';

async function buscarIBOVViaBackend(
  dataInicio: string,
  dataFim: string
): Promise<number | null> {
  try {
    const params = new URLSearchParams({ dataInicio, dataFim });
    const response = await fetch(`/api/benchmark/ibov?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const variacao = Number(payload?.variacao);
    return Number.isFinite(variacao) ? variacao : null;
  } catch (error) {
    console.error('Erro ao buscar IBOV via backend:', error);
    return null;
  }
}

export async function buscarBenchmarkPorPeriodo(
  tipo: BenchmarkTipo,
  dataInicio: string,
  dataFim: string
): Promise<number | null> {
  if (!dataInicio || !dataFim || tipo === 'MANUAL') {
    return null;
  }

  if (tipo === 'CDI') {
    return buscarCDI(dataInicio, dataFim);
  }

  if (tipo === 'IFIX') {
    return buscarIFIX(dataInicio, dataFim);
  }

  if (tipo === 'IBOV') {
    return buscarIBOVViaBackend(dataInicio, dataFim);
  }

  return null;
}
