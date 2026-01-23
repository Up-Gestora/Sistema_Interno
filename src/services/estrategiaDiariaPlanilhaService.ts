// @ts-ignore
import * as XLSX from 'xlsx';

export interface EstrategiaDiariaEntry {
  id: string;
  data: string;
  patrimonio: number;
  resultadoCdi: number;
  resultadoIfix: number;
  fatorDiario: number;
}

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const parseDate = (value: any): string => {
  if (!value) return '';

  if (value instanceof Date && !isNaN(value.getTime())) {
    return formatDate(value);
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
    }
  }

  const texto = String(value).trim();
  if (!texto) return '';

  if (texto.includes('/')) {
    const partes = texto.split('/');
    if (partes.length >= 3) {
      const dia = Number(partes[0]);
      const mes = Number(partes[1]);
      const ano = Number(partes[2].length === 2 ? `20${partes[2]}` : partes[2]);
      if (!Number.isNaN(dia) && !Number.isNaN(mes) && !Number.isNaN(ano)) {
        return `${ano}-${pad2(mes)}-${pad2(dia)}`;
      }
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const parsedDate = new Date(texto);
  if (!Number.isNaN(parsedDate.getTime())) {
    return formatDate(parsedDate);
  }

  return '';
};

const parseNumber = (valor: any): number => {
  if (valor === null || valor === undefined || valor === '' || valor === '-') return 0;
  if (typeof valor === 'number') return Number.isNaN(valor) ? 0 : valor;

  let limpo = String(valor).trim();
  if (!limpo) return 0;

  limpo = limpo.replace(/R\$\s?/gi, '').trim();
  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes('.')) {
    const partes = limpo.split('.');
    if (partes.length > 2) {
      const ultimosDois = partes[partes.length - 1];
      if (ultimosDois.length === 2) {
        const inteiros = partes.slice(0, -1).join('');
        limpo = `${inteiros}.${ultimosDois}`;
      } else {
        limpo = limpo.replace(/\./g, '');
      }
    }
  }

  const resultado = parseFloat(limpo);
  return Number.isNaN(resultado) ? 0 : resultado;
};

const parseCdiRate = (valor: any): number => {
  if (valor === null || valor === undefined || valor === '' || valor === '-') return 0;
  if (typeof valor === 'number') return Number.isNaN(valor) ? 0 : valor;

  const texto = String(valor).trim();
  if (!texto) return 0;

  const isPercent = texto.includes('%');
  const numero = parseNumber(texto.replace(/%/g, ''));
  if (!numero) return 0;

  return isPercent ? numero / 100 : numero;
};

const formatDatePtBr = (data: string) => {
  if (!data) return '';
  const [ano, mes, dia] = data.split('-');
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
};

const getHeaderMap = (headers: string[]) => {
  const normalized = headers.map((h) => normalizeHeader(String(h || '')));
  const map: Record<string, number> = {};

  const findHeader = (candidates: string[]) => {
    const idx = normalized.findIndex((item) => candidates.includes(item));
    return idx;
  };

  const diaIdx = findHeader([
    'dia util',
    'dia util da estrategia',
    'dia util da estrategia',
    'dia útil',
    'data',
    'data util',
    'data útil',
  ]);
  const patrimonioIdx = findHeader([
    'cota',
    'valor da cota',
    'cota da estrategia',
    'cota da estratégia',
    'patrimonio liquido',
    'patrimonio liquido da estrategia',
    'patrimonio',
    'patrimonio liquido estrategia',
    'pl',
  ]);
  const cdiIdx = findHeader([
    'resultado cdi',
    'cdi',
    'cdi (fator)',
    'cdi diario',
    'cdi diário',
    'cdi diario',
    'cdi diario (fator)',
    'fator cdi',
  ]);
  const ifixIdx = findHeader([
    'resultado ifix',
    'ifix',
    'ifix (indice)',
    'ifix indice',
    'indice ifix',
  ]);

  if (diaIdx !== -1) map.dia = diaIdx;
  if (patrimonioIdx !== -1) map.patrimonio = patrimonioIdx;
  if (cdiIdx !== -1) map.cdi = cdiIdx;
  if (ifixIdx !== -1) map.ifix = ifixIdx;

  return map;
};

export function exportarTemplateEstrategiaDiaria(): void {
  const headers = ['Dia Util', 'Valor da Cota', 'CDI Diario', 'IFIX (Indice)'];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Dados Diarios');
  XLSX.writeFile(wb, 'template_estrategia_diaria.xlsx');
}

export function exportarEstrategiaDiariaParaExcel(entries: EstrategiaDiariaEntry[]): void {
  const headers = ['Dia Util', 'Valor da Cota', 'CDI Diario', 'Fator Diario', 'IFIX (Indice)'];
  const linhas = entries.map((item) => [
    formatDatePtBr(item.data),
    item.patrimonio,
    item.resultadoCdi,
    item.fatorDiario || (item.resultadoCdi > 0 ? 1 + item.resultadoCdi : 0),
    item.resultadoIfix,
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...linhas]);
  ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Dados Diarios');
  XLSX.writeFile(wb, `estrategia_diaria_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function importarExcelParaEstrategiaDiaria(
  arquivo: File
): Promise<{ entries: EstrategiaDiariaEntry[]; erros: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const erros: string[] = [];

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true, cellNF: false });
        const primeiraSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[primeiraSheet];

        const dados = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: true,
          dateNF: 'dd/mm/yyyy',
        }) as any[][];

        if (dados.length < 2) {
          reject(new Error('Arquivo Excel vazio ou sem dados'));
          return;
        }

        const cabecalho = dados[0].map((h: any) => String(h || '').trim());
        const headerMap = getHeaderMap(cabecalho);

        if (
          headerMap.dia === undefined ||
          headerMap.patrimonio === undefined ||
          headerMap.ifix === undefined ||
          headerMap.cdi === undefined
        ) {
          reject(
            new Error(
              'Cabeçalho do Excel inválido. Use: Dia Util, Valor da Cota, CDI Diario e IFIX (Indice). A coluna Fator Diario é calculada pelo sistema.'
            )
          );
          return;
        }

        const entriesMap = new Map<string, EstrategiaDiariaEntry>();

        for (let i = 1; i < dados.length; i++) {
          try {
            const linha = dados[i];
            if (!linha || linha.length === 0) continue;

            const linhaVazia = linha.every((cell: any) => !cell || String(cell).trim() === '');
            if (linhaVazia) continue;

            const dataRaw = linha[headerMap.dia];
            const data = parseDate(dataRaw);
            if (!data) {
              erros.push(`Linha ${i + 1}: Dia útil inválido`);
              continue;
            }

            const patrimonio = parseNumber(linha[headerMap.patrimonio]);
            const resultadoCdi = parseCdiRate(linha[headerMap.cdi]);
            const resultadoIfix = parseNumber(linha[headerMap.ifix]);

            entriesMap.set(data, {
              id: `import_${Date.now()}_${i}`,
              data,
              patrimonio,
              resultadoCdi,
              resultadoIfix,
              fatorDiario: resultadoCdi > 0 ? 1 + resultadoCdi : 0,
            });
          } catch (error) {
            erros.push(
              `Linha ${i + 1}: Erro ao processar - ${
                error instanceof Error ? error.message : 'Erro desconhecido'
              }`
            );
          }
        }

        resolve({ entries: Array.from(entriesMap.values()), erros });
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

