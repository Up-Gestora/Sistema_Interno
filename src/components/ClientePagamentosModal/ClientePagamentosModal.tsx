import { useEffect, useState } from 'react';
import { Cliente } from '../../types';
import { AsaasPagamento, AsaasSubscription } from '../../types/asaas';
import { buscarPagamentosPaginados, buscarSubscriptions, atualizarCobranca, atualizarSubscription, cancelarCobranca } from '../../services/asaasService';
import { formatCurrency, formatDate } from '../../utils/calculations';
import { useMoneyVisibility } from '../../contexts/MoneyVisibilityContext';
import Modal from '../Modal/Modal';
import './ClientePagamentosModal.css';

interface ClientePagamentosModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
}

export default function ClientePagamentosModal({ isOpen, onClose, cliente }: ClientePagamentosModalProps) {
  const { maskValue } = useMoneyVisibility();
  const [pagamentos, setPagamentos] = useState<AsaasPagamento[]>([]);
  const [subscriptions, setSubscriptions] = useState<AsaasSubscription[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [pagamentoEditando, setPagamentoEditando] = useState<AsaasPagamento | null>(null);
  const [pagamentoValor, setPagamentoValor] = useState('');
  const [pagamentoVencimento, setPagamentoVencimento] = useState('');
  const [pagamentoDescricao, setPagamentoDescricao] = useState('');
  const [pagamentoBillingType, setPagamentoBillingType] = useState('');

  const [subscriptionEditando, setSubscriptionEditando] = useState<AsaasSubscription | null>(null);
  const [subscriptionValor, setSubscriptionValor] = useState('');
  const [subscriptionVencimento, setSubscriptionVencimento] = useState('');
  const [subscriptionBillingType, setSubscriptionBillingType] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregarDados = async () => {
    if (!cliente?.asaasCustomerId) return;

    setCarregando(true);
    setErro('');
    try {
      const [pagamentosResposta, subscriptionsResposta] = await Promise.all([
        buscarPagamentosPaginados({ customer: cliente.asaasCustomerId }),
        buscarSubscriptions({ customer: cliente.asaasCustomerId, limit: 100 }),
      ]);
      setPagamentos(pagamentosResposta || []);
      setSubscriptions(subscriptionsResposta.data || []);
    } catch (error: any) {
      setErro(error.message || 'Erro ao carregar dados de pagamento');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarDados();
      setPagamentoEditando(null);
      setSubscriptionEditando(null);
    }
  }, [isOpen, cliente?.asaasCustomerId]);

  const getStatusBadgeClass = (status: string) => {
    const statusMap: Record<string, string> = {
      RECEIVED: 'status-received',
      PENDING: 'status-pending',
      OVERDUE: 'status-overdue',
      REFUNDED: 'status-refunded',
    };
    return statusMap[status] || 'status-default';
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      RECEIVED: 'Recebido',
      PENDING: 'Pendente',
      OVERDUE: 'Vencido',
      REFUNDED: 'Reembolsado',
    };
    return statusMap[status] || status;
  };

  const iniciarEdicaoPagamento = (pagamento: AsaasPagamento) => {
    setPagamentoEditando(pagamento);
    setPagamentoValor(String(pagamento.value || 0));
    setPagamentoVencimento(pagamento.dueDate ? pagamento.dueDate.split('T')[0] : '');
    setPagamentoDescricao(pagamento.description || '');
    setPagamentoBillingType(pagamento.billingType || '');
  };

  const salvarEdicaoPagamento = async () => {
    if (!pagamentoEditando) return;

    const valor = Number(pagamentoValor);
    if (!valor || valor <= 0) {
      alert('Informe um valor válido.');
      return;
    }

    if (!pagamentoVencimento) {
      alert('Informe a data de vencimento.');
      return;
    }

    setSalvando(true);
    try {
      await atualizarCobranca(pagamentoEditando.id, {
        value: valor,
        dueDate: pagamentoVencimento,
        description: pagamentoDescricao || undefined,
        billingType: pagamentoBillingType || undefined,
      });
      await carregarDados();
      setPagamentoEditando(null);
    } catch (error: any) {
      alert(error.message || 'Erro ao atualizar cobrança.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirPagamento = async (pagamento: AsaasPagamento) => {
    const confirmar = confirm('Deseja excluir esta cobrança?');
    if (!confirmar) return;

    setSalvando(true);
    try {
      await cancelarCobranca(pagamento.id);
      await carregarDados();
    } catch (error: any) {
      alert(error.message || 'Erro ao excluir cobrança.');
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicaoSubscription = (subscription: AsaasSubscription) => {
    setSubscriptionEditando(subscription);
    setSubscriptionValor(String(subscription.value || 0));
    setSubscriptionVencimento(subscription.nextDueDate ? subscription.nextDueDate.split('T')[0] : '');
    setSubscriptionBillingType(subscription.billingType || '');
  };

  const salvarEdicaoSubscription = async () => {
    if (!subscriptionEditando) return;

    const valor = Number(subscriptionValor);
    if (!valor || valor <= 0) {
      alert('Informe um valor válido.');
      return;
    }

    if (!subscriptionVencimento) {
      alert('Informe a data de vencimento.');
      return;
    }

    setSalvando(true);
    try {
      await atualizarSubscription(subscriptionEditando.id, {
        value: valor,
        billingType: subscriptionBillingType || undefined,
        nextDueDate: subscriptionVencimento,
        updatePendingPayments: true,
      });
      await carregarDados();
      setSubscriptionEditando(null);
    } catch (error: any) {
      alert(error.message || 'Erro ao atualizar assinatura.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pagamentos - ${cliente?.nome || ''}`}
      size="large"
    >
      {!cliente?.asaasCustomerId ? (
        <div className="cliente-pagamentos-empty">
          Este cliente não está linkado ao Asaas.
        </div>
      ) : carregando ? (
        <div className="cliente-pagamentos-loading">Carregando...</div>
      ) : (
        <div className="cliente-pagamentos-content">
          {erro && (
            <div className="cliente-pagamentos-error">
              {erro}
              <button onClick={() => setErro('')}>✕</button>
            </div>
          )}

          <div className="cliente-pagamentos-section">
            <div className="section-header">
              <h3>Pagamentos</h3>
              <button className="btn-refresh" onClick={carregarDados} disabled={carregando}>
                🔄 Atualizar
              </button>
            </div>

            {pagamentos.length === 0 ? (
              <div className="empty-state">Nenhum pagamento encontrado</div>
            ) : (
              <div className="pagamentos-table-container">
                <table className="pagamentos-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th>Valor líquido</th>
                      <th>Vencimento</th>
                      <th>Status</th>
                      <th>Tipo</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentos.map((pagamento) => (
                      <tr key={pagamento.id}>
                        <td>{pagamento.description || '-'}</td>
                        <td className="valor-cell">{maskValue(formatCurrency(pagamento.value))}</td>
                        <td className="valor-cell">
                          {pagamento.netValue !== undefined && pagamento.netValue !== null
                            ? maskValue(formatCurrency(pagamento.netValue))
                            : '-'}
                        </td>
                        <td>{formatDate(pagamento.dueDate)}</td>
                        <td>
                          <span className={`status-badge ${getStatusBadgeClass(pagamento.status)}`}>
                            {getStatusLabel(pagamento.status)}
                          </span>
                        </td>
                        <td>{pagamento.billingType || '-'}</td>
                        <td>
                          <div className="pagamentos-actions">
                            <button
                              className="btn-secondary btn-small"
                              onClick={() => iniciarEdicaoPagamento(pagamento)}
                              disabled={pagamento.status === 'RECEIVED'}
                            >
                              Editar
                            </button>
                            <button
                              className="btn-danger btn-small"
                              onClick={() => handleExcluirPagamento(pagamento)}
                              disabled={pagamento.status === 'RECEIVED' || salvando}
                            >
                              Excluir
                            </button>
                            {(pagamento.invoiceUrl || pagamento.bankSlipUrl) && (
                              <a
                                className="btn-link btn-small"
                                href={pagamento.invoiceUrl || pagamento.bankSlipUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Abrir
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagamentoEditando && (
              <div className="editar-form">
                <h4>Editar cobrança</h4>
                <div className="form-grid">
                  <label>
                    Valor
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pagamentoValor}
                      onChange={(e) => setPagamentoValor(e.target.value)}
                    />
                  </label>
                  <label>
                    Vencimento
                    <input
                      type="date"
                      value={pagamentoVencimento}
                      onChange={(e) => setPagamentoVencimento(e.target.value)}
                    />
                  </label>
                  <label>
                    Forma de pagamento
                    <select
                      value={pagamentoBillingType}
                      onChange={(e) => setPagamentoBillingType(e.target.value)}
                    >
                      <option value="">Manter atual</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="PIX">Pix</option>
                      <option value="CREDIT_CARD">Cartão</option>
                    </select>
                  </label>
                  <label>
                    Descrição
                    <input
                      type="text"
                      value={pagamentoDescricao}
                      onChange={(e) => setPagamentoDescricao(e.target.value)}
                    />
                  </label>
                </div>
                <div className="form-actions-inline">
                  <button className="btn-secondary" onClick={() => setPagamentoEditando(null)}>
                    Cancelar
                  </button>
                  <button className="btn-primary" onClick={salvarEdicaoPagamento} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="cliente-pagamentos-section">
            <div className="section-header">
              <h3>Assinaturas</h3>
            </div>

            {subscriptions.length === 0 ? (
              <div className="empty-state">Nenhuma assinatura encontrada</div>
            ) : (
              <div className="subscriptions-list">
                {subscriptions.map((subscription) => (
                  <div key={subscription.id} className="subscription-card">
                    <div className="subscription-info">
                      <strong>{subscription.description || 'Assinatura'}</strong>
                      <span>Valor: {maskValue(formatCurrency(subscription.value))}</span>
                      <span>Forma: {subscription.billingType}</span>
                      <span>Status: {subscription.status}</span>
                      <span>Proximo vencimento: {formatDate(subscription.nextDueDate)}</span>
                    </div>
                    <button
                      className="btn-secondary btn-small"
                      onClick={() => iniciarEdicaoSubscription(subscription)}
                    >
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {subscriptionEditando && (
              <div className="editar-form">
                <h4>Editar assinatura</h4>
                <div className="form-grid">
                  <label>
                    Valor
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={subscriptionValor}
                      onChange={(e) => setSubscriptionValor(e.target.value)}
                    />
                  </label>
                  <label>
                    Próximo vencimento
                    <input
                      type="date"
                      value={subscriptionVencimento}
                      onChange={(e) => setSubscriptionVencimento(e.target.value)}
                    />
                  </label>
                  <label>
                    Forma de pagamento
                    <select
                      value={subscriptionBillingType}
                      onChange={(e) => setSubscriptionBillingType(e.target.value)}
                    >
                      <option value="">Manter atual</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="PIX">Pix</option>
                      <option value="CREDIT_CARD">Cartão</option>
                    </select>
                  </label>
                </div>
                <div className="form-actions-inline">
                  <button className="btn-secondary" onClick={() => setSubscriptionEditando(null)}>
                    Cancelar
                  </button>
                  <button className="btn-primary" onClick={salvarEdicaoSubscription} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
