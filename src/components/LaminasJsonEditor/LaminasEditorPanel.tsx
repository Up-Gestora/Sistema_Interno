import type { ChangeEvent } from 'react';
import type { Estrategia } from '../../types';
import type { LaminaBlockItem, LaminaTemplate } from './types';
import { normalizarTexto } from './utils';

type LaminasEditorPanelProps = {
  estrategias: Estrategia[];
  strategyId: string;
  onStrategyChange: (id: string) => void;
  exportandoPdf: boolean;
  exportandoImagem: boolean;
  onExportarPdf: () => void;
  onExportarImagem: () => void;
  showDailyHint: boolean;
  modoLivre: boolean;
  onToggleModoLivre: () => void;
  onResetLayout: () => void;
  onMostrarTodosBlocos: () => void;
  blocks: LaminaBlockItem[];
  isBlocoVisivel: (id: string) => boolean;
  onToggleBloco: (id: string) => void;
  template: LaminaTemplate;
  jsonText: string;
  jsonErro: string;
  salvoMensagem: string;
  onJsonChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onSalvar: () => void;
  notasInternas: string;
  onNotasChange: (valor: string) => void;
  onAtualizarHeaderCampo: (campo: keyof LaminaTemplate['header'], valor: string) => void;
  onAtualizarTemplate: (novo: LaminaTemplate) => void;
  onAtualizarIntro: (index: number, valor: string) => void;
  onAtualizarComentarios: (index: number, valor: string) => void;
  onAtualizarResumoMensal: (index: number, campo: 'label' | 'value', valor: string) => void;
  onLogoUpload: (event: ChangeEvent<HTMLInputElement>, alvo: 'topo' | 'rodape') => void;
  logoTopo: string | null;
  logoRodape: string | null;
  onRemoverLogoTopo: () => void;
  onRemoverLogoRodape: () => void;
};

export default function LaminasEditorPanel({
  estrategias,
  strategyId,
  onStrategyChange,
  exportandoPdf,
  exportandoImagem,
  onExportarPdf,
  onExportarImagem,
  showDailyHint,
  modoLivre,
  onToggleModoLivre,
  onResetLayout,
  onMostrarTodosBlocos,
  blocks,
  isBlocoVisivel,
  onToggleBloco,
  template,
  jsonText,
  jsonErro,
  salvoMensagem,
  onJsonChange,
  onSalvar,
  notasInternas,
  onNotasChange,
  onAtualizarHeaderCampo,
  onAtualizarTemplate,
  onAtualizarIntro,
  onAtualizarComentarios,
  onAtualizarResumoMensal,
  onLogoUpload,
  logoTopo,
  logoRodape,
  onRemoverLogoTopo,
  onRemoverLogoRodape,
}: LaminasEditorPanelProps) {
  const exportando = exportandoPdf || exportandoImagem;

  return (
    <div className="laminas-editor-panel">
      <h3>Campos rápidos</h3>
      <div className="lamina-actions">
        <label>
          Estratégia (dados diários)
          <select value={strategyId} onChange={(event) => onStrategyChange(event.target.value)}>
            <option value="">Selecione</option>
            {estrategias.map((estrategia) => (
              <option key={estrategia.id} value={estrategia.id}>
                {estrategia.nome}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-export" onClick={onExportarPdf} disabled={exportando}>
          {exportandoPdf ? 'Exportando PDF...' : 'Exportar PDF'}
        </button>
        <button type="button" className="btn-secondary" onClick={onExportarImagem} disabled={exportando}>
          {exportandoImagem ? 'Exportando imagem...' : 'Exportar imagem'}
        </button>
        {showDailyHint && <span className="json-hint">Cadastre ao menos 2 dias para gerar métricas e gráfico.</span>}
      </div>

      <div className="layout-panel">
        <div className="layout-panel-header">
          <h4>Layout do modelo</h4>
          <label className="layout-toggle">
            <input type="checkbox" checked={modoLivre} onChange={onToggleModoLivre} />
            <span>Modo livre</span>
          </label>
        </div>
        <div className="layout-panel-actions">
          <button type="button" className="btn-secondary" onClick={onResetLayout}>
            Resetar layout
          </button>
          <button type="button" className="btn-secondary" onClick={onMostrarTodosBlocos}>
            Mostrar todos
          </button>
        </div>
        <div className="layout-block-grid">
          {blocks.map((block) => (
            <button
              key={block.id}
              type="button"
              className={`layout-chip${isBlocoVisivel(block.id) ? ' is-active' : ''}`}
              onClick={() => onToggleBloco(block.id)}
            >
              {normalizarTexto(block.label)}
            </button>
          ))}
        </div>
        <span className="json-hint">Selecione um bloco e pressione Del para ocultar.</span>
      </div>

      <label>
        Título principal
        <input value={template.header.titulo} onChange={(e) => onAtualizarHeaderCampo('titulo', e.target.value)} />
      </label>
      <label>
        Subtítulo
        <input value={template.header.subtitulo} onChange={(e) => onAtualizarHeaderCampo('subtitulo', e.target.value)} />
      </label>
      <label>
        Período
        <input value={template.header.periodo} onChange={(e) => onAtualizarHeaderCampo('periodo', e.target.value)} />
      </label>
      <label>
        Destaque
        <input value={template.header.destaque} onChange={(e) => onAtualizarHeaderCampo('destaque', e.target.value)} />
      </label>
      <div className="logo-actions">
        <div className="logo-row">
          <label>
            Logo do topo
            <input type="file" accept="image/*" onChange={(event) => onLogoUpload(event, 'topo')} />
          </label>
          {logoTopo && (
            <button type="button" className="btn-secondary" onClick={onRemoverLogoTopo}>
              Remover
            </button>
          )}
        </div>
        <div className="logo-row">
          <label>
            Logo do rodapé
            <input type="file" accept="image/*" onChange={(event) => onLogoUpload(event, 'rodape')} />
          </label>
          {logoRodape && (
            <button type="button" className="btn-secondary" onClick={onRemoverLogoRodape}>
              Remover
            </button>
          )}
        </div>
      </div>
      <label>
        Público alvo
        <textarea
          rows={2}
          value={template.publicoAlvo}
          onChange={(e) => onAtualizarTemplate({ ...template, publicoAlvo: e.target.value })}
        />
      </label>
      <label>
        Intro 1
        <textarea rows={3} value={template.intro[0]?.texto || ''} onChange={(e) => onAtualizarIntro(0, e.target.value)} />
      </label>
      <label>
        Intro 2
        <textarea rows={3} value={template.intro[1]?.texto || ''} onChange={(e) => onAtualizarIntro(1, e.target.value)} />
      </label>
      <label>
        Intro 3
        <textarea rows={3} value={template.intro[2]?.texto || ''} onChange={(e) => onAtualizarIntro(2, e.target.value)} />
      </label>
      <label>
        Mês título
        <input value={template.mesTitulo} onChange={(e) => onAtualizarTemplate({ ...template, mesTitulo: e.target.value })} />
      </label>
      <div className="lamina-resumo-editor">
        <h4>Resumo mensal</h4>
        {template.resumoMensal.map((item, index) => (
          <div key={`resumo-${index}`}>
            <label>
              Resumo {index + 1} - título
              <input
                value={item.label}
                onChange={(e) => onAtualizarResumoMensal(index, 'label', e.target.value)}
              />
            </label>
            <label>
              Resumo {index + 1} - valor
              <input
                value={item.value}
                onChange={(e) => onAtualizarResumoMensal(index, 'value', e.target.value)}
              />
            </label>
          </div>
        ))}
      </div>
      <label>
        Comentário 1
        <textarea
          rows={3}
          value={template.comentarios[0]?.texto || ''}
          onChange={(e) => onAtualizarComentarios(0, e.target.value)}
        />
      </label>
      <label>
        Comentário 2
        <textarea
          rows={3}
          value={template.comentarios[1]?.texto || ''}
          onChange={(e) => onAtualizarComentarios(1, e.target.value)}
        />
      </label>
      <label>
        Comentário 3
        <textarea
          rows={2}
          value={template.comentarios[2]?.texto || ''}
          onChange={(e) => onAtualizarComentarios(2, e.target.value)}
        />
      </label>

      <div className="json-area">
        <h4>JSON do template</h4>
        <textarea value={jsonText} onChange={onJsonChange} />
        {jsonErro && <span className="json-error">{jsonErro}</span>}
        <div className="json-actions">
          <button type="button" className="btn-save" onClick={onSalvar} disabled={!!jsonErro}>
            Salvar alterações
          </button>
          {salvoMensagem && <span className="json-saved">{salvoMensagem}</span>}
        </div>

        <p className="json-hint">
          Edite o JSON para ajustar KPIs, tabelas, gráfico e atribuição. Os KPIs diários são atualizados
          automaticamente.
        </p>
      </div>


      <div className="lamina-notes">
        <h4>Notas internas (nao aparecem no preview)</h4>
        <textarea
          rows={6}
          value={notasInternas}
          onChange={(e) => onNotasChange(e.target.value)}
          placeholder="Use este espaco para rascunhos, lembretes e instrucoes."
        />
        <p className="json-hint">Atalhos rapidos (placeholders):</p>
        <ul className="lamina-notes-list">
          <li className="json-hint">retorno_1m, ifix_1m, cdi_1m, alpha_1m, alpha_cdi_1m</li>
          <li className="json-hint">retorno_3m, ifix_3m, cdi_3m, alpha_3m, alpha_cdi_3m</li>
          <li className="json-hint">retorno_inicio, ifix_inicio, cdi_inicio, alpha_inicio, alpha_cdi_inicio</li>
          <li className="json-hint">Versoes com sinal: *_signed</li>
        </ul>
        <p className="json-hint">Use no texto assim: {'{{retorno_1m}}'} ou [retorno_1m].</p>
      </div>
    </div>
  );
}














