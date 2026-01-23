import { useState } from 'react';
import { useClientes } from '../../hooks/useClientes';
import { RelatorioMensal } from '../../types/relatorio';
import { gerarRelatorioMensalPDF, gerarRelatoriosMensaisEmMassa } from '../../services/pdfGenerator';
import FormRelatorio from './FormRelatorio';
import FormRelatorioMassa from './FormRelatorioMassa';
import PreviewRelatorio from './PreviewRelatorio';
import Card from '../../components/Card/Card';
import './RelatoriosMensaisPage.css';

type ViewMode = 'form' | 'preview';
type ModoGeracao = 'individual' | 'massa';

export default function RelatoriosMensaisPage() {
  const { clientes } = useClientes();
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [modoGeracao, setModoGeracao] = useState<ModoGeracao>('massa');
  const [relatorioAtual, setRelatorioAtual] = useState<RelatorioMensal | null>(null);
  const [gerandoPDFs, setGerandoPDFs] = useState(false);
  const [relatoriosGerados, setRelatoriosGerados] = useState<RelatorioMensal[]>(() => {
    const saved = localStorage.getItem('relatoriosMensais');
    return saved ? JSON.parse(saved) : [];
  });

  const handleFormSubmit = (relatorio: RelatorioMensal) => {
    setRelatorioAtual(relatorio);
    setViewMode('preview');
  };

  const handleGerarPDF = async () => {
    if (!relatorioAtual) return;

    try {
      await gerarRelatorioMensalPDF(relatorioAtual);
      
      // Salvar relatório
      const novoRelatorio: RelatorioMensal = {
        ...relatorioAtual,
        id: Date.now().toString(),
      };
      
      const novosRelatorios = [novoRelatorio, ...relatoriosGerados];
      setRelatoriosGerados(novosRelatorios);
      localStorage.setItem('relatoriosMensais', JSON.stringify(novosRelatorios));
      
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
      await gerarRelatoriosMensaisEmMassa(relatorios);
      
      // Salvar relatórios
      const novosRelatorios = relatorios.map(rel => ({
        ...rel,
        id: `${Date.now()}_${rel.clienteId}`,
      }));
      
      const todosRelatorios = [...novosRelatorios, ...relatoriosGerados];
      setRelatoriosGerados(todosRelatorios);
      localStorage.setItem('relatoriosMensais', JSON.stringify(todosRelatorios));
      
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

  return (
    <div className="relatorios-mensais-page">
      <div className="page-header">
        <h1>Relatórios Mensais</h1>
        <p className="page-subtitle">Gere relatórios padronizados para seus clientes</p>
      </div>

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
            <FormRelatorio
              clientes={clientes}
              onSubmit={handleFormSubmit}
            />
          ) : (
            <FormRelatorioMassa
              clientes={clientes}
              onGerarPDFs={handleGerarPDFsEmMassa}
            />
          )}

          {gerandoPDFs && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>Gerando PDFs... Por favor, aguarde.</p>
            </div>
          )}
          
          {relatoriosGerados.length > 0 && (
            <Card title="Relatórios Gerados" className="relatorios-list">
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

