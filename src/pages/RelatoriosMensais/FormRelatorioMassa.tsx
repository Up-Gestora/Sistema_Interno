import { useState, useMemo, useEffect } from 'react';
import { Cliente } from '../../types';
import { RelatorioMensal } from '../../types/relatorio';
import { useEstrategias } from '../../hooks/useEstrategias';
import { buscarCDI } from '../../services/cdiIfixService';
import Card from '../../components/Card/Card';
import './FormRelatorioMassa.css';

interface FormRelatorioMassaProps {
  clientes: Cliente[];
  onGerarPDFs: (relatorios: RelatorioMensal[]) => void;
}

interface ClienteSelecionado {
  clienteId: string;
  patrimonioTotal: number;
  resultadoPercentual: number;
  resultadoValor: number;
  selecionado: boolean;
}

export default function FormRelatorioMassa({ clientes, onGerarPDFs }: FormRelatorioMassaProps) {
  const { estrategias } = useEstrategias();
  const [formData, setFormData] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    resumoMacro: '',
    cdiMensal: 0,
    textoAcimaCDI: '',
    textoAbaixoCDI: '',
  });

  const [clientesSelecionados, setClientesSelecionados] = useState<Record<string, ClienteSelecionado>>({});
  const [estrategiaSelecionada, setEstrategiaSelecionada] = useState<string>('');
  const [carregandoCDI, setCarregandoCDI] = useState(false);
  const [erroCDI, setErroCDI] = useState<string>('');

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Buscar CDI automaticamente quando mês/ano mudar
  useEffect(() => {
    const buscarCDIMensal = async () => {
      if (!formData.mes || !formData.ano) return;

      setCarregandoCDI(true);
      setErroCDI('');

      try {
        // Calcular data início e fim do mês
        const dataInicio = new Date(formData.ano, formData.mes - 1, 1);
        const dataFim = new Date(formData.ano, formData.mes, 0); // Último dia do mês

        const dataInicioStr = dataInicio.toISOString().split('T')[0];
        const dataFimStr = dataFim.toISOString().split('T')[0];

        const cdiAnual = await buscarCDI(dataInicioStr, dataFimStr);

        if (cdiAnual !== null) {
          // Converter CDI anual para mensal (dividir por 12)
          const cdiMensal = cdiAnual / 12;
          setFormData(prev => ({ ...prev, cdiMensal }));
        } else {
          setErroCDI('CDI não encontrado para o período selecionado. Preencha manualmente.');
        }
      } catch (error) {
        console.error('Erro ao buscar CDI:', error);
        setErroCDI('Erro ao buscar CDI. Preencha manualmente.');
      } finally {
        setCarregandoCDI(false);
      }
    };

    // Debounce para evitar muitas requisições
    const timeoutId = setTimeout(buscarCDIMensal, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.mes, formData.ano]);

  // Quando a estratégia mudar, atualizar automaticamente os clientes selecionados
  const handleEstrategiaChange = (estrategiaId: string) => {
    setEstrategiaSelecionada(estrategiaId);
    
    if (!estrategiaId) {
      // Se não houver estratégia selecionada, limpar seleção
      setClientesSelecionados({});
      return;
    }
    
    // Selecionar todos os clientes da estratégia
    const clientesEstrategia = clientes.filter(c => c.estrategiaId === estrategiaId);
    const novosSelecionados: Record<string, ClienteSelecionado> = {};
    
    clientesEstrategia.forEach(cliente => {
      novosSelecionados[cliente.id] = {
        clienteId: cliente.id,
        patrimonioTotal: 0,
        resultadoPercentual: 0,
        resultadoValor: 0,
        selecionado: true,
      };
    });
    
    setClientesSelecionados(novosSelecionados);
  };

  // Obter clientes da estratégia selecionada
  const clientesEstrategiaSelecionada = useMemo(() => {
    if (!estrategiaSelecionada) return [];
    return clientes.filter(c => c.estrategiaId === estrategiaSelecionada);
  }, [clientes, estrategiaSelecionada]);

  const atualizarDadosCliente = (clienteId: string, campo: keyof ClienteSelecionado, valor: number) => {
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;

      const atualizado = { ...cliente, [campo]: valor };

      // Calcular resultado em valor se o percentual mudar
      if (campo === 'resultadoPercentual') {
        atualizado.resultadoValor = (atualizado.patrimonioTotal * valor) / 100;
      }
      // Recalcular percentual se o valor mudar
      else if (campo === 'resultadoValor') {
        atualizado.resultadoPercentual = atualizado.patrimonioTotal > 0
          ? (valor / atualizado.patrimonioTotal) * 100
          : 0;
      }
      // Recalcular resultado em valor se patrimônio mudar
      else if (campo === 'patrimonioTotal') {
        atualizado.resultadoValor = (valor * atualizado.resultadoPercentual) / 100;
      }

      return {
        ...prev,
        [clienteId]: atualizado,
      };
    });
  };

  const toggleClienteSelecionado = (clienteId: string) => {
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;
      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          selecionado: !cliente.selecionado,
        },
      };
    });
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.resumoMacro) {
      alert('Por favor, preencha o Resumo Macro.');
      return;
    }

    if (!formData.textoAcimaCDI || !formData.textoAbaixoCDI) {
      alert('Por favor, preencha os textos para resultado acima e abaixo do CDI.');
      return;
    }

    if (!estrategiaSelecionada) {
      alert('Por favor, selecione uma estratégia.');
      return;
    }

    const clientesIds = Object.keys(clientesSelecionados).filter(
      id => clientesSelecionados[id]?.selecionado
    );
    if (clientesIds.length === 0) {
      alert('Nenhum cliente encontrado para a estratégia selecionada.');
      return;
    }

    const relatorios: RelatorioMensal[] = clientesIds.map(clienteId => {
      const dados = clientesSelecionados[clienteId];
      const cliente = clientes.find(c => c.id === clienteId);

      const resultadoPercentual = typeof dados.resultadoPercentual === 'number' ? dados.resultadoPercentual : 0;
      const cdiMensal = typeof formData.cdiMensal === 'number' ? formData.cdiMensal : 0;
      const resumoTexto = resultadoPercentual > cdiMensal ? formData.textoAcimaCDI : formData.textoAbaixoCDI;

      return {
        clienteId,
        clienteNome: cliente?.nome,
        mes: formData.mes,
        ano: formData.ano,
        resumoMacro: formData.resumoMacro,
        patrimonioTotal: dados.patrimonioTotal,
        resultadoMes: dados.resultadoValor,
        resultadoPercentual,
        resumoTexto: resumoTexto || '',
        cdiMensal,
        textoAcimaCDI: formData.textoAcimaCDI,
        textoAbaixoCDI: formData.textoAbaixoCDI,
        dataGeracao: new Date().toISOString(),
      };
    });

    onGerarPDFs(relatorios);
  };

  const clientesSelecionadosList = useMemo(() => {
    return Object.keys(clientesSelecionados).map(id => {
      const cliente = clientes.find(c => c.id === id);
      return { id, cliente, dados: clientesSelecionados[id] };
    });
  }, [clientesSelecionados, clientes]);

  const totalSelecionados = useMemo(() => {
    return Object.values(clientesSelecionados).filter(c => c.selecionado).length;
  }, [clientesSelecionados]);

  return (
    <Card title="Geração em Massa de Relatórios" className="form-relatorio-massa">
      <form onSubmit={handleSubmit} className="relatorio-massa-form">
        <div className="form-section">
          <h3>Período e Resumos Padrão</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mes">Mês *</label>
              <select
                id="mes"
                value={formData.mes}
                onChange={(e) => setFormData({ ...formData, mes: parseInt(e.target.value) })}
                required
              >
                {meses.map((mes, index) => (
                  <option key={index} value={index + 1}>
                    {mes}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ano">Ano *</label>
              <input
                type="number"
                id="ano"
                value={formData.ano}
                onChange={(e) => setFormData({ ...formData, ano: parseInt(e.target.value) })}
                min="2020"
                max="2100"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="resumoMacro">Resumo Macro (Padrão para todos) *</label>
            <textarea
              id="resumoMacro"
              value={formData.resumoMacro}
              onChange={(e) => setFormData({ ...formData, resumoMacro: e.target.value })}
              rows={3}
              placeholder="Digite o resumo macro da carteira..."
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cdiMensal">
                CDI Mensal (%) 
                {carregandoCDI && <span className="loading-indicator">Carregando...</span>}
              </label>
              <input
                type="number"
                id="cdiMensal"
                value={formData.cdiMensal || ''}
                onChange={(e) => setFormData({ ...formData, cdiMensal: parseFloat(e.target.value) || 0 })}
                step="0.01"
                min="0"
                placeholder="Será preenchido automaticamente"
                disabled={carregandoCDI}
              />
              {erroCDI && <p className="error-message">{erroCDI}</p>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="textoAcimaCDI">Texto quando Resultado maior que CDI *</label>
            <textarea
              id="textoAcimaCDI"
              value={formData.textoAcimaCDI}
              onChange={(e) => setFormData({ ...formData, textoAcimaCDI: e.target.value })}
              rows={5}
              placeholder="Texto que será usado quando o resultado do mês for superior ao CDI..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="textoAbaixoCDI">Texto quando Resultado menor ou igual ao CDI *</label>
            <textarea
              id="textoAbaixoCDI"
              value={formData.textoAbaixoCDI}
              onChange={(e) => setFormData({ ...formData, textoAbaixoCDI: e.target.value })}
              rows={5}
              placeholder="Texto que será usado quando o resultado do mês for igual ou inferior ao CDI..."
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Seleção de Clientes</h3>
          
          <div className="estrategia-selection-section">
            <div className="form-group">
              <label htmlFor="estrategiaSelecionada">Selecionar Estratégia *</label>
              <select
                id="estrategiaSelecionada"
                value={estrategiaSelecionada}
                onChange={(e) => handleEstrategiaChange(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Selecione uma estratégia</option>
                {estrategias.map((estrategia) => {
                  const clientesEstrategia = clientes.filter(c => c.estrategiaId === estrategia.id);
                  return (
                    <option key={estrategia.id} value={estrategia.id}>
                      {estrategia.nome} ({clientesEstrategia.length} cliente{clientesEstrategia.length !== 1 ? 's' : ''})
                    </option>
                  );
                })}
              </select>
            </div>
            
            {estrategiaSelecionada && (
              <div className="estrategia-info">
                <p className="selected-count">
                  <strong>{Object.keys(clientesSelecionados).length}</strong> cliente(s) da estratégia "<strong>{estrategias.find(e => e.id === estrategiaSelecionada)?.nome}</strong>" serão incluídos no relatório.
                </p>
                <p className="selected-count selected-count--computed">
                  <strong>{totalSelecionados}</strong> de <strong>{clientesEstrategiaSelecionada.length}</strong> cliente(s) selecionado(s) da estrategia "<strong>{estrategias.find(e => e.id === estrategiaSelecionada)?.nome}</strong>".
                </p>
                {clientesEstrategiaSelecionada.length === 0 && (
                  <p className="warning-message">
                    ⚠️ Nenhum cliente encontrado para esta estratégia.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {clientesSelecionadosList.length > 0 && (
          <div className="form-section">
            <h3>Dados dos Clientes Selecionados</h3>
            
            <div className="clientes-dados">
              {clientesSelecionadosList.map(({ id, cliente, dados }) => (
                <div key={id} className={`cliente-dados-card${dados.selecionado ? '' : ' is-disabled'}`}>
                  <div className="cliente-dados-header">
                    <label className="cliente-toggle">
                      <input
                        type="checkbox"
                        checked={dados.selecionado}
                        onChange={() => toggleClienteSelecionado(id)}
                      />
                      <span>{cliente?.nome}</span>
                    </label>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Patrimônio Total (R$) *</label>
                      <input
                        type="number"
                        value={dados.patrimonioTotal || ''}
                        onChange={(e) => atualizarDadosCliente(id, 'patrimonioTotal', parseFloat(e.target.value) || 0)}
                        step="0.01"
                        min="0"
                        required
                        disabled={!dados.selecionado}
                      />
                    </div>
                    <div className="form-group">
                      <label>Resultado do Mês (%) *</label>
                      <input
                        type="number"
                        value={dados.resultadoPercentual || ''}
                        onChange={(e) => atualizarDadosCliente(id, 'resultadoPercentual', parseFloat(e.target.value) || 0)}
                        step="0.01"
                        required
                        disabled={!dados.selecionado}
                      />
                    </div>
                    <div className="form-group">
                      <label>Resultado do Mês (R$)</label>
                      <input
                        type="number"
                        value={dados.resultadoValor.toFixed(2)}
                        onChange={(e) => atualizarDadosCliente(id, 'resultadoValor', parseFloat(e.target.value) || 0)}
                        step="0.01"
                        disabled={!dados.selecionado}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={totalSelecionados === 0}>
            Gerar {totalSelecionados} PDF(s)
          </button>
        </div>
      </form>
    </Card>
  );
}
