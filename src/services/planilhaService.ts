// @ts-ignore
import * as XLSX from 'xlsx';
import { Cliente } from '../types';

// Converter número para formato brasileiro (R$ 1.234,56)
function formatarMoeda(valor: number | undefined): string | number {
  if (valor === undefined || valor === null || isNaN(valor)) return '';
  return valor; // Retornar número para Excel formatar
}

// Converter formato brasileiro para número
function parsearMoeda(valor: any): number {
  if (valor === null || valor === undefined || valor === '' || valor === '-') return 0;
  
  // Se já é número, retornar direto
  if (typeof valor === 'number') {
    return isNaN(valor) ? 0 : valor;
  }
  
  const str = String(valor).trim();
  if (!str || str === '-') return 0;
  
  // Remover R$ e espaços
  let limpo = str.replace(/R\$\s?/gi, '').trim();
  
  // Verificar se tem vírgula (formato brasileiro: 1.234,56)
  if (limpo.includes(',')) {
    // Formato brasileiro: remover pontos (separadores de milhar) e substituir vírgula por ponto
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes('.')) {
    // Pode ser formato americano ou brasileiro sem vírgula
    // Se tem mais de um ponto, provavelmente é formato brasileiro sem vírgula decimal
    const partes = limpo.split('.');
    if (partes.length > 2) {
      // Formato brasileiro sem vírgula: 1.234.567 (últimos 2 dígitos são centavos)
      const ultimosDois = partes[partes.length - 1];
      if (ultimosDois.length === 2) {
        const inteiros = partes.slice(0, -1).join('');
        limpo = `${inteiros}.${ultimosDois}`;
      } else {
        // Formato americano: remover pontos de milhar
        limpo = limpo.replace(/\./g, '');
      }
    }
  }
  
  const resultado = parseFloat(limpo);
  return isNaN(resultado) ? 0 : resultado;
}

// Converter percentual para formato brasileiro
function formatarPercentual(valor: number | string | undefined): string | number {
  if (valor === undefined || valor === null) return '';
  if (typeof valor === 'string') return valor; // "FIXO"
  if (isNaN(valor)) return '';
  return valor; // Retornar número para Excel formatar
}

// Converter formato brasileiro de percentual para número
function parsearPercentual(valor: any): number | string {
  if (!valor || valor === '-' || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string' && valor.toUpperCase() === 'FIXO') return 'FIXO';
  
  const str = String(valor);
  // Remove % e converte vírgula para ponto
  const limpo = str.replace(/%/g, '').replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(limpo) || 0;
}

// Exportar template vazio para Excel
export function exportarTemplateExcel(): void {
  const headers = [
    'Status',
    'Cliente',
    'BTG',
    'XP',
    'Avenue',
    'Outros',
    'TX Adm Anual',
    'TX Adm Mensal',
    'Assinatura',
    'PL Total'
  ];

  // Criar workbook
  const wb = XLSX.utils.book_new();
  
  // Criar worksheet apenas com cabeçalhos
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  
  // Definir largura das colunas
  ws['!cols'] = [
    { wch: 12 }, // Status
    { wch: 25 }, // Cliente
    { wch: 15 }, // BTG
    { wch: 15 }, // XP
    { wch: 15 }, // Avenue
    { wch: 15 }, // Outros
    { wch: 15 }, // TX Adm Anual
    { wch: 15 }, // TX Adm Mensal
    { wch: 15 }, // Assinatura
    { wch: 15 }, // PL Total
  ];

  // Adicionar worksheet ao workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

  // Baixar arquivo
  XLSX.writeFile(wb, 'template_clientes.xlsx');
}

// Exportar clientes para Excel
export function exportarClientesParaExcel(clientes: Cliente[]): void {
  const headers = [
    'Status',
    'Cliente',
    'BTG',
    'XP',
    'Avenue',
    'Outros',
    'TX Adm Anual',
    'TX Adm Mensal',
    'Assinatura',
    'PL Total'
  ];

  const linhas = clientes.map(cliente => {
    // Normalizar status
    let status = cliente.status;
    if (status === 'ativo') status = 'ok';
    if (status === 'inativo') status = 'ok';

    // Usar valorTotalContratos se disponível, senão patrimonioTotal
    const plTotal = cliente.valorTotalContratos ?? cliente.patrimonioTotal ?? 0;

    return [
      status,
      cliente.nome,
      formatarMoeda(cliente.btg),
      formatarMoeda(cliente.xp),
      formatarMoeda(cliente.avenue),
      formatarMoeda(cliente.outros),
      formatarPercentual(cliente.taxaAdmAnual),
      formatarPercentual(cliente.taxaAdmMensal),
      formatarMoeda(cliente.assinatura),
      formatarMoeda(plTotal)
    ];
  });

  // Criar workbook
  const wb = XLSX.utils.book_new();
  
  // Criar worksheet com cabeçalhos e dados
  const ws = XLSX.utils.aoa_to_sheet([headers, ...linhas]);
  
  // Definir largura das colunas
  ws['!cols'] = [
    { wch: 12 }, // Status
    { wch: 25 }, // Cliente
    { wch: 15 }, // BTG
    { wch: 15 }, // XP
    { wch: 15 }, // Avenue
    { wch: 15 }, // Outros
    { wch: 15 }, // TX Adm Anual
    { wch: 15 }, // TX Adm Mensal
    { wch: 15 }, // Assinatura
    { wch: 15 }, // PL Total
  ];

  // Adicionar worksheet ao workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

  // Baixar arquivo
  const nomeArquivo = `clientes_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, nomeArquivo);
}

// Importar Excel e converter para clientes
export function importarExcelParaClientes(
  arquivo: File,
  clientesExistentes: Cliente[]
): Promise<{ clientes: Cliente[]; erros: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const erros: string[] = [];
    const clientesAtualizados: Cliente[] = [];
    const clientesNovos: Cliente[] = [];

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false, cellNF: false });
        
        // Ler primeira planilha
        const primeiraSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[primeiraSheet];
        
        // Converter para JSON com header: 1 para manter como array de arrays
        // raw: true para manter valores numéricos quando possível
        const dados = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '', 
          raw: true,
          dateNF: 'dd/mm/yyyy'
        }) as any[][];
        
        if (dados.length < 2) {
          reject(new Error('Arquivo Excel vazio ou sem dados'));
          return;
        }

        // Ler cabeçalho (primeira linha) - normalizar espaços e case
        const cabecalho = dados[0].map((h: any) => String(h || '').trim());
        
        // Validar cabeçalho - mais flexível
        const cabecalhoEsperado = [
          'Status', 'Cliente', 'BTG', 'XP', 'Avenue', 'Outros',
          'TX Adm Anual', 'TX Adm Mensal', 'Assinatura', 'PL Total'
        ];
        
        // Verificar se todos os cabeçalhos esperados estão presentes
        const cabecalhoValido = cabecalhoEsperado.every(h => 
          cabecalho.some(c => c.toLowerCase() === h.toLowerCase())
        );
        
        if (!cabecalhoValido) {
          const cabecalhosEncontrados = cabecalho.join(', ');
          reject(new Error(`Cabeçalho do Excel não está no formato esperado. Encontrado: ${cabecalhosEncontrados}`));
          return;
        }
        
        // Criar mapa de índices normalizado (case-insensitive)
        const indiceMap: Record<string, number> = {};
        cabecalhoEsperado.forEach(esperado => {
          const indice = cabecalho.findIndex(c => c.toLowerCase() === esperado.toLowerCase());
          if (indice !== -1) {
            indiceMap[esperado] = indice;
          }
        });

        // Processar linhas de dados
        for (let i = 1; i < dados.length; i++) {
          try {
            const linha = dados[i];
            
            if (!linha || linha.length === 0) continue;
            
            // Verificar se a linha está vazia (todos os valores vazios)
            const linhaVazia = linha.every((cell: any) => !cell || String(cell).trim() === '');
            if (linhaVazia) continue;
            
            // Criar objeto com os valores usando o mapa de índices
            const valores: Record<string, any> = {};
            Object.keys(indiceMap).forEach(chave => {
              const indice = indiceMap[chave];
              let valor = linha[indice];
              
              // Se o valor é undefined ou null, usar string vazia
              if (valor === undefined || valor === null) {
                valores[chave] = '';
              } else {
                // Se for número, manter como número
                // Se for string, manter como string para parsing posterior
                valores[chave] = valor;
              }
            });
            
            const nomeCliente = String(valores['Cliente'] || '').trim();
            if (!nomeCliente || nomeCliente === '') {
              erros.push(`Linha ${i + 1}: Nome do cliente não informado`);
              continue;
            }

            // Buscar cliente existente ou criar novo
            const clienteExistente = clientesExistentes.find(c => 
              c.nome.toLowerCase() === nomeCliente.toLowerCase()
            );

            if (clienteExistente) {
              // Criar uma cópia do cliente existente para atualizar (evita mutação direta)
              const clienteAtualizado: Cliente = {
                ...clienteExistente,
                status: (valores['Status'] || clienteExistente.status) as any,
              };
              
              const btg = parsearMoeda(valores['BTG']);
              const xp = parsearMoeda(valores['XP']);
              const avenue = parsearMoeda(valores['Avenue']);
              const outros = parsearMoeda(valores['Outros']);
              const plTotal = parsearMoeda(valores['PL Total']);
              
              console.log(`Cliente ${nomeCliente}:`, {
                BTG: { original: valores['BTG'], parseado: btg },
                XP: { original: valores['XP'], parseado: xp },
                Avenue: { original: valores['Avenue'], parseado: avenue },
                Outros: { original: valores['Outros'], parseado: outros },
                PLTotal: { original: valores['PL Total'], parseado: plTotal }
              });
              
              clienteAtualizado.btg = btg;
              clienteAtualizado.xp = xp;
              clienteAtualizado.avenue = avenue;
              clienteAtualizado.outros = outros;
              
              const taxaAnual = parsearPercentual(valores['TX Adm Anual']);
              const taxaMensal = parsearPercentual(valores['TX Adm Mensal']);
              
              clienteAtualizado.taxaAdmAnual = taxaAnual;
              clienteAtualizado.taxaAdmMensal = taxaMensal;
              clienteAtualizado.assinatura = parsearMoeda(valores['Assinatura']);
              
              // PL Total vai para valorTotalContratos
              clienteAtualizado.valorTotalContratos = plTotal;
              clienteAtualizado.patrimonioTotal = plTotal; // Manter também para compatibilidade

              clientesAtualizados.push(clienteAtualizado);
            } else {
              // Criar novo cliente
              const plTotal = parsearMoeda(valores['PL Total']);
              
              const novoCliente: Cliente = {
                id: `novo_${Date.now()}_${i}`,
                nome: nomeCliente,
                email: '',
                telefone: '',
                dataCadastro: new Date().toISOString().split('T')[0],
                status: (valores['Status'] || 'ok') as any,
                btg: parsearMoeda(valores['BTG']),
                xp: parsearMoeda(valores['XP']),
                avenue: parsearMoeda(valores['Avenue']),
                outros: parsearMoeda(valores['Outros']),
                taxaAdmAnual: parsearPercentual(valores['TX Adm Anual']),
                taxaAdmMensal: parsearPercentual(valores['TX Adm Mensal']),
                assinatura: parsearMoeda(valores['Assinatura']),
                // PL Total vai para valorTotalContratos
                valorTotalContratos: plTotal,
                patrimonioTotal: plTotal, // Manter também para compatibilidade
              };

              clientesNovos.push(novoCliente);
            }
          } catch (error) {
            erros.push(`Linha ${i + 1}: Erro ao processar - ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          }
        }

        // Combinar clientes existentes (não atualizados) com atualizados e novos
        const clientesNaoAtualizados = clientesExistentes.filter(c => 
          !clientesAtualizados.some(up => up.id === c.id)
        );

        const todosClientes = [
          ...clientesNaoAtualizados,
          ...clientesAtualizados,
          ...clientesNovos
        ];

        resolve({
          clientes: todosClientes,
          erros
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
