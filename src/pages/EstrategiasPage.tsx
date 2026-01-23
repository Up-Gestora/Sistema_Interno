import { useState, useEffect } from 'react';
import { useEstrategias } from '../hooks/useEstrategias';
import { useClientes } from '../hooks/useClientes';
import { Estrategia } from '../types';
import Modal from '../components/Modal/Modal';
import './EstrategiasPage.css';

export default function EstrategiasPage() {
  const { estrategias, setEstrategias } = useEstrategias();
  const { clientes } = useClientes();
  const [estrategiaEditando, setEstrategiaEditando] = useState<Estrategia | null>(null);
  const [mostrarModalEdicao, setMostrarModalEdicao] = useState(false);
  const [mostrarModalNova, setMostrarModalNova] = useState(false);
  const [novaEstrategia, setNovaEstrategia] = useState({ nome: '', descricao: '' });
  const [estrategiasExpandidas, setEstrategiasExpandidas] = useState<Set<string>>(new Set());

  const toggleExpandir = (estrategiaId: string) => {
    setEstrategiasExpandidas(prev => {
      const novo = new Set(prev);
      if (novo.has(estrategiaId)) {
        novo.delete(estrategiaId);
      } else {
        novo.add(estrategiaId);
      }
      return novo;
    });
  };

  const getClientesPorEstrategia = (estrategiaId: string) => {
    return clientes.filter(c => c.estrategiaId === estrategiaId);
  };

  const handleEditar = (estrategia: Estrategia) => {
    setEstrategiaEditando(estrategia);
    setMostrarModalEdicao(true);
  };

  const handleSalvarEdicao = (estrategiaAtualizada: Estrategia) => {
    const estrategiasAtualizadas = estrategias.map(e =>
      e.id === estrategiaAtualizada.id
        ? { ...estrategiaAtualizada, dataAtualizacao: new Date().toISOString().split('T')[0] }
        : e
    );
    setEstrategias(estrategiasAtualizadas);
    setMostrarModalEdicao(false);
    setEstrategiaEditando(null);
  };

  const handleCancelarEdicao = () => {
    setMostrarModalEdicao(false);
    setEstrategiaEditando(null);
  };

  const handleCriarNova = () => {
    setNovaEstrategia({ nome: '', descricao: '' });
    setMostrarModalNova(true);
  };

  const handleSalvarNova = (estrategia: Estrategia) => {
    const estrategiasAtualizadas = [...estrategias, estrategia];
    setEstrategias(estrategiasAtualizadas);
    setMostrarModalNova(false);
    setNovaEstrategia({ nome: '', descricao: '' });
  };

  const handleExcluir = (estrategia: Estrategia) => {
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir a estratégia "${estrategia.nome}"?\n\nEsta ação não pode ser desfeita.`
    );

    if (confirmar) {
      const estrategiasAtualizadas = estrategias.filter(e => e.id !== estrategia.id);
      setEstrategias(estrategiasAtualizadas);
    }
  };

  return (
    <div className="estrategias-page">
      <div className="page-header">
        <h1>Estratégias de Gestão</h1>
        <button className="btn-nova-estrategia" onClick={handleCriarNova}>
          ➕ Nova Estratégia
        </button>
      </div>

      <div className="estrategias-list-accordion">
        {estrategias.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma estratégia cadastrada. Clique em "Nova Estratégia" para começar.</p>
          </div>
        ) : (
          estrategias.map((estrategia) => {
            const clientesEstrategia = getClientesPorEstrategia(estrategia.id);
            const isExpanded = estrategiasExpandidas.has(estrategia.id);
            
            return (
              <div key={estrategia.id} className="estrategia-item">
                <div 
                  className="estrategia-header"
                  onClick={() => toggleExpandir(estrategia.id)}
                >
                  <div className="estrategia-header-left">
                    <button 
                      className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpandir(estrategia.id);
                      }}
                      aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                    >
                      ▼
                    </button>
                    <div className="estrategia-info">
                      <span className="estrategia-nome">{estrategia.nome}</span>
                      <span className="estrategia-clientes-count">
                        {clientesEstrategia.length} cliente(s)
                      </span>
                    </div>
                  </div>
                  <div className="estrategia-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-edit"
                      onClick={() => handleEditar(estrategia)}
                      title="Editar estratégia"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleExcluir(estrategia)}
                      title="Excluir estratégia"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="estrategia-content">
                    {estrategia.descricao && (
                      <div className="estrategia-descricao-section">
                        <p className="estrategia-descricao">{estrategia.descricao}</p>
                      </div>
                    )}
                    
                    {clientesEstrategia.length > 0 && (
                      <div className="estrategia-clientes-section">
                        <div className="clientes-list">
                          {clientesEstrategia.map((cliente) => (
                            <div key={cliente.id} className="cliente-item">
                              <span className="cliente-nome">{cliente.nome}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {estrategiaEditando && (
        <Modal
          isOpen={mostrarModalEdicao}
          onClose={handleCancelarEdicao}
          title="Editar Estratégia"
          size="medium"
        >
          <FormEstrategia
            estrategia={estrategiaEditando}
            onSave={handleSalvarEdicao}
            onCancel={handleCancelarEdicao}
          />
        </Modal>
      )}

      <Modal
        isOpen={mostrarModalNova}
        onClose={() => {
          setMostrarModalNova(false);
          setNovaEstrategia({ nome: '', descricao: '' });
        }}
        title="Nova Estratégia"
        size="medium"
      >
        <FormEstrategia
          estrategia={null}
          onSave={(estrategia) => {
            handleSalvarNova(estrategia);
          }}
          onCancel={() => {
            setMostrarModalNova(false);
            setNovaEstrategia({ nome: '', descricao: '' });
          }}
          novaEstrategia={novaEstrategia}
          setNovaEstrategia={setNovaEstrategia}
        />
      </Modal>
    </div>
  );
}

interface FormEstrategiaProps {
  estrategia: Estrategia | null;
  onSave: (estrategia: Estrategia) => void;
  onCancel: () => void;
  novaEstrategia?: { nome: string; descricao: string };
  setNovaEstrategia?: (estrategia: { nome: string; descricao: string }) => void;
}

function FormEstrategia({ estrategia, onSave, onCancel, novaEstrategia, setNovaEstrategia }: FormEstrategiaProps) {
  const [nome, setNome] = useState(estrategia?.nome || novaEstrategia?.nome || '');
  const [descricao, setDescricao] = useState(estrategia?.descricao || novaEstrategia?.descricao || '');

  // Sincronizar quando novaEstrategia mudar externamente
  useEffect(() => {
    if (!estrategia && novaEstrategia) {
      setNome(novaEstrategia.nome);
      setDescricao(novaEstrategia.descricao);
    }
  }, [novaEstrategia, estrategia]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      alert('Por favor, informe o nome da estratégia.');
      return;
    }

    if (estrategia) {
      // Edição
      onSave({
        ...estrategia,
        nome: nome.trim(),
        descricao: descricao.trim(),
        dataAtualizacao: new Date().toISOString().split('T')[0],
      });
    } else {
      // Nova estratégia
      const nova: Estrategia = {
        id: `estrategia_${Date.now()}`,
        nome: nome.trim(),
        descricao: descricao.trim(),
        dataCriacao: new Date().toISOString().split('T')[0],
        dataAtualizacao: new Date().toISOString().split('T')[0],
      };
      onSave(nova);
    }
  };

  const handleNomeChange = (value: string) => {
    setNome(value);
    if (!estrategia && setNovaEstrategia) {
      setNovaEstrategia({ ...novaEstrategia!, nome: value });
    }
  };

  const handleDescricaoChange = (value: string) => {
    setDescricao(value);
    if (!estrategia && setNovaEstrategia) {
      setNovaEstrategia({ ...novaEstrategia!, descricao: value });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-estrategia">
      <div className="form-group">
        <label htmlFor="nome" className="form-label">
          Nome da Estratégia <span className="required">*</span>
        </label>
        <input
          type="text"
          id="nome"
          className="form-input"
          value={nome}
          onChange={(e) => handleNomeChange(e.target.value)}
          required
          placeholder="Ex: Carteira Tática"
        />
      </div>

      <div className="form-group">
        <label htmlFor="descricao" className="form-label">
          Descrição
        </label>
        <textarea
          id="descricao"
          className="form-textarea"
          value={descricao}
          onChange={(e) => handleDescricaoChange(e.target.value)}
          rows={5}
          placeholder="Descreva as especificidades desta estratégia..."
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary">
          {estrategia ? 'Salvar Alterações' : 'Criar Estratégia'}
        </button>
      </div>
    </form>
  );
}

