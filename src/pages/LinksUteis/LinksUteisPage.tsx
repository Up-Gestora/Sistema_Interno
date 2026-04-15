import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/Card/Card';
import { savePortSharedStorageValue } from '../../services/portSharedStorage';
import './LinksUteisPage.css';

type LinkUtil = {
  id: string;
  nome: string;
  url: string;
  descricao: string;
  segmento: string;
  criadoEm: string;
};

const LINKS_STORAGE_KEY = 'links_uteis_v1';
const SEGMENTOS_SUGERIDOS = [
  'Design',
  'Emissão de nota',
  'Portais de notícias',
  'Ferramentas',
  'Pesquisa',
  'Financeiro',
  'Outros',
];

export default function LinksUteisPage() {
  const [links, setLinks] = useState<LinkUtil[]>(() => {
    const saved = localStorage.getItem(LINKS_STORAGE_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as LinkUtil[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [nome, setNome] = useState('');
  const [url, setUrl] = useState('');
  const [descricao, setDescricao] = useState('');
  const [segmento, setSegmento] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroSegmento, setFiltroSegmento] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
    void savePortSharedStorageValue(LINKS_STORAGE_KEY, links);
  }, [links]);

  const normalizarUrl = (valor: string) => {
    const trimmed = valor.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const handleAdicionar = (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const urlNormalizada = normalizarUrl(url);
    if (!urlNormalizada) {
      setErro('Informe o link do site.');
      return;
    }

    let urlValida: URL | null = null;
    try {
      urlValida = new URL(urlNormalizada);
    } catch {
      setErro('Informe uma URL válida.');
      return;
    }

    const nomeFinal = nome.trim() || urlValida.hostname.replace('www.', '');
    const segmentoFinal = segmento.trim() || 'Outros';

    const novoLink: LinkUtil = {
      id: `link_${Date.now()}`,
      nome: nomeFinal,
      url: urlNormalizada,
      descricao: descricao.trim(),
      segmento: segmentoFinal,
      criadoEm: new Date().toISOString(),
    };

    setLinks((prev) => [novoLink, ...prev]);
    setNome('');
    setUrl('');
    setDescricao('');
    setSegmento('');
  };

  const handleRemover = (id: string) => {
    setLinks((prev) => prev.filter((link) => link.id !== id));
  };

  const segmentosDisponiveis = useMemo(() => {
    const set = new Set(SEGMENTOS_SUGERIDOS);
    links.forEach((link) => {
      if (link.segmento) set.add(link.segmento);
    });
    return Array.from(set);
  }, [links]);

  const linksFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return links.filter((link) => {
      if (filtroSegmento && link.segmento !== filtroSegmento) return false;
      if (!termo) return true;
      const alvo = `${link.nome} ${link.descricao} ${link.url} ${link.segmento}`.toLowerCase();
      return alvo.includes(termo);
    });
  }, [links, busca, filtroSegmento]);

  return (
    <div className="links-uteis-page">
      <div className="page-header">
        <div>
          <h1>Links úteis</h1>
          <p className="page-subtitle">
            Centralize sites e ferramentas dos seus trabalhos em um só lugar.
          </p>
        </div>
      </div>

      <div className="links-grid">
        <Card title="Adicionar link" className="links-card">
          <form className="links-form" onSubmit={handleAdicionar}>
            <label>
              Nome do link
              <input
                type="text"
                placeholder="Ex.: Portal NFe"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
            <label>
              Link do site *
              <input
                type="text"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </label>
            <label>
              Descrição
              <textarea
                placeholder="Breve descrição do que este link ajuda"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
            </label>
            <label>
              Segmento
              <input
                type="text"
                list="segmentos-sugeridos"
                placeholder="Design, emissão de nota, notícias..."
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
              />
              <datalist id="segmentos-sugeridos">
                {SEGMENTOS_SUGERIDOS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            {erro && <span className="links-error">{erro}</span>}
            <button type="submit" className="btn-primary">
              + Adicionar link
            </button>
          </form>
        </Card>

        <Card title="Seus links" className="links-card">
          <div className="links-filters">
            <input
              type="text"
              placeholder="Buscar por nome, descrição ou URL"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select
              value={filtroSegmento}
              onChange={(e) => setFiltroSegmento(e.target.value)}
            >
              <option value="">Todos os segmentos</option>
              {segmentosDisponiveis.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {linksFiltrados.length === 0 ? (
            <div className="empty-state">Nenhum link cadastrado.</div>
          ) : (
            <div className="links-list">
              {linksFiltrados.map((link) => (
                <div key={link.id} className="links-item">
                  <div className="links-item-header">
                    <div>
                      <h4>{link.nome}</h4>
                      <a href={link.url} target="_blank" rel="noreferrer">
                        {link.url}
                      </a>
                    </div>
                    <span className="segmento-badge">{link.segmento}</span>
                  </div>
                  {link.descricao && <p className="links-item-desc">{link.descricao}</p>}
                  <div className="links-item-actions">
                    <a className="btn-secondary" href={link.url} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                    <button
                      type="button"
                      className="btn-secondary danger"
                      onClick={() => handleRemover(link.id)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
