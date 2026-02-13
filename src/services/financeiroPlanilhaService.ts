// @ts-ignore
import * as XLSX from 'xlsx';
import type { Cliente } from '../types';

export type InterManualLancamento = {
  id: string;
  clienteId: string;
  tipo: 'recebimento' | 'pagamento';
  valor: number;
  data: string; // YYYY-MM-DD
  descricao?: string;
};

export type SaidaManualLancamento = {
  id: string;
  recebedor: string;
  valor: number;
  data: string; // YYYY-MM-DD
  descricao?: string;
};

export type FinanceiroImportacaoResultado = {
  interEncontrado: boolean;
  saidasEncontrado: boolean;
  interLancamentos: InterManualLancamento[];
  saidasLancamentos: SaidaManualLancamento[];
  erros: string[];
};

// Mantem em sincronia com src/pages/Asaas/FinanceiroPagamentosPage.tsx
export const RECEBEDORES_SAIDAS = [
  'PIS',
  'COFINS',
  'ISS',
  'Lucro presumido',
  'Profit Ultra',
  'DLL',
  'Email UP',
  'Grupo FIIs',
  'Material de limpeza/escritorio',
  'Limpeza mensal',
  'Temviewer',
  'D4Sign',
  'Trafego pago',
  'Recarga celular',
  'Investimentos',
  'Distribuições',
  'Matheus',
  'Vinicius',
  'Igor',
  'Mário',
  'Cartao',
  'Grana Capital',
  'Contabilidade',
];

const normalizeText = (value: any) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim();

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDateIso = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const parseDate = (value: any): string => {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateIso(value);
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

  if (texto.includes('-')) {
    // Aceita YYYY-MM-DD ou DD-MM-YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
    const partes = texto.split('-').map((p) => p.trim());
    if (partes.length >= 3) {
      const [p1, p2, p3] = partes;
      const n1 = Number(p1);
      const n2 = Number(p2);
      const n3 = Number(p3);
      if (!Number.isNaN(n1) && !Number.isNaN(n2) && !Number.isNaN(n3)) {
        // Se o primeiro "parece" ser o ano, tratar como YYYY-MM-DD
        if (p1.length === 4) return `${p1}-${pad2(n2)}-${pad2(n3)}`;
        // Senão, tratar como DD-MM-YYYY
        if (p3.length === 4) return `${p3}-${pad2(n2)}-${pad2(n1)}`;
      }
    }
  }

  const parsedDate = new Date(texto);
  if (!Number.isNaN(parsedDate.getTime())) {
    return formatDateIso(parsedDate);
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

const hashStringBase36 = (input: string) => {
  // djb2 xor (32-bit)
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const getSheetByName = (workbook: XLSX.WorkBook, nomesPossiveis: string[]) => {
  const sheets = workbook.SheetNames || [];
  const normalizedToReal = new Map<string, string>();
  sheets.forEach((name) => {
    normalizedToReal.set(normalizeText(name).replace(/ /g, ''), name);
  });

  for (const nome of nomesPossiveis) {
    const key = normalizeText(nome).replace(/ /g, '');
    const real = normalizedToReal.get(key);
    if (real) return workbook.Sheets[real];
  }

  return null;
};

const buildHeaderIndexMap = (headers: any[]) => {
  const normalized = headers.map((h) => normalizeText(h));
  const map: Record<string, number> = {};

  const find = (candidates: string[]) => normalized.findIndex((item) => candidates.includes(item));

  const tipoIdx = find(['tipo']);
  const clienteIdx = find(['cliente', 'cliente id', 'clienteid', 'id cliente', 'idcliente']);
  const valorIdx = find(['valor', 'value']);
  const dataIdx = find(['data', 'date']);
  const descricaoIdx = find(['descricao', 'descrição', 'historico', 'histórico', 'desc']);
  const recebedorIdx = find(['recebedor', 'favorecido', 'beneficiario', 'beneficiário']);

  if (tipoIdx !== -1) map.tipo = tipoIdx;
  if (clienteIdx !== -1) map.cliente = clienteIdx;
  if (valorIdx !== -1) map.valor = valorIdx;
  if (dataIdx !== -1) map.data = dataIdx;
  if (descricaoIdx !== -1) map.descricao = descricaoIdx;
  if (recebedorIdx !== -1) map.recebedor = recebedorIdx;

  return map;
};

const parseTipoInter = (value: any): InterManualLancamento['tipo'] | '' => {
  const t = normalizeText(value);
  if (!t) return '';
  if (t === 'recebimento' || t === 'entrada') return 'recebimento';
  if (t === 'pagamento' || t === 'saida' || t === 'saidas') return 'pagamento';
  return '';
};

export function exportarTemplateFinanceiroExcel(): void {
  const wb = XLSX.utils.book_new();

  const interHeaders = ['Tipo', 'Cliente', 'Valor', 'Data', 'Descricao'];
  const wsInter = XLSX.utils.aoa_to_sheet([interHeaders]);
  wsInter['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInter, 'Inter_Lancamentos');

  const saidasHeaders = ['Recebedor', 'Valor', 'Data', 'Descricao'];
  const wsSaidas = XLSX.utils.aoa_to_sheet([saidasHeaders]);
  wsSaidas['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSaidas, 'Saidas_Lancamentos');

  // Aba auxiliar para copiar/colar os recebedores validos (evita erros de digitacao)
  const wsRecebedores = XLSX.utils.aoa_to_sheet([
    ['Recebedores (Saidas)'],
    ...RECEBEDORES_SAIDAS.map((r) => [r]),
  ]);
  wsRecebedores['!cols'] = [{ wch: 34 }];
  XLSX.utils.book_append_sheet(wb, wsRecebedores, 'Recebedores');

  XLSX.writeFile(wb, 'template_financeiro_inter_saidas.xlsx');
}

export function importarExcelParaFinanceiro(
  arquivo: File,
  clientesExistentes: Cliente[]
): Promise<FinanceiroImportacaoResultado> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const erros: string[] = [];

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true, cellNF: false });

        const sheetInter = getSheetByName(workbook, [
          'Inter_Lancamentos',
          'Inter Lancamentos',
          'Inter',
        ]);
        const sheetSaidas = getSheetByName(workbook, [
          'Saidas_Lancamentos',
          'Saidas Lancamentos',
          'Saidas',
          'Saídas_Lancamentos',
          'Saídas Lancamentos',
          'Saídas',
        ]);

        const interEncontrado = !!sheetInter;
        const saidasEncontrado = !!sheetSaidas;
        if (!interEncontrado && !saidasEncontrado) {
          reject(
            new Error(
              'Não encontrei as abas "Inter_Lancamentos" e/ou "Saidas_Lancamentos". Baixe o template e use as abas com esses nomes.'
            )
          );
          return;
        }

        const clientesPorNome = new Map<string, string>();
        const clientesPorId = new Map<string, string>();
        clientesExistentes.forEach((cliente) => {
          clientesPorNome.set(normalizeText(cliente.nome), cliente.id);
          clientesPorId.set(String(cliente.id), cliente.id);
        });

        const recebedorCanonicoPorNorm = new Map<string, string>();
        RECEBEDORES_SAIDAS.forEach((nome) => {
          recebedorCanonicoPorNorm.set(normalizeText(nome), nome);
        });

        const interMap = new Map<string, InterManualLancamento>();
        if (sheetInter) {
          const linhas = XLSX.utils.sheet_to_json(sheetInter, {
            header: 1,
            defval: '',
            raw: true,
            dateNF: 'dd/mm/yyyy',
          }) as any[][];

          if (linhas.length >= 1) {
            const headerMap = buildHeaderIndexMap(linhas[0] || []);
            if (
              headerMap.tipo === undefined ||
              headerMap.cliente === undefined ||
              headerMap.valor === undefined ||
              headerMap.data === undefined
            ) {
              erros.push(
                'Inter_Lancamentos: cabecalho invalido. Use: Tipo, Cliente, Valor, Data, Descricao.'
              );
            } else {
              for (let i = 1; i < linhas.length; i += 1) {
                const linha = linhas[i];
                if (!linha || linha.length === 0) continue;

                const linhaVazia = linha.every((cell: any) => !cell || String(cell).trim() === '');
                if (linhaVazia) continue;

                const tipo = parseTipoInter(linha[headerMap.tipo]);
                if (!tipo) {
                  erros.push(`Inter_Lancamentos linha ${i + 1}: Tipo invalido (use recebimento ou pagamento).`);
                  continue;
                }

                const clienteRaw = String(linha[headerMap.cliente] || '').trim();
                if (!clienteRaw) {
                  erros.push(`Inter_Lancamentos linha ${i + 1}: Cliente nao informado.`);
                  continue;
                }

                const clienteTexto = clienteRaw.startsWith('manual:') ? clienteRaw.replace(/^manual:/i, '') : clienteRaw;
                const clienteId =
                  clientesPorId.get(clienteTexto) ||
                  clientesPorNome.get(normalizeText(clienteTexto));
                if (!clienteId) {
                  erros.push(`Inter_Lancamentos linha ${i + 1}: Cliente nao encontrado (${clienteRaw}).`);
                  continue;
                }

                const valor = parseNumber(linha[headerMap.valor]);
                if (!valor || valor <= 0) {
                  erros.push(`Inter_Lancamentos linha ${i + 1}: Valor invalido.`);
                  continue;
                }

                const dataIso = parseDate(linha[headerMap.data]);
                if (!dataIso) {
                  erros.push(`Inter_Lancamentos linha ${i + 1}: Data invalida.`);
                  continue;
                }

                const descricaoRaw = headerMap.descricao !== undefined ? String(linha[headerMap.descricao] || '').trim() : '';
                const descricao = descricaoRaw ? descricaoRaw : undefined;

                const key = `inter|${tipo}|${clienteId}|${dataIso}|${valor.toFixed(2)}|${normalizeText(descricaoRaw)}`;
                const id = `inter_imp_${hashStringBase36(key)}`;
                if (interMap.has(id)) continue;

                interMap.set(id, {
                  id,
                  clienteId,
                  tipo,
                  valor,
                  data: dataIso,
                  descricao,
                });
              }
            }
          }
        }

        const saidasMap = new Map<string, SaidaManualLancamento>();
        if (sheetSaidas) {
          const linhas = XLSX.utils.sheet_to_json(sheetSaidas, {
            header: 1,
            defval: '',
            raw: true,
            dateNF: 'dd/mm/yyyy',
          }) as any[][];

          if (linhas.length >= 1) {
            const headerMap = buildHeaderIndexMap(linhas[0] || []);
            if (
              headerMap.recebedor === undefined ||
              headerMap.valor === undefined ||
              headerMap.data === undefined
            ) {
              erros.push(
                'Saidas_Lancamentos: cabecalho invalido. Use: Recebedor, Valor, Data, Descricao.'
              );
            } else {
              for (let i = 1; i < linhas.length; i += 1) {
                const linha = linhas[i];
                if (!linha || linha.length === 0) continue;

                const linhaVazia = linha.every((cell: any) => !cell || String(cell).trim() === '');
                if (linhaVazia) continue;

                const recebedorRaw = String(linha[headerMap.recebedor] || '').trim();
                if (!recebedorRaw) {
                  erros.push(`Saidas_Lancamentos linha ${i + 1}: Recebedor nao informado.`);
                  continue;
                }

                const recebedorNorm = normalizeText(recebedorRaw);
                const recebedor = recebedorCanonicoPorNorm.get(recebedorNorm);
                if (!recebedor) {
                  erros.push(
                    `Saidas_Lancamentos linha ${i + 1}: Recebedor invalido (${recebedorRaw}). Use um recebedor da aba "Recebedores".`
                  );
                  continue;
                }

                const valor = parseNumber(linha[headerMap.valor]);
                if (!valor || valor <= 0) {
                  erros.push(`Saidas_Lancamentos linha ${i + 1}: Valor invalido.`);
                  continue;
                }

                const dataIso = parseDate(linha[headerMap.data]);
                if (!dataIso) {
                  erros.push(`Saidas_Lancamentos linha ${i + 1}: Data invalida.`);
                  continue;
                }

                const descricaoRaw = headerMap.descricao !== undefined ? String(linha[headerMap.descricao] || '').trim() : '';
                const descricao = descricaoRaw ? descricaoRaw : undefined;

                const key = `saida|${recebedorNorm}|${dataIso}|${valor.toFixed(2)}|${normalizeText(descricaoRaw)}`;
                const id = `saida_imp_${hashStringBase36(key)}`;
                if (saidasMap.has(id)) continue;

                saidasMap.set(id, {
                  id,
                  recebedor,
                  valor,
                  data: dataIso,
                  descricao,
                });
              }
            }
          }
        }

        resolve({
          interEncontrado,
          saidasEncontrado,
          interLancamentos: Array.from(interMap.values()),
          saidasLancamentos: Array.from(saidasMap.values()),
          erros,
        });
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

