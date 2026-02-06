import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import Card from '../../components/Card/Card';
import { useEstrategias } from '../../hooks/useEstrategias';
import {
  EstrategiaDiariaEntry,
  exportarEstrategiaDiariaParaExcel,
  exportarTemplateEstrategiaDiaria,
  importarExcelParaEstrategiaDiaria,
} from '../../services/estrategiaDiariaPlanilhaService';
import { gerarRelatorioEstrategiaDiariaPDF } from '../../services/pdfGenerator';
import './EstrategiaDiariaPage.css';

const STORAGE_KEY = 'estrategia_diaria_dados_v1';

const formatPercent = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

const formatSignedPercent = (value: number) =>
  `${value > 0 ? '+' : ''}${formatPercent(value)}`;

const formatRatio = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCdiFactor = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 });

const formatNumber = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCota = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });

const parseNumberInput = (value: string): number => {
  if (!value) return 0;
  const raw = value.trim();
  if (!raw) return 0;

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  let normalized = raw;
  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }

  normalized = normalized.replace(/[^\d.-]/g, '');
  const numero = Number(normalized);
  return Number.isNaN(numero) ? 0 : numero;
};

const formatDecimalWhileTyping = (value: string, maxDecimals = 6): string => {
  const permitido = value.replace(/[^\d,]/g, '');
  if (!permitido) return '';

  if (permitido.includes(',')) {
    const partes = permitido.split(',');
    const parteInteira = partes[0].replace(/\D/g, '');
    const parteDecimal = partes[1]?.replace(/\D/g, '').substring(0, maxDecimals) || '';
    const parteInteiraFormatada = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parteDecimal ? `${parteInteiraFormatada},${parteDecimal}` : `${parteInteiraFormatada},`;
  }

  const numeros = permitido.replace(/\D/g, '');
  return numeros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseCdiRate = (value: string): number => {
  const isPercent = value.includes('%');
  const numero = parseNumberInput(value.replace(/%/g, ''));
  if (!numero) return 0;
  return isPercent ? numero / 100 : numero;
};

const formatDatePtBr = (data: string) => {
  if (!data) return '';
  const [ano, mes, dia] = data.split('-');
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
};

const DIAS_UTEIS_ANO = 252;
const STRATEGY_NAME_KEY = 'estrategia_diaria_nome';
const STRATEGY_ID_KEY = 'estrategia_diaria_id';
const STRATEGY_DATA_KEY = 'estrategia_diaria_por_estrategia';
const PERIOD_FILTER_KEY = 'estrategia_diaria_periodo';

const loadEntriesFromStorage = (): EstrategiaDiariaEntry[] => {
  const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as EstrategiaDiariaEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadEntriesMap = (): Record<string, EstrategiaDiariaEntry[]> => {
  const raw = localStorage.getItem(STRATEGY_DATA_KEY) || sessionStorage.getItem(STRATEGY_DATA_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, EstrategiaDiariaEntry[]>;
  } catch {
    return {};
  }
};

const saveEntriesMap = (map: Record<string, EstrategiaDiariaEntry[]>) => {
  try {
    localStorage.setItem(STRATEGY_DATA_KEY, JSON.stringify(map));
  } catch {
    sessionStorage.setItem(STRATEGY_DATA_KEY, JSON.stringify(map));
  }
};

const normalizeEntries = (entries: EstrategiaDiariaEntry[]) =>
  entries.map((item) => {
    const cdiRate = item.resultadoCdi || 0;
    const fatorCalculado = cdiRate > 0 ? 1 + cdiRate : 0;

    return {
      ...item,
      resultadoCdi: cdiRate,
      resultadoIfix: item.resultadoIfix || 0,
      fatorDiario: fatorCalculado,
    };
  });

export default function EstrategiaDiariaPage() {
  const { estrategias } = useEstrategias();
  const [entries, setEntries] = useState<EstrategiaDiariaEntry[]>([]);
  const [strategyId, setStrategyId] = useState('');
  const [data, setData] = useState('');
  const [periodo, setPeriodo] = useState<'1m' | '3m' | '6m' | '12m' | 'all'>('all');
  const [patrimonioInput, setPatrimonioInput] = useState('');
  const [cdiInput, setCdiInput] = useState('');
  const [ifixInput, setIfixInput] = useState('');
  const [importando, setImportando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [sucesso, setSucesso] = useState('');
  const estrategiaSelecionada = useMemo(
    () => estrategias.find((estrategia) => estrategia.id === strategyId),
    [estrategias, strategyId]
  );
  const benchmarkLabel = estrategiaSelecionada?.benchmark?.trim() || 'IFIX';

  useEffect(() => {
    const map = loadEntriesMap();
    const hasMapData = Object.keys(map).length > 0;
    if (hasMapData) {
      if (strategyId && map[strategyId]) {
        setEntries(normalizeEntries(map[strategyId]));
      } else {
        setEntries([]);
      }
      return;
    }

    const parsed = loadEntriesFromStorage();
    if (!parsed.length) return;
    const normalizados = normalizeEntries(parsed);
    setEntries(normalizados);

    if (strategyId) {
      map[strategyId] = normalizados;
      saveEntriesMap(map);
    }
  }, [strategyId]);

  useEffect(() => {
    if (!strategyId) return;
    const map = loadEntriesMap();
    map[strategyId] = entries;
    saveEntriesMap(map);
  }, [entries, strategyId]);

  useEffect(() => {
    if (strategyId) return;
    const savedId = localStorage.getItem(STRATEGY_ID_KEY);
    const savedName = localStorage.getItem(STRATEGY_NAME_KEY);

    if (savedId) {
      setStrategyId(savedId);
      return;
    }

    if (savedName && estrategias.length > 0) {
      const match = estrategias.find((estrategia) => estrategia.nome === savedName);
      if (match) {
        setStrategyId(match.id);
        return;
      }
    }

    if (estrategias.length > 0) {
      const defaultId =
        estrategias.find((estrategia) => estrategia.nome === 'Carteira Tática')?.id ||
        estrategias[0].id;
      setStrategyId(defaultId);
    }
  }, [estrategias, strategyId]);

  useEffect(() => {
    if (strategyId) {
      localStorage.setItem(STRATEGY_ID_KEY, strategyId);
      const nome = estrategias.find((estrategia) => estrategia.id === strategyId)?.nome;
      if (nome) localStorage.setItem(STRATEGY_NAME_KEY, nome);
    }
  }, [strategyId, estrategias]);

  useEffect(() => {
    const savedPeriod = localStorage.getItem(PERIOD_FILTER_KEY) as
      | '1m'
      | '3m'
      | '6m'
      | '12m'
      | 'all'
      | null;
    if (savedPeriod) setPeriodo(savedPeriod);
  }, []);

  useEffect(() => {
    localStorage.setItem(PERIOD_FILTER_KEY, periodo);
  }, [periodo]);

  const entriesOrdenadas = useMemo(
    () => [...entries].sort((a, b) => a.data.localeCompare(b.data)),
    [entries]
  );

  const entriesFiltradas = useMemo(() => {
    if (periodo === 'all' || entriesOrdenadas.length === 0) return entriesOrdenadas;
    const endIso = entriesOrdenadas[entriesOrdenadas.length - 1]?.data;
    if (!endIso) return entriesOrdenadas;

    const monthKey = (iso?: string) => (iso ? iso.slice(0, 7) : '');
    const monthKeyOffset = (iso: string, offset: number) => {
      const [ano, mes] = iso.split('-').map(Number);
      if (!ano || !mes) return '';
      const base = ano * 12 + (mes - 1) - offset;
      const targetAno = Math.floor(base / 12);
      const targetMes = (base % 12) + 1;
      return `${targetAno}-${String(targetMes).padStart(2, '0')}`;
    };

    const ultimoPorMes = new Map<string, EstrategiaDiariaEntry>();
    entriesOrdenadas.forEach((item) => {
      ultimoPorMes.set(monthKey(item.data), item);
    });

    const monthsMap: Record<'1m' | '3m' | '6m' | '12m', number> = {
      '1m': 1,
      '3m': 3,
      '6m': 6,
      '12m': 12,
    };
    const meses = monthsMap[periodo];
    const startIso = ultimoPorMes.get(monthKeyOffset(endIso, meses))?.data || entriesOrdenadas[0]?.data;

    return entriesOrdenadas.filter((item) => item.data >= startIso && item.data <= endIso);
  }, [entriesOrdenadas, periodo]);

  const totalDias = entriesFiltradas.length;
  const temDados = entriesFiltradas.length > 0;

  const {
    resultadoCarteira,
    cdiPeriodo,
    ifixPeriodo,
    volatilidadeAnual,
    sharpe,
    drawdownMaximo,
    chartData,
    resumoBase,
  } = useMemo(() => {
    if (entriesFiltradas.length < 2) {
      return {
        resultadoCarteira: 0,
        cdiPeriodo: 0,
        ifixPeriodo: 0,
        volatilidadeAnual: 0,
        sharpe: 0,
        drawdownMaximo: 0,
        chartData: [],
        resumoBase: {
          cotaInicial: 0,
          cotaFinal: 0,
          dataInicial: '',
          dataFinal: '',
        },
      };
    }

    const netReturns: number[] = [];
    const chartData: Array<{ data: string; carteira: number; cdi: number; ifix: number }> = [];

    const firstCota = entriesFiltradas.find((item) => item.patrimonio > 0)?.patrimonio || 0;
    const lastCota = [...entriesFiltradas].reverse().find((item) => item.patrimonio > 0)?.patrimonio || 0;
    const firstCdi = entriesFiltradas.find((item) => item.resultadoCdi > 0)?.resultadoCdi || 0;
    const lastCdi = [...entriesFiltradas].reverse().find((item) => item.resultadoCdi > 0)?.resultadoCdi || 0;
    const ifixBaseInicial =
      entriesFiltradas.find((item) => item.resultadoIfix > 0)?.resultadoIfix || 0;
    const resultadoCarteira = firstCota > 0 && lastCota > 0 ? lastCota / firstCota - 1 : 0;
    const cdiPeriodo = firstCdi > 0 && lastCdi > 0 ? (1 + lastCdi) / (1 + firstCdi) - 1 : 0;

    entriesFiltradas.forEach((item, idx) => {
      if (idx > 0) {
        const anterior = entriesFiltradas[idx - 1];
        if (anterior.patrimonio > 0 && item.patrimonio > 0) {
          const retornoBruto = item.patrimonio / anterior.patrimonio - 1;
          netReturns.push(retornoBruto);
        }
      }

      const carteiraRetorno = firstCota > 0 && item.patrimonio > 0 ? item.patrimonio / firstCota - 1 : 0;
    const cdiRetorno =
        firstCdi > 0 && item.resultadoCdi > 0
          ? (1 + item.resultadoCdi) / (1 + firstCdi) - 1
          : 0;
      const ifixRetorno = ifixBaseInicial > 0 && item.resultadoIfix > 0
        ? item.resultadoIfix / ifixBaseInicial - 1
        : 0;

      chartData.push({
        data: formatDatePtBr(item.data),
        carteira: carteiraRetorno * 100,
        cdi: cdiRetorno * 100,
        ifix: ifixRetorno * 100,
      });
    });

    const curvaLiquida: number[] = [];
    let cotaCurva = 1;
    netReturns.forEach((retorno) => {
      cotaCurva *= 1 + retorno;
      curvaLiquida.push(cotaCurva);
    });

    let drawdownMaximo = 0;
    let pico = 1;
    curvaLiquida.forEach((valor) => {
      if (valor > pico) {
        pico = valor;
        return;
      }
      const drawdown = valor / pico - 1;
      if (drawdown < drawdownMaximo) drawdownMaximo = drawdown;
    });

    const calcStd = (values: number[]) => {
      if (values.length < 2) return 0;
      const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
      const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
      return Math.sqrt(variance);
    };

    const desvioPadrao = calcStd(netReturns);
    const volatilidadeAnual = desvioPadrao * Math.sqrt(DIAS_UTEIS_ANO);

    const periodoAnos = Math.max(netReturns.length, 1) / DIAS_UTEIS_ANO;
    const retornoAnualizado = periodoAnos > 0 ? Math.pow(1 + resultadoCarteira, 1 / periodoAnos) - 1 : 0;
    const cdiAnualizado = periodoAnos > 0 ? Math.pow(1 + cdiPeriodo, 1 / periodoAnos) - 1 : 0;
    const excessoAnualizado = retornoAnualizado - cdiAnualizado;
    const sharpe = volatilidadeAnual > 0 ? excessoAnualizado / volatilidadeAnual : 0;

    const lastIfix =
      [...entriesFiltradas].reverse().find((item) => item.resultadoIfix > 0)?.resultadoIfix || 0;
    const ifixPeriodo = ifixBaseInicial > 0 && lastIfix > 0
      ? lastIfix / ifixBaseInicial - 1
      : 0;

    return {
      resultadoCarteira,
      cdiPeriodo,
      ifixPeriodo,
      volatilidadeAnual,
      sharpe,
      drawdownMaximo,
      chartData,
      resumoBase: {
        cotaInicial: firstCota,
        cotaFinal: lastCota,
        dataInicial: entriesFiltradas[0]?.data || '',
        dataFinal: entriesFiltradas[entriesFiltradas.length - 1]?.data || '',
      },
    };
  }, [entriesFiltradas]);

  const alphaCdi = resultadoCarteira - cdiPeriodo;
  const alphaIfix = resultadoCarteira - ifixPeriodo;

  const limparFormulario = () => {
    setData('');
    setPatrimonioInput('');
    setCdiInput('');
    setIfixInput('');
  };

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!data) return;

    if (!strategyId) {
      alert('Selecione uma estratégia antes de salvar.');
      return;
    }

    const cdiRate = parseCdiRate(cdiInput);
    const novo: EstrategiaDiariaEntry = {
      id: crypto.randomUUID(),
      data,
      patrimonio: parseNumberInput(patrimonioInput),
      resultadoCdi: cdiRate,
      resultadoIfix: parseNumberInput(ifixInput),
      fatorDiario: cdiRate > 0 ? 1 + cdiRate : 0,
    };

    setEntries((prev) => {
      const existe = prev.find((item) => item.data === data);
      if (!existe) return [...prev, novo];

      return prev.map((item) => (item.data === data ? { ...item, ...novo, id: item.id } : item));
    });

    limparFormulario();
  };

  const handleExportarTemplate = () => {
    try {
      exportarTemplateEstrategiaDiaria();
      setSucesso('Template Excel baixado com sucesso!');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      alert('Erro ao exportar template: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleExportar = () => {
    try {
      exportarEstrategiaDiariaParaExcel(entriesOrdenadas);
      setSucesso('Planilha exportada com sucesso!');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      alert('Erro ao exportar planilha: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleExportarPdf = async () => {
    setExportandoPdf(true);
    try {
      const estrategiaNome = estrategiaSelecionada?.nome || 'Estratégia';
      const estrategiaDescricao = estrategiaSelecionada?.descricao || '';

      await gerarRelatorioEstrategiaDiariaPDF({
        estrategiaNome,
        descricao: estrategiaDescricao,
        benchmarkLabel,
        periodo:
          resumoBase.dataInicial && resumoBase.dataFinal
            ? `${formatDatePtBr(resumoBase.dataInicial)} - ${formatDatePtBr(resumoBase.dataFinal)}`
            : 'Período não informado',
        dataGeracao: formatDatePtBr(new Date().toISOString().split('T')[0]),
        resumo: [
          { titulo: 'Retorno da Carteira', valor: formatSignedPercent(resultadoCarteira * 100), detalhe: 'Variação da cota' },
          { titulo: 'CDI', valor: formatPercent(cdiPeriodo * 100), detalhe: `Alpha: ${formatSignedPercent(alphaCdi * 100)}` },
          { titulo: benchmarkLabel, valor: formatPercent(ifixPeriodo * 100), detalhe: `Alpha: ${formatSignedPercent(alphaIfix * 100)}` },
          { titulo: 'Volatilidade anualizada', valor: formatPercent(volatilidadeAnual * 100), detalhe: 'Base diária' },
          { titulo: 'Índice de Sharpe', valor: formatRatio(sharpe), detalhe: 'Retorno excedente / risco' },
          { titulo: 'Drawdown máximo', valor: formatPercent(drawdownMaximo * 100), detalhe: 'Maior queda' },
        ],
        chartData,
      });
    } catch (error) {
      alert('Erro ao gerar PDF: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setExportandoPdf(false);
    }
  };

  const handleImportar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    if (!arquivo.name.endsWith('.xlsx') && !arquivo.name.endsWith('.xls')) {
      alert('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    setImportando(true);
    setErros([]);
    setSucesso('');

    try {
      if (!strategyId) {
        alert('Selecione uma estratégia antes de importar.');
        return;
      }

      const resultado = await importarExcelParaEstrategiaDiaria(arquivo);
      const normalizados = normalizeEntries(resultado.entries);
      setEntries(normalizados);
      if (periodo !== 'all') {
        setPeriodo('all');
      }
      const map = loadEntriesMap();
      map[strategyId] = normalizados;
      saveEntriesMap(map);

      if (resultado.erros.length > 0) {
        setErros(resultado.erros);
        alert(`Importação concluída com ${resultado.erros.length} erro(s).`);
      } else {
        setSucesso(`Importação concluída com sucesso! ${resultado.entries.length} dia(s) processado(s).`);
        setTimeout(() => setSucesso(''), 4000);
      }
    } catch (error) {
      alert('Erro ao importar planilha: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setImportando(false);
      event.target.value = '';
    }
  };

  const handleRemove = (id: string) => {
    setEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setEntries([]);
    limparFormulario();
  };

  return (
    <div
      id="estrategia-diaria-page"
      className={`estrategia-diaria-page${exportandoPdf ? ' exporting' : ''}`}
    >
      <div className="estrategia-diaria-header">
        <h2>Dados Diários da Estratégia</h2>
        <p>Informe os valores de cada dia útil para gerar um resumo simples da carteira.</p>
      </div>

      <Card title="Identificação" className="estrategia-diaria-card">
        <div className="estrategia-identificacao">
          <div className="identificacao-item">
            <label htmlFor="strategyId">Estratégia</label>
            <select
              id="strategyId"
              value={strategyId}
              onChange={(event) => setStrategyId(event.target.value)}
            >
              <option value="">Selecione</option>
              {estrategias.map((estrategia) => (
                <option key={estrategia.id} value={estrategia.id}>
                  {estrategia.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="identificacao-item">
            <label htmlFor="periodo">Período</label>
            <select
              id="periodo"
              value={periodo}
              onChange={(event) =>
                setPeriodo(event.target.value as '1m' | '3m' | '6m' | '12m' | 'all')
              }
            >
              <option value="1m">Último 1 mês</option>
              <option value="3m">Últimos 3 meses</option>
              <option value="6m">Últimos 6 meses</option>
              <option value="12m">Últimos 12 meses</option>
              <option value="all">Desde o início</option>
            </select>
          </div>
        </div>
      </Card>

      {!temDados && strategyId && (
        <Card title="Sem dados" className="estrategia-diaria-card">
          <div className="estrategia-empty">Sem dados</div>
        </Card>
      )}

      <Card title="Resumo da Estratégia" className="estrategia-diaria-card resumo-card">
        <div className="resumo-grid">
          <div className="resumo-item destaque">
            <span className="resumo-label">Retorno da Carteira</span>
            <span className="resumo-value">{formatSignedPercent(resultadoCarteira * 100)}</span>
            <span className="resumo-sub">Variação da cota no período</span>
          </div>
          <div className="resumo-item">
            <span className="resumo-label">CDI</span>
            <span className="resumo-value">
              {formatPercent(cdiPeriodo * 100)}
            </span>
            <span className="resumo-sub">Alpha: {formatSignedPercent(alphaCdi * 100)}</span>
          </div>
          <div className="resumo-item">
            <span className="resumo-label">{benchmarkLabel}</span>
            <span className="resumo-value">
              {formatPercent(ifixPeriodo * 100)}
            </span>
            <span className="resumo-sub">Alpha: {formatSignedPercent(alphaIfix * 100)}</span>
          </div>
          <div className="resumo-item">
            <span className="resumo-label">Volatilidade anualizada</span>
            <span className="resumo-value">{formatPercent(volatilidadeAnual * 100)}</span>
            <span className="resumo-sub">Base diária</span>
          </div>
          <div className="resumo-item">
            <span className="resumo-label">Índice de Sharpe</span>
            <span className="resumo-value">{formatRatio(sharpe)}</span>
            <span className="resumo-sub">Retorno excedente / risco</span>
          </div>
          <div className="resumo-item">
            <span className="resumo-label">Drawdown máximo</span>
            <span className="resumo-value">{formatPercent(drawdownMaximo * 100)}</span>
            <span className="resumo-sub">Maior queda da curva</span>
          </div>
          <div className="resumo-item">
            <span className="resumo-label">Cota inicial</span>
            <span className="resumo-value">{resumoBase.cotaInicial > 0 ? formatCota(resumoBase.cotaInicial) : '-'}</span>
            <span className="resumo-sub">Data: {resumoBase.dataInicial ? formatDatePtBr(resumoBase.dataInicial) : '-'}</span>
          </div>
          <div className="resumo-item">
            <span className="resumo-label">Cota final</span>
            <span className="resumo-value">{resumoBase.cotaFinal > 0 ? formatCota(resumoBase.cotaFinal) : '-'}</span>
            <span className="resumo-sub">Data: {resumoBase.dataFinal ? formatDatePtBr(resumoBase.dataFinal) : '-'}</span>
          </div>
          <div className="resumo-item">
            <span className="resumo-label">Dias cadastrados</span>
            <span className="resumo-value">{totalDias}</span>
            <span className="resumo-sub">
              Período: {resumoBase.dataInicial && resumoBase.dataFinal
                ? `${formatDatePtBr(resumoBase.dataInicial)} - ${formatDatePtBr(resumoBase.dataFinal)}`
                : '-'}
            </span>
          </div>
        </div>
      </Card>

      <Card title={`Comparação diária (Carteira x CDI x ${benchmarkLabel})`} className="estrategia-diaria-card">
        {!temDados ? (
          <div className="estrategia-empty">Sem dados</div>
        ) : chartData.length === 0 ? (
          <div className="estrategia-empty">Cadastre ao menos dois dias para ver o gráfico.</div>
        ) : (
          <div className="estrategia-diaria-chart">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="data" tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis tickFormatter={(value) => `${value.toFixed(2)}%`} tick={{ fill: 'var(--text-secondary)' }} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
                <Line
                  type="monotone"
                  dataKey="carteira"
                  name="Carteira"
                  stroke="var(--success-color)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cdi"
                  name="CDI"
                  stroke="var(--secondary-color)"
                  strokeWidth={3}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="ifix"
                  name={benchmarkLabel}
                  stroke="var(--warning-color)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Importar / Exportar Excel" className="estrategia-diaria-card">
        <div className="estrategia-excel-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExportarTemplate}>
            📋 Baixar Template
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportar}
            disabled={entriesOrdenadas.length === 0}
          >
            📥 Exportar Dados
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportarPdf} disabled={exportandoPdf}>
            📄 Exportar PDF
          </button>
          <div className="file-input-wrapper">
            <input
              id="file-input-estrategia"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportar}
              disabled={importando}
              className="file-input"
            />
            <label htmlFor="file-input-estrategia" className="file-input-label">
              {importando ? '⏳ Importando...' : '📤 Importar Excel'}
            </label>
          </div>
        </div>
        {sucesso && <div className="success-banner">{sucesso}</div>}
      </Card>

      <Card title="Inserir dados do dia" className="estrategia-diaria-card">
        <form className="estrategia-diaria-form" onSubmit={handleAdd}>
          <div className="form-field">
            <label htmlFor="data">Dia útil</label>
            <input
              id="data"
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="patrimonio">Valor da cota</label>
            <input
              id="patrimonio"
              type="text"
              value={patrimonioInput}
              onChange={(event) => setPatrimonioInput(formatDecimalWhileTyping(event.target.value, 6))}
              placeholder="1,0000"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="cdi">CDI diário</label>
            <input
              id="cdi"
              type="text"
              value={cdiInput}
              onChange={(event) => setCdiInput(event.target.value.replace(/[^\d.,%]/g, ''))}
              placeholder="0,05% ou 0,0005"
            />
            <small className="info-text">Fator diário = CDI + 1</small>
          </div>
          <div className="form-field">
            <label htmlFor="ifix">{benchmarkLabel} (índice)</label>
            <input
              id="ifix"
              type="text"
              value={ifixInput}
              onChange={(event) => setIfixInput(formatDecimalWhileTyping(event.target.value, 2))}
              placeholder="3.200,50"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClearAll}>
              Limpar tudo
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar dia
            </button>
          </div>
        </form>
      </Card>

      <Card title="Histórico dos dias" className="estrategia-diaria-card">
        {entriesFiltradas.length === 0 ? (
          <div className="estrategia-empty">Sem dados</div>
        ) : (
          <div className="estrategia-diaria-table">
            <table>
              <thead>
                <tr>
                  <th>Dia útil</th>
                  <th>Valor da cota</th>
                  <th>CDI diário</th>
                  <th>Fator Diário</th>
                  <th>{benchmarkLabel} (índice)</th>
                  <th className="col-actions">Ações</th>
                </tr>
              </thead>
              <tbody>
                {entriesFiltradas.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDatePtBr(item.data)}</td>
                    <td>{item.patrimonio > 0 ? formatCota(item.patrimonio) : '-'}</td>
                    <td>{item.resultadoCdi > 0 ? formatPercent(item.resultadoCdi * 100) : '-'}</td>
                    <td>
                      {item.fatorDiario > 0 || item.resultadoCdi > 0
                        ? formatCdiFactor(
                            item.fatorDiario || (item.resultadoCdi > 0 ? 1 + item.resultadoCdi : 0)
                          )
                        : '-'}
                    </td>
                    <td>{item.resultadoIfix > 0 ? formatNumber(item.resultadoIfix) : '-'}</td>
                    <td className="col-actions">
                      <button className="action-btn delete-btn" onClick={() => handleRemove(item.id)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {erros.length > 0 && (
        <Card title="Erros na Importação" className="estrategia-diaria-card hide-on-pdf">
          <div className="estrategia-erros">
            {erros.map((erro, index) => (
              <div key={index} className="error-item">
                ⚠️ {erro}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

