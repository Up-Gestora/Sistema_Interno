import { useState, useEffect } from 'react';
import { Cliente } from '../../types';
import { AsaasCliente, AsaasSubscription } from '../../types/asaas';
import { buscarClientes, buscarSubscriptions, atualizarSubscription } from '../../services/asaasService';
import { useClientes } from '../../hooks/useClientes';
import { formatCurrency } from '../../utils/calculations';
import { useMoneyVisibility } from '../../contexts/MoneyVisibilityContext';
import Card from '../Card/Card';
import Modal from '../Modal/Modal';
import ClientePagamentosModal from '../ClientePagamentosModal/ClientePagamentosModal';
import './LinkarClientesAsaas.css';

interface LinkarClientesAsaasProps {
  onLinkar?: (clienteId: string, asaasCustomerId: string, subscriptionId?: string) => void;
}

export default function LinkarClientesAsaas({ onLinkar }: LinkarClientesAsaasProps) {
  const { clientes, setClientes } = useClientes();
  const { maskValue } = useMoneyVisibility();
  const [clientesAsaas, setClientesAsaas] = useState<AsaasCliente[]>([]);
  const [subscriptions, setSubscriptions] = useState<AsaasSubscription[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string>('');
  const [buscaAsaas, setBuscaAsaas] = useState('');
  const [mostrarModalLinkar, setMostrarModalLinkar] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [asaasClienteSelecionado, setAsaasClienteSelecionado] = useState<AsaasCliente | null>(null);
  const [subscriptionSelecionada, setSubscriptionSelecionada] = useState<AsaasSubscription | null>(null);
  const [valorSubscription, setValorSubscription] = useState<number>(0);
  const [billingType, setBillingType] = useState<string>('BOLETO');
  const [dataVencimento, setDataVencimento] = useState<string>('');
  const [dataEnvio, setDataEnvio] = useState<string>('');
  const [atualizandoSubscription, setAtualizandoSubscription] = useState(false);
  const [subscriptionParaAtualizar, setSubscriptionParaAtualizar] = useState<AsaasSubscription | null>(null);
  const [clientePagamentos, setClientePagamentos] = useState<Cliente | null>(null);
  const [mostrarModalPagamentos, setMostrarModalPagamentos] = useState(false);

  useEffect(() => {
    carregarClientesAsaas();
  }, []);

  const fetchClientesAsaas = async () => {
    const resposta = await buscarClientes({ limit: 100 });
    return resposta.data || [];
  };

  const carregarClientesAsaas = async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await fetchClientesAsaas();
      setClientesAsaas(dados);
    } catch (error: any) {
      setErro(error.message || 'Erro ao carregar clientes do Asaas');
    } finally {
      setCarregando(false);
    }
  };

  const carregarSubscriptions = async (customerId: string) => {
    try {
      const resposta = await buscarSubscriptions({ customer: customerId, limit: 100 });
      setSubscriptions(resposta.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar subscriptions:', error);
      setSubscriptions([]);
    }
  };

  const handleAbrirModalLinkar = (cliente: Cliente) => {
    setClienteSelecionado(cliente);
    setMostrarModalLinkar(true);
    setAsaasClienteSelecionado(null);
    setSubscriptionSelecionada(null);
    setValorSubscription(cliente.assinatura || 0);
  };

  const handleSelecionarAsaasCliente = async (asaasCliente: AsaasCliente) => {
    setAsaasClienteSelecionado(asaasCliente);
    await carregarSubscriptions(asaasCliente.id);
    setSubscriptionSelecionada(null);
  };

  const handleLinkar = async () => {
    if (!clienteSelecionado || !asaasClienteSelecionado) {
      setErro('Selecione um cliente do Asaas');
      return;
    }

    setCarregando(true);
    setErro('');

    try {
      let subscriptionId = subscriptionSelecionada?.id;

      // Atualizar cliente interno com IDs do Asaas
      const clientesAtualizados = clientes.map(c => {
        if (c.id === clienteSelecionado.id) {
          return {
            ...c,
            asaasCustomerId: asaasClienteSelecionado.id,
            asaasSubscriptionId: subscriptionId,
            email: asaasClienteSelecionado.email || c.email,
            telefone: asaasClienteSelecionado.mobilePhone || asaasClienteSelecionado.phone || c.telefone,
          };
        }
        return c;
      });

      setClientes(clientesAtualizados);

      if (onLinkar) {
        onLinkar(clienteSelecionado.id, asaasClienteSelecionado.id, subscriptionId);
      }

      setMostrarModalLinkar(false);
      setClienteSelecionado(null);
      setAsaasClienteSelecionado(null);
      setSubscriptionSelecionada(null);
    } catch (error: any) {
      setErro(error.message || 'Erro ao linkar cliente');
    } finally {
      setCarregando(false);
    }
  };

  const handleAtualizarSubscription = async () => {
    if (!subscriptionParaAtualizar) {
      setErro('Nenhuma assinatura selecionada para atualizar');
      return;
    }

    if (!dataVencimento) {
      setErro('Por favor, informe a data de vencimento');
      return;
    }

    setCarregando(true);
    setErro('');

    try {
      await atualizarSubscription(subscriptionParaAtualizar.id, {
        value: valorSubscription,
        billingType: billingType,
        nextDueDate: dataVencimento,
        updatePendingPayments: true, // Atualiza todas as cobranças pendentes
      });

      // Recarregar subscriptions
      if (asaasClienteSelecionado) {
        await carregarSubscriptions(asaasClienteSelecionado.id);
      }

      setAtualizandoSubscription(false);
      setSubscriptionParaAtualizar(null);
      setErro('');
    } catch (error: any) {
      setErro(error.message || 'Erro ao atualizar assinatura');
    } finally {
      setCarregando(false);
    }
  };

  const handleDeslinkar = async (cliente: Cliente) => {
    if (!confirm(`Deseja deslinkar ${cliente.nome} do Asaas?`)) {
      return;
    }

    const clientesAtualizados = clientes.map(c => {
      if (c.id === cliente.id) {
        const { asaasCustomerId, asaasSubscriptionId, ...resto } = c;
        return resto;
      }
      return c;
    });

    setClientes(clientesAtualizados);
  };

  const handleAtualizarTodosContatos = async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await fetchClientesAsaas();
      setClientesAsaas(dados);

      const mapaAsaas = new Map(dados.map((cliente) => [cliente.id, cliente]));
      const clientesAtualizados = clientes.map((cliente) => {
        if (!cliente.asaasCustomerId) return cliente;
        const asaasCliente = mapaAsaas.get(cliente.asaasCustomerId);
        if (!asaasCliente) return cliente;
        return {
          ...cliente,
          email: asaasCliente.email || cliente.email,
          telefone: asaasCliente.mobilePhone || asaasCliente.phone || cliente.telefone,
        };
      });

      setClientes(clientesAtualizados);
    } catch (error: any) {
      setErro(error.message || 'Erro ao atualizar contatos do Asaas');
    } finally {
      setCarregando(false);
    }
  };

  const abrirPagamentosCliente = (cliente: Cliente) => {
    setClientePagamentos(cliente);
    setMostrarModalPagamentos(true);
  };

  const fecharPagamentosCliente = () => {
    setMostrarModalPagamentos(false);
    setClientePagamentos(null);
  };

  const clientesFiltrados = clientesAsaas.filter(c =>
    c.name.toLowerCase().includes(buscaAsaas.toLowerCase()) ||
    c.email.toLowerCase().includes(buscaAsaas.toLowerCase()) ||
    c.cpfCnpj.includes(buscaAsaas)
  );

  const clientesLinkados = clientes.filter(c => c.asaasCustomerId);
  const clientesNaoLinkados = clientes.filter(c => !c.asaasCustomerId);

  return (
    <div className="linkar-clientes-asaas">
      <Card title="Linkar Clientes com Asaas">
        {erro && (
          <div className="error-message">
            {erro}
            <button onClick={() => setErro('')}>✕</button>
          </div>
        )}

        <div className="linkar-stats">
          <div className="stat-item">
            <span className="stat-label">Total de Clientes:</span>
            <span className="stat-value">{clientes.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Linkados:</span>
            <span className="stat-value success">{clientesLinkados.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Não Linkados:</span>
            <span className="stat-value warning">{clientesNaoLinkados.length}</span>
          </div>
          <button
            className="btn-atualizar-contatos"
            onClick={handleAtualizarTodosContatos}
            disabled={carregando}
          >
            {carregando ? 'Atualizando...' : 'Atualizar contatos'}
          </button>
        </div>

        {clientesLinkados.length > 0 && (
          <div className="clientes-linkados">
            <h3>Clientes Linkados</h3>
            <div className="clientes-list">
              {clientesLinkados.map(cliente => {
                const asaasCliente = clientesAsaas.find(c => c.id === cliente.asaasCustomerId);
                return (
                  <div key={cliente.id} className="cliente-item linked">
                    <div className="cliente-info">
                      <strong>{cliente.nome}</strong>
                      <span>{cliente.email}</span>
                      {asaasCliente && (
                        <span className="asaas-info">
                          Asaas: {asaasCliente.name} ({asaasCliente.email})
                        </span>
                      )}
                      {cliente.assinatura && (
                        <span className="assinatura-value">
                          Assinatura: {maskValue(formatCurrency(cliente.assinatura))}
                        </span>
                      )}
                    </div>
                    <div className="cliente-actions">
                      <button
                        className="btn-pagamentos"
                        onClick={() => abrirPagamentosCliente(cliente)}
                      >
                        💳 Pagamentos
                      </button>
                      <button
                        className="btn-deslinkar"
                        onClick={() => handleDeslinkar(cliente)}
                      >
                        ✕ Deslinkar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="clientes-nao-linkados">
          <h3>Clientes Não Linkados</h3>
          {clientesNaoLinkados.length === 0 ? (
            <p className="empty-message">Todos os clientes estão linkados! 🎉</p>
          ) : (
            <div className="clientes-list">
              {clientesNaoLinkados.map(cliente => (
                <div key={cliente.id} className="cliente-item">
                  <div className="cliente-info">
                    <strong>{cliente.nome}</strong>
                    <span>{cliente.email}</span>
                    {cliente.assinatura && (
                      <span className="assinatura-value">
                        Assinatura: {maskValue(formatCurrency(cliente.assinatura))}
                      </span>
                    )}
                  </div>
                  <button
                    className="btn-linkar"
                    onClick={() => handleAbrirModalLinkar(cliente)}
                  >
                    🔗 Linkar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={mostrarModalLinkar}
        onClose={() => {
          setMostrarModalLinkar(false);
          setClienteSelecionado(null);
          setAsaasClienteSelecionado(null);
        }}
        title={`Linkar Cliente: ${clienteSelecionado?.nome}`}
        size="large"
      >
        <div className="modal-linkar-content">
          <div className="cliente-info-section">
            <h4>Cliente Interno</h4>
            <div className="info-box">
              <p><strong>Nome:</strong> {clienteSelecionado?.nome}</p>
              <p><strong>Email:</strong> {clienteSelecionado?.email}</p>
              <p><strong>Assinatura:</strong> {clienteSelecionado?.assinatura ? maskValue(formatCurrency(clienteSelecionado.assinatura)) : 'Não definida'}</p>
            </div>
          </div>

          <div className="busca-asaas-section">
            <h4>Buscar Cliente no Asaas</h4>
            <input
              type="text"
              placeholder="Buscar por nome, email ou CPF/CNPJ..."
              value={buscaAsaas}
              onChange={(e) => setBuscaAsaas(e.target.value)}
              className="busca-input"
            />
          </div>

          <div className="clientes-asaas-list">
            {carregando ? (
              <p>Carregando...</p>
            ) : clientesFiltrados.length === 0 ? (
              <p className="empty-message">Nenhum cliente encontrado no Asaas</p>
            ) : (
              clientesFiltrados.map(asaasCliente => (
                <div
                  key={asaasCliente.id}
                  className={`asaas-cliente-item ${asaasClienteSelecionado?.id === asaasCliente.id ? 'selected' : ''}`}
                  onClick={() => handleSelecionarAsaasCliente(asaasCliente)}
                >
                  <div>
                    <strong>{asaasCliente.name}</strong>
                    <p>{asaasCliente.email}</p>
                    <p className="cpf-cnpj">{asaasCliente.cpfCnpj}</p>
                  </div>
                  {asaasClienteSelecionado?.id === asaasCliente.id && (
                    <span className="check-mark">✓</span>
                  )}
                </div>
              ))
            )}
          </div>

          {asaasClienteSelecionado && (
            <div className="subscriptions-section">
              <h4>Assinaturas do Cliente no Asaas</h4>
              {subscriptions.length === 0 ? (
                <div className="no-subscription">
                  <p>Nenhuma assinatura encontrada para este cliente.</p>
                </div>
              ) : (
                <div className="subscriptions-list">
                  {subscriptions.map(sub => (
                    <div
                      key={sub.id}
                      className={`subscription-item ${subscriptionSelecionada?.id === sub.id ? 'selected' : ''}`}
                    >
                      <div
                        onClick={() => {
                          setSubscriptionSelecionada(sub);
                          setAtualizandoSubscription(false);
                          setSubscriptionParaAtualizar(null);
                        }}
                        style={{ flex: 1, cursor: 'pointer' }}
                      >
                        <strong>{sub.description || 'Assinatura'}</strong>
                        <p>Valor: {maskValue(formatCurrency(sub.value))}</p>
                        <p>Forma de Pagamento: {sub.billingType}</p>
                        <p>Status: {sub.status}</p>
                        <p>Próximo vencimento: {new Date(sub.nextDueDate).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {subscriptionSelecionada?.id === sub.id && (
                          <>
                            <span className="check-mark">✓</span>
                            <button
                              className="btn-atualizar"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubscriptionParaAtualizar(sub);
                                setAtualizandoSubscription(true);
                                setValorSubscription(sub.value);
                                setBillingType(sub.billingType);
                                setDataVencimento(sub.nextDueDate.split('T')[0]);
    setDataEnvio(new Date().toISOString().split('T')[0]);
                              }}
                            >
                              Atualizar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulário de atualização de subscription */}
              {atualizandoSubscription && subscriptionParaAtualizar && (
                <div className="atualizar-subscription-form">
                  <h4>Atualizar Assinatura</h4>
                  <div className="nova-subscription-form">
                    <label>
                      Valor da Assinatura (R$):
                      <input
                        type="number"
                        value={valorSubscription}
                        onChange={(e) => setValorSubscription(parseFloat(e.target.value) || 0)}
                        step="0.01"
                        min="0"
                      />
                    </label>
                    <label>
                      Forma de Pagamento:
                      <select
                        value={billingType}
                        onChange={(e) => setBillingType(e.target.value)}
                      >
                        <option value="BOLETO">Boleto</option>
                        <option value="CREDIT_CARD">Cartão de Crédito</option>
                        <option value="PIX">PIX</option>
                        <option value="DEBIT_CARD">Cartão de Débito</option>
                      </select>
                    </label>
                    <label>
                      Data de Vencimento:
                      <input
                        type="date"
                        value={dataVencimento}
                        onChange={(e) => setDataVencimento(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Data de Envio para o Cliente:
                      <input
                        type="date"
                        value={dataEnvio}
                        onChange={(e) => setDataEnvio(e.target.value)}
                      />
                    </label>
                    <div className="form-actions-inline">
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setAtualizandoSubscription(false);
                          setSubscriptionParaAtualizar(null);
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="btn-primary"
                        onClick={handleAtualizarSubscription}
                        disabled={carregando}
                      >
                        {carregando ? 'Atualizando...' : 'Salvar Alterações'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                setMostrarModalLinkar(false);
                setClienteSelecionado(null);
                setAsaasClienteSelecionado(null);
              }}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={handleLinkar}
              disabled={!asaasClienteSelecionado || carregando}
            >
              {carregando ? 'Linkando...' : 'Confirmar Linkagem'}
            </button>
          </div>
        </div>
      </Modal>

      {clientePagamentos && (
        <ClientePagamentosModal
          isOpen={mostrarModalPagamentos}
          onClose={fecharPagamentosCliente}
          cliente={clientePagamentos}
        />
      )}
    </div>
  );
}

