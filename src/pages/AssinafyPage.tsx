import { useEffect, useState } from 'react';
import Card from '../components/Card/Card';
import {
  AssinafyConfig,
  criarSignatario,
  enviarAssinatura,
  getAssinafyConfig,
  isAssinafyConfigured,
  listarDocumentos,
  saveAssinafyConfig,
  uploadDocumento,
} from '../services/assinafyService';
import './AssinafyPage.css';

export default function AssinafyPage() {
  const [configForm, setConfigForm] = useState<AssinafyConfig>({
    apiKey: '',
    ambiente: 'sandbox',
    accountId: '',
  });
  const [mensagem, setMensagem] = useState<string>('');
  const [erro, setErro] = useState<string>('');
  const [resultado, setResultado] = useState<any>(null);
  const [signerNome, setSignerNome] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [signerIds, setSignerIds] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nomeDocumento, setNomeDocumento] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const saved = getAssinafyConfig();
    if (saved) setConfigForm(saved);
  }, []);

  const limparMensagens = () => {
    setErro('');
    setMensagem('');
  };

  const handleSalvarConfig = () => {
    limparMensagens();
    if (!configForm.apiKey.trim() || !configForm.accountId.trim()) {
      setErro('Informe API Key e Workspace Account ID.');
      return;
    }
    saveAssinafyConfig({
      apiKey: configForm.apiKey.trim(),
      ambiente: configForm.ambiente,
      accountId: configForm.accountId.trim(),
    });
    setMensagem('Configuração salva com sucesso!');
    setTimeout(() => setMensagem(''), 2500);
  };

  const handleTestarConexao = async () => {
    limparMensagens();
    if (!isAssinafyConfigured()) {
      setErro('Configure a API Key e o Workspace Account ID antes de testar.');
      return;
    }
    setCarregando(true);
    try {
      const resposta = await listarDocumentos(configForm.accountId, { page: 1, 'per-page': 1 });
      setResultado(resposta);
      setMensagem('Conexão realizada com sucesso!');
    } catch (error: any) {
      setErro(error.message || 'Erro ao testar conexão.');
    } finally {
      setCarregando(false);
    }
  };

  const handleCriarSignatario = async () => {
    limparMensagens();
    if (!signerNome.trim() || !signerEmail.trim()) {
      setErro('Informe nome e email do signatário.');
      return;
    }
    setCarregando(true);
    try {
      const resposta = await criarSignatario(configForm.accountId, {
        full_name: signerNome.trim(),
        email: signerEmail.trim(),
      });
      setResultado(resposta);
      setMensagem('Signatário criado com sucesso!');
      if (resposta?.data?.id) {
        setSignerIds(resposta.data.id);
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao criar signatário.');
    } finally {
      setCarregando(false);
    }
  };

  const handleEnviarAssinatura = async () => {
    limparMensagens();
    if (!documentId.trim()) {
      setErro('Informe o ID do documento.');
      return;
    }
    const ids = signerIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      setErro('Informe ao menos um signer ID.');
      return;
    }
    setCarregando(true);
    try {
      const resposta = await enviarAssinatura(documentId.trim(), ids);
      setResultado(resposta);
      setMensagem('Envio para assinatura realizado!');
    } catch (error: any) {
      setErro(error.message || 'Erro ao enviar assinatura.');
    } finally {
      setCarregando(false);
    }
  };

  const handleUploadDocumento = async () => {
    limparMensagens();
    if (!arquivo) {
      setErro('Selecione um documento para enviar.');
      return;
    }
    if (!configForm.accountId.trim()) {
      setErro('Informe o Workspace Account ID.');
      return;
    }
    setCarregando(true);
    try {
      const resposta = await uploadDocumento(arquivo, configForm.accountId.trim(), nomeDocumento.trim());
      setResultado(resposta);
      setMensagem('Documento enviado com sucesso!');
      const documentoId = resposta?.data?.id || resposta?.data?.documentId || '';
      if (documentoId) {
        setDocumentId(String(documentoId));
      }
      setArquivo(null);
      setNomeDocumento('');
    } catch (error: any) {
      setErro(error.message || 'Erro ao enviar documento.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="assinafy-page">
      <div className="page-header">
        <div>
          <h1>Assinafy</h1>
          <p className="page-subtitle">Configure a API e execute testes rápidos de assinatura.</p>
        </div>
        <button className="btn-secondary" onClick={handleTestarConexao} disabled={carregando}>
          {carregando ? 'Testando...' : 'Testar conexão'}
        </button>
      </div>

      {(mensagem || erro) && (
        <div className={`assinafy-banner ${erro ? 'error' : 'success'}`}>
          {erro || mensagem}
        </div>
      )}

      <div className="assinafy-grid">
        <Card title="Configuração da API" className="assinafy-card">
          <div className="assinafy-form">
            <label>
              API Key
              <input
                type="password"
                value={configForm.apiKey}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Cole a API Key"
              />
            </label>
            <label>
              Workspace Account ID
              <input
                type="text"
                value={configForm.accountId}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, accountId: e.target.value }))}
                placeholder="Ex.: e3b0c442-..."
              />
            </label>
            <label>
              Ambiente
              <select
                value={configForm.ambiente}
                onChange={(e) =>
                  setConfigForm((prev) => ({
                    ...prev,
                    ambiente: e.target.value as AssinafyConfig['ambiente'],
                  }))
                }
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Produção</option>
              </select>
            </label>
            <button className="btn-primary" onClick={handleSalvarConfig}>
              Salvar configuração
            </button>
          </div>
          <div className="assinafy-hint">
            Dica: use a API Key e o Workspace Account ID do Assinafy para habilitar os testes.
          </div>
        </Card>

        <Card title="Testes rápidos" className="assinafy-card">
          <div className="assinafy-form">
            <label>
              Upload de documento
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              />
            </label>
            <label>
              Nome do documento (opcional)
              <input
                type="text"
                value={nomeDocumento}
                onChange={(e) => setNomeDocumento(e.target.value)}
                placeholder="Ex.: Contrato Cliente XP"
              />
            </label>
            <button className="btn-secondary" onClick={handleUploadDocumento} disabled={carregando}>
              Enviar documento
            </button>

            <label>
              Nome do signatário
              <input
                type="text"
                value={signerNome}
                onChange={(e) => setSignerNome(e.target.value)}
                placeholder="Nome completo"
              />
            </label>
            <label>
              Email do signatário
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="email@dominio.com"
              />
            </label>
            <button className="btn-secondary" onClick={handleCriarSignatario} disabled={carregando}>
              Criar signatário
            </button>

            <label>
              ID do documento
              <input
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Informe o documento do Assinafy"
              />
            </label>
            <label>
              Signer IDs (separados por vírgula)
              <input
                type="text"
                value={signerIds}
                onChange={(e) => setSignerIds(e.target.value)}
                placeholder="id1, id2"
              />
            </label>
            <button className="btn-secondary" onClick={handleEnviarAssinatura} disabled={carregando}>
              Enviar para assinatura
            </button>
          </div>
        </Card>

        <Card title="Resposta da API" className="assinafy-card assinafy-result">
          {resultado ? (
            <pre>{JSON.stringify(resultado, null, 2)}</pre>
          ) : (
            <div className="empty-state">Nenhuma resposta registrada.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
