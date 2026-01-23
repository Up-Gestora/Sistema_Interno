// @ts-ignore
import * as XLSX from 'xlsx';
import { CampoValor, LaminaPlanilhaDados, PerformanceRow } from '../types/lamina';

type ResultadoImportacao = {
  dados: LaminaPlanilhaDados;
  erros: string[];
};

const CABECALHO_PADRAO: LaminaPlanilhaDados = {
  cabecalho: {},
  metricas: [],
  resumoMensal: [],
  performance: [],
};

const CHAVES_CABECALHO: Record<string, string[]> = {
  nomeCarteira: ['nome da carteira', 'carteira', 'nome carteira'],
  slogan: ['slogan', 'tagline', 'subtitulo'],
  mesReferencia: ['mes referencia', 'mês referencia', 'mes de referencia', 'mês de referência', 'periodo'],
  destaque: ['destaque', 'destaque principal', 'highlight'],
  descricao: ['descricao', 'descrição', 'texto', 'descricao principal'],
  comentarios: ['comentarios', 'comentário', 'comentarios do gestor'],
  trackRecord: ['track record', 'trackrecord', 'retorno acumulado'],
};

const NORMALIZAR = (valor: any) =>
  String(valor || '')
    .trim()
    .toLowerCase();

function obterSheet(workbook: XLSX.WorkBook, nomesPossiveis: string[]) {
  const nomes = workbook.SheetNames;
  const encontrado = nomes.find((nome) =>
    nomesPossiveis.some((possivel) => NORMALIZAR(possivel) === NORMALIZAR(nome))
  );
  return encontrado ? workbook.Sheets[encontrado] : null;
}

function lerPares(sheet: XLSX.WorkSheet): CampoValor[] {
  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
  if (linhas.length === 0) return [];

  const primeira = linhas[0].map(NORMALIZAR);
  const hasCabecalho = primeira.includes('campo') || primeira.includes('label') || primeira.includes('titulo');
  const inicio = hasCabecalho ? 1 : 0;

  return linhas
    .slice(inicio)
    .map((linha) => ({
      label: String(linha[0] || '').trim(),
      value: String(linha[1] || '').trim(),
    }))
    .filter((item) => item.label);
}

function lerCabecalho(sheet: XLSX.WorkSheet) {
  const linhas = lerPares(sheet);
  const cabecalho: Record<string, string> = {};

  linhas.forEach((linha) => {
    const labelNormalizado = NORMALIZAR(linha.label);
    Object.entries(CHAVES_CABECALHO).forEach(([chave, aliases]) => {
      if (aliases.some((alias) => alias === labelNormalizado)) {
        cabecalho[chave] = linha.value;
      }
    });
  });

  return cabecalho;
}

function lerPerformance(sheet: XLSX.WorkSheet): PerformanceRow[] {
  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
  if (linhas.length === 0) return [];

  const header = linhas[0].map(NORMALIZAR);
  const idxPeriodo = header.findIndex((h) => ['periodo', 'período'].includes(h));
  const idxTatico = header.findIndex((h) => ['tatica', 'tática'].includes(h));
  const idxIfix = header.findIndex((h) => h === 'ifix');
  const idxCdi = header.findIndex((h) => h === 'cdi');
  const idxAlpha = header.findIndex((h) => h === 'alpha');

  if (idxPeriodo === -1 || idxTatico === -1) return [];

  return linhas.slice(1).map((linha) => ({
    periodo: String(linha[idxPeriodo] || '').trim(),
    tatico: String(linha[idxTatico] || '').trim(),
    ifix: String(linha[idxIfix] || '').trim(),
    cdi: String(linha[idxCdi] || '').trim(),
    alpha: String(linha[idxAlpha] || '').trim(),
  })).filter((row) => row.periodo);
}

export function importarPlanilhaLamina(arquivo: File): Promise<ResultadoImportacao> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const erros: string[] = [];

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false, cellNF: false });

        const sheetCabecalho = obterSheet(workbook, ['Lamina', 'Lâmina', 'Cabecalho', 'Cabeçalho']);
        const sheetMetricas = obterSheet(workbook, ['Metricas', 'Métricas', 'Valores']);
        const sheetResumo = obterSheet(workbook, ['Resumo', 'Resumo Mensal', 'ResumoMensal']);
        const sheetPerformance = obterSheet(workbook, ['Performance', 'Tabela Performance']);

        if (!sheetCabecalho) erros.push('Aba "Lamina" (ou "Cabeçalho") não encontrada.');
        if (!sheetMetricas) erros.push('Aba "Metricas" (ou "Valores") não encontrada.');
        if (!sheetResumo) erros.push('Aba "Resumo Mensal" não encontrada.');
        if (!sheetPerformance) erros.push('Aba "Performance" não encontrada.');

        const dados: LaminaPlanilhaDados = {
          ...CABECALHO_PADRAO,
          cabecalho: sheetCabecalho ? lerCabecalho(sheetCabecalho) : {},
          metricas: sheetMetricas ? lerPares(sheetMetricas) : [],
          resumoMensal: sheetResumo ? lerPares(sheetResumo) : [],
          performance: sheetPerformance ? lerPerformance(sheetPerformance) : [],
        };

        resolve({ dados, erros });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsBinaryString(arquivo);
  });
}

