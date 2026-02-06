import { useEffect, useState } from 'react';
import { CampoValor, PerformanceRow } from '../../types/lamina';
import { importarPlanilhaLamina } from '../../services/laminaPlanilhaService';
import './LaminasEditor.css';

const METRICAS_INICIAIS: CampoValor[] = [
  { label: 'Público Alvo', value: 'Moderado/Arrojado' },
  { label: 'Drawdown máximo', value: '-3,24%' },
  { label: 'Volatilidade Anualizada', value: '7,38%' },
  { label: 'Retorno Acumulado', value: '43,55%' },
  { label: 'Índice de Sharpe', value: '3,60' },
  { label: 'Benchmark', value: 'IFIX' },
  { label: 'Alpha', value: '28,32%' },
  { label: 'Investimento Mínimo', value: 'R$ 50.000,00' },
  { label: 'Cota de Resgate', value: 'Imediata' },
  { label: 'Prazo de Resgate', value: 'D+5' },
  { label: 'Taxa de Gestão', value: '0,60% a 2,00%' },
  { label: 'Taxa de Performance', value: '30% sobre o IFIX' },
  { label: 'Gestão', value: 'UP GCA' },
  { label: 'PL Total', value: 'R$ 6,76MM' },
];

const RESUMO_MENSAL_INICIAL: CampoValor[] = [
  { label: 'Total de operações', value: '124' },
  { label: 'Operações com ganhos', value: '84,68%' },
  { label: 'Fator de lucro', value: '+25%' },
];

const PERFORMANCE_INICIAL: PerformanceRow[] = [
  { periodo: '01 M', tatico: '6,00', ifix: '3,13', cdi: '0,96', alpha: '2,86' },
  { periodo: '03 M', tatico: '7,91', ifix: '5,18', cdi: '3,01', alpha: '2,73' },
  { periodo: 'Início', tatico: '43,55', ifix: '15,23', cdi: '14,43', alpha: '28,32' },
];

export default function LaminasEditor() {
  const [nomeCarteira, setNomeCarteira] = useState('Carteira UP FILS');
  const [slogan, setSlogan] = useState('INTELIGÊNCIA ARTIFICIAL A SERVIÇO DO SEU DINHEIRO');
  const [mesReferencia, setMesReferencia] = useState('Dezembro/25');
  const [destaque, setDestaque] = useState('+6,00%');
  const [trackRecord, setTrackRecord] = useState('Track Record +43,55%');
  const [descricao, setDescricao] = useState(
    'A Carteira Tática UP busca gerar alpha sobre o IFIX e CDI no longo prazo, com foco em FIIs, agro e infra.'
  );
  const [comentarios, setComentarios] = useState(
    'Comentários do gestor sobre o mês e próximos passos.'
  );
  const [metricas, setMetricas] = useState<CampoValor[]>(METRICAS_INICIAIS);
  const [resumoMensal, setResumoMensal] = useState<CampoValor[]>(RESUMO_MENSAL_INICIAL);
  const [performanceRows, setPerformanceRows] = useState<PerformanceRow[]>(PERFORMANCE_INICIAL);
  const [graficoUrl, setGraficoUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [errosPlanilha, setErrosPlanilha] = useState<string[]>([]);
  const [carregandoPlanilha, setCarregandoPlanilha] = useState(false);

  useEffect(() => {
    return () => {
      if (graficoUrl) URL.revokeObjectURL(graficoUrl);
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [graficoUrl, logoUrl]);

  const handleUploadImagem = (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string | null) => void,
    atual: string | null
  ) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    if (atual) URL.revokeObjectURL(atual);
    const url = URL.createObjectURL(arquivo);
    setter(url);
  };

  const handleUploadPlanilha = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setCarregandoPlanilha(true);
    setErrosPlanilha([]);
    try {
      const { dados, erros } = await importarPlanilhaLamina(arquivo);

      if (dados.cabecalho.nomeCarteira) setNomeCarteira(dados.cabecalho.nomeCarteira);
      if (dados.cabecalho.slogan) setSlogan(dados.cabecalho.slogan);
      if (dados.cabecalho.mesReferencia) setMesReferencia(dados.cabecalho.mesReferencia);
      if (dados.cabecalho.destaque) setDestaque(dados.cabecalho.destaque);
      if (dados.cabecalho.descricao) setDescricao(dados.cabecalho.descricao);
      if (dados.cabecalho.comentarios) setComentarios(dados.cabecalho.comentarios);
      if (dados.cabecalho.trackRecord) setTrackRecord(dados.cabecalho.trackRecord);

      if (dados.metricas.length > 0) setMetricas(dados.metricas);
      if (dados.resumoMensal.length > 0) setResumoMensal(dados.resumoMensal);
      if (dados.performance.length > 0) setPerformanceRows(dados.performance);

      if (erros.length > 0) setErrosPlanilha(erros);
    } catch (error: any) {
      setErrosPlanilha([error.message || 'Erro ao importar planilha.']);
    } finally {
      setCarregandoPlanilha(false);
    }
  };

  return (
    <div className="laminas-editor">
      <div className="editor-col editor-form">
        <h3>Dados principais</h3>
        <label>
          Nome da carteira
          <input
            type="text"
            value={nomeCarteira}
            onChange={(e) => setNomeCarteira(e.target.value)}
          />
        </label>
        <label>
          Slogan
          <input
            type="text"
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
          />
        </label>
        <label>
          Mês de referência
          <input
            type="text"
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
          />
        </label>
        <label>
          Destaque principal
          <input
            type="text"
            value={destaque}
            onChange={(e) => setDestaque(e.target.value)}
          />
        </label>
        <label>
          Track Record
          <input
            type="text"
            value={trackRecord}
            onChange={(e) => setTrackRecord(e.target.value)}
          />
        </label>
        <label>
          Descrição
          <textarea
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </label>
        <label>
          Comentários
          <textarea
            rows={4}
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
          />
        </label>
      </div>

      <div className="editor-col editor-preview">
        <div className="lamina-preview">
          <div className="lamina-top">
            <div className="logo-area">
              {logoUrl ? <img src={logoUrl} alt="Logo" /> : <span>Logo</span>}
            </div>
            <div className="lamina-top-text">
              <strong>{nomeCarteira}</strong>
              <span>{slogan}</span>
            </div>
            <div className="lamina-date">{mesReferencia}</div>
          </div>

          <div className="lamina-highlight">
            <span>{destaque}</span>
          </div>

          <div className="lamina-description">{descricao}</div>

          <div className="lamina-grid">
            <aside className="lamina-metrics">
              {metricas.map((item, index) => (
                <div key={`${item.label}-${index}`} className="metric-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </aside>

            <section className="lamina-main">
              <div className="lamina-chart">
                <div className="lamina-track">{trackRecord}</div>
                {graficoUrl ? (
                  <img src={graficoUrl} alt="Gráfico" />
                ) : (
                  <div className="grafico-placeholder">Imagem do gráfico</div>
                )}
              </div>

              <div className="lamina-tables">
                <div className="lamina-resumo">
                  <h4>Resumo Mensal</h4>
                  {resumoMensal.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="resumo-item">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="lamina-performance">
                  <h4>Performance</h4>
                  <div className="performance-table">
                    <div className="performance-row header">
                      <span>Período</span>
                      <span>Tática</span>
                      <span>IFIX</span>
                      <span>CDI</span>
                      <span>Alpha</span>
                    </div>
                    {performanceRows.map((row, index) => (
                      <div key={`row-${index}`} className="performance-row">
                        <span>{row.periodo}</span>
                        <span>{row.tatico}</span>
                        <span>{row.ifix}</span>
                        <span>{row.cdi}</span>
                        <span>{row.alpha}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lamina-comments">
                <h4>Comentários</h4>
                <p>{comentarios}</p>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="editor-col editor-assets">
        <h3>Arquivos</h3>
        <label>
          Planilha (xlsx)
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleUploadPlanilha}
          />
        </label>
        {carregandoPlanilha && <span className="editor-hint">Importando planilha...</span>}
        {errosPlanilha.length > 0 && (
          <div className="planilha-erros">
            {errosPlanilha.map((erro) => (
              <span key={erro}>{erro}</span>
            ))}
          </div>
        )}
        <label>
          Logo
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleUploadImagem(e, setLogoUrl, logoUrl)}
          />
        </label>
        <label>
          Gráfico
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleUploadImagem(e, setGraficoUrl, graficoUrl)}
          />
        </label>
        <p className="editor-hint">
          Atualize a planilha e importe aqui para refletir os dados no modelo.
        </p>
      </div>
    </div>
  );
}

