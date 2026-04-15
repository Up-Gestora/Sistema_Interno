import { ChangeEvent, CSSProperties, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReportCoverAdjustment, ReportCoverItem } from '../../types/reportCover';
import {
  carregarCapaRelatorio,
  gerarRelatorioPeriodicoPDF,
} from '../../services/pdfGenerator';
import {
  atualizarAjusteCapa,
  excluirCapa,
  listarCapas,
  uploadCapa,
} from '../../services/reportCoverRepositoryService';
import { RelatorioPeriodico } from '../../types/relatorio';
import Card from '../../components/Card/Card';
import YearSelect from '../../components/YearSelect/YearSelect';
import './RelatoriosMensaisPage.css';
import './FormRelatorio.css';
import './RelatorioPeriodicoPage.css';

type CapaSelecionada = {
  id: string;
  src: string;
  nomeArquivo: string;
  width: number;
  height: number;
};

type EstadoArraste = {
  inicioX: number;
  inicioY: number;
  offsetInicialX: number;
  offsetInicialY: number;
  fatorEscalaVisual: number;
};

type UploadResumoContexto = {
  selectionStart: number;
  selectionEnd: number;
};

const RELATORIOS_PERIODICOS_LOCAL_STORAGE_KEY = 'relatoriosPeriodicosGerados_v1';
const DEFAULT_COVER_ID = '__default_cover__';
const CAPA_WIDTH = 794;
const CAPA_HEIGHT = 1123;
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.5;
const AJUSTE_CAPA_INICIAL: ReportCoverAdjustment = { scale: 1, offsetX: 0, offsetY: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const calcularGeometriaImagem = (width: number, height: number, ajuste: ReportCoverAdjustment) => {
  const escalaBase = Math.max(CAPA_WIDTH / width, CAPA_HEIGHT / height);
  const larguraFinal = width * escalaBase * ajuste.scale;
  const alturaFinal = height * escalaBase * ajuste.scale;
  const left = (CAPA_WIDTH - larguraFinal) / 2 + ajuste.offsetX;
  const top = (CAPA_HEIGHT - alturaFinal) / 2 + ajuste.offsetY;
  return { larguraFinal, alturaFinal, left, top };
};

const normalizarAjuste = (
  ajuste: ReportCoverAdjustment,
  capa: Pick<CapaSelecionada, 'width' | 'height'>
): ReportCoverAdjustment => {
  const scale = clamp(ajuste.scale, ZOOM_MIN, ZOOM_MAX);
  const geometria = calcularGeometriaImagem(capa.width, capa.height, { ...ajuste, scale });
  const limiteX = Math.max(0, (geometria.larguraFinal - CAPA_WIDTH) / 2);
  const limiteY = Math.max(0, (geometria.alturaFinal - CAPA_HEIGHT) / 2);

  return {
    scale,
    offsetX: clamp(ajuste.offsetX, -limiteX, limiteX),
    offsetY: clamp(ajuste.offsetY, -limiteY, limiteY),
  };
};

const obterStyleImagem = (capa: CapaSelecionada, ajuste: ReportCoverAdjustment): CSSProperties => {
  const ajusteNormalizado = normalizarAjuste(ajuste, capa);
  const geometria = calcularGeometriaImagem(capa.width, capa.height, ajusteNormalizado);

  return {
    position: 'absolute',
    left: `${(geometria.left / CAPA_WIDTH) * 100}%`,
    top: `${(geometria.top / CAPA_HEIGHT) * 100}%`,
    width: `${(geometria.larguraFinal / CAPA_WIDTH) * 100}%`,
    height: `${(geometria.alturaFinal / CAPA_HEIGHT) * 100}%`,
    maxWidth: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
  };
};

const carregarImagemPorSrc = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const imagem = new Image();
  imagem.onload = () => resolve(imagem);
  imagem.onerror = () => reject(new Error('Falha ao carregar imagem'));
  imagem.src = src;
});

const carregarDimensoesImagem = async (src: string): Promise<{ width: number; height: number }> => {
  const imagem = await carregarImagemPorSrc(src);
  const width = imagem.naturalWidth || imagem.width || CAPA_WIDTH;
  const height = imagem.naturalHeight || imagem.height || CAPA_HEIGHT;
  return { width, height };
};

const criarCapaAjustadaParaPdf = async (
  capa: CapaSelecionada,
  ajuste: ReportCoverAdjustment
): Promise<string> => {
  const imagem = await carregarImagemPorSrc(capa.src);
  const canvas = document.createElement('canvas');
  canvas.width = CAPA_WIDTH;
  canvas.height = CAPA_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) return capa.src;

  const capaNormalizada = {
    ...capa,
    width: imagem.naturalWidth || capa.width,
    height: imagem.naturalHeight || capa.height,
  };
  const ajusteNormalizado = normalizarAjuste(ajuste, capaNormalizada);
  const geometria = calcularGeometriaImagem(
    capaNormalizada.width,
    capaNormalizada.height,
    ajusteNormalizado
  );

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CAPA_WIDTH, CAPA_HEIGHT);
  ctx.drawImage(imagem, geometria.left, geometria.top, geometria.larguraFinal, geometria.alturaFinal);

  return canvas.toDataURL('image/jpeg', 0.92);
};

export default function RelatorioPeriodicoPage() {
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const [tituloCapa, setTituloCapa] = useState('');
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [resumoTexto, setResumoTexto] = useState('');
  const [resumoImagens, setResumoImagens] = useState<Array<{ id: string; src: string }>>([]);
  const [uploadResumoContexto, setUploadResumoContexto] = useState<UploadResumoContexto | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [historicoGerado, setHistoricoGerado] = useState<Array<{
    id: string;
    titulo: string;
    periodo: string;
    dataGeracao: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem(RELATORIOS_PERIODICOS_LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [capaPadrao, setCapaPadrao] = useState<string | null>(null);
  const [carregandoCapaPadrao, setCarregandoCapaPadrao] = useState(true);
  const [coverItems, setCoverItems] = useState<ReportCoverItem[]>([]);
  const [carregandoCapasRepositorio, setCarregandoCapasRepositorio] = useState(false);
  const [erroCapasRepositorio, setErroCapasRepositorio] = useState<string | null>(null);
  const [uploadEmAndamento, setUploadEmAndamento] = useState(false);

  const [selectedCoverId, setSelectedCoverId] = useState<string>(DEFAULT_COVER_ID);
  const [capaSelecionadaCustom, setCapaSelecionadaCustom] = useState<CapaSelecionada | null>(null);
  const [ajusteCapa, setAjusteCapa] = useState<ReportCoverAdjustment>(AJUSTE_CAPA_INICIAL);

  const [editorAberto, setEditorAberto] = useState(false);
  const [arrastandoEditor, setArrastandoEditor] = useState(false);
  const [ajusteEditor, setAjusteEditor] = useState<ReportCoverAdjustment>(AJUSTE_CAPA_INICIAL);
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);

  const capaInputRef = useRef<HTMLInputElement | null>(null);
  const resumoImagemInputRef = useRef<HTMLInputElement | null>(null);
  const resumoTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorStageRef = useRef<HTMLDivElement | null>(null);
  const arrasteRef = useRef<EstadoArraste | null>(null);

  const anosDisponiveis = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, index) => anoAtual + 2 - index);
  }, []);

  const meses = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  const limparFeedback = () => {
    setMensagem('');
    setErro('');
  };

  const carregarCapasRepositorio = useCallback(async () => {
    setCarregandoCapasRepositorio(true);
    try {
      const items = await listarCapas();
      setCoverItems(items);
      setErroCapasRepositorio(null);
    } catch (error) {
      console.error('Erro ao carregar capas do repositorio:', error);
      setCoverItems([]);
      setErroCapasRepositorio(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel carregar o repositorio local de capas.'
      );
    } finally {
      setCarregandoCapasRepositorio(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;

    const carregarCapaPadraoAtual = async () => {
      try {
        const capa = await carregarCapaRelatorio();
        if (ativo) setCapaPadrao(capa);
      } catch (error) {
        console.error('Erro ao carregar capa padrao:', error);
        if (ativo) setCapaPadrao(null);
      } finally {
        if (ativo) setCarregandoCapaPadrao(false);
      }
    };

    carregarCapaPadraoAtual();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    void carregarCapasRepositorio();
  }, [carregarCapasRepositorio]);

  useEffect(() => {
    if (selectedCoverId === DEFAULT_COVER_ID) return;
    if (carregandoCapasRepositorio) return;

    const existe = coverItems.some((item) => item.id === selectedCoverId);
    if (!existe) {
      setSelectedCoverId(DEFAULT_COVER_ID);
      setEditorAberto(false);
    }
  }, [selectedCoverId, coverItems, carregandoCapasRepositorio]);

  useEffect(() => {
    let ativo = true;

    const sincronizarCapaSelecionada = async () => {
      if (selectedCoverId === DEFAULT_COVER_ID) {
        setCapaSelecionadaCustom(null);
        setAjusteCapa(AJUSTE_CAPA_INICIAL);
        return;
      }

      const item = coverItems.find((cover) => cover.id === selectedCoverId);
      if (!item) return;

      try {
        const dimensions = await carregarDimensoesImagem(item.url);
        if (!ativo) return;

        const capa: CapaSelecionada = {
          id: item.id,
          src: item.url,
          nomeArquivo: item.name,
          width: dimensions.width,
          height: dimensions.height,
        };

        setCapaSelecionadaCustom(capa);
        setAjusteCapa(normalizarAjuste(item.adjustment || AJUSTE_CAPA_INICIAL, capa));
      } catch (error) {
        if (!ativo) return;
        console.error('Erro ao carregar dimensoes da capa selecionada:', error);
        const capaFallback: CapaSelecionada = {
          id: item.id,
          src: item.url,
          nomeArquivo: item.name,
          width: CAPA_WIDTH,
          height: CAPA_HEIGHT,
        };

        setCapaSelecionadaCustom(capaFallback);
        setAjusteCapa(normalizarAjuste(item.adjustment || AJUSTE_CAPA_INICIAL, capaFallback));
      }
    };

    sincronizarCapaSelecionada();
    return () => {
      ativo = false;
    };
  }, [selectedCoverId, coverItems]);

  useEffect(() => {
    if (!editorAberto) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [editorAberto]);

  const abrirSeletorUpload = () => {
    capaInputRef.current?.click();
  };

  const handleUploadNovaCapa = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Formato invalido. Use JPG, PNG ou WEBP.');
      event.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo excede o limite de 10MB.');
      event.target.value = '';
      return;
    }

    setUploadEmAndamento(true);
    try {
      const novoItem = await uploadCapa(file);
      setCoverItems((current) => [novoItem, ...current.filter((item) => item.id !== novoItem.id)]);
      setSelectedCoverId(novoItem.id);
      setErroCapasRepositorio(null);
    } catch (error) {
      console.error('Erro ao fazer upload da capa:', error);
      alert(error instanceof Error ? error.message : 'Nao foi possivel enviar a capa.');
    } finally {
      event.target.value = '';
      setUploadEmAndamento(false);
    }
  };

  const handleSelecionarCapaPadrao = () => {
    setSelectedCoverId(DEFAULT_COVER_ID);
    setEditorAberto(false);
  };

  const handleSelecionarCapaRepositorio = (coverId: string) => {
    setSelectedCoverId(coverId);
  };

  const handleExcluirCapaRepositorio = async (cover: ReportCoverItem) => {
    const confirmar = window.confirm(`Excluir a capa "${cover.name}" do repositorio local?`);
    if (!confirmar) return;

    try {
      await excluirCapa(cover.id);
      setCoverItems((current) => current.filter((item) => item.id !== cover.id));

      if (selectedCoverId === cover.id) {
        handleSelecionarCapaPadrao();
      }
    } catch (error) {
      console.error('Erro ao excluir capa:', error);
      alert(error instanceof Error ? error.message : 'Nao foi possivel excluir a capa.');
    }
  };

  const abrirEditorCapa = () => {
    if (!capaSelecionadaCustom || selectedCoverId === DEFAULT_COVER_ID) return;
    setAjusteEditor(ajusteCapa);
    setEditorAberto(true);
  };

  const fecharEditorCapa = () => {
    arrasteRef.current = null;
    setArrastandoEditor(false);
    setEditorAberto(false);
  };

  const handleEditorZoomChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!capaSelecionadaCustom) return;
    const scale = Number(event.target.value);
    setAjusteEditor((current) => normalizarAjuste({ ...current, scale }, capaSelecionadaCustom));
  };

  const handleEditorReset = () => {
    setAjusteEditor(AJUSTE_CAPA_INICIAL);
  };

  const handleEditorPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!capaSelecionadaCustom || !editorStageRef.current) return;
    const rect = editorStageRef.current.getBoundingClientRect();
    if (!rect.width) return;

    arrasteRef.current = {
      inicioX: event.clientX,
      inicioY: event.clientY,
      offsetInicialX: ajusteEditor.offsetX,
      offsetInicialY: ajusteEditor.offsetY,
      fatorEscalaVisual: CAPA_WIDTH / rect.width,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setArrastandoEditor(true);
  };

  const handleEditorPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!capaSelecionadaCustom || !arrasteRef.current) return;
    const arraste = arrasteRef.current;
    const deltaX = (event.clientX - arraste.inicioX) * arraste.fatorEscalaVisual;
    const deltaY = (event.clientY - arraste.inicioY) * arraste.fatorEscalaVisual;

    setAjusteEditor((current) => normalizarAjuste({
      ...current,
      offsetX: arraste.offsetInicialX + deltaX,
      offsetY: arraste.offsetInicialY + deltaY,
    }, capaSelecionadaCustom));
  };

  const finalizarArrasteEditor = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    arrasteRef.current = null;
    setArrastandoEditor(false);
  };

  const aplicarAjusteCapa = async () => {
    if (!capaSelecionadaCustom || selectedCoverId === DEFAULT_COVER_ID) return;

    const ajusteAnterior = ajusteCapa;
    const ajusteNormalizado = normalizarAjuste(ajusteEditor, capaSelecionadaCustom);

    setSalvandoAjuste(true);
    setAjusteCapa(ajusteNormalizado);
    setCoverItems((current) => current.map((item) => (
      item.id === selectedCoverId ? { ...item, adjustment: ajusteNormalizado } : item
    )));

    try {
      const itemAtualizado = await atualizarAjusteCapa(selectedCoverId, ajusteNormalizado);
      setCoverItems((current) => current.map((item) => (
        item.id === selectedCoverId ? itemAtualizado : item
      )));
      setEditorAberto(false);
    } catch (error) {
      console.error('Erro ao salvar ajuste da capa:', error);
      setAjusteCapa(ajusteAnterior);
      setCoverItems((current) => current.map((item) => (
        item.id === selectedCoverId ? { ...item, adjustment: ajusteAnterior } : item
      )));
      alert(error instanceof Error ? error.message : 'Nao foi possivel salvar o ajuste da capa.');
    } finally {
      setSalvandoAjuste(false);
    }
  };

  const obterCapaPersonalizadaParaPdf = async (): Promise<string | null> => {
    if (!capaSelecionadaCustom || selectedCoverId === DEFAULT_COVER_ID) {
      return null;
    }

    try {
      return await criarCapaAjustadaParaPdf(capaSelecionadaCustom, ajusteCapa);
    } catch (error) {
      console.error('Erro ao gerar capa ajustada para PDF:', error);
      return capaSelecionadaCustom.src;
    }
  };

  const abrirSeletorImagemResumo = () => {
    const textarea = resumoTextareaRef.current;
    const selectionStart = textarea?.selectionStart ?? (textarea?.value.length || 0);
    const selectionEnd = textarea?.selectionEnd ?? (textarea?.value.length || 0);
    setUploadResumoContexto({ selectionStart, selectionEnd });

    if (resumoImagemInputRef.current) {
      resumoImagemInputRef.current.value = '';
      resumoImagemInputRef.current.click();
    }
  };

  const inserirTokenNoResumo = (token: string) => {
    const textarea = resumoTextareaRef.current;
    const selectionStart = textarea?.selectionStart ?? (textarea?.value.length || 0);
    const selectionEnd = textarea?.selectionEnd ?? (textarea?.value.length || 0);
    const before = resumoTexto.slice(0, selectionStart);
    const after = resumoTexto.slice(selectionEnd);
    const prefix = before && !before.endsWith('\n') ? '\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n' : '';
    setResumoTexto(`${before}${prefix}${token}${suffix}${after}`);
    textarea?.focus();
  };

  const adicionarImagemResumo = (
    dataUrl: string,
    selectionStart?: number,
    selectionEnd?: number
  ) => {
    const idImagem = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const token = `[[img:${idImagem}]]`;
    const start = selectionStart ?? resumoTexto.length;
    const end = selectionEnd ?? resumoTexto.length;
    const before = resumoTexto.slice(0, start);
    const after = resumoTexto.slice(end);
    const prefix = before && !before.endsWith('\n') ? '\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n' : '';
    setResumoImagens((prev) => [...prev, { id: idImagem, src: dataUrl }]);
    setResumoTexto(`${before}${prefix}${token}${suffix}${after}`);
  };

  const handleImagemResumoSelecionada = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadResumoContexto) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        adicionarImagemResumo(dataUrl, uploadResumoContexto.selectionStart, uploadResumoContexto.selectionEnd);
      }
      setUploadResumoContexto(null);
    };
    reader.onerror = () => {
      alert('Nao foi possivel carregar a imagem.');
      setUploadResumoContexto(null);
    };
    reader.readAsDataURL(file);
  };

  const removerImagemResumo = (imagemIndex: number) => {
    const imagemRemovida = resumoImagens[imagemIndex];
    if (!imagemRemovida) return;
    const token = `[[img:${imagemRemovida.id}]]`;

    setResumoImagens((prev) => prev.filter((_, idx) => idx !== imagemIndex));
    setResumoTexto((prev) => prev.split(token).join('').replace(/\n{3,}/g, '\n\n').trim());
  };

  const handleGerarPdf = async () => {
    limparFeedback();

    if (!tituloCapa.trim()) {
      setErro('Informe o Titulo da Capa.');
      return;
    }

    if (!resumoTexto.trim()) {
      setErro('Informe o texto do relatorio.');
      return;
    }

    const relatorio: RelatorioPeriodico = {
      tituloCapa: tituloCapa.trim(),
      mes,
      ano,
      resumoTexto: resumoTexto.trim(),
      resumoImagens,
      dataGeracao: new Date().toISOString(),
    };

    setGerandoPdf(true);
    try {
      const capaImagemPersonalizada = await obterCapaPersonalizadaParaPdf();
      await gerarRelatorioPeriodicoPDF(relatorio, { capaImagemPersonalizada });

      const periodo = `${String(mes).padStart(2, '0')}/${ano}`;
      const novosGerados = [
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          titulo: relatorio.tituloCapa,
          periodo,
          dataGeracao: new Date().toISOString(),
        },
        ...historicoGerado,
      ].slice(0, 15);

      setHistoricoGerado(novosGerados);
      localStorage.setItem(RELATORIOS_PERIODICOS_LOCAL_STORAGE_KEY, JSON.stringify(novosGerados));
      setMensagem('Relatorio periodico gerado com sucesso.');
    } catch (error) {
      console.error('Erro ao gerar relatorio periodico:', error);
      setErro(error instanceof Error ? error.message : 'Nao foi possivel gerar o relatorio.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const periodoEditor = `${meses[mes - 1] || 'Mes'} ${ano}`;

  const usandoCapaPadrao = selectedCoverId === DEFAULT_COVER_ID;
  const temImagemNaPreview = Boolean(usandoCapaPadrao ? capaPadrao : capaSelecionadaCustom?.src);
  const podeAjustarCorte = Boolean(!usandoCapaPadrao && capaSelecionadaCustom);

  return (
    <div className="relatorios-periodicos-page">
      <div className="page-header">
        <h1>Relatórios Periódicos</h1>
        <p className="page-subtitle">
          Gere um relatorio unico por tema, sem apuracao de resultado e sem nome de cliente.
        </p>
      </div>

      {(mensagem || erro) && (
        <div className={`relatorios-periodicos-banner ${erro ? 'error' : 'success'}`}>
          {erro || mensagem}
        </div>
      )}

      <Card title="Capa do Relatorio" className="capa-relatorio-card">
        <div className="capa-relatorio-content">
          <div className={`capa-relatorio-preview ${temImagemNaPreview ? 'is-editable' : ''}`}>
            {usandoCapaPadrao ? (
              capaPadrao ? (
                <img
                  src={capaPadrao}
                  alt="Preview da capa padrao"
                  className="capa-relatorio-preview-image"
                />
              ) : (
                <div className="capa-relatorio-placeholder">
                  {carregandoCapaPadrao
                    ? 'Carregando capa padrao...'
                    : 'Nao foi possivel carregar a capa padrao'}
                </div>
              )
            ) : capaSelecionadaCustom ? (
              <img
                src={capaSelecionadaCustom.src}
                alt="Preview da capa selecionada"
                className="capa-relatorio-preview-image capa-relatorio-preview-image--custom"
                style={obterStyleImagem(capaSelecionadaCustom, ajusteCapa)}
              />
            ) : (
              <div className="capa-relatorio-placeholder">Selecione uma capa do repositorio.</div>
            )}

            {temImagemNaPreview && (
              <div className="capa-relatorio-overlay">
                <button
                  type="button"
                  className="capa-relatorio-overlay-btn capa-relatorio-overlay-btn--left"
                  onClick={usandoCapaPadrao ? abrirSeletorUpload : handleSelecionarCapaPadrao}
                >
                  {usandoCapaPadrao ? 'Upload' : 'Usar capa padrao'}
                </button>
                <button
                  type="button"
                  className="capa-relatorio-overlay-btn capa-relatorio-overlay-btn--right"
                  onClick={abrirEditorCapa}
                  disabled={!podeAjustarCorte}
                >
                  Ajustar corte
                </button>
              </div>
            )}
          </div>

          <div className="capa-relatorio-controls">
            <input
              ref={capaInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUploadNovaCapa}
              className="capa-relatorio-input"
            />

            <div className="capa-relatorio-actions">
              <button
                type="button"
                onClick={abrirSeletorUpload}
                className="btn-view"
                disabled={uploadEmAndamento}
              >
                {uploadEmAndamento ? 'Enviando...' : 'Upload'}
              </button>
              <button
                type="button"
                onClick={handleSelecionarCapaPadrao}
                className="btn-view btn-view--secondary"
                disabled={usandoCapaPadrao}
              >
                Usar capa padrao
              </button>
            </div>

            <p className="capa-relatorio-info">
              {usandoCapaPadrao
                ? 'Usando capa padrao'
                : `Capa selecionada: ${capaSelecionadaCustom?.nomeArquivo || 'Personalizada'}`}
            </p>
            <p className="capa-relatorio-info">
              Repositorio local: clique em uma miniatura para selecionar e use "+" para enviar nova capa.
            </p>
            {erroCapasRepositorio && (
              <>
                <p className="capa-relatorio-error">{erroCapasRepositorio}</p>
                <button
                  type="button"
                  className="btn-view btn-view--secondary"
                  onClick={carregarCapasRepositorio}
                  disabled={carregandoCapasRepositorio}
                >
                  {carregandoCapasRepositorio ? 'Recarregando...' : 'Tentar novamente'}
                </button>
              </>
            )}

            <div className="capa-galeria">
              <div className={`capa-galeria-card ${usandoCapaPadrao ? 'is-selected' : ''}`}>
                <button
                  type="button"
                  className="capa-galeria-thumb"
                  onClick={handleSelecionarCapaPadrao}
                  aria-label="Selecionar capa padrao"
                >
                  {capaPadrao ? (
                    <img src={capaPadrao} alt="Capa padrao" />
                  ) : (
                    <span className="capa-galeria-thumb-text">Padrao</span>
                  )}
                </button>
              </div>

              {coverItems.map((cover) => (
                <div
                  key={cover.id}
                  className={`capa-galeria-card ${selectedCoverId === cover.id ? 'is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="capa-galeria-thumb"
                    onClick={() => handleSelecionarCapaRepositorio(cover.id)}
                    aria-label={`Selecionar capa ${cover.name}`}
                  >
                    <img src={cover.url} alt={cover.name} />
                  </button>
                  <button
                    type="button"
                    className="capa-galeria-delete"
                    onClick={() => handleExcluirCapaRepositorio(cover)}
                    aria-label={`Excluir capa ${cover.name}`}
                    title="Excluir capa"
                  >
                    x
                  </button>
                </div>
              ))}

              <div className="capa-galeria-card capa-galeria-card--add">
                <button
                  type="button"
                  className="capa-galeria-add"
                  onClick={abrirSeletorUpload}
                  aria-label="Adicionar nova capa"
                >
                  +
                </button>
              </div>
            </div>

            {carregandoCapasRepositorio && (
              <p className="capa-relatorio-info">Carregando capas do repositorio...</p>
            )}
          </div>
        </div>
      </Card>

      {editorAberto && capaSelecionadaCustom && (
        <div className="capa-editor-backdrop">
          <div className="capa-editor-modal" role="dialog" aria-modal="true">
            <div className="capa-editor-header">
              <h3>Ajustar enquadramento da capa</h3>
              <button
                type="button"
                className="btn-view btn-view--secondary"
                onClick={fecharEditorCapa}
                disabled={salvandoAjuste}
              >
                Fechar
              </button>
            </div>

            <div
              ref={editorStageRef}
              className={`capa-editor-stage ${arrastandoEditor ? 'is-dragging' : ''}`}
              onPointerDown={handleEditorPointerDown}
              onPointerMove={handleEditorPointerMove}
              onPointerUp={finalizarArrasteEditor}
              onPointerCancel={finalizarArrasteEditor}
            >
              <img
                src={capaSelecionadaCustom.src}
                alt="Ajuste de capa"
                className="capa-editor-image"
                style={obterStyleImagem(capaSelecionadaCustom, ajusteEditor)}
              />
              <div className="capa-editor-grid" />
              <div className="capa-editor-texto-topo">UP Gestao</div>
              <div className="capa-editor-texto-base">
                <div className="capa-editor-texto-cliente relatorio-periodico-capa-titulo">
                  {tituloCapa.trim() || 'Titulo da Capa'}
                </div>
                <div className="capa-editor-texto-periodo">{periodoEditor}</div>
              </div>
            </div>

            <div className="capa-editor-controls">
              <label htmlFor="capa-editor-zoom-periodico">Zoom</label>
              <input
                id="capa-editor-zoom-periodico"
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.01}
                value={ajusteEditor.scale}
                onChange={handleEditorZoomChange}
              />
              <span>{Math.round(ajusteEditor.scale * 100)}%</span>
              <button
                type="button"
                className="btn-view btn-view--secondary"
                onClick={handleEditorReset}
                disabled={salvandoAjuste}
              >
                Centralizar
              </button>
            </div>

            <div className="capa-editor-actions">
              <button
                type="button"
                className="btn-view btn-view--secondary"
                onClick={fecharEditorCapa}
                disabled={salvandoAjuste}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-view"
                onClick={aplicarAjusteCapa}
                disabled={salvandoAjuste}
              >
                {salvandoAjuste ? 'Salvando...' : 'Aplicar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Card title="Relatório Periódico" className="form-relatorio relatorio-periodico-form">
        <input
          ref={resumoImagemInputRef}
          type="file"
          accept="image/*"
          onChange={handleImagemResumoSelecionada}
          style={{ display: 'none' }}
        />

        <div className="form-section">
          <h3>Dados da Capa</h3>
          <div className="form-group">
            <label htmlFor="periodico-titulo-capa">Titulo da Capa *</label>
            <input
              id="periodico-titulo-capa"
              type="text"
              value={tituloCapa}
              onChange={(event) => setTituloCapa(event.target.value)}
              placeholder="Ex.: Relatorio Especial de Mercado"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="periodico-mes">Mes *</label>
              <select
                id="periodico-mes"
                value={mes}
                onChange={(event) => setMes(Number(event.target.value))}
              >
                {meses.map((mesLabel, index) => (
                  <option key={mesLabel} value={index + 1}>
                    {mesLabel}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="periodico-ano">Ano *</label>
              <YearSelect
                id="periodico-ano"
                value={ano}
                years={anosDisponiveis}
                onChange={setAno}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Texto e Imagens</h3>
          <div className="form-group">
            <label htmlFor="periodico-resumo">Conteudo do relatorio *</label>
            <textarea
              id="periodico-resumo"
              value={resumoTexto}
              onChange={(event) => setResumoTexto(event.target.value)}
              rows={12}
              placeholder="Escreva aqui o resumo do que aconteceu no periodo..."
              ref={resumoTextareaRef}
            />
            <div className="comentario-actions">
              <button type="button" className="btn-anexo" onClick={abrirSeletorImagemResumo}>
                Adicionar imagem
              </button>
              {resumoImagens.length > 0 && (
                <span className="comentario-count">{resumoImagens.length} imagem(ns)</span>
              )}
            </div>
            <p className="comentario-hint">
              Use os tokens <code>[[img:ID]]</code> para posicionar imagens no texto.
            </p>

            {resumoImagens.length > 0 && (
              <div className="comentario-imagens">
                {resumoImagens.map((imagem, index) => (
                  <div key={imagem.id} className="comentario-imagem">
                    <img src={imagem.src} alt={`Resumo imagem ${index + 1}`} />
                    <div className="comentario-imagem-meta">
                      <span className="comentario-token">[[img:{imagem.id}]]</span>
                      <button
                        type="button"
                        className="btn-inserir-token"
                        onClick={() => inserirTokenNoResumo(`[[img:${imagem.id}]]`)}
                      >
                        Inserir no texto
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn-remover-imagem"
                      onClick={() => removerImagemResumo(index)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleGerarPdf}
            disabled={gerandoPdf}
          >
            {gerandoPdf ? 'Gerando PDF...' : 'Emitir relatorio'}
          </button>
        </div>
      </Card>

      {historicoGerado.length > 0 && (
        <Card title="Relatórios Periódicos Emitidos" className="relatorios-list">
          <div className="relatorios-grid">
            {historicoGerado.map((item) => (
              <div key={item.id} className="relatorio-item">
                <div className="relatorio-info">
                  <h4>{item.titulo}</h4>
                  <p>{item.periodo}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

