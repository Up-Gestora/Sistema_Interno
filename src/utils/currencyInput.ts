/**
 * Converte string formatada (ex: "1.234,56") para número
 */
export function parseCurrency(value: string): number {
  if (!value || value.trim() === '') return 0;
  
  // Remove R$, espaços e pontos (separadores de milhar)
  const limpo = value
    .replace(/R\$\s?/gi, '')
    .replace(/\./g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Substitui vírgula por ponto para parseFloat
  const numero = parseFloat(limpo.replace(',', '.'));
  
  return isNaN(numero) ? 0 : numero;
}

/**
 * Formata valor enquanto o usuário digita (aceita apenas números e vírgula)
 */
export function formatCurrencyWhileTyping(value: string): string {
  // Remove tudo exceto números e vírgula
  const apenasNumeros = value.replace(/[^\d,]/g, '');
  
  // Se vazio, retorna vazio
  if (!apenasNumeros) return '';
  
  // Se tem vírgula, separa parte inteira e decimal
  if (apenasNumeros.includes(',')) {
    const partes = apenasNumeros.split(',');
    const parteInteira = partes[0].replace(/\D/g, '');
    const parteDecimal = partes[1]?.replace(/\D/g, '').substring(0, 2) || '';
    
    // Formata parte inteira com pontos
    const parteInteiraFormatada = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    return parteDecimal ? `${parteInteiraFormatada},${parteDecimal}` : `${parteInteiraFormatada},`;
  } else {
    // Sem vírgula, apenas formata a parte inteira
    const numeros = apenasNumeros.replace(/\D/g, '');
    return numeros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
}

/**
 * Formata número para string brasileira (ex: "1.234,56")
 */
export function formatCurrencyInput(value: number | undefined | null): string {
  if (value === undefined || value === null || value === 0) return '';
  
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata valor monetário para exibição (ex: "R$ 1.234,56")
 */
export function formatCurrencyDisplay(value: number | undefined | null): string {
  if (value === undefined || value === null || value === 0) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

