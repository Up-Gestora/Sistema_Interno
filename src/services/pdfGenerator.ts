// @ts-ignore
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { RelatorioMensal, RelatorioMensalEstrategia } from '../types/relatorio';
import { Cliente } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';

/**
 * Carrega a imagem da capa do relatório
 */
async function carregarCapaRelatorio(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Tentar diferentes caminhos possíveis para a capa
    const caminhosPossiveis = [
      '/capa-relatorio.png',
      '/capa-relatorio.jpg',
      '/capa-relatorio',
      '/capa-relatorio.jpeg',
      '/capa-relatorio.png.png',
      '/capa-report-mensal.png',
      '/capa-report-mensal.jpg',
      '/capa-report-mensal.jpeg',
      '/modelo-lamina.png.png',
    ];
    
    let tentativaAtual = 0;
    
    const tentarProximoCaminho = () => {
      if (tentativaAtual >= caminhosPossiveis.length) {
        resolve(null);
        return;
      }
      
      img.src = caminhosPossiveis[tentativaAtual];
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
        }
      };
      
      img.onerror = () => {
        tentativaAtual++;
        tentarProximoCaminho();
      };
    };
    
    tentarProximoCaminho();
  });
}

export async function gerarRelatorioMensalPDF(relatorio: RelatorioMensal): Promise<void> {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const mesNome = meses[relatorio.mes - 1] || `Mês ${relatorio.mes}`;
  const mesAno = `${mesNome} de ${relatorio.ano}`;
  const dataGeracao = formatDate(new Date().toISOString());

  // Determinar qual texto usar baseado na comparação com CDI
  const patrimonioTotalValor = Number(relatorio.patrimonioTotal);
  const resultadoMesValor = Number(relatorio.resultadoMes);
  const resultadoPercentualValor = relatorio.resultadoPercentual !== undefined ? Number(relatorio.resultadoPercentual) : NaN;
  const cdiMensalValor = relatorio.cdiMensal !== undefined ? Number(relatorio.cdiMensal) : NaN;

  const patrimonioTotal = Number.isFinite(patrimonioTotalValor) ? patrimonioTotalValor : 0;
  const resultadoMes = Number.isFinite(resultadoMesValor) ? resultadoMesValor : 0;
  const resultadoPercentualValido = Number.isFinite(resultadoPercentualValor);
  const resultadoPercentual = resultadoPercentualValido ? resultadoPercentualValor : 0;
  const cdiMensalValido = Number.isFinite(cdiMensalValor);
  const cdiMensal = cdiMensalValido ? cdiMensalValor : 0;
  const textoResultado = resultadoPercentual > cdiMensal 
    ? (relatorio.textoAcimaCDI || '')
    : (relatorio.textoAbaixoCDI || '');
  const resumoTextoBase = relatorio.resumoTexto?.trim()
    ? relatorio.resumoTexto
    : textoResultado;

  // Cores alinhadas com a identidade visual do sistema
  const primaryColor = '#1d2f34';
  const primaryDark = '#131b1d';
  const primaryLight = '#4c5f64';
  const textColor = '#1c2836';
  const textSecondary = '#2a3a4d';
  const textMuted = '#44576c';
  const bgLight = '#f1f3f6';
  const borderColor = '#d7e0ea';
  const successColor = '#10b981';
  const dangerColor = '#ef4444';

  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = 1123;
  const PAGE_PADDING_PX = 44;
  const BAR_HEIGHT_PX = 12;
  const barPattern = 'repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0px, rgba(255, 255, 255, 0.22) 8px, rgba(255, 255, 255, 0) 8px, rgba(255, 255, 255, 0) 16px)';
  const barGradient = `linear-gradient(90deg, ${primaryDark} 0%, ${primaryColor} 55%, ${primaryLight} 100%)`;
  const barBackground = `${barPattern}, ${barGradient}`;
  const barWatermarkText = 'UP GESTÃO • REPORT MENSAL • UP GESTÃO • REPORT MENSAL';

  const criarMarcaDaguaBarra = () => {
    const marca = document.createElement('div');
    marca.style.position = 'absolute';
    marca.style.inset = '0';
    marca.style.display = 'flex';
    marca.style.alignItems = 'center';
    marca.style.justifyContent = 'center';
    marca.style.fontSize = '9px';
    marca.style.letterSpacing = '0.42em';
    marca.style.textTransform = 'uppercase';
    marca.style.color = 'rgba(255, 255, 255, 0.5)';
    marca.style.whiteSpace = 'nowrap';
    marca.textContent = barWatermarkText;
    return marca;
  };

  const criarBarraMarca = (posicao: 'top' | 'bottom') => {
    const barra = document.createElement('div');
    barra.style.position = 'absolute';
    barra.style.left = '0';
    barra.style.right = '0';
    barra.style.height = `${BAR_HEIGHT_PX}px`;
    barra.style.background = barBackground;
    barra.style.zIndex = '1';
    barra.style.overflow = 'hidden';
    barra.style[posicao] = '0';
    barra.appendChild(criarMarcaDaguaBarra());
    return barra;
  };

  const macroParagraphos = (relatorio.resumoMacro || '')
    .replace(/;/g, '\n')
    .split(/\r?\n/)
    .map(paragrafo => paragrafo.trim());

  type ResumoBloco =
    | { type: 'paragraph'; text: string }
    | { type: 'image'; src: string; id: string }
    | { type: 'spacer' };

  // Mantem a proporcao original das imagens no PDF.
  // Importante: definimos width/height (atributos) para reservar o aspect ratio no layout
  // antes do html2canvas capturar a pagina, evitando cortes por mudanca de layout no load.
  const dimensoesImagemPorSrc = new Map<string, { width: number; height: number }>();

  const carregarDimensoesImagem = (src: string): Promise<{ width: number; height: number } | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(null);
          return;
        }
        resolve({ width, height });
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  const preloadDimensoesImagens = async (imagens: Array<{ src: string }>) => {
    const srcs = Array.from(
      new Set(
        (imagens || [])
          .map((img) => img?.src)
          .filter((src): src is string => typeof src === 'string' && src.trim().length > 0)
      )
    );

    await Promise.all(
      srcs.map(async (src) => {
        if (dimensoesImagemPorSrc.has(src)) return;
        const dims = await carregarDimensoesImagem(src);
        if (dims) dimensoesImagemPorSrc.set(src, dims);
      })
    );
  };

  const criarBlocosResumoTexto = (
    texto: string,
    imagens: Array<{ id: string; src: string }> = []
  ): ResumoBloco[] => {
    const imagemMap = new Map(
      (imagens || [])
        .filter((item) => item?.id && item?.src)
        .map((item) => [item.id, item.src])
    );
    const tokenRegex = /\[\[img:([a-zA-Z0-9_-]+)\]\]/g;
    const blocos: ResumoBloco[] = [];
    const paragrafos = (texto || '').split(/\n\s*\n/);

    paragrafos.forEach((paragrafo) => {
      if (!paragrafo.trim()) {
        blocos.push({ type: 'spacer' });
        return;
      }

      let lastIndex = 0;
      let adicionou = false;

      paragrafo.replace(tokenRegex, (match, id, offset) => {
        const antes = paragrafo.slice(lastIndex, offset).trim();
        if (antes) {
          blocos.push({ type: 'paragraph', text: antes });
          adicionou = true;
        }
        const src = imagemMap.get(id);
        if (src) {
          blocos.push({ type: 'image', src, id });
          adicionou = true;
        }
        lastIndex = offset + match.length;
        return match;
      });

      const depois = paragrafo.slice(lastIndex).trim();
      if (depois) {
        blocos.push({ type: 'paragraph', text: depois });
        adicionou = true;
      }

      if (!adicionou) {
        blocos.push({ type: 'spacer' });
      }
    });

    return blocos;
  };

  const criarElementoResumoBloco = (bloco: ResumoBloco): HTMLElement => {
    if (bloco.type === 'image') {
      const wrapper = document.createElement('div');
      wrapper.style.margin = '10px 0';

      const img = document.createElement('img');
      img.src = bloco.src;
      img.alt = 'Imagem do comentário';
      const dims = dimensoesImagemPorSrc.get(bloco.src);
      if (dims) {
        img.width = dims.width;
        img.height = dims.height;
      }
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.borderRadius = '10px';
      img.style.display = 'block';

      wrapper.appendChild(img);
      return wrapper;
    }

    const p = document.createElement('p');
    const isSpacer = bloco.type === 'spacer';
    p.style.color = textSecondary;
    p.style.fontSize = '14px';
    p.style.lineHeight = '1.4';
    p.style.margin = isSpacer ? '0 0 12px 0' : '0 0 6px 0';
    p.style.textAlign = 'justify';
    p.style.textIndent = isSpacer ? '0' : '1.2em';
    p.textContent = isSpacer ? '\u00A0' : bloco.text;
    return p;
  };

  const criarPaginaBase = () => {
    const pagina = document.createElement('div');
    pagina.style.position = 'absolute';
    pagina.style.left = '-9999px';
    pagina.style.width = `${PAGE_WIDTH_PX}px`;
    pagina.style.height = `${PAGE_HEIGHT_PX}px`;
    pagina.style.padding = '0';
    pagina.style.fontFamily = '\'Source Sans 3\', sans-serif';
    pagina.style.backgroundColor = '#ffffff';
    pagina.style.color = textColor;
    pagina.style.boxSizing = 'border-box';
    pagina.style.overflow = 'hidden';

    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.height = '100%';
    container.style.width = '100%';
    container.style.boxSizing = 'border-box';
    container.style.padding = `${PAGE_PADDING_PX}px`;
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.zIndex = '2';

    const inner = document.createElement('div');
    inner.style.maxWidth = '800px';
    inner.style.width = '100%';
    inner.style.position = 'relative';
    inner.style.height = '100%';

    const bordaTopo = criarBarraMarca('top');
    const bordaBase = criarBarraMarca('bottom');

    const conteudo = document.createElement('div');
    conteudo.style.paddingTop = '8px';
    conteudo.style.position = 'relative';
    conteudo.style.zIndex = '2';

    inner.appendChild(conteudo);
    container.appendChild(inner);
    pagina.appendChild(bordaTopo);
    pagina.appendChild(bordaBase);
    pagina.appendChild(container);

    return { pagina, conteudo };
  };

  const criarCapaReport = (capaImagem: string | null) => {
    const capa = document.createElement('div');
    capa.style.position = 'absolute';
    capa.style.left = '-9999px';
    capa.style.width = `${PAGE_WIDTH_PX}px`;
    capa.style.height = `${PAGE_HEIGHT_PX}px`;
    capa.style.fontFamily = '\'Source Sans 3\', sans-serif';
    capa.style.backgroundColor = '#ffffff';
    capa.style.color = '#ffffff';
    capa.style.boxSizing = 'border-box';
    capa.style.overflow = 'hidden';

    const fundo = document.createElement('div');
    fundo.style.position = 'absolute';
    fundo.style.inset = '0';
    fundo.style.background = capaImagem
      ? `url(${capaImagem}) center/cover no-repeat`
      : barGradient;
    fundo.style.filter = capaImagem ? 'saturate(0.9)' : 'none';

    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.background = 'linear-gradient(180deg, rgba(13, 18, 19, 0.35) 0%, rgba(13, 18, 19, 0.65) 45%, rgba(13, 18, 19, 0.85) 100%)';

    const conteudo = document.createElement('div');
    conteudo.style.position = 'relative';
    conteudo.style.zIndex = '2';
    conteudo.style.height = '100%';
    conteudo.style.display = 'flex';
    conteudo.style.flexDirection = 'column';
    conteudo.style.justifyContent = 'space-between';
    conteudo.style.padding = '64px 56px';

    const reportTitleSize = 42;
    const secondarySize = Math.round(reportTitleSize * 0.8);

    const topo = document.createElement('div');
    topo.innerHTML = `
      <div style="font-family: 'Sora', 'Source Sans 3', sans-serif; font-size: ${secondarySize}px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255, 255, 255, 0.85);">
        UP Gestão
      </div>
      <div style="margin-top: 10px; width: 140px; height: 2px; background: rgba(255, 255, 255, 0.6);"></div>
    `;

    const base = document.createElement('div');
    base.innerHTML = `
      <div style="font-family: 'Sora', 'Source Sans 3', sans-serif; font-size: ${reportTitleSize}px; font-weight: 700; line-height: 1.1;">
        Report Mensal
      </div>
      <div style="margin-top: 12px; font-size: ${secondarySize}px; color: rgba(255, 255, 255, 0.85);">
        ${relatorio.clienteNome || 'Cliente'}
      </div>
      <div style="margin-top: 6px; font-size: ${secondarySize}px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255, 255, 255, 0.7);">
        ${mesAno}
      </div>
    `;

    conteudo.appendChild(topo);
    conteudo.appendChild(base);

    capa.appendChild(fundo);
    capa.appendChild(overlay);
    capa.appendChild(conteudo);

    return capa;
  };

  const criarPaginaResumoMacro = (comHeader: boolean) => {
    const { pagina, conteudo } = criarPaginaBase();

    if (comHeader) {
      const header = document.createElement('div');
      header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 14px;">
          <div>
            <div style="font-family: 'Sora', 'Source Sans 3', sans-serif; color: ${primaryColor}; font-size: 22px; font-weight: 700; margin: 0;">
              UP Gestão
            </div>
            <div style="margin-top: 4px; color: ${textMuted}; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;">
              Report Mensal
            </div>
          </div>
          <div style="background: ${bgLight}; border: 1px solid ${borderColor}; border-radius: 10px; padding: 10px 12px; text-align: right; min-width: 180px;">
            <div style="color: ${textMuted}; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;">Período</div>
            <div style="color: ${textColor}; font-size: 14px; font-weight: 600; margin-top: 4px;">${mesAno}</div>
            <div style="color: ${textSecondary}; font-size: 12px; margin-top: 6px;">${relatorio.clienteNome || 'Cliente'}</div>
          </div>
        </div>
        <div style="height: 2px; background: ${primaryColor}; opacity: 0.4; margin-bottom: 16px;"></div>
      `;
      conteudo.appendChild(header);
    }

    const box = document.createElement('div');
    box.style.marginBottom = '18px';
    box.style.backgroundColor = '#ffffff';
    box.style.padding = '16px';
    box.style.borderRadius = '10px';
    box.style.border = 'none';
    box.style.borderLeft = `4px solid ${primaryColor}`;

    const titulo = document.createElement('h3');
    titulo.textContent = 'Resumo Macro';
    titulo.style.color = textMuted;
    titulo.style.fontSize = '12px';
    titulo.style.fontWeight = '600';
    titulo.style.marginBottom = '10px';
    titulo.style.textTransform = 'uppercase';
    titulo.style.letterSpacing = '0.12em';

    const corpo = document.createElement('div');
    corpo.style.textAlign = 'justify';

    box.appendChild(titulo);
    box.appendChild(corpo);
    conteudo.appendChild(box);

    return { pagina, corpo };
  };

  const paginasMacro: HTMLElement[] = [];
  let indiceParagrafo = 0;

  while (indiceParagrafo < macroParagraphos.length || paginasMacro.length === 0) {
    const { pagina, corpo } = criarPaginaResumoMacro(paginasMacro.length === 0);
    document.body.appendChild(pagina);

    while (indiceParagrafo < macroParagraphos.length) {
      const p = document.createElement('p');
      p.style.color = textSecondary;
      p.style.fontSize = '14px';
      const linhaMacro = macroParagraphos[indiceParagrafo];
      const linhaVazia = linhaMacro.length === 0;
      p.style.lineHeight = '1.4';
      p.style.margin = linhaVazia ? '0 0 12px 0' : '0 0 6px 0';
      p.style.textAlign = 'justify';
      p.style.textIndent = linhaVazia ? '0' : '1.2em';
      p.textContent = linhaVazia ? '\u00A0' : linhaMacro;
      corpo.appendChild(p);

      if (pagina.scrollHeight > PAGE_HEIGHT_PX) {
        corpo.removeChild(p);
        if (corpo.childElementCount === 0) {
          corpo.appendChild(p);
          indiceParagrafo++;
        }
        break;
      }

      indiceParagrafo++;
    }

    paginasMacro.push(pagina);
  }

  const criarPaginasResumoMes = (secao: RelatorioMensalEstrategia) => {

    const patrimonioTotalValor = Number(secao.patrimonioTotal);
    const resultadoMesValor = Number(secao.resultadoMes);
    const resultadoPercentualValor = secao.resultadoPercentual !== undefined
      ? Number(secao.resultadoPercentual)
      : (Number.isFinite(patrimonioTotalValor) && patrimonioTotalValor !== 0
        ? (resultadoMesValor / patrimonioTotalValor) * 100
        : NaN);

    const patrimonioTotalSecao = Number.isFinite(patrimonioTotalValor) ? patrimonioTotalValor : 0;
    const resultadoMesSecao = Number.isFinite(resultadoMesValor) ? resultadoMesValor : 0;
    const resultadoPercentualValidoSecao = Number.isFinite(resultadoPercentualValor);
    const resultadoPercentualSecao = resultadoPercentualValidoSecao ? resultadoPercentualValor : 0;
    const textoResultadoSecao = resultadoPercentualSecao > cdiMensal
      ? (relatorio.textoAcimaCDI || '')
      : (relatorio.textoAbaixoCDI || '');
    const resumoTextoSecao = secao.resumoTexto?.trim()
      ? secao.resumoTexto
      : textoResultadoSecao;

    const resultadoPercentualTexto = resultadoPercentualValidoSecao
      ? `${resultadoPercentualSecao.toFixed(2)}%`
      : '--';
    const cdiMensalTexto = cdiMensalValido ? `${cdiMensal.toFixed(2)}%` : '--';
    const resultadoMesBg = resultadoMesSecao >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
    const resultadoMesBorder = resultadoMesSecao >= 0 ? successColor : dangerColor;
    const resultadoMesColor = resultadoMesSecao >= 0 ? successColor : dangerColor;
    const resultadoPercentualColor = resultadoPercentualValidoSecao
      ? (resultadoPercentualSecao >= 0 ? successColor : dangerColor)
      : textColor;
    const resultadoPercentualBg = resultadoPercentualValidoSecao
      ? (resultadoPercentualSecao >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)')
      : bgLight;
    const resultadoPercentualBorder = resultadoPercentualValidoSecao
      ? (resultadoPercentualSecao >= 0 ? successColor : dangerColor)
      : borderColor;

    const criarPaginaResumoMesBase = (comentariosTitulo: string, mostrarMetricas: boolean) => {
      const pagina = document.createElement('div');
      pagina.style.position = 'absolute';
      pagina.style.left = '-9999px';
      pagina.style.width = `${PAGE_WIDTH_PX}px`;
      pagina.style.height = `${PAGE_HEIGHT_PX}px`;
      pagina.style.padding = '0';
      pagina.style.fontFamily = '\'Source Sans 3\', sans-serif';
      pagina.style.backgroundColor = '#ffffff';
      pagina.style.color = textColor;
      pagina.style.boxSizing = 'border-box';

      pagina.innerHTML = `
      <div style="position: relative; height: 100%;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: ${BAR_HEIGHT_PX}px; background: ${barBackground}; z-index: 1; overflow: hidden;">
          <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 9px; letter-spacing: 0.42em; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); white-space: nowrap;">
            ${barWatermarkText}
          </div>
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: ${BAR_HEIGHT_PX}px; background: ${barBackground}; z-index: 1; overflow: hidden;">
          <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 9px; letter-spacing: 0.42em; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); white-space: nowrap;">
            ${barWatermarkText}
          </div>
        </div>
        <div style="height: 100%; box-sizing: border-box; padding: ${PAGE_PADDING_PX}px;">
          <div style="max-width: 820px; margin: 0 auto; position: relative; height: 100%; display: flex; flex-direction: column;">
            <div style="padding-top: 8px; flex: 1; position: relative; z-index: 2; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 14px;">
            <div>
              <div style="font-family: 'Sora', 'Source Sans 3', sans-serif; color: ${primaryColor}; font-size: 22px; font-weight: 700;">
                UP Gestão
              </div>
              <div style="margin-top: 4px; color: ${textMuted}; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;">
                Report Mensal
              </div>
            </div>
            <div style="background: ${bgLight}; border: 1px solid ${borderColor}; border-radius: 10px; padding: 10px 12px; text-align: right; min-width: 180px;">
              <div style="color: ${textMuted}; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;">Período</div>
              <div style="color: ${textColor}; font-size: 14px; font-weight: 600; margin-top: 4px;">${mesAno}</div>
              <div style="color: ${textSecondary}; font-size: 12px; margin-top: 6px;">${relatorio.clienteNome || 'Cliente'}</div>
            </div>
          </div>
          <div style="height: 2px; background: ${primaryColor}; opacity: 0.4; margin-bottom: 12px;"></div>
          <div style="margin-bottom: 14px;">
            <div style="color: ${textMuted}; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;">Estratégia</div>
            <div style="color: ${textColor}; font-size: 16px; font-weight: 700; margin-top: 4px;">${secao.titulo || 'Estratégia principal'}</div>
          </div>
          ${mostrarMetricas ? `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
            <div style="background-color: #ffffff; border: 1px solid ${borderColor}; padding: 14px; border-radius: 10px;">
              <p style="color: ${textMuted}; font-size: 10px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.12em;">Patrimônio Total</p>
              <p style="color: ${textColor}; font-size: 22px; font-weight: 700; margin: 0;">${formatCurrency(patrimonioTotalSecao)}</p>
            </div>
            <div style="background-color: ${resultadoMesBg}; border: 1px solid ${resultadoMesBorder}; padding: 14px; border-radius: 10px;">
              <p style="color: ${textMuted}; font-size: 10px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.12em;">Resultado do Mês</p>
              <p style="color: ${resultadoMesColor}; font-size: 22px; font-weight: 700; margin: 0;">
                ${resultadoMesSecao >= 0 ? '+' : ''}${formatCurrency(resultadoMesSecao)}
              </p>
            </div>
            <div style="background-color: ${resultadoPercentualBg}; border: 1px solid ${resultadoPercentualBorder}; padding: 14px; border-radius: 10px;">
              <p style="color: ${textMuted}; font-size: 10px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.12em;">Resultado % do Mês</p>
              <p style="color: ${resultadoPercentualColor}; font-size: 22px; font-weight: 700; margin: 0;">
                ${resultadoPercentualTexto}
              </p>
            </div>
          </div>
          ` : ''}
          <div style="margin-bottom: 16px;">
            <div style="background-color: #ffffff; border: none; padding: 16px; border-radius: 10px; border-left: 4px solid ${primaryColor};">
              <div style="color: ${textMuted}; font-size: 11px; font-weight: 600; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.12em;">${comentariosTitulo}</div>
              <div style="text-align: justify;" data-resumo-corpo></div>
              ${cdiMensalValido && resultadoPercentualValidoSecao ? `
              <p style="color: ${textMuted}; font-size: 11px; margin-top: 12px; margin-bottom: 0;">
                Resultado: ${resultadoPercentualTexto} | CDI Mensal: ${cdiMensalTexto}
              </p>
              ` : ''}
            </div>
          </div>
        </div>
            <div style="padding-top: 14px; border-top: 1px solid ${borderColor}; text-align: center; margin-top: auto; position: relative; z-index: 2;">
              <p style="color: ${textMuted}; font-size: 11px; margin: 0;">Gerado em ${dataGeracao} | UP Gestão</p>
            </div>
          </div>
        </div>
      </div>
    `;

      const corpoResumo = pagina.querySelector('[data-resumo-corpo]') as HTMLDivElement | null;
      if (!corpoResumo) {
        const fallback = document.createElement('div');
        pagina.appendChild(fallback);
        return { pagina, corpoResumo: fallback };
      }

      return { pagina, corpoResumo };
    };

    const blocosResumo = criarBlocosResumoTexto(resumoTextoSecao, secao.resumoImagens);
    const temConteudo = blocosResumo.some((bloco) => bloco.type !== 'spacer');
    if (!temConteudo) {
      blocosResumo.length = 0;
      blocosResumo.push({
        type: 'paragraph',
        text: resumoTextoSecao || 'Nenhum resumo disponível.',
      });
    }

    const paginas: HTMLElement[] = [];
    let { pagina, corpoResumo } = criarPaginaResumoMesBase('Comentários da Gestão', true);
    document.body.appendChild(pagina);

    blocosResumo.forEach((bloco) => {
      const elemento = criarElementoResumoBloco(bloco);
      corpoResumo.appendChild(elemento);

      if (pagina.scrollHeight > PAGE_HEIGHT_PX) {
        corpoResumo.removeChild(elemento);

        if (corpoResumo.childElementCount === 0) {
          corpoResumo.appendChild(elemento);
          return;
        }

        paginas.push(pagina);
        const novaPagina = criarPaginaResumoMesBase('Comentários da Gestão (continuação)', false);
        pagina = novaPagina.pagina;
        corpoResumo = novaPagina.corpoResumo;
        document.body.appendChild(pagina);
        corpoResumo.appendChild(elemento);
      }
    });

    paginas.push(pagina);
    return paginas;
  };

  const estrategiasResumo: RelatorioMensalEstrategia[] = relatorio.estrategias?.length
    ? relatorio.estrategias
    : [{
        titulo: 'Estratégia principal',
        patrimonioTotal,
        resultadoMes,
        resultadoPercentual: resultadoPercentualValido ? resultadoPercentual : undefined,
        resumoTexto: resumoTextoBase,
      }];

  await preloadDimensoesImagens(estrategiasResumo.flatMap((secao) => secao.resumoImagens || []));

  const paginasResumo = estrategiasResumo.flatMap(criarPaginasResumoMes);

  const capaData = await carregarCapaRelatorio();
  const paginaCapa = criarCapaReport(capaData);

  document.body.appendChild(paginaCapa);
  paginasMacro.forEach(pagina => document.body.appendChild(pagina));
  paginasResumo.forEach(pagina => document.body.appendChild(pagina));

  try {
    let imgCapa: string | null = null;
    try {
      const canvasCapa = await html2canvas(paginaCapa, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
      });
      imgCapa = canvasCapa.toDataURL('image/png');
    } catch (error) {
      imgCapa = capaData || null;
    }

    const canvasesMacro = [];
    for (const pagina of paginasMacro) {
      const canvas = await html2canvas(pagina, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
      });
      canvasesMacro.push(canvas);
    }

    const imgMacro = canvasesMacro.map(canvas => canvas.toDataURL('image/png'));
    const canvasesResumo = [];
    for (const pagina of paginasResumo) {
      const canvas = await html2canvas(pagina, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
      });
      canvasesResumo.push(canvas);
    }
    const imgResumo = canvasesResumo.map(canvas => canvas.toDataURL('image/png'));

    // @ts-ignore
    const pdf = new jsPDF('p', 'mm', 'a4');

    if (imgCapa) {
      pdf.addImage(imgCapa, 'PNG', 0, 0, 210, 297);
      pdf.addPage();
    }

    imgMacro.forEach((img, index) => {
      if (index > 0) {
        pdf.addPage();
      }
      pdf.addImage(img, 'PNG', 0, 0, 210, 297);
    });

    imgResumo.forEach((img) => {
      pdf.addPage();
      pdf.addImage(img, 'PNG', 0, 0, 210, 297);
    });

    const fileName = `Report_Mensal_${relatorio.clienteNome?.replace(/\s/g, '_') || 'Cliente'}_${mesAno.replace(/\s/g, '_')}.pdf`;
    pdf.save(fileName);
  } finally {
    if (paginaCapa.parentNode) {
      paginaCapa.parentNode.removeChild(paginaCapa);
    }
    paginasMacro.forEach(pagina => {
      if (pagina.parentNode) {
        pagina.parentNode.removeChild(pagina);
      }
    });
    paginasResumo.forEach(pagina => {
      if (pagina.parentNode) {
        pagina.parentNode.removeChild(pagina);
      }
    });
  }
}

export async function gerarRelatoriosMensaisEmMassa(relatorios: RelatorioMensal[]): Promise<void> {
  // Gerar PDFs com delay entre cada um para evitar problemas de download simultâneo
  for (let i = 0; i < relatorios.length; i++) {
    await gerarRelatorioMensalPDF(relatorios[i]);
    
    // Aguardar um pouco antes do próximo PDF (exceto no último)
    if (i < relatorios.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

export interface RelatorioEstrategiaDiariaPDF {
  estrategiaNome: string;
  periodo: string;
  dataGeracao: string;
  descricao?: string;
  benchmarkLabel?: string;
  resumo: Array<{ titulo: string; valor: string; detalhe?: string }>;
  chartData: Array<{ data: string; carteira: number; cdi: number; ifix: number }>;
}

export async function gerarRelatorioEstrategiaDiariaPDF(
  relatorio: RelatorioEstrategiaDiariaPDF
): Promise<void> {
  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = 1123;
  const PAGE_PADDING_PX = 56;

  const primaryColor = '#1d2f34';
  const secondaryColor = '#4c5f64';
  const textColor = '#1f2a2d';
  const bgLight = '#f3f6f7';
  const borderColor = '#d5dde0';
  const benchmarkLabel = relatorio.benchmarkLabel || 'IFIX';

  const criarPaginaBase = () => {
    const pagina = document.createElement('div');
    pagina.style.position = 'absolute';
    pagina.style.left = '-9999px';
    pagina.style.width = `${PAGE_WIDTH_PX}px`;
    pagina.style.height = `${PAGE_HEIGHT_PX}px`;
    pagina.style.padding = `${PAGE_PADDING_PX}px`;
    pagina.style.fontFamily = 'Quicksand, sans-serif';
    pagina.style.backgroundColor = '#ffffff';
    pagina.style.color = textColor;
    pagina.style.boxSizing = 'border-box';
    pagina.style.overflow = 'hidden';

    const container = document.createElement('div');
    container.style.height = '100%';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '20px';

    pagina.appendChild(container);
    return { pagina, container };
  };

  const criarHeader = () => {
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="border-bottom: 3px solid ${primaryColor}; padding-bottom: 12px;">
        <h1 style="margin: 0; color: ${primaryColor}; font-size: 26px; font-weight: 700;">
          Relatório de Estratégia
        </h1>
        <p style="margin: 6px 0 0 0; color: ${secondaryColor}; font-size: 14px;">
          ${relatorio.estrategiaNome} • Período: ${relatorio.periodo}
        </p>
      </div>
    `;
    return header;
  };

  const criarCapa = () => {
    const { pagina, container } = criarPaginaBase();

    const hero = document.createElement('div');
    hero.style.flex = '1';
    hero.style.display = 'flex';
    hero.style.flexDirection = 'column';
    hero.style.justifyContent = 'center';
    hero.style.gap = '20px';

    const titulo = document.createElement('div');
    titulo.innerHTML = `
      <div style="font-size: 32px; font-weight: 700; color: ${primaryColor};">
        Relatório de Estratégia
      </div>
      <div style="margin-top: 6px; font-size: 18px; color: ${secondaryColor};">
        ${relatorio.estrategiaNome}
      </div>
    `;

    const periodo = document.createElement('div');
    periodo.innerHTML = `
      <div style="font-size: 14px; color: ${secondaryColor};">
        Período: ${relatorio.periodo}
      </div>
      <div style="font-size: 12px; color: ${secondaryColor}; margin-top: 4px;">
        Gerado em ${relatorio.dataGeracao}
      </div>
    `;

    const decor = document.createElement('div');
    decor.style.height = '180px';
    decor.style.borderRadius = '16px';
    decor.style.background = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
    decor.style.position = 'relative';
    decor.style.overflow = 'hidden';
    decor.innerHTML = `
      <div style="position:absolute; width:220px; height:220px; border-radius:50%; background: rgba(255,255,255,0.15); top:-40px; right:-30px;"></div>
      <div style="position:absolute; width:160px; height:160px; border-radius:50%; background: rgba(255,255,255,0.12); bottom:-40px; left:20px;"></div>
      <div style="position:absolute; width:320px; height:60px; background: rgba(255,255,255,0.08); bottom:30px; left:-40px; transform: rotate(-8deg);"></div>
    `;

    hero.appendChild(titulo);
    hero.appendChild(periodo);
    hero.appendChild(decor);
    container.appendChild(hero);

    return pagina;
  };

  const criarResumo = () => {
    const resumo = document.createElement('div');
    resumo.style.display = 'grid';
    resumo.style.gridTemplateColumns = 'repeat(3, 1fr)';
    resumo.style.gap = '12px';

    relatorio.resumo.forEach((item, index) => {
      const card = document.createElement('div');
      card.style.background = bgLight;
      card.style.border = `1px solid ${borderColor}`;
      card.style.borderRadius = '10px';
      card.style.padding = '12px';
      if (index === 0) {
        card.style.borderColor = primaryColor;
      }

      card.innerHTML = `
        <div style="color: ${secondaryColor}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;">
          ${item.titulo}
        </div>
        <div style="color: ${textColor}; font-size: 18px; font-weight: 700; margin-top: 6px;">
          ${item.valor}
        </div>
        ${item.detalhe ? `<div style="color: ${secondaryColor}; font-size: 12px; margin-top: 4px;">${item.detalhe}</div>` : ''}
      `;

      resumo.appendChild(card);
    });

    return resumo;
  };

  const criarDescricao = () => {
    if (!relatorio.descricao) return null;

    const box = document.createElement('div');
    box.style.background = bgLight;
    box.style.border = `1px solid ${borderColor}`;
    box.style.borderRadius = '10px';
    box.style.padding = '12px';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.gap = '6px';

    const titulo = document.createElement('div');
    titulo.style.color = secondaryColor;
    titulo.style.fontSize = '11px';
    titulo.style.textTransform = 'uppercase';
    titulo.style.letterSpacing = '0.04em';
    titulo.textContent = 'Descrição da estratégia';

    const texto = document.createElement('div');
    texto.style.color = textColor;
    texto.style.fontSize = '13px';
    texto.style.lineHeight = '1.6';

    const paragrafos = relatorio.descricao
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    texto.innerHTML = paragrafos
      .map((p) => `<p style="margin: 0 0 10px 0;">${p}</p>`)
      .join('');

    box.appendChild(titulo);
    box.appendChild(texto);
    return box;
  };

  const criarGrafico = (chartData: RelatorioEstrategiaDiariaPDF['chartData']) => {
    const width = 640;
    const height = 260;
    const padding = 28;
    const plotW = width - padding * 2;
    const plotH = height - padding * 2;
    const points = chartData.length > 1 ? chartData : [];

    const valores = points.flatMap((item) => [item.carteira, item.cdi, item.ifix]);
    const min = valores.length ? Math.min(...valores) : 0;
    const max = valores.length ? Math.max(...valores) : 1;
    const range = max - min === 0 ? 1 : max - min;

    const mapX = (idx: number) => padding + (plotW * idx) / Math.max(points.length - 1, 1);
    const mapY = (value: number) => padding + ((max - value) / range) * plotH;

    const pathFor = (key: 'carteira' | 'cdi' | 'ifix') =>
      points
        .map((item, idx) => `${idx === 0 ? 'M' : 'L'}${mapX(idx)},${mapY(item[key])}`)
        .join(' ');

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
      const y = padding + plotH * pct;
      return `<line x1="${padding}" x2="${padding + plotW}" y1="${y}" y2="${y}" stroke="${borderColor}" stroke-dasharray="4 4" />`;
    });

    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
        ${gridLines.join('')}
        <path d="${pathFor('carteira')}" stroke="#10b981" stroke-width="2.5" fill="none" />
        <path d="${pathFor('cdi')}" stroke="${secondaryColor}" stroke-width="3" fill="none" />
        <path d="${pathFor('ifix')}" stroke="#f59e0b" stroke-width="2.5" fill="none" />
        <text x="${padding}" y="${padding - 8}" font-size="12" fill="${secondaryColor}">%</text>
        <g font-size="11" fill="${secondaryColor}">
          <text x="${padding}" y="${height - 6}">Início</text>
          <text x="${width - padding - 28}" y="${height - 6}">Fim</text>
        </g>
      </svg>
    `;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '10px';

    const legend = document.createElement('div');
    legend.style.display = 'flex';
    legend.style.gap = '12px';
    legend.style.fontSize = '12px';
    legend.style.color = secondaryColor;
    legend.innerHTML = `
      <span style="display:flex; align-items:center; gap:6px;">
        <span style="width:10px; height:10px; background:#10b981; border-radius:2px;"></span>Carteira
      </span>
      <span style="display:flex; align-items:center; gap:6px;">
        <span style="width:10px; height:10px; background:${secondaryColor}; border-radius:2px;"></span>CDI
      </span>
      <span style="display:flex; align-items:center; gap:6px;">
        <span style="width:10px; height:10px; background:#f59e0b; border-radius:2px;"></span>${benchmarkLabel}
      </span>
    `;

    const svgContainer = document.createElement('div');
    svgContainer.innerHTML = svg;
    wrapper.appendChild(legend);
    wrapper.appendChild(svgContainer);

    return wrapper;
  };

  const pages: HTMLElement[] = [];

  const capa = criarCapa();
  document.body.appendChild(capa);
  pages.push(capa);

  const { pagina, container } = criarPaginaBase();
  container.appendChild(criarHeader());
  const descricao = criarDescricao();
  if (descricao) {
    container.appendChild(descricao);
  }
  container.appendChild(criarResumo());
  container.appendChild(criarGrafico(relatorio.chartData));

  const footer = document.createElement('div');
  footer.style.marginTop = 'auto';
  footer.style.paddingTop = '12px';
  footer.style.borderTop = `1px solid ${borderColor}`;
  footer.style.color = secondaryColor;
  footer.style.fontSize = '11px';
  footer.textContent = `Gerado em ${relatorio.dataGeracao}`;
  container.appendChild(footer);

  document.body.appendChild(pagina);
  pages.push(pagina);

  try {
    const canvases = [];
    for (const pagina of pages) {
      const canvas = await html2canvas(pagina, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
      });
      canvases.push(canvas);
    }

    // @ts-ignore
    const pdf = new jsPDF('p', 'mm', 'a4');
    canvases.forEach((canvas, index) => {
      if (index > 0) pdf.addPage();
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
    });

    pdf.save(`relatorio_estrategia_${new Date().toISOString().split('T')[0]}.pdf`);
  } finally {
    pages.forEach((page) => document.body.removeChild(page));
  }
}

type DashboardClientesPdfOptions = {
  titulo?: string;
  nomeArquivo?: string;
  estrategiaMap?: Record<string, string>;
};

export async function gerarDashboardClientesPDF(
  clientes: Cliente[],
  options: DashboardClientesPdfOptions = {}
): Promise<void> {
  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = 1123;
  const PAGE_PADDING_PX = 44;
  const primaryColor = '#1d2f34';
  const textColor = '#1c2836';
  const textMuted = '#5b6b76';
  const borderColor = '#d7e0ea';
  const bgLight = '#f1f3f6';

  const titulo = options.titulo || 'Dados de Clientes';
  const dataGeracao = formatDate(new Date().toISOString());
  const clientesOrdenados = [...clientes].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  );
  const getEstrategiaNome = (id?: string) => {
    if (!id) return '-';
    return options.estrategiaMap?.[id] || '-';
  };
  const getStatusLabel = (status: Cliente['status']) => {
    if (status === 'inativo') return 'Inativo';
    if (status === 'antecipado') return 'Antecipado';
    return 'Ativo';
  };

  const criarPaginaBase = (pageNumber: number, totalPages: number) => {
    const pagina = document.createElement('div');
    pagina.style.position = 'absolute';
    pagina.style.left = '-9999px';
    pagina.style.width = `${PAGE_WIDTH_PX}px`;
    pagina.style.height = `${PAGE_HEIGHT_PX}px`;
    pagina.style.padding = '0';
    pagina.style.fontFamily = '\'Source Sans 3\', sans-serif';
    pagina.style.backgroundColor = '#ffffff';
    pagina.style.color = textColor;
    pagina.style.boxSizing = 'border-box';
    pagina.style.overflow = 'hidden';

    const container = document.createElement('div');
    container.style.height = '100%';
    container.style.boxSizing = 'border-box';
    container.style.padding = `${PAGE_PADDING_PX}px`;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '14px';

    const header = document.createElement('div');
    const pageCounter = document.createElement('div');
    pageCounter.style.textAlign = 'right';
    pageCounter.style.color = textMuted;
    pageCounter.style.fontSize = '12px';
    pageCounter.textContent = `Página ${pageNumber} de ${totalPages}`;

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.alignItems = 'flex-start';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.gap = '16px';
    headerRow.innerHTML = `
      <div>
        <div style="color:${primaryColor}; font-size:22px; font-weight:700; letter-spacing:0.02em;">${titulo}</div>
        <div style="margin-top:6px; color:${textMuted}; font-size:12px;">Gerado em ${dataGeracao}</div>
      </div>
    `;
    headerRow.appendChild(pageCounter);

    const headerLine = document.createElement('div');
    headerLine.style.height = '2px';
    headerLine.style.background = primaryColor;
    headerLine.style.opacity = '0.25';
    headerLine.style.marginTop = '12px';

    header.appendChild(headerRow);
    header.appendChild(headerLine);

    const resumo = document.createElement('div');
    resumo.style.display = 'flex';
    resumo.style.gap = '12px';
    resumo.style.flexWrap = 'wrap';
    resumo.innerHTML = `
      <div style="background:${bgLight}; border:1px solid ${borderColor}; border-radius:8px; padding:10px 12px; font-size:12px; color:${textMuted};">
        Total de clientes: <strong style="color:${textColor};">${clientesOrdenados.length}</strong>
      </div>
    `;

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '11px';
    table.style.tableLayout = 'fixed';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="background:${bgLight}; color:${textMuted}; text-transform:uppercase; letter-spacing:0.08em;">
        <th style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:left; width:34%;">Cliente</th>
        <th style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:left; width:14%;">Status</th>
        <th style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:left; width:22%;">Estratégia</th>
        <th style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:right; width:15%;">Assinatura</th>
        <th style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:right; width:15%;">PL Total</th>
      </tr>
    `;

    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);

    container.appendChild(header);
    container.appendChild(resumo);
    container.appendChild(table);
    pagina.appendChild(container);

    return { pagina, tbody, pageCounter };
  };

  const paginas: HTMLElement[] = [];
  let indice = 0;

  while (indice < clientesOrdenados.length || paginas.length === 0) {
    const pageNumber = paginas.length + 1;
    const { pagina, tbody, pageCounter } = criarPaginaBase(pageNumber, 1);
    document.body.appendChild(pagina);

    while (indice < clientesOrdenados.length) {
      const cliente = clientesOrdenados[indice];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:left; word-break:break-word;">
          ${cliente.nome || '-'}
        </td>
        <td style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:left;">
          ${getStatusLabel(cliente.status)}
        </td>
        <td style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:left; word-break:break-word;">
          ${getEstrategiaNome(cliente.estrategiaId)}
        </td>
        <td style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:right;">
          ${cliente.assinatura ? formatCurrency(cliente.assinatura) : '-'}
        </td>
        <td style="padding:8px; border-bottom:1px solid ${borderColor}; text-align:right;">
          ${cliente.valorTotalContratos || cliente.patrimonioTotal
            ? formatCurrency(cliente.valorTotalContratos || cliente.patrimonioTotal || 0)
            : '-'}
        </td>
      `;

      tbody.appendChild(tr);
      if (pagina.scrollHeight > PAGE_HEIGHT_PX) {
        tbody.removeChild(tr);
        if (tbody.childElementCount === 0) {
          tbody.appendChild(tr);
          indice++;
        }
        break;
      }
      indice++;
    }

    paginas.push(pagina);
    pagina.dataset.pageCounterIndex = String(paginas.length - 1);
    (pagina as any)._pageCounter = pageCounter;
  }

  // Atualizar numeração final de páginas
  paginas.forEach((pagina, idx) => {
    const pageCounter = (pagina as any)._pageCounter as HTMLDivElement | undefined;
    if (pageCounter) {
      pageCounter.textContent = `Página ${idx + 1} de ${paginas.length}`;
    }
  });

  try {
    const canvases = [];
    for (const pagina of paginas) {
      const canvas = await html2canvas(pagina, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
      });
      canvases.push(canvas);
    }

    // @ts-ignore
    const pdf = new jsPDF('p', 'mm', 'a4');
    canvases.forEach((canvas, index) => {
      if (index > 0) pdf.addPage();
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
    });

    const nomeArquivo = options.nomeArquivo || `dados_clientes_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(nomeArquivo);
  } finally {
    paginas.forEach((pagina) => {
      if (pagina.parentNode) pagina.parentNode.removeChild(pagina);
    });
  }
}
