import { useState, useEffect } from 'react';
import { Cliente } from '../../types';
import { DadosPerformance, Aporte } from '../../types/performance';
import { calcularPercentualAporte } from '../../services/performanceCalculator';
import { parseCurrency, formatCurrencyWhileTyping } from '../../utils/currencyInput';
import { buscarCDIeIFIX } from '../../services/cdiIfixService';
import Card from '../../components/Card/Card';
import './FormPerformance.css';

interface FormPerformanceProps {
  clientes: Cliente[];
  onSubmit: (dados: DadosPerformance) => void;
}

export default function FormPerformance({ clientes, onSubmit }: FormPerformanceProps) {
  const [formData, setFormData] = useState<Partial<DadosPerformance>>({
    clienteId: '',
    patrimonioInicial: 0,
    patrimonioFinal: 0,
    descontos: 0,
    aportes: [],
    dataInicio: '',
    dataFim: '',
    cdi: 0,
    ifix: 0,
    taxaPerformance: 0.25,
  });

  const [novoAporte, setNovoAporte] = useState({ valor: 0, data: '' });
  const [buscandoIndices, setBuscandoIndices] = useState(false);
  const [erroIndices, setErroIndices] = useState<string>('');

  // Estados para valores formatados dos inputs monetários
  const [patrimonioInicialFormatado, setPatrimonioInicialFormatado] = useState('');
  const [patrimonioFinalFormatado, setPatrimonioFinalFormatado] = useState('');
  const [descontosFormatado, setDescontosFormatado] = useState('');
  const [aporteValorFormatado, setAporteValorFormatado] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clienteId || !formData.dataInicio || !formData.dataFim) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const cliente = clientes.find(c => c.id === formData.clienteId);
    const dados: DadosPerformance = {
      ...formData as DadosPerformance,
      clienteNome: cliente?.nome,
    };

    onSubmit(dados);
  };

  const adicionarAporte = () => {
    if (!novoAporte.valor || !novoAporte.data) {
      alert('Por favor, preencha valor e data do aporte.');
      return;
    }

    const percentual = calcularPercentualAporte(
      { id: Date.now().toString(), ...novoAporte },
      formData.patrimonioInicial || 0
    );

    const aporte: Aporte = {
      id: Date.now().toString(),
      valor: novoAporte.valor,
      data: novoAporte.data,
      percentualPatrimonio: percentual,
    };

    setFormData({
      ...formData,
      aportes: [...(formData.aportes || []), aporte],
    });

    setNovoAporte({ valor: 0, data: '' });
    setAporteValorFormatado('');
  };

  const removerAporte = (id: string) => {
    setFormData({
      ...formData,
      aportes: formData.aportes?.filter(a => a.id !== id) || [],
    });
  };

  // Buscar CDI e IFIX automaticamente quando as datas são preenchidas
  useEffect(() => {
    const buscarIndices = async () => {
      if (!formData.dataInicio || !formData.dataFim) {
        return;
      }

      // Validar que data fim é maior que data início
      if (new Date(formData.dataFim) <= new Date(formData.dataInicio)) {
        return;
      }

      setBuscandoIndices(true);
      setErroIndices('');

      try {
        const { cdi, ifix } = await buscarCDIeIFIX(formData.dataInicio, formData.dataFim);

        if (cdi !== null) {
          setFormData(prev => ({ ...prev, cdi }));
        }
        if (ifix !== null) {
          setFormData(prev => ({ ...prev, ifix }));
        }

        if (cdi === null && ifix === null) {
          setErroIndices('Não foi possível buscar os índices. Preencha manualmente.');
        } else if (cdi === null) {
          setErroIndices('CDI não encontrado. Preencha manualmente.');
        } else if (ifix === null) {
          setErroIndices('IFIX não encontrado. Preencha manualmente.');
        }
      } catch (error) {
        console.error('Erro ao buscar índices:', error);
        setErroIndices('Erro ao buscar índices. Preencha manualmente.');
      } finally {
        setBuscandoIndices(false);
      }
    };

    // Debounce de 500ms para evitar muitas requisições
    const timeoutId = setTimeout(buscarIndices, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.dataInicio, formData.dataFim]);

  return (
    <Card title="Cálculo de Performance Trimestral" className="form-performance">
      <form onSubmit={handleSubmit} className="performance-form">
        <div className="form-group">
          <label htmlFor="cliente">Cliente *</label>
          <select
            id="cliente"
            value={formData.clienteId}
            onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
            required
          >
            <option value="">Selecione um cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="dataInicio">Data Início *</label>
            <input
              type="date"
              id="dataInicio"
              value={formData.dataInicio}
              onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="dataFim">Data Fim *</label>
            <input
              type="date"
              id="dataFim"
              value={formData.dataFim}
              onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="patrimonioInicial">Patrimônio Inicial (R$) *</label>
            <input
              type="text"
              id="patrimonioInicial"
              value={patrimonioInicialFormatado}
              onChange={(e) => {
                const valorFormatado = formatCurrencyWhileTyping(e.target.value);
                setPatrimonioInicialFormatado(valorFormatado);
                const valorNumerico = parseCurrency(valorFormatado);
                setFormData({ ...formData, patrimonioInicial: valorNumerico });
              }}
              placeholder="0,00"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="patrimonioFinal">Patrimônio Final (R$) *</label>
            <input
              type="text"
              id="patrimonioFinal"
              value={patrimonioFinalFormatado}
              onChange={(e) => {
                const valorFormatado = formatCurrencyWhileTyping(e.target.value);
                setPatrimonioFinalFormatado(valorFormatado);
                const valorNumerico = parseCurrency(valorFormatado);
                setFormData({ ...formData, patrimonioFinal: valorNumerico });
              }}
              placeholder="0,00"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="descontos">Descontos (R$)</label>
            <input
              type="text"
              id="descontos"
              value={descontosFormatado}
              onChange={(e) => {
                const valorFormatado = formatCurrencyWhileTyping(e.target.value);
                setDescontosFormatado(valorFormatado);
                const valorNumerico = parseCurrency(valorFormatado);
                setFormData({ ...formData, descontos: valorNumerico });
              }}
              placeholder="0,00"
            />
          </div>

          <div className="form-group">
            <label htmlFor="taxaPerformance">Taxa de Performance (%)</label>
            <input
              type="number"
              id="taxaPerformance"
              value={(formData.taxaPerformance || 0) * 100}
              onChange={(e) => setFormData({ ...formData, taxaPerformance: parseFloat(e.target.value) / 100 || 0 })}
              step="0.1"
              min="0"
              max="100"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cdi">
              CDI (%) 
              {buscandoIndices && <span className="loading-indicator">⏳ Buscando...</span>}
            </label>
            <input
              type="number"
              id="cdi"
              value={formData.cdi || ''}
              onChange={(e) => setFormData({ ...formData, cdi: parseFloat(e.target.value) || 0 })}
              step="0.01"
              min="0"
              disabled={buscandoIndices}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ifix">
              IFIX (%) 
              {buscandoIndices && <span className="loading-indicator">⏳ Buscando...</span>}
            </label>
            <input
              type="number"
              id="ifix"
              value={formData.ifix || ''}
              onChange={(e) => setFormData({ ...formData, ifix: parseFloat(e.target.value) || 0 })}
              step="0.01"
              min="0"
              disabled={buscandoIndices}
            />
          </div>
        </div>
        {erroIndices && (
          <div className="error-message" style={{ color: 'var(--danger-color)', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            {erroIndices}
          </div>
        )}

        <div className="aportes-section">
          <h3>Aportes</h3>
          <div className="aporte-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="aporteValor">Valor do Aporte (R$)</label>
                <input
                  type="text"
                  id="aporteValor"
                  value={aporteValorFormatado}
                  onChange={(e) => {
                    const valorFormatado = formatCurrencyWhileTyping(e.target.value);
                    setAporteValorFormatado(valorFormatado);
                    const valorNumerico = parseCurrency(valorFormatado);
                    setNovoAporte({ ...novoAporte, valor: valorNumerico });
                  }}
                  placeholder="0,00"
                />
              </div>
              <div className="form-group">
                <label htmlFor="aporteData">Data do Aporte</label>
                <input
                  type="date"
                  id="aporteData"
                  value={novoAporte.data}
                  onChange={(e) => setNovoAporte({ ...novoAporte, data: e.target.value })}
                />
              </div>
            </div>
            <button type="button" onClick={adicionarAporte} className="btn-add">
              Adicionar Aporte
            </button>
          </div>

          {formData.aportes && formData.aportes.length > 0 && (
            <div className="aportes-list">
              {formData.aportes.map((aporte) => (
                <div key={aporte.id} className="aporte-item">
                  <div className="aporte-info">
                    <span>{new Date(aporte.data).toLocaleDateString('pt-BR')}</span>
                    <span>R$ {aporte.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    {aporte.percentualPatrimonio && (
                      <span className="percentual">
                        ({aporte.percentualPatrimonio.toFixed(1)}% do patrimônio inicial)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removerAporte(aporte.id)}
                    className="btn-remove"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Calcular Performance
          </button>
        </div>
      </form>
    </Card>
  );
}

