import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/Card/Card';
import { useClientes } from '../../hooks/useClientes';
import { formatCurrency } from '../../utils/calculations';
import { BenchmarkTipo, buscarBenchmarkPorPeriodo } from '../../services/performanceBenchmarkService';
import './PerformancePage.css';

type AbaAtiva = 'resumo' | 'individual';

interface DistribuicaoConfig {
  reservaInicialPct: number;
  executorPct: number;
  reservaCaixaPct: number;
  marioPct: number;
  matheusPct: number;
  igorPct: number;
  viniciusPct: number;
}

interface DistribuicaoResultado {
  reservaInicial: number;
  basePosReserva: number;
  executorMario: number;
  basePosExecutor: number;
  reservaCaixa: number;
  fluxoCaixaEmpresa: number;
  mario: number;
  matheus: number;
  igor: number;
  vinicius: number;
}

interface ResumoLinha {
  id: string;
  clienteId?: string;
  clienteNome: string;
  valorTotal: number;
  parcelas: number;
}

interface EtapaCalculoPersistida {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  abertura: number;
  fechamento: number;
  descontos: number;
  benchmarkTipo: BenchmarkTipo;
  benchmarkValor: number;
}

interface EtapaCalculo extends EtapaCalculoPersistida {
  carregandoBenchmark: boolean;
  erroBenchmark: string;
}

interface WorkspacePersistido {
  config: DistribuicaoConfig;
  resumoLinhas: ResumoLinha[];
  calculo: {
    clienteId: string;
    clienteNomeManual: string;
    taxaPerformance: number;
    parcelasSugeridas: number;
    etapas: EtapaCalculoPersistida[];
  };
}

interface ResultadoEtapa {
  patrimonioLiquido: number;
  variacaoCarteiraPct: number;
  alphaPct: number;
  resultadoBruto: number;
  valorTaxaPerformance: number;
}

const STORAGE_KEY = 'performance_workspace_v2';
const BENCHMARK_OPTIONS: BenchmarkTipo[] = ['CDI', 'IFIX', 'IBOV', 'MANUAL'];

const DEFAULT_DISTRIBUICAO_CONFIG: DistribuicaoConfig = {
  reservaInicialPct: 10,
  executorPct: 30,
  reservaCaixaPct: 30,
  marioPct: 10,
  matheusPct: 45,
  igorPct: 20,
  viniciusPct: 25,
};

const criarId = (prefixo: string) => `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const arredondar2 = (valor: number) => Math.round(valor * 100) / 100;

const toFiniteNumber = (valor: unknown, fallback = 0) => {
  const parsed = Number(valor);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveInt = (valor: unknown, fallback = 1) => {
  const parsed = Number(valor);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

const calcularDistribuicao = (
  valorTotal: number,
  config: DistribuicaoConfig
): DistribuicaoResultado => {
  const reservaInicial = arredondar2(valorTotal * (config.reservaInicialPct / 100));
  const basePosReserva = arredondar2(valorTotal - reservaInicial);
  const executorMario = arredondar2(basePosReserva * (config.executorPct / 100));
  const basePosExecutor = arredondar2(basePosReserva - executorMario);
  const reservaCaixa = arredondar2(basePosExecutor * (config.reservaCaixaPct / 100));
  const fluxoCaixaEmpresa = arredondar2(basePosExecutor - reservaCaixa);
  const mario = arredondar2(fluxoCaixaEmpresa * (config.marioPct / 100));
  const matheus = arredondar2(fluxoCaixaEmpresa * (config.matheusPct / 100));
  const igor = arredondar2(fluxoCaixaEmpresa * (config.igorPct / 100));
  const vinicius = arredondar2(fluxoCaixaEmpresa * (config.viniciusPct / 100));

  return {
    reservaInicial,
    basePosReserva,
    executorMario,
    basePosExecutor,
    reservaCaixa,
    fluxoCaixaEmpresa,
    mario,
    matheus,
    igor,
    vinicius,
  };
};

const calcularResultadoEtapa = (
  etapa: EtapaCalculo,
  taxaPerformance: number
): ResultadoEtapa => {
  const abertura = toFiniteNumber(etapa.abertura);
  const fechamento = toFiniteNumber(etapa.fechamento);
  const descontos = toFiniteNumber(etapa.descontos);
  const benchmarkValor = toFiniteNumber(etapa.benchmarkValor);

  const patrimonioLiquido = arredondar2(fechamento - descontos);
  const variacaoCarteiraPct = abertura > 0
    ? arredondar2(((patrimonioLiquido - abertura) / abertura) * 100)
    : 0;
  const alphaPct = arredondar2(variacaoCarteiraPct - benchmarkValor);
  const resultadoBruto = abertura > 0 ? arredondar2((abertura * alphaPct) / 100) : 0;
  const valorTaxaPerformance = arredondar2(resultadoBruto * (taxaPerformance / 100));

  return {
    patrimonioLiquido,
    variacaoCarteiraPct,
    alphaPct,
    resultadoBruto,
    valorTaxaPerformance,
  };
};

const criarEtapa = (indice: number): EtapaCalculo => ({
  id: criarId('etapa'),
  nome: `PERFORMANCE ${indice}`,
  dataInicio: '',
  dataFim: '',
  abertura: 0,
  fechamento: 0,
  descontos: 0,
  benchmarkTipo: 'IFIX',
  benchmarkValor: 0,
  carregandoBenchmark: false,
  erroBenchmark: '',
});

export default function PerformancePage() {
  const { clientes } = useClientes();

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('resumo');
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);

  const [config, setConfig] = useState<DistribuicaoConfig>(DEFAULT_DISTRIBUICAO_CONFIG);
  const [resumoLinhas, setResumoLinhas] = useState<ResumoLinha[]>([]);
  const [novoClienteId, setNovoClienteId] = useState('');
  const [novoClienteNomeManual, setNovoClienteNomeManual] = useState('');
  const [novoValorTotal, setNovoValorTotal] = useState('');
  const [novasParcelas, setNovasParcelas] = useState('1');

  const [clienteCalculoId, setClienteCalculoId] = useState('');
  const [clienteCalculoNomeManual, setClienteCalculoNomeManual] = useState('');
  const [taxaPerformance, setTaxaPerformance] = useState(30);
  const [parcelasSugeridas, setParcelasSugeridas] = useState(1);
  const [etapas, setEtapas] = useState<EtapaCalculo[]>([criarEtapa(1)]);

  const totalParticipacao = useMemo(
    () => config.marioPct + config.matheusPct + config.igorPct + config.viniciusPct,
    [config]
  );
  const participacaoValida = Math.abs(totalParticipacao - 100) < 0.01;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setWorkspaceLoaded(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<WorkspacePersistido>;

      if (parsed.config) {
        setConfig({
          reservaInicialPct: toFiniteNumber(parsed.config.reservaInicialPct, DEFAULT_DISTRIBUICAO_CONFIG.reservaInicialPct),
          executorPct: toFiniteNumber(parsed.config.executorPct, DEFAULT_DISTRIBUICAO_CONFIG.executorPct),
          reservaCaixaPct: toFiniteNumber(parsed.config.reservaCaixaPct, DEFAULT_DISTRIBUICAO_CONFIG.reservaCaixaPct),
          marioPct: toFiniteNumber(parsed.config.marioPct, DEFAULT_DISTRIBUICAO_CONFIG.marioPct),
          matheusPct: toFiniteNumber(parsed.config.matheusPct, DEFAULT_DISTRIBUICAO_CONFIG.matheusPct),
          igorPct: toFiniteNumber(parsed.config.igorPct, DEFAULT_DISTRIBUICAO_CONFIG.igorPct),
          viniciusPct: toFiniteNumber(parsed.config.viniciusPct, DEFAULT_DISTRIBUICAO_CONFIG.viniciusPct),
        });
      }

      if (Array.isArray(parsed.resumoLinhas)) {
        const linhas = parsed.resumoLinhas
          .map((linha) => ({
            id: typeof linha.id === 'string' && linha.id ? linha.id : criarId('resumo'),
            clienteId: typeof linha.clienteId === 'string' ? linha.clienteId : undefined,
            clienteNome: String(linha.clienteNome || '').trim(),
            valorTotal: toFiniteNumber(linha.valorTotal, 0),
            parcelas: toPositiveInt(linha.parcelas, 1),
          }))
          .filter((linha) => !!linha.clienteNome);

        setResumoLinhas(linhas);
      }

      if (parsed.calculo) {
        setClienteCalculoId(typeof parsed.calculo.clienteId === 'string' ? parsed.calculo.clienteId : '');
        setClienteCalculoNomeManual(
          typeof parsed.calculo.clienteNomeManual === 'string' ? parsed.calculo.clienteNomeManual : ''
        );
        setTaxaPerformance(toFiniteNumber(parsed.calculo.taxaPerformance, 30));
        setParcelasSugeridas(toPositiveInt(parsed.calculo.parcelasSugeridas, 1));

        if (Array.isArray(parsed.calculo.etapas) && parsed.calculo.etapas.length > 0) {
          const etapasPersistidas = parsed.calculo.etapas.map((etapa, index) => ({
            id: typeof etapa.id === 'string' && etapa.id ? etapa.id : criarId(`etapa_${index + 1}`),
            nome: typeof etapa.nome === 'string' && etapa.nome.trim() ? etapa.nome : `PERFORMANCE ${index + 1}`,
            dataInicio: typeof etapa.dataInicio === 'string' ? etapa.dataInicio : '',
            dataFim: typeof etapa.dataFim === 'string' ? etapa.dataFim : '',
            abertura: toFiniteNumber(etapa.abertura, 0),
            fechamento: toFiniteNumber(etapa.fechamento, 0),
            descontos: toFiniteNumber(etapa.descontos, 0),
            benchmarkTipo: BENCHMARK_OPTIONS.includes(etapa.benchmarkTipo) ? etapa.benchmarkTipo : 'IFIX',
            benchmarkValor: toFiniteNumber(etapa.benchmarkValor, 0),
            carregandoBenchmark: false,
            erroBenchmark: '',
          }));

          setEtapas(etapasPersistidas);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar workspace de performance:', error);
    } finally {
      setWorkspaceLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) return;

    const payload: WorkspacePersistido = {
      config,
      resumoLinhas,
      calculo: {
        clienteId: clienteCalculoId,
        clienteNomeManual: clienteCalculoNomeManual,
        taxaPerformance,
        parcelasSugeridas,
        etapas: etapas.map(({ carregandoBenchmark, erroBenchmark, ...restante }) => restante),
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    workspaceLoaded,
    config,
    resumoLinhas,
    clienteCalculoId,
    clienteCalculoNomeManual,
    taxaPerformance,
    parcelasSugeridas,
    etapas,
  ]);

  const linhasResumoCalculadas = useMemo(
    () =>
      resumoLinhas.map((linha) => {
        const distribuicaoTotal = calcularDistribuicao(linha.valorTotal, config);
        const valorParcela = linha.parcelas > 0 ? linha.valorTotal / linha.parcelas : linha.valorTotal;
        const distribuicaoParcela = calcularDistribuicao(valorParcela, config);
        return {
          linha,
          distribuicaoTotal,
          valorParcela: arredondar2(valorParcela),
          distribuicaoParcela,
        };
      }),
    [resumoLinhas, config]
  );

  const totaisResumo = useMemo(
    () =>
      linhasResumoCalculadas.reduce(
        (acc, item) => ({
          valorTotal: arredondar2(acc.valorTotal + item.linha.valorTotal),
          reservaInicial: arredondar2(acc.reservaInicial + item.distribuicaoTotal.reservaInicial),
          executorMario: arredondar2(acc.executorMario + item.distribuicaoTotal.executorMario),
          reservaCaixa: arredondar2(acc.reservaCaixa + item.distribuicaoTotal.reservaCaixa),
          fluxoCaixaEmpresa: arredondar2(acc.fluxoCaixaEmpresa + item.distribuicaoTotal.fluxoCaixaEmpresa),
          mario: arredondar2(acc.mario + item.distribuicaoTotal.mario),
          matheus: arredondar2(acc.matheus + item.distribuicaoTotal.matheus),
          igor: arredondar2(acc.igor + item.distribuicaoTotal.igor),
          vinicius: arredondar2(acc.vinicius + item.distribuicaoTotal.vinicius),
        }),
        {
          valorTotal: 0,
          reservaInicial: 0,
          executorMario: 0,
          reservaCaixa: 0,
          fluxoCaixaEmpresa: 0,
          mario: 0,
          matheus: 0,
          igor: 0,
          vinicius: 0,
        }
      ),
    [linhasResumoCalculadas]
  );

  const clienteCalculoNome = useMemo(() => {
    const selecionado = clientes.find((cliente) => cliente.id === clienteCalculoId);
    return selecionado?.nome || clienteCalculoNomeManual.trim();
  }, [clienteCalculoId, clienteCalculoNomeManual, clientes]);

  const etapasComResultado = useMemo(
    () =>
      etapas.map((etapa) => ({
        etapa,
        resultado: calcularResultadoEtapa(etapa, taxaPerformance),
      })),
    [etapas, taxaPerformance]
  );

  const totalResultadoBruto = useMemo(
    () => arredondar2(etapasComResultado.reduce((acc, item) => acc + item.resultado.resultadoBruto, 0)),
    [etapasComResultado]
  );

  const totalPerformanceAPagar = useMemo(
    () => arredondar2(etapasComResultado.reduce((acc, item) => acc + item.resultado.valorTaxaPerformance, 0)),
    [etapasComResultado]
  );

  const adicionarLinhaResumo = () => {
    const valorTotal = toFiniteNumber(novoValorTotal, 0);
    const parcelas = toPositiveInt(novasParcelas, 1);
    const clienteSelecionado = clientes.find((cliente) => cliente.id === novoClienteId);
    const clienteNome = clienteSelecionado?.nome || novoClienteNomeManual.trim();

    if (!clienteNome) {
      alert('Selecione um cliente ou informe um nome manual.');
      return;
    }

    if (valorTotal <= 0) {
      alert('Informe um valor total maior que zero.');
      return;
    }

    setResumoLinhas((prev) => [
      {
        id: criarId('resumo'),
        clienteId: clienteSelecionado?.id,
        clienteNome,
        valorTotal: arredondar2(valorTotal),
        parcelas,
      },
      ...prev,
    ]);

    setNovoClienteId('');
    setNovoClienteNomeManual('');
    setNovoValorTotal('');
    setNovasParcelas('1');
  };

  const atualizarLinhaResumo = (id: string, patch: Partial<ResumoLinha>) => {
    setResumoLinhas((prev) =>
      prev.map((linha) => {
        if (linha.id !== id) return linha;
        return {
          ...linha,
          ...patch,
          valorTotal: patch.valorTotal !== undefined ? arredondar2(Math.max(0, patch.valorTotal)) : linha.valorTotal,
          parcelas: patch.parcelas !== undefined ? toPositiveInt(patch.parcelas, linha.parcelas) : linha.parcelas,
        };
      })
    );
  };

  const removerLinhaResumo = (id: string) => {
    setResumoLinhas((prev) => prev.filter((linha) => linha.id !== id));
  };

  const limparResumo = () => {
    if (!window.confirm('Deseja limpar todos os lançamentos do resumo?')) return;
    setResumoLinhas([]);
  };

  const atualizarConfig = (campo: keyof DistribuicaoConfig, valor: number) => {
    setConfig((prev) => ({
      ...prev,
      [campo]: toFiniteNumber(valor, prev[campo]),
    }));
  };

  const atualizarEtapa = <K extends keyof EtapaCalculo>(
    etapaId: string,
    campo: K,
    valor: EtapaCalculo[K]
  ) => {
    setEtapas((prev) =>
      prev.map((etapa) => (etapa.id === etapaId ? { ...etapa, [campo]: valor } : etapa))
    );
  };

  const adicionarEtapa = () => {
    setEtapas((prev) => [...prev, criarEtapa(prev.length + 1)]);
  };

  const removerEtapa = (etapaId: string) => {
    if (etapas.length <= 1) return;
    setEtapas((prev) => prev.filter((etapa) => etapa.id !== etapaId));
  };

  const limparCalculoIndividual = () => {
    if (!window.confirm('Deseja resetar o cálculo individual do cliente?')) return;
    setClienteCalculoId('');
    setClienteCalculoNomeManual('');
    setTaxaPerformance(30);
    setParcelasSugeridas(1);
    setEtapas([criarEtapa(1)]);
  };

  const atualizarBenchmarkEtapa = async (etapaId: string) => {
    const etapa = etapas.find((item) => item.id === etapaId);
    if (!etapa) return;

    if (etapa.benchmarkTipo === 'MANUAL') {
      atualizarEtapa(etapaId, 'erroBenchmark', '');
      return;
    }

    if (!etapa.dataInicio || !etapa.dataFim) {
      atualizarEtapa(etapaId, 'erroBenchmark', 'Informe data inicial e final para buscar benchmark.');
      return;
    }

    const inicio = new Date(etapa.dataInicio);
    const fim = new Date(etapa.dataFim);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) {
      atualizarEtapa(etapaId, 'erroBenchmark', 'Período inválido para o benchmark.');
      return;
    }

    atualizarEtapa(etapaId, 'carregandoBenchmark', true);
    atualizarEtapa(etapaId, 'erroBenchmark', '');

    const valor = await buscarBenchmarkPorPeriodo(etapa.benchmarkTipo, etapa.dataInicio, etapa.dataFim);

    if (valor === null) {
      atualizarEtapa(etapaId, 'carregandoBenchmark', false);
      atualizarEtapa(
        etapaId,
        'erroBenchmark',
        `Não foi possível buscar ${etapa.benchmarkTipo} automaticamente. Informe o valor manualmente.`
      );
      return;
    }

    atualizarEtapa(etapaId, 'benchmarkValor', arredondar2(valor));
    atualizarEtapa(etapaId, 'carregandoBenchmark', false);
    atualizarEtapa(etapaId, 'erroBenchmark', '');
  };

  const atualizarTodosBenchmarks = async () => {
    for (const etapa of etapas) {
      if (etapa.benchmarkTipo !== 'MANUAL') {
        // eslint-disable-next-line no-await-in-loop
        await atualizarBenchmarkEtapa(etapa.id);
      }
    }
  };

  const enviarTotalParaResumo = () => {
    if (!clienteCalculoNome) {
      alert('Selecione o cliente no cálculo individual.');
      return;
    }

    if (totalPerformanceAPagar <= 0) {
      alert('O total da performance está zero ou negativo. Ajuste o cálculo antes de enviar ao resumo.');
      return;
    }

    const parcelas = toPositiveInt(parcelasSugeridas, 1);
    setResumoLinhas((prev) => [
      {
        id: criarId('resumo'),
        clienteId: clienteCalculoId || undefined,
        clienteNome: clienteCalculoNome,
        valorTotal: totalPerformanceAPagar,
        parcelas,
      },
      ...prev,
    ]);
    setAbaAtiva('resumo');
  };

  return (
    <div className="performance-page">
      <div className="page-header">
        <h1>Performance</h1>
        <p className="page-subtitle">
          Resumo de cobrança/distribuição e cálculo individual por etapa de carteira.
        </p>
      </div>

      <div className="performance-tabs">
        <button
          type="button"
          className={`performance-tab ${abaAtiva === 'resumo' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('resumo')}
        >
          Resumo e Distribuição
        </button>
        <button
          type="button"
          className={`performance-tab ${abaAtiva === 'individual' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('individual')}
        >
          Cálculo Individual
        </button>
      </div>

      {abaAtiva === 'resumo' ? (
        <>
          <Card title="Regras de Distribuição" className="performance-card">
            <div className="performance-config-grid">
              <label>
                Reserva inicial (%)
                <input
                  type="number"
                  value={config.reservaInicialPct}
                  onChange={(event) => atualizarConfig('reservaInicialPct', Number(event.target.value))}
                  step="0.01"
                />
              </label>
              <label>
                Executor Mario (%)
                <input
                  type="number"
                  value={config.executorPct}
                  onChange={(event) => atualizarConfig('executorPct', Number(event.target.value))}
                  step="0.01"
                />
              </label>
              <label>
                Reserva caixa (%)
                <input
                  type="number"
                  value={config.reservaCaixaPct}
                  onChange={(event) => atualizarConfig('reservaCaixaPct', Number(event.target.value))}
                  step="0.01"
                />
              </label>
              <label>
                Mario (%)
                <input
                  type="number"
                  value={config.marioPct}
                  onChange={(event) => atualizarConfig('marioPct', Number(event.target.value))}
                  step="0.01"
                />
              </label>
              <label>
                Matheus (%)
                <input
                  type="number"
                  value={config.matheusPct}
                  onChange={(event) => atualizarConfig('matheusPct', Number(event.target.value))}
                  step="0.01"
                />
              </label>
              <label>
                Igor (%)
                <input
                  type="number"
                  value={config.igorPct}
                  onChange={(event) => atualizarConfig('igorPct', Number(event.target.value))}
                  step="0.01"
                />
              </label>
              <label>
                Vinicius (%)
                <input
                  type="number"
                  value={config.viniciusPct}
                  onChange={(event) => atualizarConfig('viniciusPct', Number(event.target.value))}
                  step="0.01"
                />
              </label>
            </div>
            {!participacaoValida && (
              <p className="performance-warning">
                A participação individual soma {totalParticipacao.toFixed(2)}%. O ideal é 100%.
              </p>
            )}
          </Card>

          <Card title="Lançar Cobrança de Performance" className="performance-card">
            <div className="performance-form-grid">
              <label>
                Cliente (cadastro)
                <select
                  value={novoClienteId}
                  onChange={(event) => setNovoClienteId(event.target.value)}
                >
                  <option value="">Selecionar cliente</option>
                  {clientes
                    .slice()
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
                    .map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Cliente manual
                <input
                  type="text"
                  value={novoClienteNomeManual}
                  onChange={(event) => setNovoClienteNomeManual(event.target.value)}
                  placeholder="Use quando não estiver no cadastro"
                />
              </label>
              <label>
                Valor total (R$)
                <input
                  type="number"
                  value={novoValorTotal}
                  onChange={(event) => setNovoValorTotal(event.target.value)}
                  min="0"
                  step="0.01"
                />
              </label>
              <label>
                Parcelas
                <input
                  type="number"
                  value={novasParcelas}
                  onChange={(event) => setNovasParcelas(event.target.value)}
                  min="1"
                  step="1"
                />
              </label>
            </div>
            <div className="performance-actions-inline">
              <button type="button" className="performance-btn primary" onClick={adicionarLinhaResumo}>
                Adicionar no Resumo
              </button>
              <button
                type="button"
                className="performance-btn secondary"
                onClick={() => {
                  setNovoClienteId('');
                  setNovoClienteNomeManual('');
                  setNovoValorTotal('');
                  setNovasParcelas('1');
                }}
              >
                Limpar formulário
              </button>
            </div>
          </Card>

          <div className="performance-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Total a receber</span>
              <strong>{formatCurrency(totaisResumo.valorTotal)}</strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Fluxo de caixa (empresa)</span>
              <strong>{formatCurrency(totaisResumo.fluxoCaixaEmpresa)}</strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Executor Mario</span>
              <strong>{formatCurrency(totaisResumo.executorMario)}</strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Reserva total</span>
              <strong>{formatCurrency(totaisResumo.reservaInicial + totaisResumo.reservaCaixa)}</strong>
            </div>
          </div>

          <Card title="Resumo Consolidado" className="performance-card">
            <div className="performance-table-wrap">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Valor total</th>
                    <th>Parcelas</th>
                    <th>Valor parcela</th>
                    <th>Reserva/parcela</th>
                    <th>Executor/parcela</th>
                    <th>Reserva caixa/parcela</th>
                    <th>Fluxo/parcela</th>
                    <th>Mario/parcela</th>
                    <th>Matheus/parcela</th>
                    <th>Igor/parcela</th>
                    <th>Vinicius/parcela</th>
                    <th>Reserva 10%</th>
                    <th>Executor</th>
                    <th>Reserva caixa</th>
                    <th>Fluxo caixa</th>
                    <th>Mario</th>
                    <th>Matheus</th>
                    <th>Igor</th>
                    <th>Vinicius</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasResumoCalculadas.length === 0 ? (
                    <tr>
                      <td colSpan={21} className="empty-row">
                        Nenhum lançamento ainda.
                      </td>
                    </tr>
                  ) : (
                    linhasResumoCalculadas.map((item) => (
                      <tr key={item.linha.id}>
                        <td>{item.linha.clienteNome}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.linha.valorTotal}
                            onChange={(event) =>
                              atualizarLinhaResumo(item.linha.id, {
                                valorTotal: Number(event.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.linha.parcelas}
                            onChange={(event) =>
                              atualizarLinhaResumo(item.linha.id, {
                                parcelas: Number(event.target.value) || 1,
                              })
                            }
                          />
                        </td>
                        <td>{formatCurrency(item.valorParcela)}</td>
                        <td>{formatCurrency(item.distribuicaoParcela.reservaInicial)}</td>
                        <td>{formatCurrency(item.distribuicaoParcela.executorMario)}</td>
                        <td>{formatCurrency(item.distribuicaoParcela.reservaCaixa)}</td>
                        <td>{formatCurrency(item.distribuicaoParcela.fluxoCaixaEmpresa)}</td>
                        <td>{formatCurrency(item.distribuicaoParcela.mario)}</td>
                        <td>{formatCurrency(item.distribuicaoParcela.matheus)}</td>
                        <td>{formatCurrency(item.distribuicaoParcela.igor)}</td>
                        <td>{formatCurrency(item.distribuicaoParcela.vinicius)}</td>
                        <td>{formatCurrency(item.distribuicaoTotal.reservaInicial)}</td>
                        <td>{formatCurrency(item.distribuicaoTotal.executorMario)}</td>
                        <td>{formatCurrency(item.distribuicaoTotal.reservaCaixa)}</td>
                        <td className="highlight-cell">{formatCurrency(item.distribuicaoTotal.fluxoCaixaEmpresa)}</td>
                        <td>{formatCurrency(item.distribuicaoTotal.mario)}</td>
                        <td>{formatCurrency(item.distribuicaoTotal.matheus)}</td>
                        <td>{formatCurrency(item.distribuicaoTotal.igor)}</td>
                        <td>{formatCurrency(item.distribuicaoTotal.vinicius)}</td>
                        <td>
                          <button
                            type="button"
                            className="performance-btn danger"
                            onClick={() => removerLinhaResumo(item.linha.id)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {linhasResumoCalculadas.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td>{formatCurrency(totaisResumo.valorTotal)}</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>{formatCurrency(totaisResumo.reservaInicial)}</td>
                      <td>{formatCurrency(totaisResumo.executorMario)}</td>
                      <td>{formatCurrency(totaisResumo.reservaCaixa)}</td>
                      <td>{formatCurrency(totaisResumo.fluxoCaixaEmpresa)}</td>
                      <td>{formatCurrency(totaisResumo.mario)}</td>
                      <td>{formatCurrency(totaisResumo.matheus)}</td>
                      <td>{formatCurrency(totaisResumo.igor)}</td>
                      <td>{formatCurrency(totaisResumo.vinicius)}</td>
                      <td>-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="performance-actions-inline">
              <button type="button" className="performance-btn secondary" onClick={limparResumo}>
                Limpar resumo
              </button>
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card title="Configuração do Cliente" className="performance-card">
            <div className="performance-form-grid">
              <label>
                Cliente (cadastro)
                <select
                  value={clienteCalculoId}
                  onChange={(event) => setClienteCalculoId(event.target.value)}
                >
                  <option value="">Selecionar cliente</option>
                  {clientes
                    .slice()
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
                    .map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Cliente manual
                <input
                  type="text"
                  value={clienteCalculoNomeManual}
                  onChange={(event) => setClienteCalculoNomeManual(event.target.value)}
                  placeholder="Nome para relatório"
                />
              </label>
              <label>
                Taxa de performance (%)
                <input
                  type="number"
                  value={taxaPerformance}
                  onChange={(event) => setTaxaPerformance(toFiniteNumber(event.target.value, 30))}
                  step="0.1"
                />
              </label>
              <label>
                Parcelas sugeridas
                <input
                  type="number"
                  value={parcelasSugeridas}
                  onChange={(event) => setParcelasSugeridas(toPositiveInt(event.target.value, 1))}
                  min="1"
                  step="1"
                />
              </label>
            </div>
            <div className="performance-actions-inline">
              <button type="button" className="performance-btn primary" onClick={adicionarEtapa}>
                + Nova etapa
              </button>
              <button type="button" className="performance-btn secondary" onClick={atualizarTodosBenchmarks}>
                Atualizar benchmarks
              </button>
              <button type="button" className="performance-btn danger" onClick={limparCalculoIndividual}>
                Limpar cálculo
              </button>
            </div>
          </Card>

          <div className="performance-etapas-grid">
            {etapasComResultado.map(({ etapa, resultado }, index) => (
              <Card key={etapa.id} title={`Etapa ${index + 1}`} className="performance-card etapa-card">
                <div className="etapa-header">
                  <input
                    type="text"
                    value={etapa.nome}
                    onChange={(event) => atualizarEtapa(etapa.id, 'nome', event.target.value)}
                  />
                  <button
                    type="button"
                    className="performance-btn danger"
                    onClick={() => removerEtapa(etapa.id)}
                    disabled={etapas.length <= 1}
                  >
                    Remover
                  </button>
                </div>

                <div className="performance-form-grid">
                  <label>
                    Início
                    <input
                      type="date"
                      value={etapa.dataInicio}
                      onChange={(event) => atualizarEtapa(etapa.id, 'dataInicio', event.target.value)}
                    />
                  </label>
                  <label>
                    Fim
                    <input
                      type="date"
                      value={etapa.dataFim}
                      onChange={(event) => atualizarEtapa(etapa.id, 'dataFim', event.target.value)}
                    />
                  </label>
                  <label>
                    Abertura (R$)
                    <input
                      type="number"
                      value={etapa.abertura}
                      onChange={(event) => atualizarEtapa(etapa.id, 'abertura', toFiniteNumber(event.target.value, 0))}
                      min="0"
                      step="0.01"
                    />
                  </label>
                  <label>
                    Fechamento (R$)
                    <input
                      type="number"
                      value={etapa.fechamento}
                      onChange={(event) => atualizarEtapa(etapa.id, 'fechamento', toFiniteNumber(event.target.value, 0))}
                      min="0"
                      step="0.01"
                    />
                  </label>
                  <label>
                    Descontos (R$)
                    <input
                      type="number"
                      value={etapa.descontos}
                      onChange={(event) => atualizarEtapa(etapa.id, 'descontos', toFiniteNumber(event.target.value, 0))}
                      step="0.01"
                    />
                  </label>
                  <label>
                    Benchmark
                    <select
                      value={etapa.benchmarkTipo}
                      onChange={(event) =>
                        atualizarEtapa(etapa.id, 'benchmarkTipo', event.target.value as BenchmarkTipo)
                      }
                    >
                      {BENCHMARK_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Benchmark (%) no período
                    <input
                      type="number"
                      value={etapa.benchmarkValor}
                      onChange={(event) =>
                        atualizarEtapa(etapa.id, 'benchmarkValor', toFiniteNumber(event.target.value, 0))
                      }
                      step="0.01"
                    />
                  </label>
                </div>

                <div className="performance-actions-inline">
                  <button
                    type="button"
                    className="performance-btn secondary"
                    onClick={() => atualizarBenchmarkEtapa(etapa.id)}
                    disabled={etapa.benchmarkTipo === 'MANUAL' || etapa.carregandoBenchmark}
                  >
                    {etapa.carregandoBenchmark ? 'Buscando...' : 'Buscar benchmark'}
                  </button>
                </div>

                {etapa.erroBenchmark && <p className="performance-warning">{etapa.erroBenchmark}</p>}

                <div className="etapa-results-grid">
                  <div className="result-item">
                    <span>Patrimônio líquido</span>
                    <strong>{formatCurrency(resultado.patrimonioLiquido)}</strong>
                  </div>
                  <div className="result-item">
                    <span>Var carteira</span>
                    <strong className={resultado.variacaoCarteiraPct >= 0 ? 'positive' : 'negative'}>
                      {resultado.variacaoCarteiraPct.toFixed(2)}%
                    </strong>
                  </div>
                  <div className="result-item">
                    <span>Alpha</span>
                    <strong className={resultado.alphaPct >= 0 ? 'positive' : 'negative'}>
                      {resultado.alphaPct.toFixed(2)}%
                    </strong>
                  </div>
                  <div className="result-item">
                    <span>Final etapa (R$)</span>
                    <strong className={resultado.resultadoBruto >= 0 ? 'positive' : 'negative'}>
                      {formatCurrency(resultado.resultadoBruto)}
                    </strong>
                  </div>
                  <div className="result-item">
                    <span>Taxa etapa (R$)</span>
                    <strong className={resultado.valorTaxaPerformance >= 0 ? 'positive' : 'negative'}>
                      {formatCurrency(resultado.valorTaxaPerformance)}
                    </strong>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card title="Resumo do Cálculo Individual" className="performance-card">
            <div className="performance-summary-grid">
              <div className="summary-item">
                <span>Cliente</span>
                <strong>{clienteCalculoNome || 'Não definido'}</strong>
              </div>
              <div className="summary-item">
                <span>Taxa de performance</span>
                <strong>{taxaPerformance.toFixed(2)}%</strong>
              </div>
              <div className="summary-item">
                <span>Resultado bruto total</span>
                <strong className={totalResultadoBruto >= 0 ? 'positive' : 'negative'}>
                  {formatCurrency(totalResultadoBruto)}
                </strong>
              </div>
              <div className="summary-item highlight">
                <span>Performance total a pagar</span>
                <strong className={totalPerformanceAPagar >= 0 ? 'positive' : 'negative'}>
                  {formatCurrency(totalPerformanceAPagar)}
                </strong>
              </div>
            </div>

            <div className="performance-actions-inline">
              <button type="button" className="performance-btn primary" onClick={enviarTotalParaResumo}>
                Enviar total para Resumo
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
