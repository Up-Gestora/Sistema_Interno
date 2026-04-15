// @ts-ignore
import * as XLSX from 'xlsx';
import type { Cliente } from '../types';

export interface PlanilhaRelatorioMensalLinha {
  clienteId: string;
  clienteNome: string;
  patrimonioTotal: number;
  resultadoPercentual: number;
  resultadoMes: number;
}

export interface ImportacaoRelatorioMensalResultado {
  linhas: PlanilhaRelatorioMensalLinha[];
  linhasIgnoradas: number;
  erros: string[];
  avisos: string[];
}

type HeaderMap = {
  cliente: number;
  patrimonioTotal: number;
  resultadoPercentual: number;
  resultadoMes: number;
};

const normalizeText = (value: unknown): string => (
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9%$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const isCellEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return false;
  const texto = String(value).trim();
  return !texto || texto === '-';
};

const parseNumber = (value: unknown): number | null => {
  if (isCellEmpty(value)) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  let texto = String(value).trim();
  if (!texto || texto === '-') return null;

  texto = texto
    .replace(/\s/g, '')
    .replace(/R\$\s?/gi, '')
    .replace(/%/g, '');

  const temVirgula = texto.includes(',');
  const temPonto = texto.includes('.');

  if (temVirgula && temPonto) {
    const ultimaVirgula = texto.lastIndexOf(',');
    const ultimoPonto = texto.lastIndexOf('.');

    if (ultimaVirgula > ultimoPonto) {
      texto = texto.replace(/\./g, '').replace(',', '.');
    } else {
      texto = texto.replace(/,/g, '');
    }
  } else if (temVirgula) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (temPonto) {
    const partes = texto.split('.');
    if (partes.length > 2) {
      const decimal = partes.pop() || '';
      texto = `${partes.join('')}.${decimal}`;
    }
  }

  texto = texto.replace(/[^\d.-]/g, '');
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
};

const parsePercent = (value: unknown, hasPercentFormat: boolean): number => {
  const numero = parseNumber(value);
  if (numero === null) return 0;

  if (typeof value === 'number' && hasPercentFormat) {
    return numero * 100;
  }

  return numero;
};

const findHeaderIndex = (
  headers: string[],
  matcher: (normalizedHeader: string) => boolean
): number => headers.findIndex(matcher);

const buildHeaderMap = (rawHeaders: unknown[]): HeaderMap | null => {
  const headers = rawHeaders.map((header) => normalizeText(header));

  const cliente = findHeaderIndex(headers, (header) =>
    header === 'cliente' || (header.includes('nome') && header.includes('cliente'))
  );
  const patrimonioTotal = findHeaderIndex(headers, (header) => (
    (header.includes('patrimonio') && (header.includes('total') || header.includes('pl')))
    || header === 'pl total'
  ));
  const resultadoPercentual = findHeaderIndex(headers, (header) => (
    header.includes('resultado')
    && header.includes('mes')
    && (header.includes('%') || header.includes('percentual') || header.includes('percent'))
  ));
  const resultadoMes = findHeaderIndex(headers, (header) => (
    header.includes('resultado')
    && header.includes('mes')
    && (
      header.includes('r$')
      || header.includes(' em r')
      || header.endsWith(' r')
      || header.includes('valor')
      || header.includes('reais')
    )
  ));

  if (cliente === -1 || patrimonioTotal === -1 || resultadoPercentual === -1 || resultadoMes === -1) {
    return null;
  }

  return {
    cliente,
    patrimonioTotal,
    resultadoPercentual,
    resultadoMes,
  };
};

export function exportarTemplateRelatorioMensal(clientes: Cliente[]): void {
  const headers = ['Cliente', 'Patrimonio Total', 'Resultado no Mes (%)', 'Resultado no Mes (R$)'];
  const linhas = [...clientes]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
    .map((cliente) => [cliente.nome, '', '', '']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...linhas]);
  ws['!cols'] = [
    { wch: 42 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Rebalanceamento');
  XLSX.writeFile(wb, 'template_relatorio_rebalanceamento.xlsx');
}

const hasPercentCellFormat = (worksheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number): boolean => {
  const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = worksheet[cellRef] as XLSX.CellObject | undefined;
  return typeof cell?.z === 'string' && cell.z.includes('%');
};

export function importarPlanilhaRelatorioMensal(
  arquivo: File,
  clientes: Cliente[]
): Promise<ImportacaoRelatorioMensalResultado> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const erros: string[] = [];
    const avisos: string[] = [];
    const linhasPorCliente = new Map<string, PlanilhaRelatorioMensalLinha>();
    let linhasIgnoradas = 0;

    const clientesPorNome = new Map<string, Cliente[]>();
    clientes.forEach((cliente) => {
      const key = normalizeText(cliente.nome);
      const existentes = clientesPorNome.get(key) || [];
      existentes.push(cliente);
      clientesPorNome.set(key, existentes);
    });

    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false, cellNF: false });
        const primeiraSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[primeiraSheet];

        const tabela = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: true,
        }) as unknown[][];

        if (tabela.length < 2) {
          reject(new Error('Planilha vazia ou sem linhas de dados.'));
          return;
        }

        const headerMap = buildHeaderMap(tabela[0] || []);
        if (!headerMap) {
          reject(new Error(
            'Cabecalho invalido. Use: Cliente, Patrimonio Total, Resultado no Mes (%) e Resultado no Mes (R$).'
          ));
          return;
        }

        for (let i = 1; i < tabela.length; i += 1) {
          const linha = tabela[i];
          if (!linha || linha.length === 0) continue;

          const patrimonioRaw = linha[headerMap.patrimonioTotal];
          const percentualRaw = linha[headerMap.resultadoPercentual];
          const resultadoRaw = linha[headerMap.resultadoMes];

          const temDados = (
            !isCellEmpty(patrimonioRaw)
            || !isCellEmpty(percentualRaw)
            || !isCellEmpty(resultadoRaw)
          );

          if (!temDados) {
            linhasIgnoradas += 1;
            continue;
          }

          const nomeRaw = linha[headerMap.cliente];
          const nomePlanilha = String(nomeRaw || '').trim();
          if (!nomePlanilha) {
            erros.push(`Linha ${i + 1}: cliente nao informado.`);
            continue;
          }

          const candidatos = clientesPorNome.get(normalizeText(nomePlanilha)) || [];
          if (candidatos.length === 0) {
            erros.push(`Linha ${i + 1}: cliente "${nomePlanilha}" nao encontrado no cadastro.`);
            continue;
          }
          if (candidatos.length > 1) {
            erros.push(`Linha ${i + 1}: cliente "${nomePlanilha}" esta duplicado no cadastro.`);
            continue;
          }

          const cliente = candidatos[0];
          const patrimonioTotal = parseNumber(patrimonioRaw) ?? 0;
          const resultadoMes = parseNumber(resultadoRaw) ?? 0;
          const percentualFormatado = hasPercentCellFormat(worksheet, i, headerMap.resultadoPercentual);
          const resultadoPercentual = parsePercent(percentualRaw, percentualFormatado);

          if (linhasPorCliente.has(cliente.id)) {
            avisos.push(`Linha ${i + 1}: cliente "${cliente.nome}" repetido. Ultima linha foi mantida.`);
          }

          linhasPorCliente.set(cliente.id, {
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            patrimonioTotal,
            resultadoPercentual,
            resultadoMes,
          });
        }

        resolve({
          linhas: Array.from(linhasPorCliente.values()),
          linhasIgnoradas,
          erros,
          avisos,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Nao foi possivel ler o arquivo Excel.'));
    };

    reader.readAsBinaryString(arquivo);
  });
}
