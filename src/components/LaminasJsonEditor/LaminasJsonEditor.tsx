import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useEstrategias } from '../../hooks/useEstrategias';
import type { EstrategiaDiariaEntry } from '../../services/estrategiaDiariaPlanilhaService';
import LaminasEditorPanel from './LaminasEditorPanel';
import LaminasPreviewPanel from './LaminasPreviewPanel';
import {
  DIAS_UTEIS_ANO,
  LAMINA_BLOCKS,
  LAMINA_HIDDEN_KEY,
  LAMINA_LAYOUT_KEY,
  LAMINA_LAYOUT_MODE_KEY,
  LAMINA_LOGOS_KEY,
  LAMINA_STRATEGY_KEY,
  STRATEGY_ID_KEY,
  TEMPLATE_PADRAO,
} from './constants';
import type { DailyMetrics, LaminaLayoutItem, LaminaLayoutMap, LaminaLogoAssets, LaminaTemplate } from './types';
import {
  aplicarBenchmarkLabel,
  aplicarDadosDiarios,
  formatMesAno,
  formatPercent,
  formatRatio,
  formatSignedPercent,
  loadEntriesMap,
  normalizarTemplate,
  normalizeEntries,
} from './utils';
import './LaminasJsonEditor.css';

const TEMPLATE_STORAGE_KEY = 'laminas_template_json_v2';
const NOTES_STORAGE_KEY = 'lamina_notes_v1';

const buildStorageKey = (baseKey: string, strategyId?: string) =>
  strategyId ? `${baseKey}_${strategyId}` : baseKey;

const legacyMigrationKey = (baseKey: string) => `${baseKey}__migrated`;

const loadStrategyStorage = (baseKey: string, strategyId?: string) => {
  const key = buildStorageKey(baseKey, strategyId);
  const saved = localStorage.getItem(key);
  if (saved !== null) return saved;
  if (!strategyId) return null;
  const migrationKey = legacyMigrationKey(baseKey);
  if (localStorage.getItem(migrationKey) === 'true') return null;
  const legacy = localStorage.getItem(baseKey);
  if (legacy !== null) {
    localStorage.setItem(key, legacy);
    localStorage.setItem(migrationKey, 'true');
    return legacy;
  }
  return null;
};

const saveStrategyStorage = (baseKey: string, strategyId: string | undefined, value: string) => {
  localStorage.setItem(buildStorageKey(baseKey, strategyId), value);
};

const removeStrategyStorage = (baseKey: string, strategyId?: string) => {
  localStorage.removeItem(buildStorageKey(baseKey, strategyId));
};

const criarIntroDaDescricao = (descricao?: string): LaminaTemplate['intro'] => {
  if (!descricao) return [];
  const textoLimpo = descricao.trim();
  if (!textoLimpo) return [];
  const partes = textoLimpo
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (partes.length === 0) {
    return [{ texto: textoLimpo }];
  }

  return partes.map((texto) => ({ texto }));
};

export default function LaminasJsonEditor() {
  const { estrategias } = useEstrategias();
  const [template, setTemplate] = useState<LaminaTemplate>(TEMPLATE_PADRAO);
  const [jsonText, setJsonText] = useState(JSON.stringify(TEMPLATE_PADRAO, null, 2));
  const [jsonErro, setJsonErro] = useState('');
  const [salvoMensagem, setSalvoMensagem] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [dailyEntries, setDailyEntries] = useState<EstrategiaDiariaEntry[]>([]);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [exportandoImagem, setExportandoImagem] = useState(false);
  const [layoutMap, setLayoutMap] = useState<LaminaLayoutMap>({});
  const [modoLivre, setModoLivre] = useState(false);
  const [layoutInicializado, setLayoutInicializado] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1.1);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [logoTopo, setLogoTopo] = useState<string | null>(null);
  const [logoRodape, setLogoRodape] = useState<string | null>(null);
  const [hiddenBlocks, setHiddenBlocks] = useState<Record<string, boolean>>({});
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const topbarRef = useRef<HTMLDivElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const atribuicaoRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const tablesRef = useRef<HTMLDivElement | null>(null);
  const mesRef = useRef<HTMLDivElement | null>(null);
  const comentariosRef = useRef<HTMLDivElement | null>(null);
  const operacionalRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const hydratingRef = useRef(false);
  const estrategiaSelecionada = useMemo(
    () => estrategias.find((estrategia) => estrategia.id === strategyId),
    [estrategias, strategyId]
  );
  const benchmarkSelecionado = estrategiaSelecionada?.benchmark?.trim() || 'IFIX';
  const tituloEstrategia = estrategiaSelecionada?.nome?.trim() || '';
  const introDescricao = useMemo(
    () => criarIntroDaDescricao(estrategiaSelecionada?.descricao),
    [estrategiaSelecionada?.descricao]
  );

  useLayoutEffect(() => {
    const updateSize = () => {
      const el = previewRef.current;
      if (!el) return;
      setPreviewSize({ width: el.offsetWidth, height: el.offsetHeight });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    hydratingRef.current = true;

    const salvo = loadStrategyStorage(TEMPLATE_STORAGE_KEY, strategyId);
    if (salvo) {
      setJsonText(salvo);
      aplicarJson(salvo);
    } else {
      const padrao = JSON.stringify(TEMPLATE_PADRAO, null, 2);
      setJsonText(padrao);
      aplicarJson(padrao);
    }

    const savedNotes = loadStrategyStorage(NOTES_STORAGE_KEY, strategyId);
    setNotasInternas(savedNotes ?? '');

    const rawLayout = loadStrategyStorage(LAMINA_LAYOUT_KEY, strategyId);
    if (rawLayout) {
      try {
        const parsed = JSON.parse(rawLayout) as LaminaLayoutMap;
        setLayoutMap(parsed);
        setLayoutInicializado(Object.keys(parsed).length > 0);
      } catch {
        setLayoutMap({});
        setLayoutInicializado(false);
      }
    } else {
      setLayoutMap({});
      setLayoutInicializado(false);
    }

    const rawLogos = loadStrategyStorage(LAMINA_LOGOS_KEY, strategyId);
    if (rawLogos) {
      try {
        const parsed = JSON.parse(rawLogos) as LaminaLogoAssets;
        setLogoTopo(parsed.topo || null);
        setLogoRodape(parsed.rodape || null);
      } catch {
        setLogoTopo(null);
        setLogoRodape(null);
      }
    } else {
      setLogoTopo(null);
      setLogoRodape(null);
    }

    const rawMode = loadStrategyStorage(LAMINA_LAYOUT_MODE_KEY, strategyId);
    setModoLivre(rawMode === 'true');

    const rawHidden = loadStrategyStorage(LAMINA_HIDDEN_KEY, strategyId);
    if (rawHidden) {
      try {
        const parsed = JSON.parse(rawHidden) as Record<string, boolean>;
        setHiddenBlocks(parsed || {});
      } catch {
        setHiddenBlocks({});
      }
    } else {
      setHiddenBlocks({});
    }

    setSelectedBlock(null);

    requestAnimationFrame(() => {
      hydratingRef.current = false;
    });
  }, [strategyId]);

  useEffect(() => {
    if (hydratingRef.current) return;
    if (!Object.keys(layoutMap).length) {
      removeStrategyStorage(LAMINA_LAYOUT_KEY, strategyId);
      return;
    }
    const storageKey = buildStorageKey(LAMINA_LAYOUT_KEY, strategyId);
    const timeout = setTimeout(() => {
      if (hydratingRef.current) return;
      localStorage.setItem(storageKey, JSON.stringify(layoutMap));
    }, 300);
    return () => clearTimeout(timeout);
  }, [layoutMap, strategyId]);

  useEffect(() => {
    if (hydratingRef.current) return;
    if (!logoTopo && !logoRodape) {
      removeStrategyStorage(LAMINA_LOGOS_KEY, strategyId);
      return;
    }
    saveStrategyStorage(LAMINA_LOGOS_KEY, strategyId, JSON.stringify({ topo: logoTopo, rodape: logoRodape }));
  }, [logoTopo, logoRodape, strategyId]);

  useEffect(() => {
    if (hydratingRef.current) return;
    saveStrategyStorage(LAMINA_HIDDEN_KEY, strategyId, JSON.stringify(hiddenBlocks));
  }, [hiddenBlocks, strategyId]);

  useEffect(() => {
    if (hydratingRef.current) return;
    saveStrategyStorage(LAMINA_LAYOUT_MODE_KEY, strategyId, modoLivre ? 'true' : 'false');
  }, [modoLivre, strategyId]);

  useEffect(() => {
    if (hydratingRef.current) return;
    saveStrategyStorage(NOTES_STORAGE_KEY, strategyId, notasInternas);
  }, [notasInternas, strategyId]);

  useEffect(() => {
    if (strategyId) return;
    const saved = localStorage.getItem(LAMINA_STRATEGY_KEY) || localStorage.getItem(STRATEGY_ID_KEY);
    if (saved) {
      setStrategyId(saved);
      return;
    }
    if (estrategias.length > 0) {
      setStrategyId(estrategias[0].id);
    }
  }, [estrategias, strategyId]);

  useEffect(() => {
    if (strategyId) {
      localStorage.setItem(LAMINA_STRATEGY_KEY, strategyId);
    }
  }, [strategyId]);

  useEffect(() => {
    if (!strategyId) {
      setDailyEntries([]);
      return;
    }
    const map = loadEntriesMap();
    const entries = map[strategyId] ? normalizeEntries(map[strategyId]) : [];
    setDailyEntries(entries);
  }, [strategyId]);

  useEffect(() => {
    if (!introDescricao.length) return;
    setTemplate((prev) => {
      const textoAtual = prev.intro.map((item) => item.texto.trim()).filter(Boolean).join('\n\n');
      const textoNovo = introDescricao.map((item) => item.texto.trim()).filter(Boolean).join('\n\n');
      if (textoAtual === textoNovo) return prev;
      const next = { ...prev, intro: introDescricao };
      setJsonText(JSON.stringify(next, null, 2));
      return next;
    });
  }, [introDescricao]);

  useEffect(() => {
    if (!tituloEstrategia) return;
    setTemplate((prev) => {
      if (prev.header.titulo === tituloEstrategia) return prev;
      const next = { ...prev, header: { ...prev.header, titulo: tituloEstrategia } };
      setJsonText(JSON.stringify(next, null, 2));
      return next;
    });
  }, [tituloEstrategia]);

  const aplicarJson = (texto: string) => {
    try {
      const parsed = JSON.parse(texto);
      const normalizado = normalizarTemplate(parsed);
      setTemplate(normalizado);
      setJsonErro('');
    } catch (error: any) {
      setJsonErro(error.message || 'JSON inválido.');
    }
  };

  const atualizarTemplate = (novoTemplate: LaminaTemplate) => {
    setTemplate(novoTemplate);
    setJsonText(JSON.stringify(novoTemplate, null, 2));
  };

  const handleJsonChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const novoTexto = event.target.value;
    setJsonText(novoTexto);
    aplicarJson(novoTexto);
  };

  const isBlocoVisivel = (id: string) => !hiddenBlocks[id];

  const toggleBloco = (id: string) => {
    setHiddenBlocks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      return next;
    });
    if (selectedBlock === id) {
      setSelectedBlock(null);
    }
  };

  const mostrarTodosOsBlocos = () => {
    setHiddenBlocks({});
    setSelectedBlock(null);
  };

  const atualizarLayout = (id: string, patch: Partial<LaminaLayoutItem>) => {
    setLayoutMap((prev) => {
      const atual = prev[id];
      if (!atual) return prev;
      return {
        ...prev,
        [id]: {
          ...atual,
          ...patch,
        },
      };
    });
  };

  const capturarLayoutAtual = () => {
    const container = previewRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const scale = previewZoom || 1;
    const itens = [
      { id: 'topbar', ref: topbarRef },
      { id: 'intro', ref: introRef },
      { id: 'divider', ref: dividerRef },
      { id: 'left', ref: leftRef },
      { id: 'atribuicao', ref: atribuicaoRef },
      { id: 'chart', ref: chartRef },
      { id: 'tables', ref: tablesRef },
      { id: 'mes', ref: mesRef },
      { id: 'comentarios', ref: comentariosRef },
      { id: 'operacional', ref: operacionalRef },
      { id: 'footer', ref: footerRef },
    ];

    const next: LaminaLayoutMap = {};
    itens.forEach(({ id, ref }) => {
      if (layoutMap[id]) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      next[id] = {
        x: (rect.left - containerRect.left) / scale,
        y: (rect.top - containerRect.top) / scale,
        w: rect.width / scale,
        h: rect.height / scale,
      };
    });

    if (Object.keys(next).length) {
      setLayoutMap((prev) => ({ ...prev, ...next }));
    }
  };

  const handleToggleModoLivre = () => {
    if (!modoLivre) {
      capturarLayoutAtual();
      setLayoutInicializado(true);
    }
    setModoLivre((prev) => !prev);
  };

  const handleResetLayout = () => {
    setLayoutMap({});
    setModoLivre(false);
    setLayoutInicializado(false);
    setSelectedBlock(null);
    removeStrategyStorage(LAMINA_LAYOUT_KEY, strategyId);
    saveStrategyStorage(LAMINA_LAYOUT_MODE_KEY, strategyId, 'false');
  };

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>, alvo: 'topo' | 'rodape') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válida.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (alvo === 'topo') {
        setLogoTopo(result);
      } else {
        setLogoRodape(result);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!modoLivre) return;
    requestAnimationFrame(() => capturarLayoutAtual());
  }, [modoLivre]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedBlock) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        setHiddenBlocks((prev) => ({ ...prev, [selectedBlock]: true }));
        setSelectedBlock(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlock]);

  useEffect(() => {
    const handlePointerOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.lamina-preview')) return;
      setSelectedBlock(null);
    };
    window.addEventListener('pointerdown', handlePointerOutside);
    return () => window.removeEventListener('pointerdown', handlePointerOutside);
  }, []);

  const atualizarHeaderCampo = (campo: keyof LaminaTemplate['header'], valor: string) => {
    atualizarTemplate({
      ...template,
      header: {
        ...template.header,
        [campo]: valor,
      },
    });
  };

  const atualizarIntro = (index: number, valor: string) => {
    const novoIntro = template.intro.map((item, idx) => (idx === index ? { ...item, texto: valor } : item));
    atualizarTemplate({ ...template, intro: novoIntro });
  };

  const atualizarComentarios = (index: number, valor: string) => {
    const novosComentarios = template.comentarios.map((item, idx) =>
      idx === index ? { ...item, texto: valor } : item
    );
    atualizarTemplate({ ...template, comentarios: novosComentarios });
  };

  const atualizarResumoMensal = (index: number, campo: 'label' | 'value', valor: string) => {
    const novoResumo = template.resumoMensal.map((item, idx) =>
      idx === index ? { ...item, [campo]: valor } : item
    );
    atualizarTemplate({ ...template, resumoMensal: novoResumo });
  };

  const dailyMetrics = useMemo<DailyMetrics | null>(() => {
    const ordenadas = [...dailyEntries].sort((a, b) => a.data.localeCompare(b.data));
    if (ordenadas.length < 2) return null;

    const netReturns: number[] = [];
    const chartData = [] as LaminaTemplate['chart']['data'];
    const drawdownSeries: Array<{ label: string; drawdown: number }> = [];

    const firstCota = ordenadas.find((item) => item.patrimonio > 0)?.patrimonio || 0;
    const lastCota = [...ordenadas].reverse().find((item) => item.patrimonio > 0)?.patrimonio || 0;
    const resultadoCarteira = firstCota > 0 && lastCota > 0 ? lastCota / firstCota - 1 : 0;
    const firstCdi = ordenadas.find((item) => item.resultadoCdi > 0)?.resultadoCdi || 0;
    const lastCdi = [...ordenadas].reverse().find((item) => item.resultadoCdi > 0)?.resultadoCdi || 0;
    const cdiPeriodo = firstCdi > 0 && lastCdi > 0 ? (1 + lastCdi) / (1 + firstCdi) - 1 : 0;
    const ifixBaseInicial = ordenadas.find((item) => item.resultadoIfix > 0)?.resultadoIfix || 0;

    let cotaCurvaSerie = 1;
    let picoSerie = 1;

    ordenadas.forEach((item, idx) => {
      let retornoBruto = 0;
      if (idx > 0) {
        const anterior = ordenadas[idx - 1];
        if (anterior.patrimonio > 0 && item.patrimonio > 0) {
          retornoBruto = item.patrimonio / anterior.patrimonio - 1;
          netReturns.push(retornoBruto);
        }
      }

      if (idx > 0) {
        cotaCurvaSerie *= 1 + retornoBruto;
      }
      if (cotaCurvaSerie > picoSerie) {
        picoSerie = cotaCurvaSerie;
      }

      const drawdownAtual = picoSerie > 0 ? (cotaCurvaSerie / picoSerie - 1) * 100 : 0;
      drawdownSeries.push({
        label: formatMesAno(item.data),
        drawdown: drawdownAtual,
      });

      const carteiraRetorno = firstCota > 0 && item.patrimonio > 0 ? item.patrimonio / firstCota - 1 : 0;
      const cdiRetorno =
        firstCdi > 0 && item.resultadoCdi > 0 ? (1 + item.resultadoCdi) / (1 + firstCdi) - 1 : 0;
      const ifixRetorno =
        ifixBaseInicial > 0 && item.resultadoIfix > 0 ? item.resultadoIfix / ifixBaseInicial - 1 : 0;

      chartData.push({
        label: formatMesAno(item.data),
        tatica: carteiraRetorno * 100,
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

    const lastIfix = [...ordenadas].reverse().find((item) => item.resultadoIfix > 0)?.resultadoIfix || 0;
    const ifixPeriodo = ifixBaseInicial > 0 && lastIfix > 0 ? lastIfix / ifixBaseInicial - 1 : 0;
    const formatTabelaPercent = (valor: number) =>
      Number.isFinite(valor) ? formatRatio(valor * 100) : '0,00';

    const endIso = ordenadas[ordenadas.length - 1]?.data;

    const monthKey = (iso?: string) => (iso ? iso.slice(0, 7) : '');

    const monthKeyOffset = (iso: string, offset: number) => {
      const [ano, mes] = iso.split('-').map(Number);
      if (!ano || !mes) return '';
      const base = (ano * 12 + (mes - 1)) - offset;
      const targetAno = Math.floor(base / 12);
      const targetMes = (base % 12) + 1;
      return `${targetAno}-${String(targetMes).padStart(2, '0')}`;
    };

    const ultimoPorMes = new Map<string, EstrategiaDiariaEntry>();
    ordenadas.forEach((item) => {
      ultimoPorMes.set(monthKey(item.data), item);
    });

    const startIsoFechamento = (monthsBack: number) => {
      if (!endIso) return undefined;
      const key = monthKeyOffset(endIso, monthsBack);
      return ultimoPorMes.get(key)?.data;
    };

    const filtrarPeriodo = (startIso?: string) => {
      if (!endIso) return [];
      return ordenadas.filter((item) => (!startIso || item.data >= startIso) && item.data <= endIso);
    };

    const retornoCarteiraPeriodo = (entries: EstrategiaDiariaEntry[]) => {
      const primeiro = entries.find((item) => item.patrimonio > 0)?.patrimonio || 0;
      const ultimo = [...entries].reverse().find((item) => item.patrimonio > 0)?.patrimonio || 0;
      return primeiro > 0 && ultimo > 0 ? ultimo / primeiro - 1 : 0;
    };

    const retornoIfixPeriodo = (entries: EstrategiaDiariaEntry[]) => {
      const primeiro = entries.find((item) => item.resultadoIfix > 0)?.resultadoIfix || 0;
      const ultimo = [...entries].reverse().find((item) => item.resultadoIfix > 0)?.resultadoIfix || 0;
      return primeiro > 0 && ultimo > 0 ? ultimo / primeiro - 1 : 0;
    };

    const retornoCdiPeriodo = (entries: EstrategiaDiariaEntry[]) => {
      const primeiro = entries.find((item) => item.resultadoCdi > 0)?.resultadoCdi || 0;
      const ultimo = [...entries].reverse().find((item) => item.resultadoCdi > 0)?.resultadoCdi || 0;
      return primeiro > 0 && ultimo > 0 ? (1 + ultimo) / (1 + primeiro) - 1 : 0;
    };

    const calcularPeriodo = (startIso?: string) => {
      const entries = filtrarPeriodo(startIso);
      const carteira = retornoCarteiraPeriodo(entries);
      const ifix = retornoIfixPeriodo(entries);
      const cdi = retornoCdiPeriodo(entries);
      return { carteira, ifix, cdi, alpha: carteira - ifix };
    };

    const periodo1m = calcularPeriodo(startIsoFechamento(1));
    const periodo3m = calcularPeriodo(startIsoFechamento(3));
    const periodoInicio = calcularPeriodo(ordenadas[0]?.data);

    const tabelaPerformanceRows = [
      [
        '01 M',
        formatTabelaPercent(periodo1m.carteira),
        formatTabelaPercent(periodo1m.ifix),
        formatTabelaPercent(periodo1m.cdi),
        formatTabelaPercent(periodo1m.alpha),
      ],
      [
        '03 M',
        formatTabelaPercent(periodo3m.carteira),
        formatTabelaPercent(periodo3m.ifix),
        formatTabelaPercent(periodo3m.cdi),
        formatTabelaPercent(periodo3m.alpha),
      ],
      [
        'Inicio',
        formatTabelaPercent(periodoInicio.carteira),
        formatTabelaPercent(periodoInicio.ifix),
        formatTabelaPercent(periodoInicio.cdi),
        formatTabelaPercent(periodoInicio.alpha),
      ],
    ];

    const formatPlaceholderPercent = (valor: number) => formatPercent(valor * 100);
    const formatPlaceholderSigned = (valor: number) => formatSignedPercent(valor * 100);

    const placeholders = {
      retorno_1m: formatPlaceholderPercent(periodo1m.carteira),
      ifix_1m: formatPlaceholderPercent(periodo1m.ifix),
      cdi_1m: formatPlaceholderPercent(periodo1m.cdi),
      alpha_1m: formatPlaceholderPercent(periodo1m.alpha),
      alpha_1m_signed: formatPlaceholderSigned(periodo1m.alpha),
      alpha_cdi_1m: formatPlaceholderPercent(periodo1m.carteira - periodo1m.cdi),
      alpha_cdi_1m_signed: formatPlaceholderSigned(periodo1m.carteira - periodo1m.cdi),
      retorno_3m: formatPlaceholderPercent(periodo3m.carteira),
      ifix_3m: formatPlaceholderPercent(periodo3m.ifix),
      cdi_3m: formatPlaceholderPercent(periodo3m.cdi),
      alpha_3m: formatPlaceholderPercent(periodo3m.alpha),
      alpha_3m_signed: formatPlaceholderSigned(periodo3m.alpha),
      alpha_cdi_3m: formatPlaceholderPercent(periodo3m.carteira - periodo3m.cdi),
      alpha_cdi_3m_signed: formatPlaceholderSigned(periodo3m.carteira - periodo3m.cdi),
      retorno_inicio: formatPlaceholderPercent(periodoInicio.carteira),
      ifix_inicio: formatPlaceholderPercent(periodoInicio.ifix),
      cdi_inicio: formatPlaceholderPercent(periodoInicio.cdi),
      alpha_inicio: formatPlaceholderPercent(periodoInicio.alpha),
      alpha_inicio_signed: formatPlaceholderSigned(periodoInicio.alpha),
      alpha_cdi_inicio: formatPlaceholderPercent(periodoInicio.carteira - periodoInicio.cdi),
      alpha_cdi_inicio_signed: formatPlaceholderSigned(periodoInicio.carteira - periodoInicio.cdi),
    };

    const alphaIfix = resultadoCarteira - ifixPeriodo;

    return {
      drawdownMaximo,
      volatilidadeAnual,
      sharpe,
      resultadoCarteira,
      alphaIfix,
      chartData,
      drawdownSeries,
      tabelaPerformanceRows,
      placeholders,
      totalDias: ordenadas.length,
    };
  }, [dailyEntries]);

  const templateComDados = useMemo(
    () => (dailyMetrics ? aplicarDadosDiarios(template, dailyMetrics) : template),
    [template, dailyMetrics]
  );
  const templateComIntro = useMemo(() => {
    if (!introDescricao.length) return templateComDados;
    return { ...templateComDados, intro: introDescricao };
  }, [templateComDados, introDescricao]);
  const templateComTitulo = useMemo(() => {
    if (!tituloEstrategia) return templateComIntro;
    return { ...templateComIntro, header: { ...templateComIntro.header, titulo: tituloEstrategia } };
  }, [templateComIntro, tituloEstrategia]);
  const templatePreview = useMemo(
    () => aplicarBenchmarkLabel(templateComTitulo, benchmarkSelecionado),
    [templateComTitulo, benchmarkSelecionado]
  );
  const visibleBlockIds = useMemo(
    () => LAMINA_BLOCKS.map((block) => block.id).filter((id) => isBlocoVisivel(id)),
    [hiddenBlocks]
  );
  const layoutCompleto = visibleBlockIds.length > 0 && visibleBlockIds.every((id) => !!layoutMap[id]);
  const layoutAtivo = modoLivre;
  const exportando = exportandoPdf || exportandoImagem;
  const zoomAplicado = exportando ? 1 : previewZoom;
  const previewWidth = previewSize.width ? previewSize.width * zoomAplicado : undefined;
  const previewHeight = previewSize.height ? previewSize.height * zoomAplicado : undefined;

  useEffect(() => {
    if (!layoutInicializado) return;
    if (modoLivre || layoutCompleto || visibleBlockIds.length === 0) return;
    requestAnimationFrame(() => capturarLayoutAtual());
  }, [layoutInicializado, modoLivre, layoutCompleto, visibleBlockIds]);

  const handleSelectBlock = (id: string) => {
    setSelectedBlock(id);
  };

  const handlePreviewPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.lamina-movable')) return;
    setSelectedBlock(null);
  };

  const handlePreviewWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    const step = 0.1;
    const direction = Math.sign(event.deltaY);
    setPreviewZoom((prev) => {
      const next = prev + (direction > 0 ? -step : step);
      return Math.min(Math.max(next, 0.5), 2.5);
    });
  };

  const dadosGrafico = useMemo(() => templatePreview.chart.data, [templatePreview.chart.data]);
  const dadosDrawdown = useMemo(() => dailyMetrics?.drawdownSeries ?? [], [dailyMetrics]);

  const handleSalvar = () => {
    let textoAtualizado = jsonText;
    try {
      const parsed = JSON.parse(jsonText);
      const normalizado = normalizarTemplate(parsed);
      textoAtualizado = JSON.stringify(normalizado, null, 2);
      setTemplate(normalizado);
      setJsonText(textoAtualizado);
    } catch {
      textoAtualizado = jsonText;
    }

    saveStrategyStorage(TEMPLATE_STORAGE_KEY, strategyId, textoAtualizado);
    if (Object.keys(layoutMap).length) {
      saveStrategyStorage(LAMINA_LAYOUT_KEY, strategyId, JSON.stringify(layoutMap));
    }
    if (logoTopo || logoRodape) {
      saveStrategyStorage(LAMINA_LOGOS_KEY, strategyId, JSON.stringify({ topo: logoTopo, rodape: logoRodape }));
    }
    saveStrategyStorage(LAMINA_LAYOUT_MODE_KEY, strategyId, modoLivre ? 'true' : 'false');
    saveStrategyStorage(LAMINA_HIDDEN_KEY, strategyId, JSON.stringify(hiddenBlocks));
    saveStrategyStorage(NOTES_STORAGE_KEY, strategyId, notasInternas);
    setSalvoMensagem('Alterações salvas.');
    setTimeout(() => setSalvoMensagem(''), 2000);
  };

  const aguardarRenderizacaoExport = async () => {
    if ('fonts' in document && document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise(requestAnimationFrame);
    await new Promise((resolve) => setTimeout(resolve, 80));
  };

  const capturarPreviewCanvas = async () => {
    const elemento = previewRef.current;
    if (!elemento) return null;

    const width = elemento.offsetWidth;
    const height = elemento.offsetHeight;
    const backgroundColor = getComputedStyle(elemento).backgroundColor || '#ffffff';
    const scale = Math.max(2, window.devicePixelRatio || 1);

    return html2canvas(elemento, {
      scale,
      useCORS: true,
      backgroundColor,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
    });
  };

  const gerarNomeArquivo = (extensao: 'pdf' | 'png') => {
    const estrategiaNome = estrategias.find((estrategia) => estrategia.id === strategyId)?.nome || 'lamina';
    const data = new Date().toISOString().split('T')[0];
    return `lamina_${estrategiaNome.replace(/\s+/g, '_')}_${data}.${extensao}`;
  };

  const handleExportarPdf = async () => {
    setExportandoPdf(true);

    try {
      await aguardarRenderizacaoExport();
      const canvas = await capturarPreviewCanvas();
      if (!canvas) return;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(gerarNomeArquivo('pdf'));
    } catch (error) {
      alert('Erro ao exportar PDF: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setExportandoPdf(false);
    }
  };

  const handleExportarImagem = async () => {
    setExportandoImagem(true);

    try {
      await aguardarRenderizacaoExport();
      const canvas = await capturarPreviewCanvas();
      if (!canvas) return;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Falha ao gerar imagem.');
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = gerarNomeArquivo('png');
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao exportar imagem: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setExportandoImagem(false);
    }
  };

  return (
    <div className="laminas-json">
      <LaminasEditorPanel
        estrategias={estrategias}
        strategyId={strategyId}
        onStrategyChange={setStrategyId}
        exportandoPdf={exportandoPdf}
        exportandoImagem={exportandoImagem}
        onExportarPdf={handleExportarPdf}
        onExportarImagem={handleExportarImagem}
        showDailyHint={!!strategyId && dailyEntries.length < 2}
        modoLivre={modoLivre}
        onToggleModoLivre={handleToggleModoLivre}
        onResetLayout={handleResetLayout}
        onMostrarTodosBlocos={mostrarTodosOsBlocos}
        blocks={LAMINA_BLOCKS}
        isBlocoVisivel={isBlocoVisivel}
        onToggleBloco={toggleBloco}
        template={template}
        jsonText={jsonText}
        jsonErro={jsonErro}
        salvoMensagem={salvoMensagem}
        onJsonChange={handleJsonChange}
        onSalvar={handleSalvar}
        notasInternas={notasInternas}
        onNotasChange={setNotasInternas}
        onAtualizarHeaderCampo={atualizarHeaderCampo}
        onAtualizarTemplate={atualizarTemplate}
        onAtualizarIntro={atualizarIntro}
        onAtualizarComentarios={atualizarComentarios}
        onAtualizarResumoMensal={atualizarResumoMensal}
        onLogoUpload={handleLogoUpload}
        logoTopo={logoTopo}
        logoRodape={logoRodape}
        onRemoverLogoTopo={() => setLogoTopo(null)}
        onRemoverLogoRodape={() => setLogoRodape(null)}
      />
      <LaminasPreviewPanel
        previewRef={previewRef}
        previewWidth={previewWidth}
        previewHeight={previewHeight}
        exportandoPdf={exportando}
        modoLivre={modoLivre}
        layoutAtivo={layoutAtivo}
        zoomAplicado={zoomAplicado}
        templatePreview={templatePreview}
        logoTopo={logoTopo}
        logoRodape={logoRodape}
        layoutMap={layoutMap}
        selectedBlock={selectedBlock}
        onLayoutChange={atualizarLayout}
        onSelectBlock={handleSelectBlock}
        isBlocoVisivel={isBlocoVisivel}
        onPreviewPointerDown={handlePreviewPointerDown}
        onPreviewWheel={handlePreviewWheel}
        topbarRef={topbarRef}
        introRef={introRef}
        dividerRef={dividerRef}
        leftRef={leftRef}
        atribuicaoRef={atribuicaoRef}
        chartRef={chartRef}
        tablesRef={tablesRef}
        mesRef={mesRef}
        comentariosRef={comentariosRef}
        operacionalRef={operacionalRef}
        footerRef={footerRef}
        dadosGrafico={dadosGrafico}
        dadosDrawdown={dadosDrawdown}
      />
    </div>
  );
}























