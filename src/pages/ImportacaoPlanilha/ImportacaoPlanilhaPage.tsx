import { useState } from 'react';
import { exportarClientesParaExcel, exportarTemplateExcel, importarExcelParaClientes } from '../../services/planilhaService';
import { gerarDashboardClientesPDF } from '../../services/pdfGenerator';
import { useClientes } from '../../hooks/useClientes';
import { useEstrategias } from '../../hooks/useEstrategias';
import Card from '../../components/Card/Card';
import './ImportacaoPlanilhaPage.css';

export default function ImportacaoPlanilhaPage() {
  const { clientes, setClientes } = useClientes();
  const { estrategias } = useEstrategias();
  const [importando, setImportando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [sucesso, setSucesso] = useState<string>('');

  const handleExportar = () => {
    try {
      exportarClientesParaExcel(clientes);
      setSucesso('Planilha com dados exportada com sucesso!');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      alert('Erro ao exportar planilha: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleExportarTemplate = () => {
    try {
      exportarTemplateExcel();
      setSucesso('Template vazio exportado com sucesso!');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      alert('Erro ao exportar template: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleExportarPdf = async () => {
    try {
      const estrategiaMap = estrategias.reduce<Record<string, string>>((acc, estrategia) => {
        acc[estrategia.id] = estrategia.nome;
        return acc;
      }, {});
      await gerarDashboardClientesPDF(clientes, {
        titulo: 'Dados de Clientes',
        nomeArquivo: `dados_clientes_${new Date().toISOString().split('T')[0]}.pdf`,
        estrategiaMap,
      });
      setSucesso('PDF com dados exportado com sucesso!');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      alert('Erro ao exportar PDF: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleImportar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    // Validar extensão
    if (!arquivo.name.endsWith('.xlsx') && !arquivo.name.endsWith('.xls')) {
      alert('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    setImportando(true);
    setErros([]);
    setSucesso('');

    try {
      const resultado = await importarExcelParaClientes(arquivo, clientes);
      
      console.log('Clientes importados:', resultado.clientes);
      console.log('Total de clientes:', resultado.clientes.length);
      
      // Atualizar clientes usando setClientes do hook (que já salva no localStorage)
      // Criar uma nova referência do array para garantir que o React detecte a mudança
      const clientesAtualizados = [...resultado.clientes];
      setClientes(clientesAtualizados);
      
      // Verificar se foi salvo no localStorage
      const verificarSalvamento = () => {
        const salvo = localStorage.getItem('clientes');
        if (salvo) {
          const clientesSalvos = JSON.parse(salvo);
          console.log('Dados salvos no localStorage:', clientesSalvos.length, 'clientes');
          if (clientesSalvos.length !== clientesAtualizados.length) {
            console.warn('Aviso: Número de clientes no localStorage não corresponde ao esperado');
            // Tentar salvar novamente
            localStorage.setItem('clientes', JSON.stringify(clientesAtualizados));
          }
        } else {
          console.error('Erro: Dados não foram salvos no localStorage!');
          // Tentar salvar novamente
          localStorage.setItem('clientes', JSON.stringify(clientesAtualizados));
        }
      };
      
      // Verificar após um pequeno delay para garantir que o setClientes foi executado
      setTimeout(() => {
        verificarSalvamento();
        // Disparar evento para sincronizar outras instâncias
        window.dispatchEvent(new Event('clientes-updated'));
      }, 200);
      
      if (resultado.erros.length > 0) {
        setErros(resultado.erros);
        alert(`Importação concluída com ${resultado.erros.length} erro(s). Verifique os detalhes abaixo.`);
      } else {
        setSucesso(`Importação concluída com sucesso! ${resultado.clientes.length} cliente(s) processado(s). Os dados foram salvos no sistema.`);
        setTimeout(() => setSucesso(''), 5000);
      }
    } catch (error) {
      alert('Erro ao importar planilha: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setImportando(false);
      // Limpar input para permitir importar o mesmo arquivo novamente
      event.target.value = '';
    }
  };

  return (
    <div className="importacao-planilha-page">
      <div className="page-header">
        <h1>Dados</h1>
        <p className="page-subtitle">
          Exporte os dados dos clientes ou importe uma planilha atualizada
        </p>
      </div>

      <div className="planilha-actions">
        <Card title="Exportar Template Vazio" className="action-card">
          <p className="card-description">
            Baixe um template Excel (.xlsx) vazio com apenas os cabeçalhos. 
            Preencha com os dados da sua planilha e importe de volta.
          </p>
          <button 
            onClick={handleExportarTemplate} 
            className="btn-export btn-template"
          >
            📋 Baixar Template Excel
          </button>
        </Card>

        <Card title="Exportar Dados Existentes" className="action-card">
          <p className="card-description">
            Baixe uma planilha Excel (.xlsx) com todos os dados dos clientes cadastrados. 
            Você pode editar no Excel e importar de volta.
          </p>
          <button 
            onClick={handleExportar} 
            className="btn-export"
            disabled={clientes.length === 0}
          >
            📥 Exportar Excel com Dados
          </button>
        </Card>

        <Card title="Exportar Dados em PDF" className="action-card">
          <p className="card-description">
            Gere um PDF simples com a situação dos clientes para apresentar a parceiros.
          </p>
          <button
            onClick={handleExportarPdf}
            className="btn-export"
            disabled={clientes.length === 0}
          >
            🧾 Exportar PDF com Dados
          </button>
        </Card>

        {sucesso && (
          <div className="success-banner">
            <p className="success-message">{sucesso}</p>
          </div>
        )}

        <Card title="Importar Planilha" className="action-card">
          <p className="card-description">
            Selecione um arquivo Excel (.xlsx ou .xls) para atualizar os dados dos clientes.
            Clientes existentes serão atualizados e novos serão criados.
          </p>
          <div className="import-section">
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportar}
              disabled={importando}
              className="file-input"
            />
            <label htmlFor="file-input" className="file-input-label">
              {importando ? '⏳ Importando...' : '📤 Selecionar Arquivo Excel'}
            </label>
          </div>
          {importando && (
            <div className="loading-message">
              <div className="spinner"></div>
              <p>Processando arquivo...</p>
            </div>
          )}
        </Card>
      </div>

      {erros.length > 0 && (
        <Card title="Erros na Importação" className="errors-card">
          <div className="errors-list">
            {erros.map((erro, index) => (
              <div key={index} className="error-item">
                ⚠️ {erro}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Instruções" className="instructions-card">
        <div className="instructions-content">
          <h3>Formato da Planilha</h3>
          <p>A planilha deve conter as seguintes colunas (nesta ordem):</p>
          <ul>
            <li><strong>Status:</strong> ativo, inativo, antecipado (OK sera tratado como ativo)</li>
            <li><strong>Cliente:</strong> Nome do cliente</li>
            <li><strong>BTG:</strong> Valor em R$ (ex: R$ 1.000.000,00 ou 1000000)</li>
            <li><strong>XP:</strong> Valor em R$</li>
            <li><strong>Avenue:</strong> Valor em R$</li>
            <li><strong>Outros:</strong> Valor em R$</li>
            <li><strong>TX Adm Anual:</strong> Percentual (ex: 0,60%) ou "FIXO"</li>
            <li><strong>TX Adm Mensal:</strong> Percentual (ex: 0,05%) ou "FIXO"</li>
            <li><strong>Assinatura:</strong> Valor em R$</li>
            <li><strong>PL Total:</strong> Valor em R$</li>
          </ul>
          
          <h3>Como usar:</h3>
          <ol>
            <li><strong>Opção 1 - Template Vazio:</strong> Clique em "Baixar Template Excel" para obter um arquivo vazio com os cabeçalhos</li>
            <li><strong>Opção 2 - Dados Existentes:</strong> Clique em "Exportar Excel com Dados" para baixar os clientes já cadastrados</li>
            <li>Abra o arquivo no Excel ou Google Sheets</li>
            <li>Preencha ou edite os dados conforme necessário (os cabeçalhos permanecerão formatados)</li>
            <li>Salve o arquivo no formato Excel (.xlsx)</li>
            <li>Clique em "Selecionar Arquivo Excel" e escolha o arquivo preenchido/editado</li>
            <li>O sistema atualizará os clientes existentes (identificados pelo nome) e criará novos se necessário</li>
          </ol>

          <div className="warning-box">
            <strong>⚠️ Atenção:</strong> Clientes são identificados pelo nome. 
            Se o nome mudar, será criado um novo cliente.
          </div>
        </div>
      </Card>
    </div>
  );
}
