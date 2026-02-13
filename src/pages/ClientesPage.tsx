import { useState } from 'react';
import { useClientes } from '../hooks/useClientes';
import { useEstrategias } from '../hooks/useEstrategias';
import Clientes from '../components/Clientes/Clientes';
import Modal from '../components/Modal/Modal';
import EditarClienteForm from '../components/EditarClienteForm/EditarClienteForm';
import ClientePagamentosModal from '../components/ClientePagamentosModal/ClientePagamentosModal';
import { Cliente } from '../types';
import { atualizarCobrancasPendentes, buscarSubscriptions, cancelarSubscription, criarCobranca, isAsaasConfigured } from '../services/asaasService';
import { useMoneyVisibility } from '../contexts/MoneyVisibilityContext';
import './ClientesPage.css';

export default function ClientesPage() {
  const { clientes, aplicacoes, saldos, setClientes } = useClientes();
  const { estrategias } = useEstrategias();
  const { maskValue } = useMoneyVisibility();
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [mostrarModalEdicao, setMostrarModalEdicao] = useState(false);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [clientePerformance, setClientePerformance] = useState<Cliente | null>(null);
  const [mostrarModalPerformance, setMostrarModalPerformance] = useState(false);
  const [clientePagamentos, setClientePagamentos] = useState<Cliente | null>(null);
  const [mostrarModalPagamentos, setMostrarModalPagamentos] = useState(false);
  const [tipoCobranca, setTipoCobranca] = useState<'avista' | 'parcelada'>('avista');
  const [valorPerformance, setValorPerformance] = useState('');
  const [parcelasPerformance, setParcelasPerformance] = useState('2');
  const [vencimentoPerformance, setVencimentoPerformance] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('BOLETO');
  const [descricaoPerformance, setDescricaoPerformance] = useState('Cobrança de performance trimestral');
  const [enviandoCobranca, setEnviandoCobranca] = useState(false);

  const parseValorMonetario = (valorTexto: string) => {
    if (!valorTexto) return 0;
    const normalizado = valorTexto.includes(',')
      ? valorTexto.replace(/\./g, '').replace(',', '.')
      : valorTexto;
    return Number(normalizado);
  };

  const getEstrategiaNome = (estrategiaId?: string) => {
    if (!estrategiaId) return null;
    return estrategias.find(e => e.id === estrategiaId)?.nome || null;
  };
  const criarClienteBase = (): Cliente => ({
    id: `cliente_${Date.now()}`,
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    dataCadastro: new Date().toISOString().split('T')[0],
    status: 'ativo',
    estrategiaId: undefined,
    valorTotalContratos: 0,
    btg: 0,
    xp: 0,
    avenue: 0,
    outros: 0,
    taxaAdmAnual: 0,
    taxaAdmMensal: 0,
    assinatura: 0,
    patrimonioTotal: 0,
  });


  const handleEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setCriandoNovo(false);
    setMostrarModalEdicao(true);
  };

  const handleCriarNovo = () => {
    setClienteEditando(criarClienteBase());
    setCriandoNovo(true);
    setMostrarModalEdicao(true);
  };

  const handleSalvarEdicao = async (clienteAtualizado: Cliente) => {
    const existe = clientes.some(c => c.id === clienteAtualizado.id);
    // Verificar se a assinatura mudou e se o cliente está linkado ao Asaas
    const clienteOriginal = clientes.find(c => c.id === clienteAtualizado.id);
    const assinaturaMudou = clienteOriginal?.assinatura !== clienteAtualizado.assinatura;
    const temAsaasCustomerId = clienteAtualizado.asaasCustomerId;
    const asaasConfigurado = isAsaasConfigured();
    const statusMudouParaInativo = !!clienteOriginal &&
      clienteOriginal.status !== 'inativo' &&
      clienteAtualizado.status === 'inativo';

    let clienteParaSalvar = {
      ...clienteAtualizado,
      dataCadastro:
        clienteAtualizado.dataCadastro ||
        clienteOriginal?.dataCadastro ||
        new Date().toISOString().split('T')[0],
    };

    if (statusMudouParaInativo && temAsaasCustomerId && !asaasConfigurado) {
      alert('Cliente salvo, mas a API do Asaas não está configurada. Não foi possível cancelar a assinatura.');
    }

    if (statusMudouParaInativo && temAsaasCustomerId && asaasConfigurado) {
      try {
        let subscriptionId = clienteAtualizado.asaasSubscriptionId;
        if (!subscriptionId) {
          const respostaSubscriptions = await buscarSubscriptions({ customer: clienteAtualizado.asaasCustomerId, limit: 100 });
          const lista = respostaSubscriptions.data || [];
          const ativa = lista.find(sub => sub.status === 'ACTIVE');
          const selecionada = ativa || lista[0];
          if (selecionada) {
            subscriptionId = selecionada.id;
            if (!clienteParaSalvar.asaasSubscriptionId) {
              clienteParaSalvar = {
                ...clienteParaSalvar,
                asaasSubscriptionId: subscriptionId,
              };
            }
          }
        }

        if (subscriptionId) {
          await cancelarSubscription(subscriptionId);
        } else {
          alert('Cliente salvo, mas nenhuma assinatura foi encontrada no Asaas para cancelar.');
        }
      } catch (error: any) {
        const mensagemErro =
          error?.message ||
          'Erro ao cancelar assinatura no Asaas. Verifique se o cliente possui assinatura ativa e se a API está configurada.';
        alert(`Cliente salvo, mas houve um erro ao cancelar a assinatura no Asaas: ${mensagemErro}`);
      }
    }

    // Se a assinatura mudou, o cliente está linkado e o Asaas está configurado, atualizar cobranças pendentes no Asaas
    if (existe && assinaturaMudou && temAsaasCustomerId && asaasConfigurado && clienteAtualizado.assinatura) {
      try {
        const resultado = await atualizarCobrancasPendentes(
          temAsaasCustomerId,
          clienteAtualizado.asaasSubscriptionId,
          clienteAtualizado.assinatura
        );
        
        if (resultado.subscriptionId && !clienteAtualizado.asaasSubscriptionId) {
          clienteParaSalvar = {
            ...clienteAtualizado,
            asaasSubscriptionId: resultado.subscriptionId,
          };
        }

        if (resultado.atualizadas > 0) {
          console.log(`✅ ${resultado.atualizadas} cobrança(s) atualizada(s) no Asaas com sucesso`);
          if (resultado.erros > 0) {
            alert(`${resultado.atualizadas} cobrança(s) atualizada(s), mas ${resultado.erros} falharam.`);
          }
        } else if (resultado.erros > 0) {
          throw new Error(`Nenhuma cobrança foi atualizada. ${resultado.erros} erro(s) ocorreram.`);
        } else {
          console.log('ℹ️ Nenhuma cobrança pendente encontrada para atualizar');
        }
      } catch (error: any) {
        console.error('❌ Erro ao atualizar cobranças no Asaas:', error);
        const mensagemErro =
          error?.message ||
          'Erro ao atualizar cobranças no Asaas. Verifique se o cliente possui assinatura ativa e se a API está configurada.';
        // Continuar salvando mesmo se falhar a atualização no Asaas
        alert(`Cliente salvo, mas houve um erro ao atualizar as cobranças no Asaas: ${mensagemErro}`);
      }
    }

    const clientesAtualizados = existe
      ? clientes.map(c => (c.id === clienteAtualizado.id ? clienteParaSalvar : c))
      : [clienteParaSalvar, ...clientes];
    setClientes(clientesAtualizados);
    setMostrarModalEdicao(false);
    setClienteEditando(null);
    setCriandoNovo(false);
  };

  const handleCancelarEdicao = () => {
    setMostrarModalEdicao(false);
    setClienteEditando(null);
    setCriandoNovo(false);
  };

  const handleExcluir = (cliente: Cliente) => {
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o cliente "${cliente.nome}"?\n\nEsta ação não pode ser desfeita.`
    );

    if (confirmar) {
      const clientesAtualizados = clientes.filter(c => c.id !== cliente.id);
      setClientes(clientesAtualizados);
    }
  };

  const abrirCobrancaPerformance = (cliente: Cliente) => {
    setClientePerformance(cliente);
    setTipoCobranca('avista');
    setValorPerformance('');
    setParcelasPerformance('2');
    setVencimentoPerformance('');
    setFormaPagamento('BOLETO');
    setDescricaoPerformance('Cobrança de performance trimestral');
    setMostrarModalPerformance(true);
  };

  const fecharCobrancaPerformance = () => {
    setMostrarModalPerformance(false);
    setClientePerformance(null);
    setEnviandoCobranca(false);
  };

  const abrirPagamentosCliente = (cliente: Cliente) => {
    setClientePagamentos(cliente);
    setMostrarModalPagamentos(true);
  };

  const fecharPagamentosCliente = () => {
    setMostrarModalPagamentos(false);
    setClientePagamentos(null);
  };

  const handleEmitirCobrancaPerformance = async () => {
    if (!clientePerformance) return;

    if (!isAsaasConfigured()) {
      alert('Configure a API do Asaas antes de emitir cobranças.');
      return;
    }

    if (!clientePerformance.asaasCustomerId) {
      alert('Este cliente ainda não está vinculado ao Asaas.');
      return;
    }

    const valor = parseValorMonetario(valorPerformance);
    if (!valor || valor <= 0) {
      alert('Informe um valor válido para a cobrança.');
      return;
    }

    if (!vencimentoPerformance) {
      alert('Informe a data de vencimento.');
      return;
    }

    let installmentCount: number | undefined;
    let installmentValue: number | undefined;
    if (tipoCobranca === 'parcelada') {
      const parcelas = Number(parcelasPerformance);
      if (!parcelas || parcelas < 2) {
        alert('Informe um número de parcelas válido (mínimo 2).');
        return;
      }
      installmentCount = parcelas;
      installmentValue = Number((valor / parcelas).toFixed(2));
    }

    setEnviandoCobranca(true);
    try {
      const cobranca = await criarCobranca({
        customer: clientePerformance.asaasCustomerId,
        billingType: formaPagamento,
        value: valor,
        dueDate: vencimentoPerformance,
        description: descricaoPerformance || 'Cobrança de performance trimestral',
        installmentCount,
        installmentValue,
      });

      const links = [cobranca.invoiceUrl, cobranca.bankSlipUrl]
        .filter(Boolean)
        .join('\n');

      alert(
        links
          ? `Cobrança criada com sucesso!\n\nLinks:\n${links}`
          : 'Cobrança criada com sucesso!'
      );
      fecharCobrancaPerformance();
    } catch (error: any) {
      console.error('Erro ao criar cobrança de performance:', error);
      alert(`Erro ao criar cobrança: ${error.message}`);
      setEnviandoCobranca(false);
    }
  };

  const valorParcelaPreview = (() => {
    if (tipoCobranca !== 'parcelada') return null;
    const valor = parseValorMonetario(valorPerformance);
    const parcelas = Number(parcelasPerformance);
    if (!valor || !parcelas) return null;
    return maskValue(formatCurrency(valor / parcelas));
  })();

  return (
    <div className="clientes-page">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Clientes</h1>
          <p className="page-subtitle">Gestão completa de clientes e seus patrimônios</p>
        </div>
        <button className="btn-novo-cliente" onClick={handleCriarNovo}>
          + Novo Cliente
        </button>
      </div>

      <div className="clientes-content">
        <Clientes 
          clientes={clientes} 
          onEdit={handleEditar}
          onDelete={handleExcluir}
        />
      </div>

      {clienteEditando && (
        <Modal
          isOpen={mostrarModalEdicao}
          onClose={handleCancelarEdicao}
          title={criandoNovo ? 'Novo Cliente' : 'Editar Cliente'}
          size="large"
        >
          <EditarClienteForm
            cliente={clienteEditando}
            onSave={handleSalvarEdicao}
            onCancel={handleCancelarEdicao}
          />
        </Modal>
      )}

      {clientePerformance && (
        <Modal
          isOpen={mostrarModalPerformance}
          onClose={fecharCobrancaPerformance}
          title={`Cobrança de performance - ${clientePerformance.nome}`}
          size="medium"
        >
          <div className="performance-form">
            <div className="form-row">
              <label className="form-label">Tipo de cobrança</label>
              <select
                value={tipoCobranca}
                onChange={(e) => setTipoCobranca(e.target.value as 'avista' | 'parcelada')}
                className="form-input"
              >
                <option value="avista">À vista</option>
                <option value="parcelada">Parcelada</option>
              </select>
            </div>

            <div className="form-row">
              <label className="form-label">Valor total</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={valorPerformance}
                onChange={(e) => setValorPerformance(e.target.value)}
                className="form-input"
                placeholder="0,00"
              />
            </div>

            {tipoCobranca === 'parcelada' && (
              <div className="form-row">
                <label className="form-label">Parcelas</label>
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={parcelasPerformance}
                  onChange={(e) => setParcelasPerformance(e.target.value)}
                  className="form-input"
                />
                {valorParcelaPreview && (
                  <span className="form-helper">
                    Valor da parcela: {valorParcelaPreview}
                  </span>
                )}
              </div>
            )}

            <div className="form-row">
              <label className="form-label">Vencimento</label>
              <input
                type="date"
                value={vencimentoPerformance}
                onChange={(e) => setVencimentoPerformance(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-row">
              <label className="form-label">Forma de pagamento</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="form-input"
              >
                <option value="BOLETO">Boleto</option>
                <option value="PIX">Pix</option>
                <option value="CREDIT_CARD">Cartão</option>
              </select>
            </div>

            <div className="form-row">
              <label className="form-label">Descrição</label>
              <input
                type="text"
                value={descricaoPerformance}
                onChange={(e) => setDescricaoPerformance(e.target.value)}
                className="form-input"
                placeholder="Ex.: Performance trimestral"
              />
            </div>

            <button
              className="performance-submit-btn"
              onClick={handleEmitirCobrancaPerformance}
              disabled={enviandoCobranca}
            >
              {enviandoCobranca ? 'Enviando...' : 'Emitir cobrança'}
            </button>
          </div>
        </Modal>
      )}

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

