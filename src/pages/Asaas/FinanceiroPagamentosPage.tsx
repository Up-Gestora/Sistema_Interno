import { Fragment, useEffect, useMemo, useState } from 'react';
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
  const [mostrarLancamentosManuais, setMostrarLancamentosManuais] = useState(false);
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

  const recebedoresSaidas = [
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

  const impostosSaidas = ['PIS', 'COFINS', 'ISS', 'Lucro presumido'];
  const distribuicaoLucrosSaidas = [
    'Distribuições',
    'Igor',
    'Mário',
    'Matheus',
    'Vinicius',
  ];
  const impostosSet = new Set(impostosSaidas.map(normalizarSaida));
  const distribuicaoSet = new Set(distribuicaoLucrosSaidas.map(normalizarSaida));
  const custosGeraisSaidas = recebedoresSaidas.filter(
    (nome) => !impostosSet.has(normalizarSaida(nome)) && !distribuicaoSet.has(normalizarSaida(nome))
  );
  const gruposSaidas = [
    { titulo: 'Impostos', itens: impostosSaidas },
    { titulo: 'Distribuição de Lucros', itens: distribuicaoLucrosSaidas },
    { titulo: 'Custos Gerais', itens: custosGeraisSaidas },
  ];

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

  const mesesGrafico = useMemo(() => {
    const setMeses = new Set(resumoRecebimentos.meses);
    saidasLancamentos.forEach((item) => {
      const mesKey = getMesKey(item.data);
      if (mesKey) setMeses.add(mesKey);
    });
    return Array.from(setMeses).sort();
  }, [resumoRecebimentos.meses, saidasLancamentos]);

  const dadosGrafico = useMemo(() => {
    const pagamentosPorMes = saidasLancamentos.reduce<Record<string, number>>((acc, item) => {
      const mesKey = getMesKey(item.data);
      if (!mesKey) return acc;
      acc[mesKey] = (acc[mesKey] || 0) + item.valor;
      return acc;
    }, {});

    return mesesGrafico.map((mes) => ({
      mes: formatarMesLabel(mes),
      administracao: resumoAssinaturas.totaisPorMes[mes] || 0,
      performance: resumoOutros.totaisPorMes[mes] || 0,
      pagamentos: pagamentosPorMes[mes] || 0,
      lucro:
        (resumoAssinaturas.totaisPorMes[mes] || 0) +
        (resumoOutros.totaisPorMes[mes] || 0) -
        (pagamentosPorMes[mes] || 0),
    }));
  }, [mesesGrafico, resumoAssinaturas.totaisPorMes, resumoOutros.totaisPorMes, saidasLancamentos]);

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
    const normalizado = valorTexto.includes(',')
      ? valorTexto.replace(/\./g, '').replace(',', '.')
      : valorTexto;
    const valor = Number(normalizado);
    return Number.isFinite(valor) ? valor : 0;
  };

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
    resumo: {
      meses: string[];
      clientes: { clienteId: string; nome: string; valores: Record<string, number> }[];
      totaisPorMes: Record<string, number>;
      formatarMes: (mesKey: string) => string;
    },
    titulo: string,
    subtitulo: string,
    mesesOverride?: string[]
  ) => {
    const mesesParaMostrar = mesesOverride && mesesOverride.length ? mesesOverride : resumo.meses;

    return (
      <div className="assinaturas-resumo-section">
        <div className="assinaturas-resumo-header">
          <h3>{titulo}</h3>
          <span>{subtitulo} - {mostrarValorLiquido ? 'valor líquido' : 'valor bruto'}</span>
        </div>
        {mesesParaMostrar.length === 0 ? (
          <div className="empty-state">Nenhum pagamento recebido no período.</div>
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
                  <th className="assinaturas-col-cliente">{rotuloTotal}</th>
                  {mesesParaMostrar.map((mes) => (
                    <th key={`total-${titulo}-${mes}`} className="assinaturas-col-mes">
                      {maskValue(formatCurrency(resumo.totaisPorMes[mes] || 0))}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="assinaturas-col-cliente">Cliente</th>
                  {mesesParaMostrar.map((mes) => (
                    <th key={`mes-${titulo}-${mes}`} className="assinaturas-col-mes">
                      {resumo.formatarMes(mes)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
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
      new Set([...resumoRecebimentos.meses, ...construirMeses()])
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
  }, [saidasLancamentos, recebedoresSaidas, resumoRecebimentos.meses, gruposSaidas]);

  const mesesResumo = useMemo(() => {
    const setMeses = new Set([...resumoRecebimentos.meses, ...resumoSaidas.meses]);
    return Array.from(setMeses).sort();
  }, [resumoRecebimentos.meses, resumoSaidas.meses]);

  const obterRecebedorSaida = (nome: string) =>
    resumoSaidas.porRecebedor[normalizarSaida(nome)] || { recebedor: nome, valores: {} };
  const renderResumoSaidas = () => (
    <div className="assinaturas-resumo-section">
      <div className="assinaturas-resumo-header">
        <h3>Saidas por mes</h3>
        <span>Valores pagos por recebedor</span>
      </div>
      {mesesResumo.length === 0 ? (
        <div className="empty-state">Nenhuma saida registrada no periodo.</div>
      ) : (
        <div className="assinaturas-table-container">
          <table className="assinaturas-table">
            <colgroup>
              <col style={{ width: `${COL_WIDTH_CLIENTE}px` }} />
              {mesesResumo.map((mes) => (
                <col key={`col-saida-${mes}`} style={{ width: `${COL_WIDTH_MES}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="assinaturas-col-cliente">Total de saidas</th>
                {mesesResumo.map((mes) => (
                  <th key={`saida-total-${mes}`} className="assinaturas-col-mes">
                    {maskValue(formatCurrency(resumoSaidas.totaisPorMes[mes] || 0))}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="assinaturas-col-cliente">Recebedor</th>
                {mesesResumo.map((mes) => (
                  <th key={`saida-mes-${mes}`} className="assinaturas-col-mes">
                    {formatarMesLabel(mes)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gruposSaidas.map((grupo) => (
                <Fragment key={grupo.titulo}>
                  <tr className="assinaturas-group-row">
                    <td className="assinaturas-group-cell" colSpan={mesesResumo.length + 1}>
                      {grupo.titulo}
                    </td>
                  </tr>
                  {grupo.itens.map((nome) => {
                    const item = obterRecebedorSaida(nome);
                    return (
                      <tr key={`saida-${grupo.titulo}-${nome}`}>
                        <td className="assinaturas-col-cliente">{item.recebedor}</td>
                        {mesesResumo.map((mes) => (
                          <td key={`saida-${grupo.titulo}-${nome}-${mes}`} className="assinaturas-col-mes">
                            {item.valores[mes]
                              ? maskValue(formatCurrency(item.valores[mes]))
                              : '-'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

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
                <Bar dataKey="pagamentos" name="Pagamentos" fill="var(--chart-payments)" />
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
            mesesResumo
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
    </div>
  );
}




