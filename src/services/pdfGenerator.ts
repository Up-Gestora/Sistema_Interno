// @ts-ignore
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { RelatorioMensal } from '../types/relatorio';
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
      '/capa-relatorio.jpeg',
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

  const mesAno = `${meses[relatorio.mes - 1]} de ${relatorio.ano}`;
  const dataGeracao = formatDate(new Date().toISOString());

  // Determinar qual texto usar baseado na comparação com CDI
  const resultadoPercentual = typeof relatorio.resultadoPercentual === 'number' ? relatorio.resultadoPercentual : 0;
  const cdiMensal = typeof relatorio.cdiMensal === 'number' ? relatorio.cdiMensal : 0;
  const textoResultado = resultadoPercentual > cdiMensal 
    ? (relatorio.textoAcimaCDI || '')
    : (relatorio.textoAbaixoCDI || '');

  // Cores da identidade visual
  const primaryColor = '#3b82f6';
  const secondaryColor = '#64748b';
  const textColor = '#1e293b';
  const bgLight = '#f8fafc';
  const successColor = '#10b981';
  const dangerColor = '#ef4444';

  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = 1123;
  const PAGE_PADDING_PX = 76;

  const macroParagraphos = (relatorio.resumoMacro || '')
    .split(/\n\s*\n/)
    .map(paragrafo => paragrafo.trim())
    .filter(Boolean);

  const textoResultadoFormatado = (textoResultado || '').split(/\n\s*\n/).map(paragrafo => {
    const trimmed = paragrafo.trim();
    return trimmed
      ? `<p style="color: ${textColor}; font-size: 14px; line-height: 1.8; margin: 0 0 16px 0; text-align: justify; text-indent: 1.5em;">${trimmed}</p>`
      : '';
  }).join('');

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
    container.style.maxWidth = '800px';
    container.style.margin = '0 auto';
    container.style.position = 'relative';
    container.style.height = '100%';

    const bordaTopo = document.createElement('div');
    bordaTopo.style.position = 'absolute';
    bordaTopo.style.top = '0';
    bordaTopo.style.left = '0';
    bordaTopo.style.right = '0';
    bordaTopo.style.height = '8px';
    bordaTopo.style.background = `repeating-linear-gradient(90deg, ${primaryColor} 0px, ${primaryColor} 40px, transparent 40px, transparent 80px)`;
    bordaTopo.style.opacity = '0.6';
    bordaTopo.style.zIndex = '1';

    const bordaBase = document.createElement('div');
    bordaBase.style.position = 'absolute';
    bordaBase.style.bottom = '0';
    bordaBase.style.left = '0';
    bordaBase.style.right = '0';
    bordaBase.style.height = '8px';
    bordaBase.style.background = `repeating-linear-gradient(90deg, ${primaryColor} 0px, ${primaryColor} 40px, transparent 40px, transparent 80px)`;
    bordaBase.style.opacity = '0.6';
    bordaBase.style.zIndex = '1';

    const conteudo = document.createElement('div');
    conteudo.style.paddingTop = '10px';

    container.appendChild(bordaTopo);
    container.appendChild(conteudo);
    container.appendChild(bordaBase);
    pagina.appendChild(container);

    return { pagina, conteudo };
  };

  const criarPaginaResumoMacro = (comHeader: boolean) => {
    const { pagina, conteudo } = criarPaginaBase();

    if (comHeader) {
      const header = document.createElement('div');
      header.innerHTML = `
        <div style="text-align: center; margin-bottom: 32px; border-bottom: 3px solid ${primaryColor}; padding-bottom: 18px;">
          <h1 style="color: ${primaryColor}; font-size: 32px; font-weight: 700; margin: 0;">UP Gestão</h1>
          <p style="color: ${secondaryColor}; font-size: 16px; margin: 10px 0 0 0;">Relatório Mensal de Carteira</p>
        </div>
        <div style="margin-bottom: 24px;">
          <h2 style="color: ${textColor}; font-size: 24px; font-weight: 600; margin-bottom: 10px;">${relatorio.clienteNome || 'Cliente'}</h2>
          <p style="color: ${secondaryColor}; font-size: 14px; margin: 0;">Período: ${mesAno}</p>
        </div>
      `;
      conteudo.appendChild(header);
    }

    const box = document.createElement('div');
    box.style.marginBottom = '20px';
    box.style.backgroundColor = bgLight;
    box.style.padding = '20px';
    box.style.borderRadius = '8px';
    box.style.borderLeft = `4px solid ${primaryColor}`;

    const titulo = document.createElement('h3');
    titulo.textContent = 'Resumo Macro';
    titulo.style.color = textColor;
    titulo.style.fontSize = '18px';
    titulo.style.fontWeight = '600';
    titulo.style.marginBottom = '12px';

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
      p.style.color = textColor;
      p.style.fontSize = '14px';
      p.style.lineHeight = '1.8';
      p.style.margin = '0 0 16px 0';
      p.style.textAlign = 'justify';
      p.style.textIndent = '1.5em';
      p.textContent = macroParagraphos[indiceParagrafo];
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

  const divResumoMes = document.createElement('div');
  divResumoMes.style.position = 'absolute';
  divResumoMes.style.left = '-9999px';
  divResumoMes.style.width = `${PAGE_WIDTH_PX}px`;
  divResumoMes.style.height = `${PAGE_HEIGHT_PX}px`;
  divResumoMes.style.padding = `${PAGE_PADDING_PX}px`;
  divResumoMes.style.fontFamily = 'Quicksand, sans-serif';
  divResumoMes.style.backgroundColor = '#ffffff';
  divResumoMes.style.color = textColor;
  divResumoMes.style.boxSizing = 'border-box';
  divResumoMes.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; position: relative; height: 100%; display: flex; flex-direction: column;">
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 8px; background: repeating-linear-gradient(90deg, ${primaryColor} 0px, ${primaryColor} 40px, transparent 40px, transparent 80px); opacity: 0.6; z-index: 1;"></div>
      <div style="padding-top: 10px; flex: 1;">
        <div style="margin-bottom: 24px;">
          <h3 style="color: ${textColor}; font-size: 18px; font-weight: 600; margin-bottom: 12px;">Resumo do Mês</h3>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
          <div style="background-color: ${bgLight}; padding: 20px; border-radius: 8px;">
            <p style="color: ${secondaryColor}; font-size: 12px; font-weight: 600; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.5px;">Patrimônio Total</p>
            <p style="color: ${textColor}; font-size: 28px; font-weight: 700; margin: 0;">${formatCurrency(relatorio.patrimonioTotal)}</p>
          </div>
          <div style="background-color: ${relatorio.resultadoMes >= 0 ? '#d1fae5' : '#fee2e2'}; padding: 20px; border-radius: 8px;">
            <p style="color: ${secondaryColor}; font-size: 12px; font-weight: 600; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.5px;">Resultado do Mês</p>
            <p style="color: ${relatorio.resultadoMes >= 0 ? successColor : dangerColor}; font-size: 28px; font-weight: 700; margin: 0;">
              ${relatorio.resultadoMes >= 0 ? '+' : ''}${formatCurrency(relatorio.resultadoMes)}
            </p>
          </div>
        </div>
        <div style="margin-bottom: 24px;">
          <div style="background-color: ${bgLight}; padding: 20px; border-radius: 8px; border-left: 4px solid ${primaryColor};">
            <div style="text-align: justify;">
              ${textoResultadoFormatado || `<p style="color: ${textColor}; font-size: 14px; line-height: 1.8; margin: 0; text-align: justify;">${textoResultado || 'Nenhum resumo disponível.'}</p>`}
            </div>
            ${cdiMensal > 0 && typeof resultadoPercentual === 'number' ? `
            <p style="color: ${secondaryColor}; font-size: 12px; margin-top: 15px; margin-bottom: 0;">
              Resultado: ${resultadoPercentual.toFixed(2)}% | CDI Mensal: ${cdiMensal.toFixed(2)}%
            </p>
            ` : ''}
          </div>
        </div>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; margin-top: auto;">
        <p style="color: ${secondaryColor}; font-size: 12px; margin: 0 0 25px 0;">Gerado em ${dataGeracao} | UP Gestão</p>
        <div style="height: 8px; background: repeating-linear-gradient(90deg, ${primaryColor} 0px, ${primaryColor} 40px, transparent 40px, transparent 80px); opacity: 0.6;"></div>
      </div>
    </div>
  `;

  paginasMacro.forEach(pagina => document.body.appendChild(pagina));
  document.body.appendChild(divResumoMes);

  try {
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

    const canvasResumo = await html2canvas(divResumoMes, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: PAGE_WIDTH_PX,
      height: PAGE_HEIGHT_PX,
    });

    const imgMacro = canvasesMacro.map(canvas => canvas.toDataURL('image/png'));
    const imgResumo = canvasResumo.toDataURL('image/png');

    // @ts-ignore
    const pdf = new jsPDF('p', 'mm', 'a4');

    // Tentar adicionar capa como primeira página
    try {
      const capaData = await carregarCapaRelatorio();
      if (capaData) {
        pdf.addImage(capaData, 'PNG', 0, 0, 210, 297);
        pdf.addPage();
      }
    } catch (error) {
      // Continuar sem capa se houver erro
    }

    imgMacro.forEach((img, index) => {
      if (index > 0) {
        pdf.addPage();
      }
      pdf.addImage(img, 'PNG', 0, 0, 210, 297);
    });

    pdf.addPage();
    pdf.addImage(imgResumo, 'PNG', 0, 0, 210, 297);

    const fileName = `Relatorio_${relatorio.clienteNome?.replace(/\s/g, '_') || 'Cliente'}_${mesAno.replace(/\s/g, '_')}.pdf`;
    pdf.save(fileName);
  } finally {
    paginasMacro.forEach(pagina => document.body.removeChild(pagina));
    document.body.removeChild(divResumoMes);
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
        <span style="width:10px; height:10px; background:#f59e0b; border-radius:2px;"></span>IFIX
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
