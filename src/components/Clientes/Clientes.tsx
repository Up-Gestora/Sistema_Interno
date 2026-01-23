import { useState } from 'react';
import { Cliente } from '../../types';
import { useEstrategias } from '../../hooks/useEstrategias';
import { formatCurrency } from '../../utils/calculations';
import { useMoneyVisibility } from '../../contexts/MoneyVisibilityContext';
import Card from '../Card/Card';
import './Clientes.css';

interface ClientesProps {
  clientes: Cliente[];
  onEdit?: (cliente: Cliente) => void;
  onDelete?: (cliente: Cliente) => void;
  pagamentosStatus?: Record<string, 'OK' | 'Inad' | '-'>;
  asaasContato?: Record<string, { email?: string; telefone?: string }>;
  dashboardView?: boolean;
  filtroEstrategia?: string;
  onFiltroEstrategiaChange?: (estrategia: string) => void;
}

export default function Clientes({
  clientes,
  onEdit,
  onDelete,
  pagamentosStatus,
  asaasContato,
  dashboardView = false,
  filtroEstrategia: filtroExterno,
  onFiltroEstrategiaChange,
}: ClientesProps) {
  const { estrategias } = useEstrategias();
  const { maskValue } = useMoneyVisibility();
  const [filtroEstrategiaLocal, setFiltroEstrategiaLocal] = useState<string>('');
  
  // Usar filtro externo se fornecido, senão usar estado local
  const filtroEstrategia = filtroExterno !== undefined ? filtroExterno : filtroEstrategiaLocal;
  const setFiltroEstrategia = onFiltroEstrategiaChange || setFiltroEstrategiaLocal;

  const clientesFiltrados = clientes.filter((cliente) => {
    if (!filtroEstrategia) return true;
    if (filtroEstrategia === 'sem-estrategia') return !cliente.estrategiaId;
    return cliente.estrategiaId === filtroEstrategia;
  });

  const getEstrategiaNome = (estrategiaId?: string) => {
    if (!estrategiaId) return '-';
    return estrategias.find(e => e.id === estrategiaId)?.nome || '-';
  };

  const getStatusLabel = (cliente: Cliente) => {
    if (cliente.status === 'inativo') return 'Inativo';
    if (!dashboardView) return cliente.status;
    return cliente.asaasCustomerId ? 'OK' : 'Pendente Asaas';
  };

  const getStatusClass = (cliente: Cliente) => {
    if (cliente.status === 'inativo') return 'status-inativo';
    if (!dashboardView) return `status-${cliente.status}`;
    return cliente.asaasCustomerId ? 'status-ok' : 'status-pendente-asaas';
  };

  const getPagamentoLabel = (cliente: Cliente) => {
    if (!dashboardView) return '-';
    return pagamentosStatus?.[cliente.id] || '-';
  };

  const getEmail = (cliente: Cliente) => {
    if (!dashboardView) return cliente.email;
    return asaasContato?.[cliente.id]?.email || cliente.email;
  };

  const getTelefone = (cliente: Cliente) => {
    if (!dashboardView) return cliente.telefone;
    return asaasContato?.[cliente.id]?.telefone || cliente.telefone;
  };

  const formatTelefone = (telefone?: string) => {
    if (!telefone) return '-';
    const digits = telefone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return telefone;
  };

  return (
    <Card title="Clientes" className="clientes-container">
      <div className="clientes-filters">
        <div className="filter-group">
          <label htmlFor="filtroEstrategia" className="filter-label">Filtrar por Estratégia:</label>
          <select
            id="filtroEstrategia"
            value={filtroEstrategia}
            onChange={(e) => setFiltroEstrategia(e.target.value)}
            className="filter-select"
          >
            <option value="">Todas as estratégias ({clientes.length})</option>
            {estrategias.map((estrategia) => {
              const count = clientes.filter(c => c.estrategiaId === estrategia.id).length;
              return (
                <option key={estrategia.id} value={estrategia.id}>
                  {estrategia.nome} ({count})
                </option>
              );
            })}
            <option value="sem-estrategia">
              Sem estratégia ({clientes.filter(c => !c.estrategiaId).length})
            </option>
          </select>
        </div>
      </div>

      <div className="clientes-table-container">
        <table className="clientes-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Telefone</th>
              <th>Estratégia</th>
              <th>Valor Total</th>
              <th>Status</th>
              {dashboardView && <th>Pagamentos</th>}
              {(onEdit || onDelete) && <th className="actions-header">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.length === 0 ? (
              <tr>
                <td
                  colSpan={(onEdit || onDelete)
                    ? (dashboardView ? 8 : 9)
                    : (dashboardView ? 7 : 8)}
                  className="empty-state"
                >
                  Nenhum cliente encontrado
                </td>
              </tr>
            ) : (
              clientesFiltrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td className="nome-cell">{cliente.nome}</td>
                  <td>{getEmail(cliente)}</td>
                  <td>{formatTelefone(getTelefone(cliente))}</td>
                  <td>{getEstrategiaNome(cliente.estrategiaId)}</td>
                  <td className="valor-cell">
                    {cliente.valorTotalContratos
                      ? maskValue(formatCurrency(cliente.valorTotalContratos))
                      : '-'}
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusClass(cliente)}`}>
                      {getStatusLabel(cliente)}
                    </span>
                  </td>
                  {dashboardView && (
                    <td>
                      <span className={`pagamento-badge pagamento-${getPagamentoLabel(cliente).toLowerCase()}`}>
                        {getPagamentoLabel(cliente)}
                      </span>
                    </td>
                  )}
                  {(onEdit || onDelete) && (
                    <td className="actions-cell">
                      <div className="actions-buttons">
                        {onEdit && (
                          <button
                            className="action-btn edit-btn"
                            onClick={() => onEdit(cliente)}
                            title="Editar cliente"
                            aria-label="Editar cliente"
                          >
                            ✏️
                          </button>
                        )}
                        {onDelete && (
                          <button
                            className="action-btn delete-btn"
                            onClick={() => onDelete(cliente)}
                            title="Excluir cliente"
                            aria-label="Excluir cliente"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

