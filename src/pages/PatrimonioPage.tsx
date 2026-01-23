import { useClientes } from '../hooks/useClientes';
import PatrimonioLiquidoComponent from '../components/PatrimonioLiquido/PatrimonioLiquido';
import './PatrimonioPage.css';

export default function PatrimonioPage() {
  const { clientes, aplicacoes, saldos } = useClientes();

  return (
    <div className="patrimonio-page">
      <div className="page-header">
        <h1>Patrimônio</h1>
        <p className="page-subtitle">Visão completa do patrimônio e aplicações financeiras</p>
      </div>

      <div className="patrimonio-content">
        <PatrimonioLiquidoComponent
          aplicacoes={aplicacoes}
          saldos={saldos}
          clientes={clientes}
        />
      </div>
    </div>
  );
}

