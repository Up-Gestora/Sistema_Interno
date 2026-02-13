import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import ClientesPage from './pages/ClientesPage';
import RelatoriosMensaisPage from './pages/RelatoriosMensais/RelatoriosMensaisPage';
import PerformancePage from './pages/PerformanceTrimestral/PerformancePage';
import ImportacaoPlanilhaPage from './pages/ImportacaoPlanilha/ImportacaoPlanilhaPage';
import EstrategiasPage from './pages/EstrategiasPage';
import AsaasPage from './pages/AsaasPage';
import FinanceiroContasPage from './pages/Asaas/FinanceiroContasPage';
import FinanceiroPagamentosPage from './pages/Asaas/FinanceiroPagamentosPage';
import LaminasPage from './pages/LaminasPage';
import EstrategiaDiariaPage from './pages/EstrategiaDiaria/EstrategiaDiariaPage';
import LinksUteisPage from './pages/LinksUteis/LinksUteisPage';
import AssinafyPage from './pages/AssinafyPage';
import VentureCapitalPage from './pages/VentureCapitalPage';
import { useClientes } from './hooks/useClientes';

function App() {
  const { clientes, aplicacoes, saldos } = useClientes();

  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              clientes={clientes}
              aplicacoes={aplicacoes}
              saldos={saldos}
            />
          }
        />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/estrategias" element={<EstrategiasPage />} />
        <Route path="/private" element={<VentureCapitalPage />} />
        <Route path="/venture-capital" element={<VentureCapitalPage />} />
        <Route path="/relatorios-mensais" element={<RelatoriosMensaisPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/laminas" element={<LaminasPage />} />
        <Route path="/estrategia-diaria" element={<EstrategiaDiariaPage />} />
        <Route path="/importacao-planilha" element={<ImportacaoPlanilhaPage />} />
        <Route path="/links-uteis" element={<LinksUteisPage />} />
        <Route path="/assinafy" element={<AssinafyPage />} />
        <Route path="/asaas" element={<AsaasPage />}>
          <Route path="contas" element={<FinanceiroContasPage />} />
          <Route path="pagamentos" element={<FinanceiroPagamentosPage />} />
        </Route>
      </Routes>
    </Layout>
  );
}

export default App;
