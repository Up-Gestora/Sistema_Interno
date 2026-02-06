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
  const resultadoPercentual = typeof relatorio.resultadoPercentual === 'number' ? relatorio.resultadoPercentual : null;
  const cdiMensal = typeof relatorio.cdiMensal === 'number' ? relatorio.cdiMensal : null;
  const resumoTexto =
    relatorio.resumoTexto?.trim()
      ? relatorio.resumoTexto
      : resultadoPercentual !== null && cdiMensal !== null
        ? (resultadoPercentual > cdiMensal ? relatorio.textoAcimaCDI : relatorio.textoAbaixoCDI) || ''
        : '';
  const resumoMacroLinhas = (relatorio.resumoMacro || '')
    .replace(/;/g, '\n')
    .split(/\r?\n/)
    .map((linha) => linha.trim());

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

        <div className="preview-metrics">
          <div className="metric-card">
            <span className="metric-label">Patrimônio Total</span>
            <span className="metric-value">{formatCurrency(relatorio.patrimonioTotal)}</span>
          </div>
          <div className={`metric-card ${relatorio.resultadoMes >= 0 ? 'positive' : 'negative'}`}>
            <span className="metric-label">Resultado do Mês</span>
            <span className="metric-value">
              {relatorio.resultadoMes >= 0 ? '+' : ''}{formatCurrency(relatorio.resultadoMes)}
            </span>
          </div>
        </div>

        <div className="preview-section">
          <h3>Resumo do Mês</h3>
          <div className="preview-text">
            {(resumoTexto || 'Nenhum resumo disponível.')
              .split('\n')
              .map((line, index) => (
                <p key={index}>{line || '\u00A0'}</p>
              ))}
          </div>
        </div>

        <div className="preview-footer">
          <p>Gerado em {dataGeracao} | UP Gestão</p>
        </div>
      </div>

      <div className="preview-actions">
        <button onClick={onVoltar} className="btn-secondary">
          Voltar e Editar
        </button>
        <button onClick={onGerarPDF} className="btn-primary">
          Gerar PDF
        </button>
      </div>
    </Card>
  );
}

