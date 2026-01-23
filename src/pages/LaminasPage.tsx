import LaminasJsonEditor from '../components/LaminasJsonEditor/LaminasJsonEditor';
import './LaminasPage.css';

export default function LaminasPage() {
  return (
    <div className="laminas-page">
      <div className="page-header">
        <h1>Lâminas</h1>
        <p className="page-subtitle">
          Edite os dados no JSON e veja o preview em A4 em tempo real.
        </p>
      </div>

      <div className="laminas-content">
        <LaminasJsonEditor />
      </div>
    </div>
  );
}


