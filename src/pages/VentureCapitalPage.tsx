import Card from '../components/Card/Card';
import './VentureCapitalPage.css';

export default function VentureCapitalPage() {
  return (
    <div className="venture-capital-page">
      <div className="page-header">
        <div>
          <h1>Private</h1>
          <p className="page-subtitle">Area para organizar os projetos de investimento privado.</p>
        </div>
      </div>

      <Card title="Status da Area" className="venture-card">
        <div className="venture-status">
          <span className="venture-status-badge">Em andamento / Em construcao</span>
          <p>
            Esta pagina ainda esta em obras. O planejamento ja chegou, a planilha esta quase
            convencida e o cafe esta fazendo hora extra. Em breve a area ganha backlog, pipeline e
            acompanhamento por projeto.
          </p>
        </div>
      </Card>
    </div>
  );
}
