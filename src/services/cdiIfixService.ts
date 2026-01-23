/**
 * Serviço para buscar CDI e IFIX do Banco Central do Brasil
 * 
 * API do Banco Central: https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados
 * 
 * Códigos:
 * - CDI: 12 (Taxa de juros - CDI)
 * - IFIX: 433 (Índice IFIX)
 */

interface DadoSerie {
  data: string;
  valor: string;
}

interface ResultadoSerie {
  dataInicio: string;
  dataFim: string;
  valorMedio: number;
  valores: Array<{ data: string; valor: number }>;
}

const CDI_CODIGO = 12;
const IFIX_CODIGO = 433;

/**
 * Formata data para formato do Banco Central (dd/MM/yyyy)
 */
function formatarDataBCB(data: string): string {
  const date = new Date(data);
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Busca série histórica do Banco Central
 * 
 * Nota: A API do Banco Central pode ter restrições de CORS.
 * Se isso ocorrer, será necessário usar um proxy ou backend intermediário.
 */
async function buscarSerieBCB(
  codigo: number,
  dataInicio: string,
  dataFim: string
): Promise<ResultadoSerie | null> {
  try {
    const dataInicioFormatada = formatarDataBCB(dataInicio);
    const dataFimFormatada = formatarDataBCB(dataFim);
    
    // API do Banco Central do Brasil
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${dataInicioFormatada}&dataFinal=${dataFimFormatada}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar dados: ${response.status} ${response.statusText}`);
    }
    
    const dados: DadoSerie[] = await response.json();
    
    if (!dados || dados.length === 0) {
      return null;
    }
    
    // Converter valores para número e calcular média
    const valores = dados
      .map(item => ({
        data: item.data,
        valor: parseFloat(item.valor.replace(',', '.')) || 0,
      }))
      .filter(item => !isNaN(item.valor) && item.valor > 0);
    
    if (valores.length === 0) {
      return null;
    }
    
    const soma = valores.reduce((acc, item) => acc + item.valor, 0);
    const valorMedio = soma / valores.length;
    
    return {
      dataInicio,
      dataFim,
      valorMedio,
      valores,
    };
  } catch (error) {
    console.error(`Erro ao buscar série ${codigo}:`, error);
    // Se for erro de CORS, informar ao usuário
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn('Possível problema de CORS. Considere usar um proxy ou backend intermediário.');
    }
    return null;
  }
}

/**
 * Busca CDI para um período
 */
export async function buscarCDI(
  dataInicio: string,
  dataFim: string
): Promise<number | null> {
  const resultado = await buscarSerieBCB(CDI_CODIGO, dataInicio, dataFim);
  
  if (!resultado) {
    return null;
  }
  
  // CDI vem em percentual ao ano, retornar como está
  return resultado.valorMedio;
}

/**
 * Busca IFIX para um período
 */
export async function buscarIFIX(
  dataInicio: string,
  dataFim: string
): Promise<number | null> {
  const resultado = await buscarSerieBCB(IFIX_CODIGO, dataInicio, dataFim);
  
  if (!resultado) {
    return null;
  }
  
  // IFIX vem como índice, calcular variação percentual no período
  if (resultado.valores.length < 2) {
    return null;
  }
  
  const primeiroValor = resultado.valores[0].valor;
  const ultimoValor = resultado.valores[resultado.valores.length - 1].valor;
  
  if (primeiroValor === 0) {
    return null;
  }
  
  // Calcular variação percentual
  const variacao = ((ultimoValor - primeiroValor) / primeiroValor) * 100;
  
  return variacao;
}

/**
 * Busca CDI e IFIX simultaneamente
 */
export async function buscarCDIeIFIX(
  dataInicio: string,
  dataFim: string
): Promise<{ cdi: number | null; ifix: number | null }> {
  const [cdi, ifix] = await Promise.all([
    buscarCDI(dataInicio, dataFim),
    buscarIFIX(dataInicio, dataFim),
  ]);
  
  return { cdi, ifix };
}

