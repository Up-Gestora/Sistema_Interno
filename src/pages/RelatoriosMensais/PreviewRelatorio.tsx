import { RelatorioMensal } from '../../types/relatorio';
import { formatCurrency, formatDate } from '../../utils/calculations';
import Card from '../../components/Card/Card';
import './PreviewRelatorio.css';

interface PreviewRelatorioProps {
  relatorio: RelatorioMensal;
  onGerarPDF: () => void;
  onVoltar: () => void;
}

export default function PreviewRelatorio({ relatorio, onGerarPDF, onVoltar }: PreviewRelatorioProps) {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const mesAno = `${meses[relatorio.mes - 1]} de ${relatorio.ano}`;
  const dataGeracao = relatorio.dataGeracao ? formatDate(relatorio.dataGeracao) : formatDate(new Date().toISOString());
  const resultadoPercentualGlobal = typeof relatorio.resultadoPercentual === 'number' ? relatorio.resultadoPercentual : null;
  const cdiMensal = typeof relatorio.cdiMensal === 'number' ? relatorio.cdiMensal : null;
  const resumoMacroLinhas = (relatorio.resumoMacro || '')
    .replace(/;/g, '\n')
    .split(/\r?\n/)
    .map((linha) => linha.trim());

  const renderResumoComImagens = (
    texto: string,
    imagens: Array<{ id: string; src: string }> = []
  ) => {
    const imagemMap = new Map(imagens.map((img) => [img.id, img.src]));
    const tokenRegex = /\[\[img:([a-zA-Z0-9_-]+)\]\]/g;
    const blocos = (texto || '').split(/\n\s*\n/);
    const elementos: JSX.Element[] = [];
    let imageIndex = 0;
    let keyIndex = 0;

    blocos.forEach((bloco) => {
      if (!bloco.trim()) {
        elementos.push(
          <p key={`spacer-${keyIndex++}`} className="preview-spacer">
            {'\u00A0'}
          </p>
        );
        return;
      }

      let lastIndex = 0;
      let adicionou = false;
      bloco.replace(tokenRegex, (match, id, offset) => {
        const antes = bloco.slice(lastIndex, offset).trim();
        if (antes) {
          elementos.push(<p key={`p-${keyIndex++}`}>{antes}</p>);
          adicionou = true;
        }
        const src = imagemMap.get(id);
        if (src) {
          imageIndex += 1;
          elementos.push(
            <div key={`img-${keyIndex++}`} className="preview-image">
              <img src={src} alt={`Comentário imagem ${imageIndex}`} />
            </div>
          );
          adicionou = true;
        }
        lastIndex = offset + match.length;
        return match;
      });

      const depois = bloco.slice(lastIndex).trim();
      if (depois) {
        elementos.push(<p key={`p-${keyIndex++}`}>{depois}</p>);
        adicionou = true;
      }

      if (!adicionou) {
        elementos.push(
          <p key={`spacer-${keyIndex++}`} className="preview-spacer">
            {'\u00A0'}
          </p>
        );
      }
    });

    if (!elementos.length) {
      elementos.push(<p key="empty">Nenhum resumo disponível.</p>);
    }

    return elementos;
  };

  const estrategiasPreview = relatorio.estrategias?.length
    ? relatorio.estrategias
    : [{
        titulo: 'Estratégia principal',
        patrimonioTotal: relatorio.patrimonioTotal,
        resultadoMes: relatorio.resultadoMes,
        resultadoPercentual: relatorio.resultadoPercentual,
        resumoTexto: relatorio.resumoTexto,
        resumoImagens: [],
      }];

  return (
    <Card title="Preview do Relatório" className="preview-relatorio">
      <div className="preview-content">
        <div className="preview-header">
          <div className="preview-logo">
            <h1>UP Gestão</h1>
            <p>Relatório Mensal de Carteira</p>
          </div>
        </div>

        <div className="preview-cliente">
          <h2>{relatorio.clienteNome || 'Cliente'}</h2>
          <p>Período: {mesAno}</p>
        </div>

        <div className="preview-section">
          <h3>Resumo Macro</h3>
          <div className="preview-text">
            {(resumoMacroLinhas.length ? resumoMacroLinhas : ['Nenhum resumo disponível.'])
              .map((line, index) => (
                <p key={index} className={line ? undefined : 'preview-spacer'}>
                  {line || '\u00A0'}
                </p>
              ))}
          </div>
        </div>

        {estrategiasPreview.map((estrategia, index) => {
          const resultadoPercentualEstrategia = typeof estrategia.resultadoPercentual === 'number'
            ? estrategia.resultadoPercentual
            : resultadoPercentualGlobal;
          const resumoTextoEstrategia = estrategia.resumoTexto?.trim()
            ? estrategia.resumoTexto
            : relatorio.resumoTexto?.trim()
              ? relatorio.resumoTexto
              : resultadoPercentualEstrategia !== null && cdiMensal !== null
                ? (resultadoPercentualEstrategia > cdiMensal ? relatorio.textoAcimaCDI : relatorio.textoAbaixoCDI) || ''
                : '';

          return (
            <div key={`preview-estrategia-${index}`} className="preview-section">
              <h3>Estratégia: {estrategia.titulo || 'Estratégia principal'}</h3>
              <div className="preview-metrics">
                <div className="metric-card">
                  <span className="metric-label">Patrimônio Total</span>
                  <span className="metric-value">{formatCurrency(estrategia.patrimonioTotal)}</span>
                </div>
                <div className={`metric-card ${estrategia.resultadoMes >= 0 ? 'positive' : 'negative'}`}>
                  <span className="metric-label">Resultado do Mês</span>
                  <span className="metric-value">
                    {estrategia.resultadoMes >= 0 ? '+' : ''}{formatCurrency(estrategia.resultadoMes)}
                  </span>
                </div>
                {typeof estrategia.resultadoPercentual === 'number' && (
                  <div className={`metric-card ${estrategia.resultadoPercentual >= 0 ? 'positive' : 'negative'}`}>
                    <span className="metric-label">Resultado % do Mês</span>
                    <span className="metric-value">
                      {estrategia.resultadoPercentual.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="preview-text">
                {renderResumoComImagens(resumoTextoEstrategia, estrategia.resumoImagens)}
              </div>
            </div>
          );
        })}

        <div className="preview-footer">
          <p>Gerado em {dataGeracao} | UP Gestão</p>
        </div>
      </div>

      <div className="preview-actions">
        <button onClick={onVoltar} className="btn-secondary">
          Voltar e Editar
        </button>
        <button
          onClick={onGerarPDF}
          className="btn-primary btn-action btn-action--report"
          aria-label="Gerar relatório em PDF"
        >
          Relatório
        </button>
      </div>
    </Card>
  );
}

