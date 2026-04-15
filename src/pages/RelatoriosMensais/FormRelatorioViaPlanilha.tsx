import { ChangeEvent, useEffect, useState } from 'react';
import { Cliente } from '../../types';
import { CamposCompartilhadosProducaoRelatorio, RelatorioMensal } from '../../types/relatorio';
import YearSelect from '../../components/YearSelect/YearSelect';
import Card from '../../components/Card/Card';
import { buscarCDI } from '../../services/cdiIfixService';
import {
  exportarTemplateRelatorioMensal,
  importarPlanilhaRelatorioMensal,
  PlanilhaRelatorioMensalLinha,
} from '../../services/relatorioMensalPlanilhaService';
import { formatDecimalInput, parseDecimalInput } from '../../utils/numberInput';
import './FormRelatorioViaPlanilha.css';

interface FormRelatorioViaPlanilhaProps {
  clientes: Cliente[];
  onGerarPDFs: (relatorios: RelatorioMensal[]) => void;
  camposCompartilhados: CamposCompartilhadosProducaoRelatorio;
  onCamposCompartilhadosChange: (campos: Partial<CamposCompartilhadosProducaoRelatorio>) => void;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function FormRelatorioViaPlanilha({
  clientes,
  onGerarPDFs,
  camposCompartilhados,
  onCamposCompartilhadosChange,
}: FormRelatorioViaPlanilhaProps) {
  const [linhasImportadas, setLinhasImportadas] = useState<PlanilhaRelatorioMensalLinha[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [linhasIgnoradas, setLinhasIgnoradas] = useState(0);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [avisosImportacao, setAvisosImportacao] = useState<string[]>([]);
  const [importandoPlanilha, setImportandoPlanilha] = useState(false);
  const [carregandoCDI, setCarregandoCDI] = useState(false);
  const [erroCDI, setErroCDI] = useState('');

  const anosDisponiveis = Array.from({ length: 81 }, (_, index) => 2020 + index);

  const formatDateIso = (date: Date) => {
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  useEffect(() => {
    const carregarCDIMensal = async () => {
      if (!camposCompartilhados.mes || !camposCompartilhados.ano) return;
      if (camposCompartilhados.cdiMensal.trim()) return;

      setCarregandoCDI(true);
      setErroCDI('');

      try {
        const dataInicio = new Date(camposCompartilhados.ano, camposCompartilhados.mes - 1, 1);
        const dataFim = new Date(camposCompartilhados.ano, camposCompartilhados.mes, 0);
        const cdiMensal = await buscarCDI(formatDateIso(dataInicio), formatDateIso(dataFim));

        if (cdiMensal !== null) {
          onCamposCompartilhadosChange({ cdiMensal: formatDecimalInput(cdiMensal) });
        } else {
          setErroCDI('CDI nao encontrado para o periodo selecionado. Preencha manualmente.');
        }
      } catch (error) {
        console.error('Erro ao buscar CDI mensal para via planilha:', error);
        setErroCDI('Erro ao buscar CDI. Preencha manualmente.');
      } finally {
        setCarregandoCDI(false);
      }
    };

    const timer = setTimeout(carregarCDIMensal, 500);
    return () => clearTimeout(timer);
  }, [
    camposCompartilhados.mes,
    camposCompartilhados.ano,
    camposCompartilhados.cdiMensal,
    onCamposCompartilhadosChange,
  ]);

  const handleBaixarTemplate = () => {
    if (clientes.length === 0) {
      alert('Nao existem clientes cadastrados para montar o template.');
      return;
    }

    exportarTemplateRelatorioMensal(clientes);
  };

  const handleImportarPlanilha = async (event: ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    const extensaoValida = arquivo.name.endsWith('.xlsx') || arquivo.name.endsWith('.xls');
    if (!extensaoValida) {
      alert('Selecione um arquivo Excel (.xlsx ou .xls).');
      event.target.value = '';
      return;
    }

    setImportandoPlanilha(true);
    setErrosImportacao([]);
    setAvisosImportacao([]);

    try {
      const resultado = await importarPlanilhaRelatorioMensal(arquivo, clientes);

      setNomeArquivo(arquivo.name);
      setLinhasImportadas(resultado.linhas);
      setLinhasIgnoradas(resultado.linhasIgnoradas);
      setErrosImportacao(resultado.erros);
      setAvisosImportacao(resultado.avisos);

      if (resultado.linhas.length === 0) {
        alert('Nenhuma linha valida foi encontrada para gerar relatorios.');
        return;
      }

      const resumoMensagens = [
        `${resultado.linhas.length} cliente(s) com dados validos.`,
      ];
      if (resultado.linhasIgnoradas > 0) {
        resumoMensagens.push(`${resultado.linhasIgnoradas} linha(s) sem dados foram ignoradas.`);
      }
      if (resultado.erros.length > 0) {
        resumoMensagens.push(`${resultado.erros.length} erro(s) encontrados.`);
      }
      if (resultado.avisos.length > 0) {
        resumoMensagens.push(`${resultado.avisos.length} aviso(s) encontrados.`);
      }

      alert(resumoMensagens.join('\n'));
    } catch (error) {
      console.error('Erro ao importar planilha de relatorios:', error);
      alert(error instanceof Error ? error.message : 'Nao foi possivel importar a planilha.');
    } finally {
      setImportandoPlanilha(false);
      event.target.value = '';
    }
  };

  const handleGerarRelatorios = (event: React.FormEvent) => {
    event.preventDefault();

    if (!camposCompartilhados.resumoMacro.trim()) {
      alert('Preencha o resumo macro.');
      return;
    }
    if (!camposCompartilhados.textoAcimaCDI.trim() || !camposCompartilhados.textoAbaixoCDI.trim()) {
      alert('Preencha os textos de comparacao acima e abaixo do CDI.');
      return;
    }

    if (linhasImportadas.length === 0) {
      alert('Importe uma planilha com ao menos um cliente preenchido.');
      return;
    }

    const cdiMensal = parseDecimalInput(camposCompartilhados.cdiMensal);

    const relatorios: RelatorioMensal[] = linhasImportadas.map((linha) => ({
      ...(linha.resultadoPercentual > cdiMensal
        ? { resumoTexto: camposCompartilhados.textoAcimaCDI }
        : { resumoTexto: camposCompartilhados.textoAbaixoCDI }),
      clienteId: linha.clienteId,
      clienteNome: linha.clienteNome,
      mes: camposCompartilhados.mes,
      ano: camposCompartilhados.ano,
      resumoMacro: camposCompartilhados.resumoMacro,
      patrimonioTotal: linha.patrimonioTotal,
      resultadoMes: linha.resultadoMes,
      resultadoPercentual: linha.resultadoPercentual,
      cdiMensal,
      textoAcimaCDI: camposCompartilhados.textoAcimaCDI,
      textoAbaixoCDI: camposCompartilhados.textoAbaixoCDI,
      estrategias: [{
        titulo: 'Carteira UP',
        patrimonioTotal: linha.patrimonioTotal,
        resultadoMes: linha.resultadoMes,
        resultadoPercentual: linha.resultadoPercentual,
        resumoTexto: linha.resultadoPercentual > cdiMensal
          ? camposCompartilhados.textoAcimaCDI
          : camposCompartilhados.textoAbaixoCDI,
      }],
      dataGeracao: new Date().toISOString(),
    }));

    onGerarPDFs(relatorios);
  };

  return (
    <Card title="Geracao de Relatorios Via Planilha" className="form-relatorio-planilha">
      <form onSubmit={handleGerarRelatorios} className="relatorio-planilha-form">
        <div className="planilha-section">
          <h3>Periodo e Resumos Padrao</h3>

          <div className="planilha-form-row">
            <div className="planilha-form-group">
              <label htmlFor="planilha-mes">Mes *</label>
              <select
                id="planilha-mes"
                value={camposCompartilhados.mes}
                onChange={(e) => onCamposCompartilhadosChange({
                  mes: Number(e.target.value),
                  cdiMensal: '',
                })}
                required
              >
                {MESES.map((mes, index) => (
                  <option key={mes} value={index + 1}>
                    {mes}
                  </option>
                ))}
              </select>
            </div>

            <div className="planilha-form-group">
              <label htmlFor="planilha-ano">Ano *</label>
              <YearSelect
                id="planilha-ano"
                value={Number(camposCompartilhados.ano) || new Date().getFullYear()}
                years={anosDisponiveis}
                onChange={(ano) => onCamposCompartilhadosChange({
                  ano,
                  cdiMensal: '',
                })}
              />
            </div>
          </div>

          <div className="planilha-form-group">
            <label htmlFor="planilha-resumo-macro">Resumo Macro (Padrao para todos) *</label>
            <textarea
              id="planilha-resumo-macro"
              value={camposCompartilhados.resumoMacro}
              onChange={(e) => onCamposCompartilhadosChange({ resumoMacro: e.target.value })}
              rows={4}
              placeholder="Digite o resumo macro para todos os clientes..."
              required
            />
          </div>

          <div className="planilha-form-row">
            <div className="planilha-form-group">
              <label htmlFor="planilha-cdi">
                CDI Mensal (%)
                {carregandoCDI && <span className="loading-indicator">Carregando...</span>}
              </label>
              <input
                id="planilha-cdi"
                type="text"
                inputMode="decimal"
                value={camposCompartilhados.cdiMensal}
                onChange={(e) => onCamposCompartilhadosChange({ cdiMensal: e.target.value })}
                placeholder="Sera preenchido automaticamente"
                disabled={carregandoCDI}
              />
              {erroCDI && <p className="error-message">{erroCDI}</p>}
            </div>
          </div>

          <div className="planilha-form-group">
            <label htmlFor="planilha-texto-acima-cdi">Texto quando Resultado maior que CDI *</label>
            <textarea
              id="planilha-texto-acima-cdi"
              value={camposCompartilhados.textoAcimaCDI}
              onChange={(e) => onCamposCompartilhadosChange({ textoAcimaCDI: e.target.value })}
              rows={4}
              placeholder="Texto que sera usado quando o resultado do mes for superior ao CDI..."
              required
            />
          </div>

          <div className="planilha-form-group">
            <label htmlFor="planilha-texto-abaixo-cdi">Texto quando Resultado menor ou igual ao CDI *</label>
            <textarea
              id="planilha-texto-abaixo-cdi"
              value={camposCompartilhados.textoAbaixoCDI}
              onChange={(e) => onCamposCompartilhadosChange({ textoAbaixoCDI: e.target.value })}
              rows={4}
              placeholder="Texto que sera usado quando o resultado do mes for igual ou inferior ao CDI..."
              required
            />
          </div>
        </div>

        <div className="planilha-section">
          <h3>Template e Importacao</h3>
          <p className="planilha-hint">
            1. Baixe o template com todos os clientes.
            <br />
            2. Preencha Patrimonio Total, Resultado no Mes (%) e Resultado no Mes (R$).
            <br />
            3. Importe o arquivo para gerar os relatorios dos clientes preenchidos.
          </p>

          <div className="planilha-actions">
            <button type="button" className="planilha-btn planilha-btn-secondary" onClick={handleBaixarTemplate}>
              Baixar Template
            </button>

            <label className="planilha-btn planilha-btn-secondary planilha-upload">
              {importandoPlanilha ? 'Importando...' : 'Importar Planilha'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportarPlanilha}
                disabled={importandoPlanilha}
              />
            </label>
          </div>

          <div className="planilha-status-grid">
            <div className="planilha-status-card">
              <span>{linhasImportadas.length}</span>
              <small>Clientes com dados</small>
            </div>
            <div className="planilha-status-card">
              <span>{linhasIgnoradas}</span>
              <small>Linhas ignoradas</small>
            </div>
            <div className="planilha-status-card">
              <span>{errosImportacao.length}</span>
              <small>Erros</small>
            </div>
          </div>

          {nomeArquivo && (
            <p className="planilha-arquivo-info">
              Arquivo importado: <strong>{nomeArquivo}</strong>
            </p>
          )}

          {errosImportacao.length > 0 && (
            <div className="planilha-feedback planilha-feedback-error">
              <h4>Erros de importacao</h4>
              <ul>
                {errosImportacao.slice(0, 8).map((erro) => (
                  <li key={erro}>{erro}</li>
                ))}
              </ul>
            </div>
          )}

          {avisosImportacao.length > 0 && (
            <div className="planilha-feedback planilha-feedback-warning">
              <h4>Avisos de importacao</h4>
              <ul>
                {avisosImportacao.slice(0, 8).map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="planilha-form-actions">
          <button
            type="submit"
            className="planilha-btn planilha-btn-primary"
            disabled={linhasImportadas.length === 0}
          >
            Gerar Relatorios
          </button>
        </div>
      </form>
    </Card>
  );
}

