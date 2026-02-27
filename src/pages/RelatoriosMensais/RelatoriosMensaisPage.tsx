import { ChangeEvent, CSSProperties, PointerEvent, useEffect, useRef, useState } from 'react';
import { useClientes } from '../../hooks/useClientes';
import { RelatorioMensal } from '../../types/relatorio';
import { ReportCoverAdjustment, ReportCoverItem } from '../../types/reportCover';
import {
  carregarCapaRelatorio,
  gerarRelatorioMensalPDF,
  gerarRelatoriosMensaisEmMassa,
} from '../../services/pdfGenerator';
import {
  atualizarAjusteCapa,
  excluirCapa,
  listarCapas,
  uploadCapa,
} from '../../services/reportCoverRepositoryService';
import FormRelatorio from './FormRelatorio';
import FormRelatorioMassa from './FormRelatorioMassa';
import PreviewRelatorio from './PreviewRelatorio';
import Card from '../../components/Card/Card';
import './RelatoriosMensaisPage.css';

type ViewMode = 'form' | 'preview';
type ModoGeracao = 'individual' | 'massa';

type CapaSelecionada = {
  id: string;
  src: string;
  nomeArquivo: string;
  width: number;
  height: number;
};

type CapaPersistida = {
  travada: boolean;
  selectedCoverId?: string;
};

type EstadoArraste = {
  inicioX: number;
  inicioY: number;
  offsetInicialX: number;
  offsetInicialY: number;
  fatorEscalaVisual: number;
};

const RELATORIOS_LOCAL_STORAGE_KEY = 'relatoriosMensais';
const CAPA_LOCAL_STORAGE_KEY = 'relatorioMensalCapaTravada';
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

export default function RelatoriosMensaisPage() {
  const { clientes } = useClientes();
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [modoGeracao, setModoGeracao] = useState<ModoGeracao>('massa');
  const [relatorioAtual, setRelatorioAtual] = useState<RelatorioMensal | null>(null);
  const [gerandoPDFs, setGerandoPDFs] = useState(false);
  const [relatoriosGerados, setRelatoriosGerados] = useState<RelatorioMensal[]>(() => {
    const saved = localStorage.getItem(RELATORIOS_LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
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

  const [capaTravada, setCapaTravada] = useState(false);
  const [configCapaInicializada, setConfigCapaInicializada] = useState(false);

  const [editorAberto, setEditorAberto] = useState(false);
  const [arrastandoEditor, setArrastandoEditor] = useState(false);
  const [ajusteEditor, setAjusteEditor] = useState<ReportCoverAdjustment>(AJUSTE_CAPA_INICIAL);
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);

  const capaInputRef = useRef<HTMLInputElement | null>(null);
  const editorStageRef = useRef<HTMLDivElement | null>(null);
  const arrasteRef = useRef<EstadoArraste | null>(null);

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
    let ativo = true;

    const carregarCapasRepositorio = async () => {
      setCarregandoCapasRepositorio(true);
      try {
        const items = await listarCapas();
        if (!ativo) return;
        setCoverItems(items);
        setErroCapasRepositorio(null);
      } catch (error) {
        if (!ativo) return;
        console.error('Erro ao carregar capas do repositorio:', error);
        setCoverItems([]);
        setErroCapasRepositorio('Nao foi possivel carregar o repositorio local de capas.');
      } finally {
        if (ativo) setCarregandoCapasRepositorio(false);
      }
    };

    carregarCapasRepositorio();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CAPA_LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CapaPersistida;
        if (parsed?.travada) {
          setCapaTravada(true);
          if (typeof parsed.selectedCoverId === 'string' && parsed.selectedCoverId) {
            setSelectedCoverId(parsed.selectedCoverId);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar capa travada:', error);
    } finally {
      setConfigCapaInicializada(true);
    }
  }, []);

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
    if (!configCapaInicializada) return;

    if (!capaTravada) {
      localStorage.removeItem(CAPA_LOCAL_STORAGE_KEY);
      return;
    }

    const payload: CapaPersistida = {
      travada: true,
      selectedCoverId,
    };
    localStorage.setItem(CAPA_LOCAL_STORAGE_KEY, JSON.stringify(payload));
  }, [configCapaInicializada, capaTravada, selectedCoverId]);

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

  const handleFormSubmit = (relatorio: RelatorioMensal) => {
    setRelatorioAtual(relatorio);
    setViewMode('preview');
  };

  const handleGerarPDF = async () => {
    if (!relatorioAtual) return;

    try {
      const capaImagemPersonalizada = await obterCapaPersonalizadaParaPdf();
      await gerarRelatorioMensalPDF(relatorioAtual, { capaImagemPersonalizada });

      const novoRelatorio: RelatorioMensal = {
        ...relatorioAtual,
        id: Date.now().toString(),
      };

      const novosRelatorios = [novoRelatorio, ...relatoriosGerados];
      setRelatoriosGerados(novosRelatorios);
      localStorage.setItem(RELATORIOS_LOCAL_STORAGE_KEY, JSON.stringify(novosRelatorios));

      alert('PDF gerado com sucesso!');
      setViewMode('form');
      setRelatorioAtual(null);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Por favor, tente novamente.');
    }
  };

  const handleGerarPDFsEmMassa = async (relatorios: RelatorioMensal[]) => {
    if (relatorios.length === 0) return;

    setGerandoPDFs(true);
    try {
      const capaImagemPersonalizada = await obterCapaPersonalizadaParaPdf();
      await gerarRelatoriosMensaisEmMassa(relatorios, { capaImagemPersonalizada });

      const novosRelatorios = relatorios.map((rel) => ({
        ...rel,
        id: `${Date.now()}_${rel.clienteId}`,
      }));

      const todosRelatorios = [...novosRelatorios, ...relatoriosGerados];
      setRelatoriosGerados(todosRelatorios);
      localStorage.setItem(RELATORIOS_LOCAL_STORAGE_KEY, JSON.stringify(todosRelatorios));

      alert(`${relatorios.length} PDF(s) gerado(s) com sucesso!`);
    } catch (error) {
      console.error('Erro ao gerar PDFs:', error);
      alert('Erro ao gerar PDFs. Por favor, tente novamente.');
    } finally {
      setGerandoPDFs(false);
    }
  };

  const handleVoltar = () => {
    setViewMode('form');
  };

  const meses = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const dataAtual = new Date();
  const mesEditor = relatorioAtual?.mes ? relatorioAtual.mes - 1 : dataAtual.getMonth();
  const anoEditor = relatorioAtual?.ano || dataAtual.getFullYear();
  const mesNomeEditor = meses[mesEditor] || 'Mes';
  const periodoEditor = `${mesNomeEditor} ${anoEditor}`;
  const clienteEditor = relatorioAtual?.clienteNome || 'Cliente';

  const usandoCapaPadrao = selectedCoverId === DEFAULT_COVER_ID;
  const temImagemNaPreview = Boolean(usandoCapaPadrao ? capaPadrao : capaSelecionadaCustom?.src);
  const podeAjustarCorte = Boolean(!usandoCapaPadrao && capaSelecionadaCustom);

  return (
    <div className="relatorios-mensais-page">
      <div className="page-header">
        <h1>Relatorios Mensais</h1>
        <p className="page-subtitle">Gere relatorios padronizados para seus clientes</p>
      </div>

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

            <label className="capa-relatorio-lock">
              <input
                type="checkbox"
                checked={capaTravada}
                onChange={(event) => setCapaTravada(event.target.checked)}
              />
              Travar capa
            </label>

            <p className="capa-relatorio-info">
              {usandoCapaPadrao
                ? 'Usando capa padrao'
                : `Capa selecionada: ${capaSelecionadaCustom?.nomeArquivo || 'Personalizada'}`}
            </p>
            <p className="capa-relatorio-info">
              Repositorio local: clique em uma miniatura para selecionar, use "+" para enviar nova capa.
            </p>
            {erroCapasRepositorio && (
              <p className="capa-relatorio-error">{erroCapasRepositorio}</p>
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
                <div className="capa-editor-texto-titulo">Report Mensal</div>
                <div className="capa-editor-texto-cliente">{clienteEditor}</div>
                <div className="capa-editor-texto-periodo">{periodoEditor}</div>
              </div>
            </div>

            <div className="capa-editor-controls">
              <label htmlFor="capa-editor-zoom">Zoom</label>
              <input
                id="capa-editor-zoom"
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

      {viewMode === 'form' && (
        <>
          <div className="modo-geracao-toggle">
            <button
              className={`toggle-btn ${modoGeracao === 'individual' ? 'active' : ''}`}
              onClick={() => setModoGeracao('individual')}
            >
              Individual
            </button>
            <button
              className={`toggle-btn ${modoGeracao === 'massa' ? 'active' : ''}`}
              onClick={() => setModoGeracao('massa')}
            >
              Em Massa
            </button>
          </div>

          {modoGeracao === 'individual' ? (
            <FormRelatorio clientes={clientes} onSubmit={handleFormSubmit} />
          ) : (
            <FormRelatorioMassa clientes={clientes} onGerarPDFs={handleGerarPDFsEmMassa} />
          )}

          {gerandoPDFs && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>Gerando PDFs... Por favor, aguarde.</p>
            </div>
          )}

          {relatoriosGerados.length > 0 && (
            <Card title="Relatorios Gerados" className="relatorios-list">
              <div className="relatorios-grid">
                {relatoriosGerados.slice(0, 10).map((relatorio) => (
                  <div key={relatorio.id} className="relatorio-item">
                    <div className="relatorio-info">
                      <h4>{relatorio.clienteNome}</h4>
                      <p>
                        {relatorio.mes}/{relatorio.ano}
                      </p>
                    </div>
                    <div className="relatorio-actions">
                      <button
                        onClick={() => {
                          setRelatorioAtual(relatorio);
                          setViewMode('preview');
                        }}
                        className="btn-view"
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {viewMode === 'preview' && relatorioAtual && (
        <PreviewRelatorio
          relatorio={relatorioAtual}
          onGerarPDF={handleGerarPDF}
          onVoltar={handleVoltar}
        />
      )}
    </div>
  );
}

