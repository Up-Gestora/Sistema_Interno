import { ResultadoPerformance } from '../../types/performance';
import { formatCurrency, formatDate } from '../../utils/calculations';
import Card from '../../components/Card/Card';
import './CalculadoraPerformance.css';

interface CalculadoraPerformanceProps {
  resultado: ResultadoPerformance;
}

export default function CalculadoraPerformance({ resultado }: CalculadoraPerformanceProps) {
  return (
    <Card title="Resultado do Cálculo de Performance" className="calculadora-performance">
      <div className="resultado-content">
        <div className="resultado-header">
          <h3>{resultado.clienteNome}</h3>
          <p>
            Período: {formatDate(resultado.dataInicio)} a {formatDate(resultado.dataFim)}
          </p>
        </div>

        {resultado.temAporteGrande && resultado.periodosSeparados && (
          <div className="periodos-separados">
            <h4>Períodos Separados (Aporte Grande Detectado)</h4>
            <div className="periodos-grid">
              {resultado.periodosSeparados.map((periodo, index) => (
                <div key={index} className="periodo-card">
                  <h5>{periodo.periodo}</h5>
                  <div className="periodo-metrics">
                    <div className="metric">
                      <span className="label">Patrimônio Inicial</span>
                      <span className="value">{formatCurrency(periodo.patrimonioInicial)}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Patrimônio Final</span>
                      <span className="value">{formatCurrency(periodo.patrimonioFinal)}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Rendimento</span>
                      <span className={`value ${periodo.rendimento >= 0 ? 'positive' : 'negative'}`}>
                        {periodo.rendimento >= 0 ? '+' : ''}{formatCurrency(periodo.rendimento)}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="label">Rendimento (%)</span>
                      <span className={`value ${periodo.rendimentoPercentual >= 0 ? 'positive' : 'negative'}`}>
                        {periodo.rendimentoPercentual >= 0 ? '+' : ''}{periodo.rendimentoPercentual.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="periodo-total">
          <h4>Período Total</h4>
          <div className="total-metrics">
            <div className="metric-large">
              <span className="label">Patrimônio Inicial</span>
              <span className="value">{formatCurrency(resultado.periodoTotal.patrimonioInicial)}</span>
            </div>
            <div className="metric-large">
              <span className="label">Patrimônio Final (Líquido)</span>
              <span className="value">{formatCurrency(resultado.periodoTotal.patrimonioFinal)}</span>
            </div>
            <div className="metric-large">
              <span className="label">Rendimento Total</span>
              <span className={`value ${resultado.periodoTotal.rendimento >= 0 ? 'positive' : 'negative'}`}>
                {resultado.periodoTotal.rendimento >= 0 ? '+' : ''}{formatCurrency(resultado.periodoTotal.rendimento)}
              </span>
            </div>
            <div className="metric-large">
              <span className="label">Rendimento Total (%)</span>
              <span className={`value ${resultado.periodoTotal.rendimentoPercentual >= 0 ? 'positive' : 'negative'}`}>
                {resultado.periodoTotal.rendimentoPercentual >= 0 ? '+' : ''}{resultado.periodoTotal.rendimentoPercentual.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="performance-taxa">
          <h4>Cálculo da Taxa de Performance</h4>
          <div className="taxa-details">
            <div className="taxa-item">
              <span className="label">Rendimento acima do CDI</span>
              <span className={`value ${resultado.rendimentoAcimaCDIPercentual >= 0 ? 'positive' : 'negative'}`}>
                {resultado.rendimentoAcimaCDIPercentual >= 0 ? '+' : ''}{resultado.rendimentoAcimaCDIPercentual.toFixed(2)}%
              </span>
            </div>
            <div className="taxa-item">
              <span className="label">Taxa de Performance</span>
              <span className="value">{resultado.taxaCalculada.toFixed(1)}%</span>
            </div>
            <div className="taxa-item highlight">
              <span className="label">Valor da Taxa a Cobrar</span>
              <span className="value">{formatCurrency(resultado.valorTaxa)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

