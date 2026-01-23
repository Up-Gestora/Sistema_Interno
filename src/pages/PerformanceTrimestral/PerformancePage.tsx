import { useState } from 'react';
import { useClientes } from '../../hooks/useClientes';
import { DadosPerformance } from '../../types/performance';
import { calcularPerformance } from '../../services/performanceCalculator';
import FormPerformance from './FormPerformance';
import CalculadoraPerformance from './CalculadoraPerformance';
import './PerformancePage.css';

export default function PerformancePage() {
  const { clientes } = useClientes();
  const [resultado, setResultado] = useState<ReturnType<typeof calcularPerformance> | null>(null);

  const handleCalcular = (dados: DadosPerformance) => {
    const resultadoCalculado = calcularPerformance(dados);
    setResultado(resultadoCalculado);
  };

  return (
    <div className="performance-page">
      <div className="page-header">
        <h1>Cálculo de Performance Trimestral</h1>
        <p className="page-subtitle">
          Calcule a taxa de performance com tratamento automático de aportes grandes
        </p>
      </div>

      <FormPerformance clientes={clientes} onSubmit={handleCalcular} />

      {resultado && <CalculadoraPerformance resultado={resultado} />}
    </div>
  );
}

