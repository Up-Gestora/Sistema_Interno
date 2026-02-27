import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
// @ts-ignore
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useOutletContext } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../utils/calculations';
import Card from '../../components/Card/Card';
import { FinanceiroOutletContext } from '../AsaasPage';
import { AsaasPagamento } from '../../types/asaas';

type CategoriaSaida = 'impostos' | 'distribuicao' | 'custos';

type RecebedorSaidaCustom = {
  nome: string;
  categoria: CategoriaSaida;
};

type ResumoTabela = {
  meses: string[];
  clientes: { clienteId: string; nome: string; valores: Record<string, number> }[];
  totaisPorMes: Record<string, number>;
  formatarMes: (mesKey: string) => string;
};

const RECEBEDORES_SAIDAS_CUSTOM_KEY = 'financeiro_recebedores_saidas_custom_v1';

const RECEBEDORES_SAIDAS_PADRAO = [
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

const IMPOSTOS_SAIDAS_PADRAO = ['PIS', 'COFINS', 'ISS', 'Lucro presumido'];

const DISTRIBUICAO_LUCROS_SAIDAS_PADRAO = [
  'Distribuições',
  'Igor',
  'Mário',
  'Matheus',
  'Vinicius',
];

export default function FinanceiroPagamentosPage() {
  const [mostrarValorLiquido, setMostrarValorLiquido] = useState(false);
  const [mostrarTodosPagamentos, setMostrarTodosPagamentos] = useState(false);
  const mesesReferencia = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const {
    pagamentos,
    pagamentosFiltrados,
    carregando,
    filtroStatus,
    setFiltroStatus,
    clientesPorAsaasId,
    clientes,
    interLancamentos,
    onAdicionarLancamentoInter,
    onRemoverLancamentoInter,
    saidasLancamentos,
    onAdicionarSaida,
    onRemoverSaida,
    getStatusBadgeClass,
    getStatusLabel,
    maskValue,
  } = useOutletContext<FinanceiroOutletContext>();

  const [interClienteId, setInterClienteId] = useState('');
  const [interValor, setInterValor] = useState('');
  const [interData, setInterData] = useState('');
  const [interDescricao, setInterDescricao] = useState('');
  const [interErro, setInterErro] = useState('');
  const [saidaRecebedor, setSaidaRecebedor] = useState('');
  const [saidaValor, setSaidaValor] = useState('');
  const [saidaData, setSaidaData] = useState('');
  const [saidaDescricao, setSaidaDescricao] = useState('');
  const [saidaErro, setSaidaErro] = useState('');
  const [mostrarNovoGasto, setMostrarNovoGasto] = useState(false);
  const [novoGastoNome, setNovoGastoNome] = useState('');
  const [novoGastoCategoria, setNovoGastoCategoria] = useState<CategoriaSaida>('custos');
  const [novoGastoErro, setNovoGastoErro] = useState('');
  const [recebedoresSaidasCustom, setRecebedoresSaidasCustom] = useState<RecebedorSaidaCustom[]>(() => {
    const saved = localStorage.getItem(RECEBEDORES_SAIDAS_CUSTOM_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item: any) => {
          const nome = typeof item?.nome === 'string' ? item.nome.trim() : '';
          const categoria: CategoriaSaida =
            item?.categoria === 'impostos' || item?.categoria === 'distribuicao' || item?.categoria === 'custos'
              ? item.categoria
              : 'custos';
          if (!nome) return null;
          return { nome, categoria } as RecebedorSaidaCustom;
        })
        .filter(Boolean) as RecebedorSaidaCustom[];
    } catch {
      return [];
    }
  });
  const [mostrarLancamentosManuais, setMostrarLancamentosManuais] = useState(false);
  const [modoPlanilhaSaidas, setModoPlanilhaSaidas] = useState(false);
  const [edicaoSaidas, setEdicaoSaidas] = useState<Record<string, string>>({});
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const COL_WIDTH_CLIENTE = 220;
  const COL_WIDTH_MES = 110;

  const DISTRIBUICAO_LUCROS_LONGA_NORMALIZADA =
    'distribuicao de lucros (soma dos valores distribuidos ao matheus, vinicius, igor e mario abaixo)';

  const normalizarSaida = (nome: string) => {
    const normalizado = nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizado === DISTRIBUICAO_LUCROS_LONGA_NORMALIZADA) {
      return 'distribuicoes';
    }
    return normalizado;
  };

  useEffect(() => {
    localStorage.setItem(RECEBEDORES_SAIDAS_CUSTOM_KEY, JSON.stringify(recebedoresSaidasCustom));
  }, [recebedoresSaidasCustom]);

  const uniquePorNormalizado = (nomes: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    nomes.forEach((nome) => {
      const key = normalizarSaida(nome || '');
      if (!key) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(nome);
    });
    return out;
  };

  const recebedoresSaidas = useMemo(() => {
    return uniquePorNormalizado([
      ...RECEBEDORES_SAIDAS_PADRAO,
      ...recebedoresSaidasCustom.map((item) => item.nome),
    ]);
  }, [recebedoresSaidasCustom]);

  const impostosSaidas = useMemo(() => {
    return uniquePorNormalizado([
      ...IMPOSTOS_SAIDAS_PADRAO,
      ...recebedoresSaidasCustom
        .filter((item) => item.categoria === 'impostos')
        .map((item) => item.nome),
    ]);
  }, [recebedoresSaidasCustom]);

  const distribuicaoLucrosSaidas = useMemo(() => {
    return uniquePorNormalizado([
      ...DISTRIBUICAO_LUCROS_SAIDAS_PADRAO,
      ...recebedoresSaidasCustom
        .filter((item) => item.categoria === 'distribuicao')
        .map((item) => item.nome),
    ]);
  }, [recebedoresSaidasCustom]);

  const impostosSet = useMemo(() => new Set(impostosSaidas.map(normalizarSaida)), [impostosSaidas]);
  const distribuicaoSet = useMemo(
    () => new Set(distribuicaoLucrosSaidas.map(normalizarSaida)),
    [distribuicaoLucrosSaidas]
  );

  const custosGeraisSaidas = useMemo(
    () =>
      recebedoresSaidas.filter(
        (nome) => !impostosSet.has(normalizarSaida(nome)) && !distribuicaoSet.has(normalizarSaida(nome))
      ),
    [recebedoresSaidas, impostosSet, distribuicaoSet]
  );

  const recebedoresSaidasNaoCategorizados = useMemo(() => {
    const knownSet = new Set(recebedoresSaidas.map(normalizarSaida));
    const extras = new Map<string, string>();

    saidasLancamentos.forEach((item) => {
      const key = normalizarSaida(item.recebedor || '');
      if (!key) return;
      if (knownSet.has(key)) return;
      if (!extras.has(key)) extras.set(key, item.recebedor);
    });

    return Array.from(extras.values()).sort((a, b) => a.localeCompare(b));
  }, [saidasLancamentos, recebedoresSaidas]);

  const gruposSaidas = useMemo(
    () => {
      const grupos = [
        { titulo: 'Impostos', itens: impostosSaidas },
        { titulo: 'Distribuição de Lucros', itens: distribuicaoLucrosSaidas },
        { titulo: 'Custos Gerais', itens: custosGeraisSaidas },
      ];

      if (recebedoresSaidasNaoCategorizados.length) {
        grupos.push({ titulo: 'Outros', itens: recebedoresSaidasNaoCategorizados });
      }

      return grupos;
    },
    [impostosSaidas, distribuicaoLucrosSaidas, custosGeraisSaidas, recebedoresSaidasNaoCategorizados]
  );

  const labelCategoriaSaida = (categoria: CategoriaSaida) => {
    if (categoria === 'impostos') return 'Impostos';
    if (categoria === 'distribuicao') return 'Distribuição de Lucros';
    return 'Custos Gerais';
  };

  const removerGastoCustom = (nome: string) => {
    const key = normalizarSaida(nome);
    setRecebedoresSaidasCustom((prev) => prev.filter((item) => normalizarSaida(item.nome) !== key));
  };

  const handleAdicionarGastoCustom = () => {
    const nome = novoGastoNome.trim();
    if (!nome) {
      setNovoGastoErro('Informe o nome do recebedor.');
      return;
    }

    const key = normalizarSaida(nome);
    if (!key) {
      setNovoGastoErro('Informe um nome válido.');
      return;
    }

    const existe = recebedoresSaidas.some((recebedor) => normalizarSaida(recebedor) === key);
    if (existe) {
      setNovoGastoErro('Esse recebedor já existe.');
      return;
    }

    setRecebedoresSaidasCustom((prev) => [...prev, { nome, categoria: novoGastoCategoria }]);
    setNovoGastoNome('');
    setNovoGastoErro('');
    setMostrarNovoGasto(false);
    setSaidaRecebedor(nome);
  };

  const getMesKey = (dateString?: string) => {
    if (!dateString) return null;
    const [dataSemHora] = dateString.split('T');
    if (!dataSemHora || dataSemHora.length < 7) return null;
    return dataSemHora.slice(0, 7);
  };

  const { resumoAssinaturas, resumoOutros, resumoRecebimentos } = useMemo(() => {
    const meses = mesesReferencia;

    const isPagamentoAssinatura = (pagamento: AsaasPagamento) => {
      if (pagamento.subscription) return true;
      const texto = `${pagamento.description || ''} ${pagamento.externalReference || ''}`.toLowerCase();
      return (
        texto.includes('assinatura') ||
        texto.includes('mensalidade') ||
        texto.includes('taxa de administracao') ||
        texto.includes('taxa de administração')
      );
    };

    const statusPagos = new Set(['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED', 'INTER_RECEIVED']);

    const selecionarValor = (pagamento: AsaasPagamento) => {
      if (mostrarValorLiquido) {
        return pagamento.netValue ?? pagamento.value ?? 0;
      }
      return pagamento.value ?? 0;
    };

    const construirResumo = (pagamentosBase: AsaasPagamento[]) => {
      const pagamentosPagos = pagamentosBase.filter((pagamento) => statusPagos.has(pagamento.status));
      const clientesMap = new Map<
        string,
        { clienteId: string; nome: string; valores: Record<string, number> }
      >();

      const normalizarNome = (nome: string) => nome.trim().toLowerCase();
      Object.values(clientesPorAsaasId).forEach((nome) => {
        const nomeKey = normalizarNome(nome || '');
        if (!nomeKey) return;
        if (!clientesMap.has(nomeKey)) {
          clientesMap.set(nomeKey, { clienteId: `nome:${nomeKey}`, nome, valores: {} });
        }
      });

      const desconhecidos = new Map<string, number>();
      let minMesKey: string | null = null;
      let maxMesKey: string | null = null;

      const atualizarRange = (mesKey: string) => {
        if (!minMesKey || mesKey < minMesKey) minMesKey = mesKey;
        if (!maxMesKey || mesKey > maxMesKey) maxMesKey = mesKey;
      };

      pagamentosBase.forEach((pagamento) => {
        const dataReferencia = pagamento.paymentDate || pagamento.clientPaymentDate || pagamento.dueDate || pagamento.dateCreated;
        const mesKey = getMesKey(dataReferencia);
        if (!mesKey) return;
        atualizarRange(mesKey);
      });

      pagamentosPagos.forEach((pagamento) => {
        const dataReferencia = pagamento.paymentDate || pagamento.clientPaymentDate || pagamento.dueDate || pagamento.dateCreated;
        const mesKey = getMesKey(dataReferencia);
        if (!mesKey) return;

        const clienteId = pagamento.customer || 'desconhecido';
        const clienteNome = clientesPorAsaasId[clienteId];
        const valorPago = selecionarValor(pagamento);

        if (!clienteNome) {
          desconhecidos.set(mesKey, (desconhecidos.get(mesKey) || 0) + valorPago);
          return;
        }

        const nomeKey = normalizarNome(clienteNome);
        const atual = clientesMap.get(nomeKey) || { clienteId: `nome:${nomeKey}`, nome: clienteNome, valores: {} };
        atual.valores[mesKey] = (atual.valores[mesKey] || 0) + valorPago;
        clientesMap.set(nomeKey, atual);
      });

      const construirMeses = () => {
        if (!minMesKey || !maxMesKey) return [] as string[];
        const [anoInicio, mesInicio] = minMesKey.split('-').map(Number);
        const [anoFim, mesFim] = maxMesKey.split('-').map(Number);
        if (!anoInicio || !mesInicio || !anoFim || !mesFim) return [];

        const lista: string[] = [];
        let anoAtual = anoInicio;
        let mesAtual = mesInicio;
        while (anoAtual < anoFim || (anoAtual === anoFim && mesAtual <= mesFim)) {
          lista.push(`${anoAtual}-${String(mesAtual).padStart(2, '0')}`);
          mesAtual += 1;
          if (mesAtual > 12) {
            mesAtual = 1;
            anoAtual += 1;
          }
        }
        return lista;
      };

      const mesesOrdenados = construirMeses();
      const clientesOrdenados = Array.from(clientesMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
      const incluirNaoVinculados = desconhecidos.size > 0;
      if (incluirNaoVinculados) {
        const valoresNaoVinculados = mesesOrdenados.reduce<Record<string, number>>((acc, mes) => {
          const valor = desconhecidos.get(mes);
          if (valor) acc[mes] = valor;
          return acc;
        }, {});
        clientesOrdenados.push({
          clienteId: 'nao-vinculado',
          nome: 'Não vinculado',
          valores: valoresNaoVinculados,
        });
      }

      const totaisPorMes = mesesOrdenados.reduce<Record<string, number>>((acc, mes) => {
        const totalClientes = clientesOrdenados.reduce((sum, cliente) => sum + (cliente.valores[mes] || 0), 0);
        const totalDesconhecido = incluirNaoVinculados ? 0 : (desconhecidos.get(mes) || 0);
        acc[mes] = totalClientes + totalDesconhecido;
        return acc;
      }, {});

      const formatarMes = (mesKey: string) => {
        const [ano, mes] = mesKey.split('-');
        const mesIndex = Number(mes) - 1;
        const nomeMes = meses[mesIndex] || mes;
        return `${nomeMes}/${ano.slice(-2)}`;
      };

      return {
        meses: mesesOrdenados,
        clientes: clientesOrdenados,
        totaisPorMes,
        formatarMes,
      };
    };

    const pagamentosAssinatura = pagamentos.filter((pagamento) => isPagamentoAssinatura(pagamento));
    const pagamentosOutros = pagamentos.filter((pagamento) => !isPagamentoAssinatura(pagamento));

    return {
      resumoAssinaturas: construirResumo(pagamentosAssinatura),
      resumoOutros: construirResumo(pagamentosOutros),
      resumoRecebimentos: construirResumo(pagamentos),
    };
  }, [pagamentos, clientesPorAsaasId, mostrarValorLiquido]);

  const rotuloTotal = mostrarValorLiquido ? 'Receita líquida total' : 'Receita bruta total';

  const formatarMesLabel = (mesKey: string) => {
    const [ano, mes] = mesKey.split('-');
    const mesIndex = Number(mes) - 1;
    const nomeMes = mesesReferencia[mesIndex] || mes;
    return `${nomeMes}/${ano.slice(-2)}`;
  };

  const carregarProjetosPrivate = () => {
    if (typeof window === 'undefined') return [] as Array<{
      id: string;
      nome: string;
      entradas: Array<{ valor: number; data: string }>;
      saidas: Array<{ valor: number; data: string }>;
    }>;

    const storageKeys = ['private_projects_v4', 'private_projects_v3', 'private_projects_v2', 'private_projects_v1'];
    const fallbackDate = new Date().toISOString().split('T')[0];

    for (const key of storageKeys) {
      const stored = localStorage.getItem(key);
      if (!stored) continue;

      try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) continue;

        return parsed
          .map((item) => {
            if (typeof item !== 'object' || item === null) return null;

            const projeto = item as {
              id?: unknown;
              nome?: unknown;
              financeiro?: {
                entradas?: Array<{ valor?: unknown; data?: unknown }>;
                saidas?: Array<{ valor?: unknown; data?: unknown }>;
              };
            };

            const nome = typeof projeto.nome === 'string' ? projeto.nome.trim() : '';
            if (!nome) return null;

            const id =
              typeof projeto.id === 'string' && projeto.id.trim()
                ? projeto.id
                : `project:${nome.toLowerCase().replace(/\s+/g, '-')}`;

            const entradasRaw = Array.isArray(projeto.financeiro?.entradas) ? projeto.financeiro?.entradas : [];
            const saidasRaw = Array.isArray(projeto.financeiro?.saidas) ? projeto.financeiro?.saidas : [];

            const entradas = entradasRaw
              .map((entrada) => {
                const valor =
                  typeof entrada?.valor === 'number' ? entrada.valor : Number(entrada?.valor || 0);
                const dataRaw = typeof entrada?.data === 'string' ? entrada.data : '';
                if (!Number.isFinite(valor) || valor <= 0) return null;
                const data = getMesKey(dataRaw) ? dataRaw : fallbackDate;
                return { valor, data };
              })
              .filter((entrada): entrada is { valor: number; data: string } => !!entrada);

            const saidas = saidasRaw
              .map((saida) => {
                const valor = typeof saida?.valor === 'number' ? saida.valor : Number(saida?.valor || 0);
                const dataRaw = typeof saida?.data === 'string' ? saida.data : '';
                if (!Number.isFinite(valor) || valor <= 0) return null;
                const data = getMesKey(dataRaw) ? dataRaw : fallbackDate;
                return { valor, data };
              })
              .filter((saida): saida is { valor: number; data: string } => !!saida);

            return {
              id,
              nome,
              entradas,
              saidas,
            };
          })
          .filter(
            (
              projeto,
            ): projeto is {
              id: string;
              nome: string;
              entradas: Array<{ valor: number; data: string }>;
              saidas: Array<{ valor: number; data: string }>;
            } => !!projeto,
          )
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
      } catch {
        continue;
      }
    }

    return [] as Array<{
      id: string;
      nome: string;
      entradas: Array<{ valor: number; data: string }>;
      saidas: Array<{ valor: number; data: string }>;
    }>;
  };

  const resumoRecebimentosProjetos = useMemo<ResumoTabela>(() => {
    const projetos = carregarProjetosPrivate().map((projeto) => {
      const valores: Record<string, number> = {};
      projeto.entradas.forEach((entrada) => {
        const mesKey = getMesKey(entrada.data);
        if (!mesKey) return;
        valores[mesKey] = (valores[mesKey] || 0) + entrada.valor;
      });
      return {
        clienteId: projeto.id,
        nome: projeto.nome,
        valores,
      };
    });

    const meses = Array.from(
      new Set(
        projetos.flatMap((projeto) =>
          Object.keys(projeto.valores).filter((mes) => typeof mes === 'string' && mes.length === 7),
        ),
      ),
    ).sort();

    const totaisPorMes = meses.reduce<Record<string, number>>((acc, mes) => {
      acc[mes] = projetos.reduce((sum, projeto) => sum + (projeto.valores[mes] || 0), 0);
      return acc;
    }, {});

    return {
      meses,
      clientes: projetos,
      totaisPorMes,
      formatarMes: formatarMesLabel,
    };
  }, [formatarMesLabel]);

  const resumoSaidasVenture = useMemo<ResumoTabela>(() => {
    const vazio: ResumoTabela = {
      meses: [],
      clientes: [],
      totaisPorMes: {},
      formatarMes: formatarMesLabel,
    };

    const projetos = carregarProjetosPrivate().map((projeto) => {
      const valores: Record<string, number> = {};
      projeto.saidas.forEach((saida) => {
        const mesKey = getMesKey(saida.data);
        if (!mesKey) return;
        valores[mesKey] = (valores[mesKey] || 0) + saida.valor;
      });
      return {
        clienteId: projeto.id,
        nome: projeto.nome,
        valores,
      };
    });

    if (projetos.length === 0) return vazio;

    const meses = Array.from(
      new Set(
        projetos.flatMap((projeto) =>
          Object.keys(projeto.valores).filter((mes) => typeof mes === 'string' && mes.length === 7),
        ),
      ),
    ).sort();

    const totaisPorMes = meses.reduce<Record<string, number>>((acc, mes) => {
      acc[mes] = projetos.reduce((sum, projeto) => sum + (projeto.valores[mes] || 0), 0);
      return acc;
    }, {});

    return {
      meses,
      clientes: projetos,
      totaisPorMes,
      formatarMes: formatarMesLabel,
    };
  }, [formatarMesLabel]);

  const mesesGrafico = useMemo(() => {
    const setMeses = new Set([
      ...resumoRecebimentos.meses,
      ...resumoRecebimentosProjetos.meses,
      ...resumoSaidasVenture.meses,
    ]);
    saidasLancamentos.forEach((item) => {
      const mesKey = getMesKey(item.data);
      if (mesKey) setMeses.add(mesKey);
    });
    return Array.from(setMeses).sort();
  }, [resumoRecebimentos.meses, resumoRecebimentosProjetos.meses, resumoSaidasVenture.meses, saidasLancamentos]);

  const dadosGrafico = useMemo(() => {
    const pagamentosPorMes = saidasLancamentos.reduce<Record<string, number>>((acc, item) => {
      const mesKey = getMesKey(item.data);
      if (!mesKey) return acc;
      acc[mesKey] = (acc[mesKey] || 0) + item.valor;
      return acc;
    }, {});

    return mesesGrafico.map((mes) => {
      const administracao = resumoAssinaturas.totaisPorMes[mes] || 0;
      const performance = resumoOutros.totaisPorMes[mes] || 0;
      const venture = resumoRecebimentosProjetos.totaisPorMes[mes] || 0;
      const pagamentos = (pagamentosPorMes[mes] || 0) + (resumoSaidasVenture.totaisPorMes[mes] || 0);

      return {
        mes: formatarMesLabel(mes),
        administracao,
        performance,
        venture,
        pagamentos,
        lucro: administracao + performance + venture - pagamentos,
      };
    });
  }, [
    mesesGrafico,
    resumoAssinaturas.totaisPorMes,
    resumoOutros.totaisPorMes,
    resumoRecebimentosProjetos.totaisPorMes,
    resumoSaidasVenture.totaisPorMes,
    saidasLancamentos,
  ]);

  const clientesPorId = useMemo(() => {
    return clientes.reduce<Record<string, string>>((acc, cliente) => {
      acc[cliente.id] = cliente.nome;
      return acc;
    }, {});
  }, [clientes]);

  useEffect(() => {
    if (interClienteId) return;
    if (clientes.length > 0) {
      setInterClienteId(clientes[0].id);
    }
  }, [clientes, interClienteId]);

  const parseValorMonetario = (valorTexto: string) => {
    if (!valorTexto) return 0;
    const sanitizado = valorTexto.replace(/[^0-9,.-]/g, '').trim();
    if (!sanitizado) return 0;
    const normalizado = sanitizado.includes(',')
      ? sanitizado.replace(/\./g, '').replace(',', '.')
      : sanitizado;
    const valor = Number(normalizado);
    return Number.isFinite(valor) ? valor : 0;
  };

  const formatarValorPlanilha = (valor: number) =>
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor);

  const buildPlanilhaKey = (recebedor: string, mes: string) =>
    `${normalizarSaida(recebedor)}|${mes}`;

  const handleAdicionarInter = () => {
    if (!interClienteId) {
      setInterErro('Selecione um cliente.');
      return;
    }
    const valor = parseValorMonetario(interValor);
    if (!valor || valor <= 0) {
      setInterErro('Informe um valor válido.');
      return;
    }
    if (!interData) {
      setInterErro('Informe a data.');
      return;
    }

    onAdicionarLancamentoInter({
      id: `inter_${Date.now()}`,
      clienteId: interClienteId,
      tipo: 'recebimento',
      valor,
      data: interData,
      descricao: interDescricao.trim() || undefined,
    });

    setInterValor('');
    setInterData('');
    setInterDescricao('');
    setInterErro('');
  };

  const handleAdicionarSaida = () => {
    if (!saidaRecebedor) {
      setSaidaErro('Selecione um recebedor.');
      return;
    }
    const valor = parseValorMonetario(saidaValor);
    if (!valor || valor <= 0) {
      setSaidaErro('Informe um valor valido.');
      return;
    }
    if (!saidaData) {
      setSaidaErro('Informe a data.');
      return;
    }

    onAdicionarSaida({
      id: `saida_${Date.now()}`,
      recebedor: saidaRecebedor,
      valor,
      data: saidaData,
      descricao: saidaDescricao.trim() || undefined,
    });

    setSaidaValor('');
    setSaidaData('');
    setSaidaDescricao('');
    setSaidaErro('');
  };

  const gerarNomeArquivo = (extensao: 'pdf' | 'xlsx') =>
    `financeiro_${new Date().toISOString().split('T')[0]}.${extensao}`;

  const handleExportarExcel = () => {
    setExportandoExcel(true);
    try {
      const mesesExport = mesesResumoComProjetos;
      const mesesLabel = mesesExport.map((mes) => formatarMesLabel(mes));
      const mesesExportProjetos = mesesResumoComProjetos;
      const mesesLabelProjetos = mesesExportProjetos.map((mes) => formatarMesLabel(mes));

      const wb = XLSX.utils.book_new();

      const resumoRecebimentosHeaders = ['Cliente', ...mesesLabel];
      const resumoRecebimentosRows = [
        [
          rotuloTotal,
          ...mesesExport.map((mes) => totaisReceitasConsolidadasPorMes[mes] || 0),
        ],
        [
          'Resultado',
          ...mesesExport.map((mes) => resumoRecebimentos.totaisPorMes[mes] || 0),
        ],
        ...resumoRecebimentos.clientes.map((cliente) => [
          cliente.nome,
          ...mesesExport.map((mes) => cliente.valores[mes] || 0),
        ]),
      ];
      const wsRecebimentos = XLSX.utils.aoa_to_sheet([
        resumoRecebimentosHeaders,
        ...resumoRecebimentosRows,
      ]);
      wsRecebimentos['!cols'] = resumoRecebimentosHeaders.map((header) => ({
        wch: Math.max(12, header.length + 2),
      }));
      XLSX.utils.book_append_sheet(wb, wsRecebimentos, 'Resumo_Recebimentos');

      const resumoProjetosHeaders = ['Projeto', ...mesesLabelProjetos];
      const resumoProjetosRows = [
        [
          'Total Venture',
          ...mesesExportProjetos.map((mes) => resumoRecebimentosProjetos.totaisPorMes[mes] || 0),
        ],
        [
          'Resultado',
          ...mesesExportProjetos.map((mes) => resumoRecebimentosProjetos.totaisPorMes[mes] || 0),
        ],
        ...resumoRecebimentosProjetos.clientes.map((projeto) => [
          projeto.nome,
          ...mesesExportProjetos.map((mes) => projeto.valores[mes] || 0),
        ]),
      ];
      const wsProjetos = XLSX.utils.aoa_to_sheet([resumoProjetosHeaders, ...resumoProjetosRows]);
      wsProjetos['!cols'] = resumoProjetosHeaders.map((header) => ({
        wch: Math.max(12, header.length + 2),
      }));
      XLSX.utils.book_append_sheet(wb, wsProjetos, 'Resumo_Projetos_VC');

      const resumoMensalHeaders = [
        'Mês',
        'Receita Administração',
        'Receita Performance',
        'Receita Venture',
        'Receita Total',
        'Despesa Operacional',
        'Despesa Venture',
        'Despesa Total',
        'Lucro',
      ];
      const resumoMensalRows = mesesExport.map((mes) => {
        const administracao = resumoAssinaturas.totaisPorMes[mes] || 0;
        const performance = resumoOutros.totaisPorMes[mes] || 0;
        const venture = resumoRecebimentosProjetos.totaisPorMes[mes] || 0;
        const receitaTotal = administracao + performance + venture;
        const despesaOperacional = resumoSaidas.totaisPorMes[mes] || 0;
        const despesaVenture = resumoSaidasVenture.totaisPorMes[mes] || 0;
        const despesaTotal = despesaOperacional + despesaVenture;
        const lucro = receitaTotal - despesaTotal;

        return [
          formatarMesLabel(mes),
          administracao,
          performance,
          venture,
          receitaTotal,
          despesaOperacional,
          despesaVenture,
          despesaTotal,
          lucro,
        ];
      });
      const wsResumoMensal = XLSX.utils.aoa_to_sheet([
        resumoMensalHeaders,
        ...resumoMensalRows,
      ]);
      wsResumoMensal['!cols'] = resumoMensalHeaders.map((header) => ({
        wch: Math.max(14, header.length + 2),
      }));
      XLSX.utils.book_append_sheet(wb, wsResumoMensal, 'Resumo_Mensal');

      const resumoSaidasHeaders = ['Grupo', 'Recebedor', ...mesesLabel];
      const resumoSaidasRows: (string | number)[][] = [];
      gruposSaidas.forEach((grupo) => {
        resumoSaidasRows.push([
          grupo.titulo,
          `Total ${grupo.titulo}`,
          ...mesesExport.map((mes) => obterTotalGrupoMes(grupo, mes)),
        ]);
        grupo.itens.forEach((nome) => {
          const item = obterRecebedorSaida(nome);
          resumoSaidasRows.push([
            grupo.titulo,
            item.recebedor,
            ...mesesExport.map((mes) => item.valores[mes] || 0),
          ]);
        });
      });
      if (resumoSaidasVenture.clientes.length > 0) {
        resumoSaidasRows.push([
          'Saidas Projetos Venture',
          'Total Saidas Projetos Venture',
          ...mesesExport.map((mes) => resumoSaidasVenture.totaisPorMes[mes] || 0),
        ]);
        resumoSaidasVenture.clientes.forEach((projeto) => {
          resumoSaidasRows.push([
            'Saidas Projetos Venture',
            projeto.nome,
            ...mesesExport.map((mes) => projeto.valores[mes] || 0),
          ]);
        });
      }
      const wsSaidas = XLSX.utils.aoa_to_sheet([resumoSaidasHeaders, ...resumoSaidasRows]);
      wsSaidas['!cols'] = resumoSaidasHeaders.map((header) => ({
        wch: Math.max(12, header.length + 2),
      }));
      XLSX.utils.book_append_sheet(wb, wsSaidas, 'Resumo_Saidas');

      const pagamentosHeaders = [
        'Cliente',
        'Mês Referência',
        'Descricao',
        'Valor',
        'Valor Liquido',
        'Vencimento',
        'Pagamento',
        'Status',
        'Tipo',
      ];
      const pagamentosExport = [...pagamentos].sort((a, b) => {
        const dataA = getDataReferencia(a);
        const dataB = getDataReferencia(b);
        const timeA = dataA ? new Date(dataA).getTime() : 0;
        const timeB = dataB ? new Date(dataB).getTime() : 0;
        return timeB - timeA;
      });
      const pagamentosRows = pagamentosExport.map((pagamento) => {
        const clienteNome = clientesPorAsaasId[pagamento.customer] || pagamento.customer || '-';
        const dataPagamento =
          pagamento.paymentDate || pagamento.clientPaymentDate || '';
        const mesReferencia = getMesKey(getDataReferencia(pagamento)) || '';
        return [
          clienteNome,
          mesReferencia,
          pagamento.description || '',
          pagamento.value ?? 0,
          pagamento.netValue ?? '',
          pagamento.dueDate ? formatDate(pagamento.dueDate) : '',
          dataPagamento ? formatDate(dataPagamento) : '',
          getStatusLabel(pagamento.status),
          pagamento.billingType || '',
        ];
      });
      const wsPagamentos = XLSX.utils.aoa_to_sheet([pagamentosHeaders, ...pagamentosRows]);
      wsPagamentos['!cols'] = pagamentosHeaders.map((header, index) => ({
        wch: index === 2 ? 40 : Math.max(12, header.length + 2),
      }));
      XLSX.utils.book_append_sheet(wb, wsPagamentos, 'Pagamentos');

      const saidasHeaders = ['Recebedor', 'Valor', 'Data', 'Descricao'];
      const saidasRows = saidasLancamentos.map((item) => [
        item.recebedor,
        item.valor,
        item.data ? formatDate(item.data) : '',
        item.descricao || '',
      ]);
      const wsSaidasLanc = XLSX.utils.aoa_to_sheet([saidasHeaders, ...saidasRows]);
      wsSaidasLanc['!cols'] = saidasHeaders.map((header, index) => ({
        wch: index === 3 ? 40 : Math.max(12, header.length + 2),
      }));
      XLSX.utils.book_append_sheet(wb, wsSaidasLanc, 'Saidas_Lancamentos');

      const interHeaders = ['Tipo', 'Cliente', 'Valor', 'Data', 'Descricao'];
      const interRows = interLancamentos.map((item) => [
        item.tipo,
        clientesPorId[item.clienteId] || item.clienteId,
        item.valor,
        item.data ? formatDate(item.data) : '',
        item.descricao || '',
      ]);
      const wsInter = XLSX.utils.aoa_to_sheet([interHeaders, ...interRows]);
      wsInter['!cols'] = interHeaders.map((header, index) => ({
        wch: index === 4 ? 40 : Math.max(12, header.length + 2),
      }));
      XLSX.utils.book_append_sheet(wb, wsInter, 'Inter_Lancamentos');

      XLSX.writeFile(wb, gerarNomeArquivo('xlsx'));
    } catch (error) {
      alert('Erro ao exportar Excel: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setExportandoExcel(false);
    }
  };

  const handleExportarPdf = async () => {
    setExportandoPdf(true);
    try {
      const aguardarFrame = () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      await aguardarFrame();
      await aguardarFrame();

      const container = reportRef.current;
      if (!container) {
        throw new Error('Area de exportacao nao encontrada.');
      }
      const pages = Array.from(container.querySelectorAll('.financeiro-report-page')) as HTMLElement[];
      if (!pages.length) {
        throw new Error('Nenhuma pagina disponivel para exportacao.');
      }

      const aguardarImagens = async (elemento: HTMLElement) => {
        const imagensPendentes = Array.from(elemento.querySelectorAll('img')).filter((img) => !img.complete);
        if (!imagensPendentes.length) return;
        await Promise.all(
          imagensPendentes.map(
            (img) =>
              new Promise<void>((resolve) => {
                const concluir = () => resolve();
                img.addEventListener('load', concluir, { once: true });
                img.addEventListener('error', concluir, { once: true });
              })
          )
        );
      };

      await aguardarFrame();
      if (document.fonts?.status !== 'loaded') {
        await document.fonts.ready;
      }
      await Promise.all(pages.map((page) => aguardarImagens(page)));
      await aguardarFrame();

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const scale = Math.min(3, Math.max(2.5, window.devicePixelRatio || 1));

      for (let i = 0; i < pages.length; i += 1) {
        const page = pages[i];
        const pageWidth = page.scrollWidth || page.clientWidth;
        const pageHeight = page.scrollHeight || page.clientHeight;
        const canvas = await html2canvas(page, {
          scale,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: pageWidth,
          height: pageHeight,
          windowWidth: pageWidth,
          windowHeight: pageHeight,
        });
        const imgData = canvas.toDataURL('image/png');

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }

      pdf.save(gerarNomeArquivo('pdf'));
    } catch (error) {
      alert('Erro ao exportar PDF: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setExportandoPdf(false);
    }
  };
  const handleTogglePlanilhaSaidas = () => {
    setModoPlanilhaSaidas((prev) => {
      const next = !prev;
      if (prev) {
        setEdicaoSaidas({});
      }
      return next;
    });
  };

  const atualizarSaidaPlanilha = (recebedor: string, mes: string, valorTexto: string) => {
    const valor = parseValorMonetario(valorTexto);
    const recebedorKey = normalizarSaida(recebedor);
    const existentes = saidasLancamentos.filter(
      (item) => normalizarSaida(item.recebedor) === recebedorKey && getMesKey(item.data) === mes
    );

    existentes.forEach((item) => onRemoverSaida(item.id));

    if (valor > 0) {
      onAdicionarSaida({
        id: `saida_planilha_${recebedorKey}_${mes}`,
        recebedor,
        valor,
        data: `${mes}-01`,
        descricao: 'Planilha',
      });
    }
  };

  const getDataReferencia = (pagamento: AsaasPagamento) =>
    pagamento.paymentDate || pagamento.clientPaymentDate || pagamento.dueDate || pagamento.dateCreated;

  const pagamentosOrdenados = useMemo(() => {
    const lista = [...pagamentosFiltrados];
    lista.sort((a, b) => {
      const dataA = getDataReferencia(a);
      const dataB = getDataReferencia(b);
      const timeA = dataA ? new Date(dataA).getTime() : 0;
      const timeB = dataB ? new Date(dataB).getTime() : 0;
      return timeB - timeA;
    });
    return lista;
  }, [pagamentosFiltrados]);

  const pagamentosVisiveis = mostrarTodosPagamentos ? pagamentosOrdenados : pagamentosOrdenados.slice(0, 3);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((item: any) => (
          <p key={item.dataKey} className="tooltip-value">
            {item.name}: {maskValue(formatCurrency(item.value))}
          </p>
        ))}
      </div>
    );
  };

  const renderResumo = (
    resumo: ResumoTabela,
    titulo: string,
    subtitulo: string,
    mesesOverride?: string[],
    linhaLabel = 'Cliente',
    emptyLabel = 'Nenhum pagamento recebido no periodo.',
    totaisCabecalho?: Record<string, number>,
    cabecalhoLabel = rotuloTotal
  ) => {
    const mesesParaMostrar = mesesOverride && mesesOverride.length ? mesesOverride : resumo.meses;

    return (
      <div className="assinaturas-resumo-section">
        <div className="assinaturas-resumo-header">
          <h3>{titulo}</h3>
          <span>{subtitulo} - {mostrarValorLiquido ? 'valor líquido' : 'valor bruto'}</span>
        </div>
        {mesesParaMostrar.length === 0 ? (
          <div className="empty-state">{emptyLabel}</div>
        ) : (
          <div className="assinaturas-table-container">
            <table className="assinaturas-table">
              <colgroup>
                <col style={{ width: `${COL_WIDTH_CLIENTE}px` }} />
                {mesesParaMostrar.map((mes) => (
                  <col key={`col-${titulo}-${mes}`} style={{ width: `${COL_WIDTH_MES}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="assinaturas-col-cliente">{linhaLabel}</th>
                  {mesesParaMostrar.map((mes) => (
                    <th key={`mes-${titulo}-${mes}`} className="assinaturas-col-mes">
                      {resumo.formatarMes(mes)}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="assinaturas-col-cliente">{cabecalhoLabel}</th>
                  {mesesParaMostrar.map((mes) => (
                    <th key={`total-${titulo}-${mes}`} className="assinaturas-col-mes">
                      {maskValue(formatCurrency(totaisCabecalho?.[mes] ?? resumo.totaisPorMes[mes] ?? 0))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="assinaturas-result-row">
                  <td className="assinaturas-col-cliente">Resultado</td>
                  {mesesParaMostrar.map((mes) => {
                    const resultadoMes = resumo.totaisPorMes[mes] || 0;
                    const classeResultado =
                      resultadoMes > 0
                        ? 'assinaturas-result-positivo'
                        : resultadoMes < 0
                        ? 'assinaturas-result-negativo'
                        : '';
                    return (
                      <td key={`resultado-${titulo}-${mes}`} className={`assinaturas-col-mes ${classeResultado}`}>
                        {resultadoMes ? maskValue(formatCurrency(resultadoMes)) : '-'}
                      </td>
                    );
                  })}
                </tr>
                {resumo.clientes.map((cliente) => (
                  <tr key={`${titulo}-${cliente.clienteId}`}>
                    <td className="assinaturas-col-cliente">{cliente.nome}</td>
                    {mesesParaMostrar.map((mes) => (
                      <td key={`${titulo}-${cliente.clienteId}-${mes}`} className="assinaturas-col-mes">
                        {cliente.valores[mes]
                          ? maskValue(formatCurrency(cliente.valores[mes]))
                          : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const resumoSaidas = useMemo(() => {
    const pagamentosBase = saidasLancamentos;
    const recebedoresMap = new Map<
      string,
      { recebedor: string; valores: Record<string, number> }
    >();

    const normalizarNome = (nome: string) => normalizarSaida(nome);
    recebedoresSaidas.forEach((nome) => {
      const nomeKey = normalizarNome(nome);
      if (!nomeKey) return;
      recebedoresMap.set(nomeKey, { recebedor: nome, valores: {} });
    });

    let minMesKey: string | null = null;
    let maxMesKey: string | null = null;

    const atualizarRange = (mesKey: string) => {
      if (!minMesKey || mesKey < minMesKey) minMesKey = mesKey;
      if (!maxMesKey || mesKey > maxMesKey) maxMesKey = mesKey;
    };

    pagamentosBase.forEach((item) => {
      const mesKey = getMesKey(item.data);
      if (!mesKey) return;
      atualizarRange(mesKey);
    });

    pagamentosBase.forEach((item) => {
      const mesKey = getMesKey(item.data);
      if (!mesKey) return;
      const nomeKey = normalizarNome(item.recebedor);
      const atual = recebedoresMap.get(nomeKey) || { recebedor: item.recebedor, valores: {} };
      atual.valores[mesKey] = (atual.valores[mesKey] || 0) + item.valor;
      recebedoresMap.set(nomeKey, atual);
    });

    const construirMeses = () => {
      if (!minMesKey || !maxMesKey) return [] as string[];
      const [anoInicio, mesInicio] = minMesKey.split('-').map(Number);
      const [anoFim, mesFim] = maxMesKey.split('-').map(Number);
      if (!anoInicio || !mesInicio || !anoFim || !mesFim) return [];

      const lista: string[] = [];
      let anoAtual = anoInicio;
      let mesAtual = mesInicio;
      while (anoAtual < anoFim || (anoAtual === anoFim && mesAtual <= mesFim)) {
        lista.push(`${anoAtual}-${String(mesAtual).padStart(2, '0')}`);
        mesAtual += 1;
        if (mesAtual > 12) {
          mesAtual = 1;
          anoAtual += 1;
        }
      }
      return lista;
    };

    const mesesOrdenados = Array.from(
      new Set([...resumoRecebimentos.meses, ...resumoRecebimentosProjetos.meses, ...construirMeses()]),
    ).sort();
    const ordemRecebedores = gruposSaidas.flatMap((grupo) => grupo.itens);
    const recebedoresOrdenados = ordemRecebedores.map((nome) => {
      const nomeKey = normalizarNome(nome);
      return recebedoresMap.get(nomeKey) || { recebedor: nome, valores: {} };
    });
    const totaisPorMes = mesesOrdenados.reduce<Record<string, number>>((acc, mes) => {
      const totalMes = recebedoresOrdenados.reduce((sum, item) => sum + (item.valores[mes] || 0), 0);
      acc[mes] = totalMes;
      return acc;
    }, {});
    const porRecebedor = recebedoresOrdenados.reduce<
      Record<string, { recebedor: string; valores: Record<string, number> }>
    >((acc, item) => {
      acc[normalizarNome(item.recebedor)] = item;
      return acc;
    }, {});

    return {
      meses: mesesOrdenados,
      recebedores: recebedoresOrdenados,
      totaisPorMes,
      porRecebedor,
    };
  }, [saidasLancamentos, recebedoresSaidas, resumoRecebimentos.meses, resumoRecebimentosProjetos.meses, gruposSaidas]);

  const mesesResumo = useMemo(() => {
    const setMeses = new Set([
      ...resumoRecebimentos.meses,
      ...resumoRecebimentosProjetos.meses,
      ...resumoSaidas.meses,
      ...resumoSaidasVenture.meses,
    ]);
    return Array.from(setMeses).sort();
  }, [resumoRecebimentos.meses, resumoRecebimentosProjetos.meses, resumoSaidas.meses, resumoSaidasVenture.meses]);

  const mesesResumoComProjetos = useMemo(() => {
    const setMeses = new Set([...mesesResumo]);
    return Array.from(setMeses).sort();
  }, [mesesResumo]);

  const totaisReceitasConsolidadasPorMes = useMemo(() => {
    return mesesResumoComProjetos.reduce<Record<string, number>>((acc, mes) => {
      acc[mes] = (resumoRecebimentos.totaisPorMes[mes] || 0) + (resumoRecebimentosProjetos.totaisPorMes[mes] || 0);
      return acc;
    }, {});
  }, [mesesResumoComProjetos, resumoRecebimentos.totaisPorMes, resumoRecebimentosProjetos.totaisPorMes]);

  const totaisSaidasConsolidadasPorMes = useMemo(() => {
    return mesesResumoComProjetos.reduce<Record<string, number>>((acc, mes) => {
      acc[mes] = (resumoSaidas.totaisPorMes[mes] || 0) + (resumoSaidasVenture.totaisPorMes[mes] || 0);
      return acc;
    }, {});
  }, [mesesResumoComProjetos, resumoSaidas.totaisPorMes, resumoSaidasVenture.totaisPorMes]);

  const obterRecebedorSaida = (nome: string) =>
    resumoSaidas.porRecebedor[normalizarSaida(nome)] || { recebedor: nome, valores: {} };

  const obterValorPlanilhaInput = (nome: string, mes: string) => {
    const key = buildPlanilhaKey(nome, mes);
    if (edicaoSaidas[key] !== undefined) return edicaoSaidas[key];
    const valorAtual = obterRecebedorSaida(nome).valores[mes] || 0;
    return valorAtual ? formatarValorPlanilha(valorAtual) : '';
  };

  const handleChangePlanilhaInput = (nome: string, mes: string, valor: string) => {
    const key = buildPlanilhaKey(nome, mes);
    setEdicaoSaidas((prev) => ({
      ...prev,
      [key]: valor,
    }));
  };

  const handleCommitPlanilhaInput = (nome: string, mes: string, valorAtualInput?: string) => {
    const key = buildPlanilhaKey(nome, mes);
    const valorTexto = valorAtualInput ?? edicaoSaidas[key];
    if (valorTexto === undefined) return;
    const valorAtual = obterRecebedorSaida(nome).valores[mes] || 0;
    const novoValor = parseValorMonetario(valorTexto);
    const mudou = Math.abs(novoValor - valorAtual) > 0.0001;
    if (mudou || (!valorTexto.trim() && valorAtual > 0)) {
      atualizarSaidaPlanilha(nome, mes, valorTexto);
    }
    setEdicaoSaidas((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleCancelarPlanilhaInput = (nome: string, mes: string) => {
    const key = buildPlanilhaKey(nome, mes);
    setEdicaoSaidas((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const obterTotalGrupoMes = (grupo: { titulo: string; itens: string[] }, mes: string) =>
    grupo.itens.reduce((sum, nome) => sum + (obterRecebedorSaida(nome).valores[mes] || 0), 0);

  const mesesPeriodoRelatorio = mesesResumoComProjetos.length ? mesesResumoComProjetos : mesesResumo;
  const periodoRelatorio = mesesPeriodoRelatorio.length
    ? `${formatarMesLabel(mesesPeriodoRelatorio[0])} - ${formatarMesLabel(mesesPeriodoRelatorio[mesesPeriodoRelatorio.length - 1])}`
    : 'Periodo nao definido';
  const dataGeracaoRelatorio = formatDate(new Date().toISOString());

  const formatarValorRelatorio = (valor: number) => maskValue(formatCurrency(valor));
  const formatarPercentualRelatorio = (valor: number) =>
    `${valor >= 0 ? '+' : ''}${(valor * 100).toFixed(1).replace('.', ',')}%`;

  type ResumoMensalRelatorio = {
    mes: string;
    recebimentos: number;
    saidas: number;
    resultado: number;
    margem: number;
  };

  type ClienteResumoRelatorio = {
    clienteId: string;
    nome: string;
    total: number;
    media: number;
    participacao: number;
    valores: Record<string, number>;
  };

  const resumoMensalRelatorio: ResumoMensalRelatorio[] = mesesResumoComProjetos.map((mes) => {
    const recebimentos = totaisReceitasConsolidadasPorMes[mes] || 0;
    const saidas = totaisSaidasConsolidadasPorMes[mes] || 0;
    const resultado = recebimentos - saidas;
    const margem = recebimentos > 0 ? resultado / recebimentos : 0;
    return { mes, recebimentos, saidas, resultado, margem };
  });
  const resumoMensalRelatorioMap = resumoMensalRelatorio.reduce<Record<string, ResumoMensalRelatorio>>(
    (acc, item) => {
      acc[item.mes] = item;
      return acc;
    },
    {}
  );

  const totaisRelatorio = resumoMensalRelatorio.reduce(
    (acc, item) => ({
      recebimentos: acc.recebimentos + item.recebimentos,
      saidas: acc.saidas + item.saidas,
      resultado: acc.resultado + item.resultado,
    }),
    { recebimentos: 0, saidas: 0, resultado: 0 }
  );
  const margemTotalRelatorio =
    totaisRelatorio.recebimentos > 0 ? totaisRelatorio.resultado / totaisRelatorio.recebimentos : 0;
  const mediaRecebimentos =
    resumoMensalRelatorio.length > 0 ? totaisRelatorio.recebimentos / resumoMensalRelatorio.length : 0;
  const mediaSaidas = resumoMensalRelatorio.length > 0 ? totaisRelatorio.saidas / resumoMensalRelatorio.length : 0;

  const melhorMesRelatorio = resumoMensalRelatorio.reduce<ResumoMensalRelatorio | null>(
    (melhor, item) => (melhor === null || item.resultado > melhor.resultado ? item : melhor),
    null
  );
  const piorMesRelatorio = resumoMensalRelatorio.reduce<ResumoMensalRelatorio | null>(
    (pior, item) => (pior === null || item.resultado < pior.resultado ? item : pior),
    null
  );

  const dividirEmChunks = <T,>(lista: T[], tamanho: number): T[][] => {
    if (!lista.length) return [];
    if (tamanho <= 0) return [lista];
    return Array.from({ length: Math.ceil(lista.length / tamanho) }, (_, index) =>
      lista.slice(index * tamanho, (index + 1) * tamanho)
    );
  };

  const mesesPorPaginaRelatorio = 8;
  const mesesChunksRelatorio = dividirEmChunks(mesesResumoComProjetos, mesesPorPaginaRelatorio);

  const totalRecebimentosClientesRelatorio = mesesResumoComProjetos.reduce(
    (acc, mes) => acc + (resumoRecebimentos.totaisPorMes[mes] || 0),
    0,
  );

  const clientesResumoRelatorio: ClienteResumoRelatorio[] = resumoRecebimentos.clientes
    .map((cliente) => {
      const total = mesesResumoComProjetos.reduce((acc, mes) => acc + (cliente.valores[mes] || 0), 0);
      const media = mesesResumoComProjetos.length > 0 ? total / mesesResumoComProjetos.length : 0;
      const participacao = totalRecebimentosClientesRelatorio > 0 ? total / totalRecebimentosClientesRelatorio : 0;
      return {
        clienteId: cliente.clienteId,
        nome: cliente.nome,
        total,
        media,
        participacao,
        valores: cliente.valores,
      };
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));

  const clientesPorPaginaRelatorio = 18;
  const clientesChunksRelatorio = dividirEmChunks(clientesResumoRelatorio, clientesPorPaginaRelatorio);

  const topClientesParaDetalhe = clientesResumoRelatorio.slice(0, 12);
  const clientesTopChunksRelatorio = dividirEmChunks(topClientesParaDetalhe, 12);
  const mesesPorPaginaClienteRelatorio = 6;
  const mesesChunksClienteRelatorio = dividirEmChunks(mesesResumoComProjetos, mesesPorPaginaClienteRelatorio);

  const totalRecebimentosProjetosRelatorio = mesesResumoComProjetos.reduce(
    (acc, mes) => acc + (resumoRecebimentosProjetos.totaisPorMes[mes] || 0),
    0,
  );

  const projetosResumoRelatorio: ClienteResumoRelatorio[] = resumoRecebimentosProjetos.clientes
    .map((projeto) => {
      const total = mesesResumoComProjetos.reduce((acc, mes) => acc + (projeto.valores[mes] || 0), 0);
      const media = mesesResumoComProjetos.length > 0 ? total / mesesResumoComProjetos.length : 0;
      const participacao =
        totalRecebimentosProjetosRelatorio > 0 ? total / totalRecebimentosProjetosRelatorio : 0;
      return {
        clienteId: projeto.clienteId,
        nome: projeto.nome,
        total,
        media,
        participacao,
        valores: projeto.valores,
      };
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));

  const projetosPorPaginaRelatorio = 18;
  const projetosChunksRelatorio = dividirEmChunks(projetosResumoRelatorio, projetosPorPaginaRelatorio);

  const topProjetosParaDetalhe = projetosResumoRelatorio.slice(0, 12);
  const projetosTopChunksRelatorio = dividirEmChunks(topProjetosParaDetalhe, 12);
  const mesesPorPaginaProjetoRelatorio = 6;
  const mesesChunksProjetoRelatorio = dividirEmChunks(mesesResumoComProjetos, mesesPorPaginaProjetoRelatorio);

  const renderReportHeader = (titulo: string, subtitulo?: string) => (
    <div className="financeiro-report-header">
      <div>
        <div className="financeiro-report-logo">UP Gestao</div>
        <div className="financeiro-report-title">{titulo}</div>
        {subtitulo && <div className="financeiro-report-subtitle">{subtitulo}</div>}
      </div>
      <div className="financeiro-report-meta">
        <span>Periodo: {periodoRelatorio}</span>
        <span>Gerado em {dataGeracaoRelatorio}</span>
      </div>
    </div>
  );
  const renderResumoSaidas = () => (
    <div className="assinaturas-resumo-section">
      <div className="assinaturas-resumo-header">
        <div className="assinaturas-resumo-header-top">
          <div>
            <h3>Saidas por mes</h3>
            <span>Valores pagos por categoria (inclui projetos venture)</span>
          </div>
          <div className="assinaturas-resumo-controls">
            <button type="button" className="btn-secondary" onClick={handleTogglePlanilhaSaidas}>
              {modoPlanilhaSaidas ? 'Finalizar edicao' : 'Editar planilha'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setMostrarNovoGasto((prev) => !prev);
                setNovoGastoErro('');
              }}
            >
              {mostrarNovoGasto ? 'Cancelar' : 'Novo gasto'}
            </button>
          </div>
        </div>
        {modoPlanilhaSaidas && (
          <span className="assinaturas-resumo-hint">
            Clique na celula para digitar. Enter confirma, Esc cancela.
          </span>
        )}
        {mostrarNovoGasto && (
          <div className="assinaturas-novo-gasto">
            <div className="inter-manual-form">
              <label>
                Nome
                <input
                  type="text"
                  placeholder="Ex.: Hosting, Marketing..."
                  value={novoGastoNome}
                  onChange={(e) => setNovoGastoNome(e.target.value)}
                />
              </label>
              <label>
                Categoria
                <select
                  value={novoGastoCategoria}
                  onChange={(e) => setNovoGastoCategoria(e.target.value as CategoriaSaida)}
                >
                  <option value="custos">Custos Gerais</option>
                  <option value="impostos">Impostos</option>
                  <option value="distribuicao">Distribuicao de Lucros</option>
                </select>
              </label>
              <button type="button" className="btn-secondary" onClick={handleAdicionarGastoCustom}>
                Adicionar linha
              </button>
            </div>
            {novoGastoErro && <span className="inter-manual-error">{novoGastoErro}</span>}
            {recebedoresSaidasCustom.length > 0 && (
              <div className="assinaturas-gastos-custom-list">
                {recebedoresSaidasCustom.map((item) => (
                  <div key={`custom-${item.nome}`} className="assinaturas-gastos-custom-item">
                    <span className="assinaturas-gastos-custom-nome">{item.nome}</span>
                    <span className="assinaturas-gastos-custom-categoria">{labelCategoriaSaida(item.categoria)}</span>
                    <button
                      type="button"
                      className="btn-secondary assinaturas-gastos-custom-remove"
                      onClick={() => removerGastoCustom(item.nome)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {mesesResumo.length === 0 ? (
        <div className="empty-state">Nenhuma saida registrada no periodo.</div>
      ) : (
        <div className="assinaturas-table-container">
          <table className={modoPlanilhaSaidas ? 'assinaturas-table assinaturas-table-editing' : 'assinaturas-table'}>
            <colgroup>
              <col style={{ width: `${COL_WIDTH_CLIENTE}px` }} />
              {mesesResumo.map((mes) => (
                <col key={`col-saida-${mes}`} style={{ width: `${COL_WIDTH_MES}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="assinaturas-col-cliente">Recebedor</th>
                {mesesResumo.map((mes) => (
                  <th key={`saida-mes-${mes}`} className="assinaturas-col-mes">
                    {formatarMesLabel(mes)}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="assinaturas-col-cliente">Total de saidas</th>
                {mesesResumo.map((mes) => (
                  <th key={`saida-total-${mes}`} className="assinaturas-col-mes">
                    {maskValue(formatCurrency(totaisSaidasConsolidadasPorMes[mes] || 0))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gruposSaidas.map((grupo) => (
                <Fragment key={grupo.titulo}>
                  <tr className="assinaturas-group-total">
                    <td className="assinaturas-col-cliente">Total {grupo.titulo}</td>
                    {mesesResumo.map((mes) => {
                      const totalGrupo = obterTotalGrupoMes(grupo, mes);
                      return (
                        <td key={`saida-${grupo.titulo}-total-${mes}`} className="assinaturas-col-mes">
                          {totalGrupo ? maskValue(formatCurrency(totalGrupo)) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                  {grupo.itens.map((nome) => {
                    const item = obterRecebedorSaida(nome);
                    return (
                      <tr key={`saida-${grupo.titulo}-${nome}`}>
                        <td className="assinaturas-col-cliente">{item.recebedor}</td>
                        {mesesResumo.map((mes) => (
                          <td key={`saida-${grupo.titulo}-${nome}-${mes}`} className="assinaturas-col-mes">
                            {modoPlanilhaSaidas ? (
                              <input
                                className="assinaturas-table-input"
                                inputMode="decimal"
                                value={obterValorPlanilhaInput(nome, mes)}
                                onChange={(e) => handleChangePlanilhaInput(nome, mes, e.target.value)}
                                onBlur={(e) => {
                                  if (e.currentTarget.dataset.cancelled === '1') {
                                    delete e.currentTarget.dataset.cancelled;
                                    return;
                                  }
                                  handleCommitPlanilhaInput(nome, mes, e.currentTarget.value);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                  if (e.key === 'Escape') {
                                    e.currentTarget.dataset.cancelled = '1';
                                    handleCancelarPlanilhaInput(nome, mes);
                                    e.currentTarget.blur();
                                  }
                                }}
                              />
                            ) : item.valores[mes] ? (
                              maskValue(formatCurrency(item.valores[mes]))
                            ) : (
                              '-'
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
              {resumoSaidasVenture.clientes.length > 0 && (
                <Fragment key="saida-venture">
                  <tr className="assinaturas-group-total">
                    <td className="assinaturas-col-cliente">Total Saidas Projetos Venture</td>
                    {mesesResumo.map((mes) => (
                      <td key={`saida-venture-total-${mes}`} className="assinaturas-col-mes">
                        {resumoSaidasVenture.totaisPorMes[mes]
                          ? maskValue(formatCurrency(resumoSaidasVenture.totaisPorMes[mes]))
                          : '-'}
                      </td>
                    ))}
                  </tr>
                  {resumoSaidasVenture.clientes.map((projeto) => (
                    <tr key={`saida-venture-${projeto.clienteId}`}>
                      <td className="assinaturas-col-cliente">{projeto.nome}</td>
                      {mesesResumo.map((mes) => (
                        <td key={`saida-venture-${projeto.clienteId}-${mes}`} className="assinaturas-col-mes">
                          {projeto.valores[mes] ? maskValue(formatCurrency(projeto.valores[mes])) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const reportPages: { key: string; content: JSX.Element }[] = [
    {
      key: 'financeiro-executivo',
      content: (
        <>
          {renderReportHeader('Relatorio Financeiro', 'Modelo executivo para apresentacao interna')}
          <div className="financeiro-report-section">
            <h3>Painel executivo</h3>
            <div className="financeiro-report-metrics">
              <div className="financeiro-report-metric">
                <span className="financeiro-report-metric-label">Recebimentos acumulados</span>
                <span className="financeiro-report-metric-value">{formatarValorRelatorio(totaisRelatorio.recebimentos)}</span>
              </div>
              <div className="financeiro-report-metric">
                <span className="financeiro-report-metric-label">Saidas acumuladas</span>
                <span className="financeiro-report-metric-value">{formatarValorRelatorio(totaisRelatorio.saidas)}</span>
              </div>
              <div className={`financeiro-report-metric ${totaisRelatorio.resultado >= 0 ? 'positivo' : 'negativo'}`}>
                <span className="financeiro-report-metric-label">Resultado acumulado</span>
                <span className="financeiro-report-metric-value">{formatarValorRelatorio(totaisRelatorio.resultado)}</span>
              </div>
              <div className={`financeiro-report-metric ${margemTotalRelatorio >= 0 ? 'positivo' : 'negativo'}`}>
                <span className="financeiro-report-metric-label">Margem do periodo</span>
                <span className="financeiro-report-metric-value">{formatarPercentualRelatorio(margemTotalRelatorio)}</span>
              </div>
            </div>
          </div>
          <div className="financeiro-report-section">
            <div className="financeiro-report-section-header">
              <h3>Destaques para apresentacao</h3>
              <span>{resumoMensalRelatorio.length} meses analisados</span>
            </div>
            <table className="financeiro-report-table">
              <tbody>
                <tr>
                  <td>Media de recebimentos</td>
                  <td>{formatarValorRelatorio(mediaRecebimentos)}</td>
                </tr>
                <tr>
                  <td>Media de saidas</td>
                  <td>{formatarValorRelatorio(mediaSaidas)}</td>
                </tr>
                <tr>
                  <td>Melhor mes (resultado)</td>
                  <td>
                    {melhorMesRelatorio
                      ? `${formatarMesLabel(melhorMesRelatorio.mes)} - ${formatarValorRelatorio(melhorMesRelatorio.resultado)}`
                      : '-'}
                  </td>
                </tr>
                <tr>
                  <td>Pior mes (resultado)</td>
                  <td>
                    {piorMesRelatorio
                      ? `${formatarMesLabel(piorMesRelatorio.mes)} - ${formatarValorRelatorio(piorMesRelatorio.resultado)}`
                      : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ),
    },
  ];

  if (mesesChunksRelatorio.length === 0) {
    reportPages.push({
      key: 'financeiro-tabelas-vazio',
      content: (
        <>
          {renderReportHeader('Relatorio Financeiro', 'Tabelas mensais')}
          <div className="financeiro-report-section">
            <h3>Recebimentos por mes</h3>
            <div className="financeiro-report-empty">Nenhum recebimento disponivel.</div>
          </div>
          <div className="financeiro-report-section">
            <h3>Saidas por mes</h3>
            <div className="financeiro-report-empty">Nenhuma saida disponivel.</div>
          </div>
        </>
      ),
    });
  } else {
    mesesChunksRelatorio.forEach((chunk, index) => {
      reportPages.push({
        key: `financeiro-tabelas-${index}`,
        content: (
          <>
            {renderReportHeader('Relatorio Financeiro', `Tabelas mensais - Parte ${index + 1}`)}
            <div className="financeiro-report-section">
              <h3>Recebimentos por mes</h3>
              <table className="financeiro-report-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Total de recebimentos</th>
                    <th>Resultado do mes</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((mes) => {
                    const item = resumoMensalRelatorioMap[mes];
                    return (
                      <tr key={`pdf-recebimentos-${index}-${mes}`}>
                        <td>{formatarMesLabel(mes)}</td>
                        <td>{formatarValorRelatorio(item?.recebimentos || 0)}</td>
                        <td>{formatarValorRelatorio(item?.resultado || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="financeiro-report-section">
              <h3>Saidas por mes</h3>
              <table className="financeiro-report-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Total de saidas</th>
                    <th>Margem do mes</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((mes) => {
                    const item = resumoMensalRelatorioMap[mes];
                    return (
                      <tr key={`pdf-saidas-${index}-${mes}`}>
                        <td>{formatarMesLabel(mes)}</td>
                        <td>{formatarValorRelatorio(item?.saidas || 0)}</td>
                        <td>{formatarPercentualRelatorio(item?.margem || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ),
      });
    });
  }

  if (clientesChunksRelatorio.length === 0) {
    reportPages.push({
      key: 'financeiro-clientes-vazio',
      content: (
        <>
          {renderReportHeader('Relatorio Financeiro', 'Tabelas por cliente')}
          <div className="financeiro-report-section">
            <h3>Recebimentos por cliente</h3>
            <div className="financeiro-report-empty">Nenhum cliente com recebimento no periodo.</div>
          </div>
        </>
      ),
    });
  } else {
    clientesChunksRelatorio.forEach((clientesChunk, index) => {
      reportPages.push({
        key: `financeiro-clientes-resumo-${index}`,
        content: (
          <>
            {renderReportHeader('Relatorio Financeiro', `Recebimentos por cliente - Parte ${index + 1}`)}
            <div className="financeiro-report-section">
              <div className="financeiro-report-section-header">
                <h3>Resumo por cliente</h3>
                <span>{clientesResumoRelatorio.length} clientes no periodo</span>
              </div>
              <table className="financeiro-report-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Total recebido</th>
                    <th>Media mensal</th>
                    <th>Participacao</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesChunk.map((cliente) => (
                    <tr key={`pdf-cliente-resumo-${cliente.clienteId}-${index}`}>
                      <td>{cliente.nome}</td>
                      <td>{formatarValorRelatorio(cliente.total)}</td>
                      <td>{formatarValorRelatorio(cliente.media)}</td>
                      <td>{formatarPercentualRelatorio(cliente.participacao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ),
      });
    });

    if (mesesChunksClienteRelatorio.length > 0 && clientesTopChunksRelatorio.length > 0) {
      mesesChunksClienteRelatorio.forEach((mesesChunk, mesIndex) => {
        clientesTopChunksRelatorio.forEach((clientesChunk, clienteIndex) => {
          reportPages.push({
            key: `financeiro-clientes-mensal-${mesIndex}-${clienteIndex}`,
            content: (
              <>
                {renderReportHeader('Relatorio Financeiro', `Recebimentos mensais por cliente - Parte ${mesIndex + 1}`)}
                <div className="financeiro-report-section">
                  <div className="financeiro-report-section-header">
                    <h3>Detalhe mensal por cliente</h3>
                    <span>Top {topClientesParaDetalhe.length} clientes por recebimento</span>
                  </div>
                  <table className="financeiro-report-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        {mesesChunk.map((mes) => (
                          <th key={`pdf-cliente-mes-head-${mesIndex}-${clienteIndex}-${mes}`}>{formatarMesLabel(mes)}</th>
                        ))}
                        <th>Total periodo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesChunk.map((cliente) => (
                        <tr key={`pdf-cliente-mensal-${mesIndex}-${clienteIndex}-${cliente.clienteId}`}>
                          <td>{cliente.nome}</td>
                          {mesesChunk.map((mes) => (
                            <td key={`pdf-cliente-mensal-${cliente.clienteId}-${mes}`}>
                              {formatarValorRelatorio(cliente.valores[mes] || 0)}
                            </td>
                          ))}
                          <td>{formatarValorRelatorio(cliente.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ),
          });
        });
      });
    }
  }

  if (projetosChunksRelatorio.length === 0) {
    reportPages.push({
      key: 'financeiro-projetos-vazio',
      content: (
        <>
          {renderReportHeader('Relatorio Financeiro', 'Tabelas por projeto')}
          <div className="financeiro-report-section">
            <h3>Recebimentos de venture capital por projeto</h3>
            <div className="financeiro-report-empty">Nenhum projeto com recebimento no periodo.</div>
          </div>
        </>
      ),
    });
  } else {
    projetosChunksRelatorio.forEach((projetosChunk, index) => {
      reportPages.push({
        key: `financeiro-projetos-resumo-${index}`,
        content: (
          <>
            {renderReportHeader('Relatorio Financeiro', `Recebimentos por projeto - Parte ${index + 1}`)}
            <div className="financeiro-report-section">
              <div className="financeiro-report-section-header">
                <h3>Resumo por projeto</h3>
                <span>{projetosResumoRelatorio.length} projetos no periodo</span>
              </div>
              <table className="financeiro-report-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>Total recebido</th>
                    <th>Media mensal</th>
                    <th>Participacao</th>
                  </tr>
                </thead>
                <tbody>
                  {projetosChunk.map((projeto) => (
                    <tr key={`pdf-projeto-resumo-${projeto.clienteId}-${index}`}>
                      <td>{projeto.nome}</td>
                      <td>{formatarValorRelatorio(projeto.total)}</td>
                      <td>{formatarValorRelatorio(projeto.media)}</td>
                      <td>{formatarPercentualRelatorio(projeto.participacao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ),
      });
    });

    if (mesesChunksProjetoRelatorio.length > 0 && projetosTopChunksRelatorio.length > 0) {
      mesesChunksProjetoRelatorio.forEach((mesesChunk, mesIndex) => {
        projetosTopChunksRelatorio.forEach((projetosChunk, projetoIndex) => {
          reportPages.push({
            key: `financeiro-projetos-mensal-${mesIndex}-${projetoIndex}`,
            content: (
              <>
                {renderReportHeader('Relatorio Financeiro', `Recebimentos mensais por projeto - Parte ${mesIndex + 1}`)}
                <div className="financeiro-report-section">
                  <div className="financeiro-report-section-header">
                    <h3>Detalhe mensal por projeto</h3>
                    <span>Top {topProjetosParaDetalhe.length} projetos por recebimento</span>
                  </div>
                  <table className="financeiro-report-table">
                    <thead>
                      <tr>
                        <th>Projeto</th>
                        {mesesChunk.map((mes) => (
                          <th key={`pdf-projeto-mes-head-${mesIndex}-${projetoIndex}-${mes}`}>
                            {formatarMesLabel(mes)}
                          </th>
                        ))}
                        <th>Total periodo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projetosChunk.map((projeto) => (
                        <tr key={`pdf-projeto-mensal-${mesIndex}-${projetoIndex}-${projeto.clienteId}`}>
                          <td>{projeto.nome}</td>
                          {mesesChunk.map((mes) => (
                            <td key={`pdf-projeto-mensal-${projeto.clienteId}-${mes}`}>
                              {formatarValorRelatorio(projeto.valores[mes] || 0)}
                            </td>
                          ))}
                          <td>{formatarValorRelatorio(projeto.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ),
          });
        });
      });
    }
  }

  const totalReportPages = reportPages.length;

  return (
    <div className="financeiro-subpage">
      <Card className="pagamentos-chart-card">
        <div className="pagamentos-chart-header">
          <div>
            <h2>Recebimentos mensais</h2>
            <span>Recebimentos x Pagamentos e lucro</span>
          </div>
        </div>
        {dadosGrafico.length === 0 ? (
          <div className="empty-state">Nenhum pagamento recebido no período.</div>
        ) : (
          <div className="pagamentos-chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dadosGrafico} margin={{ top: 8, right: 16, left: 32, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="mes" stroke="var(--chart-axis)" />
                <YAxis
                  tickFormatter={(value) => maskValue(formatCurrency(value))}
                  stroke="var(--chart-axis)"
                  width={84}
                  tickMargin={8}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="administracao" name="Administração" stackId="recebimentos" fill="var(--chart-admin)" />
                <Bar dataKey="performance" name="Performance" stackId="recebimentos" fill="var(--chart-performance)" />
                <Bar dataKey="venture" name="Venture" stackId="recebimentos" fill="var(--chart-venture)" />
                <Bar dataKey="pagamentos" name="Saidas" fill="var(--chart-payments)" />
                <Line
                  type="monotone"
                  dataKey="lucro"
                  name="Lucro"
                  stroke="var(--chart-profit)"
                  strokeWidth={2.2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card>
        <div className="pagamentos-header">
          <h2>Pagamentos e Cobranças</h2>
          <div className="filtros">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="filtro-select"
            >
              <option value="">Todos os status</option>
              <option value="RECEIVED">Recebidos</option>
              <option value="PENDING">Pendentes</option>
              <option value="OVERDUE">Vencidos</option>
              <option value="REFUNDED">Reembolsados</option>
              <option value="INTER_RECEIVED">Recebidos (Inter)</option>
            </select>
            <div className="financeiro-export-actions">
              <button
                type="button"
                className="btn-secondary btn-action btn-action--report"
                onClick={handleExportarPdf}
                disabled={exportandoPdf}
                aria-label="Gerar relatório financeiro em PDF"
              >
                {exportandoPdf ? 'Gerando...' : 'Relatório'}
              </button>
              <button
                type="button"
                className="btn-secondary btn-action btn-action--export"
                onClick={handleExportarExcel}
                disabled={exportandoExcel}
                aria-label="Exportar dados financeiros em Excel"
              >
                {exportandoExcel ? 'Exportando...' : 'Exportar'}
              </button>
            </div>
          </div>
        </div>

        <div className="assinaturas-resumo">
          <div className="assinaturas-resumo-header-top">
            <div>
              <h3>Resumo de recebimentos</h3>
              <span>Todos os recebimentos - {mostrarValorLiquido ? 'valor líquido' : 'valor bruto'}</span>
            </div>
            <label className="assinaturas-resumo-toggle">
              <input
                type="checkbox"
                checked={mostrarValorLiquido}
                onChange={(e) => setMostrarValorLiquido(e.target.checked)}
              />
              <span>Valor líquido</span>
            </label>
          </div>
          {renderResumo(
            resumoRecebimentos,
            'Recebimentos por mês',
            'Valores recebidos por cliente',
            mesesResumo,
            'Cliente',
            'Nenhum pagamento recebido no periodo.',
            totaisReceitasConsolidadasPorMes,
            rotuloTotal
          )}
          {renderResumo(
            resumoRecebimentosProjetos,
            'Recebimentos de Venture Capital',
            'Entradas registradas por projeto',
            mesesResumoComProjetos,
            'Projeto',
            'Nenhum recebimento de venture capital no periodo.',
            undefined,
            'Total Venture'
          )}
          {renderResumoSaidas()}
        </div>

        {carregando ? (
          <div className="loading">Carregando...</div>
        ) : pagamentosFiltrados.length === 0 ? (
          <div className="empty-state">Nenhum pagamento encontrado</div>
        ) : (
          <div className="pagamentos-table-container">
            <table className="pagamentos-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Valor líquido</th>
                  <th>Vencimento</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {pagamentosVisiveis.map((pagamento) => {
                  const clienteNome = clientesPorAsaasId[pagamento.customer];
                  return (
                    <tr key={pagamento.id}>
                      <td title={clienteNome ? '' : pagamento.customer || ''}>
                        {clienteNome || '-'}
                      </td>
                      <td>{pagamento.description || '-'}</td>
                      <td className="valor-cell">{maskValue(formatCurrency(pagamento.value))}</td>
                      <td className="valor-cell">
                        {pagamento.netValue !== undefined && pagamento.netValue !== null
                          ? maskValue(formatCurrency(pagamento.netValue))
                          : '-'}
                      </td>
                      <td>{formatDate(pagamento.dueDate)}</td>
                      <td>
                        {pagamento.paymentDate
                          ? formatDate(pagamento.paymentDate)
                          : pagamento.clientPaymentDate
                          ? formatDate(pagamento.clientPaymentDate)
                          : '-'}
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(pagamento.status)}`}>
                          {getStatusLabel(pagamento.status)}
                        </span>
                      </td>
                      <td>{pagamento.billingType || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pagamentosOrdenados.length > 3 && (
              <div className="pagamentos-table-actions">
                <button
                  type="button"
                  className="btn-secondary pagamentos-more-btn"
                  onClick={() => setMostrarTodosPagamentos((prev) => !prev)}
                >
                  {mostrarTodosPagamentos
                    ? 'Ver menos'
                    : `Ver mais (${pagamentosOrdenados.length - 3})`}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="inter-manual-toggle">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setMostrarLancamentosManuais((prev) => !prev)}
          >
            {mostrarLancamentosManuais ? 'Recolher lançamentos manuais' : 'Mostrar lançamentos manuais'}
          </button>
        </div>

        {mostrarLancamentosManuais && (
          <div className="inter-manual-stack">
            <div className="inter-manual-card">
              <div className="inter-manual-header">
                <div>
                  <h3>Lançamentos Banco Inter</h3>
                  <span>Adicionar recebimentos manuais por cliente.</span>
                </div>
              </div>
              <div className="inter-manual-form">
                <label>
                  Cliente
                  <select value={interClienteId} onChange={(e) => setInterClienteId(e.target.value)}>
                    <option value="">Selecione</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Valor
                  <input
                    type="text"
                    placeholder="0,00"
                    value={interValor}
                    onChange={(e) => setInterValor(e.target.value)}
                  />
                </label>
                <label>
                  Data
                  <input type="date" value={interData} onChange={(e) => setInterData(e.target.value)} />
                </label>
                <label className="inter-manual-descricao">
                  Descrição
                  <input
                    type="text"
                    placeholder="Ex.: Recebimento Inter"
                    value={interDescricao}
                    onChange={(e) => setInterDescricao(e.target.value)}
                  />
                </label>
                <button type="button" className="btn-secondary" onClick={handleAdicionarInter}>
                  Adicionar lançamento
                </button>
              </div>
              {interErro && <span className="inter-manual-error">{interErro}</span>}
              {interLancamentos.length > 0 && (
                <div className="inter-manual-list">
                  <table className="pagamentos-table inter-manual-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Valor</th>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interLancamentos.map((item) => (
                        <tr key={item.id}>
                          <td>{clientesPorId[item.clienteId] || 'Cliente'}</td>
                          <td className="valor-cell">{maskValue(formatCurrency(item.valor))}</td>
                          <td>{formatDate(item.data)}</td>
                          <td>{item.descricao || '-'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary inter-remove-btn"
                              onClick={() => onRemoverLancamentoInter(item.id)}
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="inter-manual-card">
              <div className="inter-manual-header">
                <div>
                  <h3>Saídas da empresa</h3>
                  <span>Adicionar pagamentos internos por recebedor.</span>
                </div>
              </div>
              <div className="inter-manual-form">
                <label>
                  Recebedor
                  <select value={saidaRecebedor} onChange={(e) => setSaidaRecebedor(e.target.value)}>
                    <option value="">Selecione</option>
                    {recebedoresSaidas.map((recebedor) => (
                      <option key={recebedor} value={recebedor}>
                        {recebedor}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Valor
                  <input
                    type="text"
                    placeholder="0,00"
                    value={saidaValor}
                    onChange={(e) => setSaidaValor(e.target.value)}
                  />
                </label>
                <label>
                  Data
                  <input type="date" value={saidaData} onChange={(e) => setSaidaData(e.target.value)} />
                </label>
                <label className="inter-manual-descricao">
                  Descrição
                  <input
                    type="text"
                    placeholder="Ex.: Pagamento mensal"
                    value={saidaDescricao}
                    onChange={(e) => setSaidaDescricao(e.target.value)}
                  />
                </label>
                <button type="button" className="btn-secondary" onClick={handleAdicionarSaida}>
                  Adicionar saída
                </button>
              </div>
              {saidaErro && <span className="inter-manual-error">{saidaErro}</span>}
              {saidasLancamentos.length > 0 && (
                <div className="inter-manual-list">
                  <table className="pagamentos-table inter-manual-table">
                    <thead>
                      <tr>
                        <th>Recebedor</th>
                        <th>Valor</th>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saidasLancamentos.map((item) => (
                        <tr key={item.id}>
                          <td>{item.recebedor}</td>
                          <td className="valor-cell">{maskValue(formatCurrency(item.valor))}</td>
                          <td>{formatDate(item.data)}</td>
                          <td>{item.descricao || '-'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary inter-remove-btn"
                              onClick={() => onRemoverSaida(item.id)}
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
      <div className="financeiro-report-export" aria-hidden="true" ref={reportRef}>
        <div className="financeiro-report">
          {reportPages.map((page, index) => (
            <div key={page.key} className="financeiro-report-page">
              {page.content}
              <div className="financeiro-report-footer">
                <span>UP Gestão</span>
                <span>Página {index + 1} de {totalReportPages}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}







