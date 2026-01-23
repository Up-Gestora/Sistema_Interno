import { useState } from 'react';
import { Cliente } from '../../types';
import { RelatorioMensal } from '../../types/relatorio';
import Card from '../../components/Card/Card';
import './FormRelatorio.css';

interface FormRelatorioProps {
  clientes: Cliente[];
  onSubmit: (relatorio: RelatorioMensal) => void;
  onCancel?: () => void;
}

export default function FormRelatorio({ clientes, onSubmit, onCancel }: FormRelatorioProps) {
  const [formData, setFormData] = useState<Partial<RelatorioMensal>>({
    clienteId: '',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    resumoMacro: '',
    patrimonioTotal: 0,
    resultadoMes: 0,
    resumoTexto: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clienteId || !formData.resumoMacro || !formData.resumoTexto) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const cliente = clientes.find(c => c.id === formData.clienteId);
    const relatorio: RelatorioMensal = {
      ...formData as RelatorioMensal,
      clienteNome: cliente?.nome,
      dataGeracao: new Date().toISOString(),
    };

    onSubmit(relatorio);
  };

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <Card title="Novo Relatório Mensal" className="form-relatorio">
      <form onSubmit={handleSubmit} className="relatorio-form">
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
          <label htmlFor="resumoMacro">Resumo Macro *</label>
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
            <label htmlFor="patrimonioTotal">Patrimônio Total (R$) *</label>
            <input
              type="number"
              id="patrimonioTotal"
              value={formData.patrimonioTotal || ''}
              onChange={(e) => setFormData({ ...formData, patrimonioTotal: parseFloat(e.target.value) || 0 })}
              step="0.01"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="resultadoMes">Resultado do Mês (R$) *</label>
            <input
              type="number"
              id="resultadoMes"
              value={formData.resultadoMes || ''}
              onChange={(e) => setFormData({ ...formData, resultadoMes: parseFloat(e.target.value) || 0 })}
              step="0.01"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="resumoTexto">Resumo do Mês *</label>
          <textarea
            id="resumoTexto"
            value={formData.resumoTexto}
            onChange={(e) => setFormData({ ...formData, resumoTexto: e.target.value })}
            rows={8}
            placeholder="Descreva o que aconteceu no mês, principais movimentações, eventos do mercado, etc..."
            required
          />
        </div>

        <div className="form-actions">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
          )}
          <button type="submit" className="btn-primary">
            Gerar Preview
          </button>
        </div>
      </form>
    </Card>
  );
}

