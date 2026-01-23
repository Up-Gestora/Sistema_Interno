import { useOutletContext } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../utils/calculations';
import Card from '../../components/Card/Card';
import { FinanceiroOutletContext } from '../AsaasPage';

export default function FinanceiroPagamentosPage() {
  const {
    pagamentosFiltrados,
    carregando,
    filtroStatus,
    setFiltroStatus,
    clientesPorAsaasId,
    getStatusBadgeClass,
    getStatusLabel,
    maskValue,
  } = useOutletContext<FinanceiroOutletContext>();

  return (
    <div className="financeiro-subpage">
      <Card>
        <div className="pagamentos-header">
          <h2>Pagamentos e Cobranças</h2>
          <div className="filtros">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="filtro-select"
            >
              <option value="">Todos os status</option>
              <option value="RECEIVED">Recebidos</option>
              <option value="PENDING">Pendentes</option>
              <option value="OVERDUE">Vencidos</option>
              <option value="REFUNDED">Reembolsados</option>
            </select>
          </div>
        </div>

        {carregando ? (
          <div className="loading">Carregando...</div>
        ) : pagamentosFiltrados.length === 0 ? (
          <div className="empty-state">Nenhum pagamento encontrado</div>
        ) : (
          <div className="pagamentos-table-container">
            <table className="pagamentos-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {pagamentosFiltrados.map((pagamento) => {
                  const clienteNome = clientesPorAsaasId[pagamento.customer];
                  return (
                    <tr key={pagamento.id}>
                      <td title={clienteNome ? '' : pagamento.customer || ''}>
                        {clienteNome || '-'}
                      </td>
                      <td>{pagamento.description || '-'}</td>
                      <td className="valor-cell">{maskValue(formatCurrency(pagamento.value))}</td>
                      <td>{formatDate(pagamento.dueDate)}</td>
                      <td>
                        {pagamento.paymentDate
                          ? formatDate(pagamento.paymentDate)
                          : pagamento.clientPaymentDate
                          ? formatDate(pagamento.clientPaymentDate)
                          : '-'}
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(pagamento.status)}`}>
                          {getStatusLabel(pagamento.status)}
                        </span>
                      </td>
                      <td>{pagamento.billingType || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}


