import { useRef, useState } from 'react';
import { Cliente } from '../../types';
import { RelatorioMensal } from '../../types/relatorio';
import { useEstrategias } from '../../hooks/useEstrategias';
import Card from '../../components/Card/Card';
import YearSelect from '../../components/YearSelect/YearSelect';
import { parseDecimalInput } from '../../utils/numberInput';
import './FormRelatorio.css';

interface FormRelatorioProps {
  clientes: Cliente[];
  onSubmit: (relatorio: RelatorioMensal) => void;
  onCancel?: () => void;
}

interface EstrategiaSelecionada {
  estrategiaId: string;
  titulo: string;
  tituloPersonalizado: string;
  patrimonioTotal: string;
  resultadoPercentual: string;
  resultadoValor: string;
  comentario: string;
  comentarioImagens: Array<{ id: string; src: string }>;
}

export default function FormRelatorio({ clientes, onSubmit, onCancel }: FormRelatorioProps) {
  const { estrategias } = useEstrategias();
  const [formData, setFormData] = useState<Partial<RelatorioMensal>>({
    clienteId: '',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    resumoMacro: '',
  });
  const [estrategiasSelecionadas, setEstrategiasSelecionadas] = useState<EstrategiaSelecionada[]>(() => ([
    {
      estrategiaId: '',
      titulo: 'Estratégia principal',
      tituloPersonalizado: '',
      patrimonioTotal: '',
      resultadoPercentual: '',
      resultadoValor: '',
      comentario: '',
      comentarioImagens: [],
    },
  ]));
  const [uploadContexto, setUploadContexto] = useState<{
    estrategiaIndex: number;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const comentarioRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  const obterNomeEstrategia = (id?: string) => {
    if (!id) return 'Estratégia principal';
    return estrategias.find(estrategia => estrategia.id === id)?.nome || 'Estratégia principal';
  };

  const criarEstrategiaPadrao = (cliente?: Cliente): EstrategiaSelecionada => {
    const estrategiaId = cliente?.estrategiaId || '';
    return {
      estrategiaId,
      titulo: obterNomeEstrategia(estrategiaId),
      tituloPersonalizado: '',
      patrimonioTotal: '',
      resultadoPercentual: '',
      resultadoValor: '',
      comentario: '',
      comentarioImagens: [],
    };
  };

  const atualizarDadosEstrategia = (
    estrategiaIndex: number,
    campo: keyof EstrategiaSelecionada,
    valor: string
  ) => {
    setEstrategiasSelecionadas(prev => prev.map((estrategia, index) => (
      index === estrategiaIndex ? { ...estrategia, [campo]: valor } : estrategia
    )));
  };

  const atualizarComentarioEstrategia = (estrategiaIndex: number, comentario: string) => {
    setEstrategiasSelecionadas(prev => prev.map((estrategia, index) => (
      index === estrategiaIndex ? { ...estrategia, comentario } : estrategia
    )));
  };

  const atualizarEstrategia = (estrategiaIndex: number, estrategiaId: string) => {
    const titulo = obterNomeEstrategia(estrategiaId);
    setEstrategiasSelecionadas(prev => prev.map((estrategia, index) => (
      index === estrategiaIndex ? { ...estrategia, estrategiaId, titulo } : estrategia
    )));
  };

  const adicionarEstrategia = () => {
    setEstrategiasSelecionadas(prev => [...prev, criarEstrategiaPadrao()]);
  };

  const removerEstrategia = (estrategiaIndex: number) => {
    setEstrategiasSelecionadas(prev => prev.filter((_, index) => index !== estrategiaIndex));
  };

  const inserirTokenNoComentario = (estrategiaIndex: number, token: string) => {
    const textarea = comentarioRefs.current[estrategiaIndex];
    const selectionStart = textarea?.selectionStart ?? (textarea?.value.length || 0);
    const selectionEnd = textarea?.selectionEnd ?? (textarea?.value.length || 0);

    setEstrategiasSelecionadas(prev => prev.map((estrategia, index) => {
      if (index !== estrategiaIndex) return estrategia;
      const comentarioAtual = estrategia.comentario || '';
      const before = comentarioAtual.slice(0, selectionStart);
      const after = comentarioAtual.slice(selectionEnd);
      const prefix = before && !before.endsWith('\n') ? '\n' : '';
      const suffix = after && !after.startsWith('\n') ? '\n' : '';
      return {
        ...estrategia,
        comentario: `${before}${prefix}${token}${suffix}${after}`,
      };
    }));

    if (textarea) {
      textarea.focus();
    }
  };

  const adicionarImagemComentario = (
    estrategiaIndex: number,
    dataUrl: string,
    selectionStart?: number,
    selectionEnd?: number
  ) => {
    const idImagem = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const token = `[[img:${idImagem}]]`;
    setEstrategiasSelecionadas(prev => prev.map((estrategia, index) => {
      if (index !== estrategiaIndex) return estrategia;
      const comentarioAtual = estrategia.comentario || '';
      const start = selectionStart ?? comentarioAtual.length;
      const end = selectionEnd ?? comentarioAtual.length;
      const before = comentarioAtual.slice(0, start);
      const after = comentarioAtual.slice(end);
      const prefix = before && !before.endsWith('\n') ? '\n' : '';
      const suffix = after && !after.startsWith('\n') ? '\n' : '';
      return {
        ...estrategia,
        comentarioImagens: [...(estrategia.comentarioImagens || []), { id: idImagem, src: dataUrl }],
        comentario: `${before}${prefix}${token}${suffix}${after}`,
      };
    }));
  };

  const removerImagemComentario = (estrategiaIndex: number, imagemIndex: number) => {
    setEstrategiasSelecionadas(prev => prev.map((estrategia, index) => {
      if (index !== estrategiaIndex) return estrategia;
      const imagensAtualizadas = (estrategia.comentarioImagens || []).filter((_, idx) => idx !== imagemIndex);
      const imagemRemovida = (estrategia.comentarioImagens || [])[imagemIndex];
      const tokenRemover = imagemRemovida ? `[[img:${imagemRemovida.id}]]` : '';
      const comentarioAtualizado = tokenRemover
        ? (estrategia.comentario || '').replaceAll(tokenRemover, '').replace(/\n{3,}/g, '\n\n').trim()
        : estrategia.comentario;
      return {
        ...estrategia,
        comentarioImagens: imagensAtualizadas,
        comentario: comentarioAtualizado,
      };
    }));
  };

  const abrirSeletorImagem = (estrategiaIndex: number) => {
    const textarea = comentarioRefs.current[estrategiaIndex];
    const selectionStart = textarea?.selectionStart ?? (textarea?.value.length || 0);
    const selectionEnd = textarea?.selectionEnd ?? (textarea?.value.length || 0);
    setUploadContexto({ estrategiaIndex, selectionStart, selectionEnd });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImagemSelecionada = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadContexto) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        adicionarImagemComentario(
          uploadContexto.estrategiaIndex,
          dataUrl,
          uploadContexto.selectionStart,
          uploadContexto.selectionEnd
        );
      }
      setUploadContexto(null);
    };
    reader.onerror = () => {
      alert('Não foi possível carregar a imagem.');
      setUploadContexto(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clienteId || !formData.resumoMacro) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    if (!estrategiasSelecionadas.length) {
      alert('Adicione ao menos uma estratégia.');
      return;
    }
    const algumaSemEstrategia = estrategiasSelecionadas.some((estrategia) => !estrategia.estrategiaId);
    if (algumaSemEstrategia) {
      alert('Por favor, selecione a estratégia de cada bloco.');
      return;
    }

    const cliente = clientes.find(c => c.id === formData.clienteId);
    const estrategiasRelatorio = estrategiasSelecionadas.map((estrategia) => {
      const resultadoPercentual = parseDecimalInput(estrategia.resultadoPercentual);
      const patrimonioTotal = parseDecimalInput(estrategia.patrimonioTotal);
      const resultadoValor = parseDecimalInput(estrategia.resultadoValor);
      const tituloResolvido =
        estrategia.tituloPersonalizado?.trim() ||
        estrategia.titulo ||
        obterNomeEstrategia(estrategia.estrategiaId) ||
        'Estratégia manual';

      return {
        titulo: tituloResolvido,
        patrimonioTotal,
        resultadoMes: resultadoValor,
        resultadoPercentual,
        resumoTexto: estrategia.comentario || '',
        resumoImagens: estrategia.comentarioImagens,
      };
    });
    const estrategiaPrincipal = estrategiasRelatorio[0];
    const relatorio: RelatorioMensal = {
      ...formData as RelatorioMensal,
      patrimonioTotal: estrategiaPrincipal?.patrimonioTotal || 0,
      resultadoMes: estrategiaPrincipal?.resultadoMes || 0,
      resultadoPercentual: estrategiaPrincipal?.resultadoPercentual || 0,
      resumoTexto: estrategiaPrincipal?.resumoTexto || '',
      clienteNome: cliente?.nome,
      dataGeracao: new Date().toISOString(),
      estrategias: estrategiasRelatorio,
    };

    onSubmit(relatorio);
  };

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const anosDisponiveis = Array.from({ length: 81 }, (_, index) => 2020 + index);

  return (
    <Card title="Novo Relatório Mensal" className="form-relatorio">
      <form onSubmit={handleSubmit} className="relatorio-form">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImagemSelecionada}
          style={{ display: 'none' }}
        />
        <div className="form-section">
          <h3>Dados do Relatório</h3>
          <div className="form-group">
            <label htmlFor="cliente">Cliente *</label>
            <select
              id="cliente"
              value={formData.clienteId}
              onChange={(e) => {
                const clienteId = e.target.value;
                const clienteSelecionado = clientes.find(c => c.id === clienteId);
                setFormData({ ...formData, clienteId });
                if (clienteSelecionado?.estrategiaId) {
                  setEstrategiasSelecionadas((prev) => {
                    if (!prev.length) return [criarEstrategiaPadrao(clienteSelecionado)];
                    return prev.map((estrategia, index) => (
                      index === 0
                        ? {
                          ...estrategia,
                          estrategiaId: clienteSelecionado.estrategiaId || '',
                          titulo: obterNomeEstrategia(clienteSelecionado.estrategiaId),
                        }
                        : estrategia
                    ));
                  });
                }
              }}
              required
            >
              <option value="">Selecione um cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mes">Mês *</label>
              <select
                id="mes"
                value={formData.mes}
                onChange={(e) => setFormData({ ...formData, mes: parseInt(e.target.value) })}
                required
              >
                {meses.map((mes, index) => (
                  <option key={index} value={index + 1}>
                    {mes}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ano">Ano *</label>
              <YearSelect
                id="ano"
                value={Number(formData.ano) || new Date().getFullYear()}
                years={anosDisponiveis}
                onChange={(ano) => setFormData({ ...formData, ano })}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="resumoMacro">Resumo Macro *</label>
            <textarea
              id="resumoMacro"
              value={formData.resumoMacro}
              onChange={(e) => setFormData({ ...formData, resumoMacro: e.target.value })}
              rows={3}
              placeholder="Digite o resumo macro da carteira..."
              required
            />
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-header">
            <h3>Estratégias</h3>
            <button type="button" className="btn-add-estrategia" onClick={adicionarEstrategia}>
              + Estratégia
            </button>
          </div>

          <div className="clientes-dados">
            {estrategiasSelecionadas.map((estrategia, estrategiaIndex) => {
              const tituloExibido =
                estrategia.tituloPersonalizado?.trim() ||
                estrategia.titulo ||
                'Estratégia manual';

              return (
                <div key={`estrategia-${estrategiaIndex}`} className="cliente-dados-card">
                  <div className="cliente-estrategia-block">
                    <div className="cliente-estrategia-header">
                      <div className="cliente-estrategia-title">{tituloExibido}</div>
                      {estrategiaIndex > 0 && (
                        <button
                          type="button"
                          className="btn-remove-estrategia"
                          onClick={() => removerEstrategia(estrategiaIndex)}
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Estratégia *</label>
                        <select
                          value={estrategia.estrategiaId}
                          onChange={(e) => atualizarEstrategia(estrategiaIndex, e.target.value)}
                          required
                        >
                          <option value="">Selecione uma estratégia</option>
                          {estrategias.map((estrategiaDisponivel) => (
                            <option key={estrategiaDisponivel.id} value={estrategiaDisponivel.id}>
                              {estrategiaDisponivel.nome}
                            </option>
                          ))}
                        </select>
                        <label>Título personalizado (opcional)</label>
                        <input
                          type="text"
                          value={estrategia.tituloPersonalizado}
                          onChange={(e) => atualizarDadosEstrategia(estrategiaIndex, 'tituloPersonalizado', e.target.value)}
                          placeholder="Ex.: Carteira Balanceada - RF"
                        />
                      </div>

                      <div className="form-group">
                        <label>Patrimônio Total (R$) *</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={estrategia.patrimonioTotal}
                          onChange={(e) => atualizarDadosEstrategia(estrategiaIndex, 'patrimonioTotal', e.target.value)}
                          required
                        />
                        <label htmlFor={`comentario-${estrategiaIndex}`}>Comentário individual (opcional)</label>
                        <textarea
                          id={`comentario-${estrategiaIndex}`}
                          value={estrategia.comentario}
                          onChange={(e) => atualizarComentarioEstrategia(estrategiaIndex, e.target.value)}
                          rows={3}
                          placeholder="Observação específica para esta estratégia..."
                          ref={(el) => {
                            comentarioRefs.current[estrategiaIndex] = el;
                          }}
                        />
                        <div className="comentario-actions">
                          <button
                            type="button"
                            className="btn-anexo"
                            onClick={() => abrirSeletorImagem(estrategiaIndex)}
                          >
                            Adicionar imagem
                          </button>
                          {estrategia.comentarioImagens?.length ? (
                            <span className="comentario-count">
                              {estrategia.comentarioImagens.length} imagem(ns)
                            </span>
                          ) : null}
                        </div>
                        <p className="comentario-hint">
                          Posicione o marcador <code>[[img:ID]]</code> no texto para inserir a imagem antes/depois do comentário desejado.
                        </p>
                        {estrategia.comentarioImagens?.length ? (
                          <div className="comentario-imagens">
                            {estrategia.comentarioImagens.map((imagem, imagemIndex) => (
                              <div key={`comentario-imagem-${estrategiaIndex}-${imagem.id}`} className="comentario-imagem">
                                <img src={imagem.src} alt={`Comentário imagem ${imagemIndex + 1}`} />
                                <div className="comentario-imagem-meta">
                                  <span className="comentario-token">[[img:{imagem.id}]]</span>
                                  <button
                                    type="button"
                                    className="btn-inserir-token"
                                    onClick={() => inserirTokenNoComentario(estrategiaIndex, `[[img:${imagem.id}]]`)}
                                  >
                                    Inserir no texto
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="btn-remover-imagem"
                                  onClick={() => removerImagemComentario(estrategiaIndex, imagemIndex)}
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="form-group">
                        <label>Resultado do Mês (%) *</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={estrategia.resultadoPercentual}
                          onChange={(e) => atualizarDadosEstrategia(estrategiaIndex, 'resultadoPercentual', e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Resultado do Mês (R$)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={estrategia.resultadoValor}
                          onChange={(e) => atualizarDadosEstrategia(estrategiaIndex, 'resultadoValor', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="form-actions">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
          )}
          <button type="submit" className="btn-primary">
            Gerar Preview
          </button>
        </div>
      </form>
    </Card>
  );
}

