import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import Card from '../components/Card/Card';
import { useTeamMembers } from '../hooks/useTeamMembers';
import type { TeamMember } from '../types/teamMember';
import './VentureCapitalPage.css';

type ProjectStatus = 'planejamento' | 'em_desenvolvimento' | 'validacao' | 'operacao' | 'pausado';
type GithubAccess = 'liberado' | 'restrito' | 'pendente';
type MovementType = 'entrada' | 'saida';

type FinancialMovement = {
  id: string;
  descricao: string;
  valor: number;
  data: string;
};

type PendingTask = {
  id: string;
  titulo: string;
  concluida: boolean;
};

type PrivateProject = {
  id: string;
  nome: string;
  descricao: string;
  features: string[];
  status: ProjectStatus;
  github: {
    repositorio: string;
    acesso: GithubAccess;
  };
  financeiro: {
    moeda: 'BRL';
    entradas: FinancialMovement[];
    saidas: FinancialMovement[];
  };
  responsaveis: string[];
  participacaoExterna: number;
  parceiroInvestidor: string;
  pendencias: PendingTask[];
};

type PrivateProjectSeed = Omit<PrivateProject, 'responsaveis'> & {
  responsaveisNomes: string[];
};

type NewProjectFormState = {
  nome: string;
  descricao: string;
  features: string;
  status: ProjectStatus;
  githubRepo: string;
  githubAcesso: GithubAccess;
  responsaveis: string[];
  participacaoExterna: string;
  parceiroInvestidor: string;
};

type FinancialMovementFormDraft = {
  nome: string;
  valor: string;
  tipo: MovementType;
};

const PROJECTS_STORAGE_KEY = 'private_projects_v4';
const LEGACY_PROJECTS_STORAGE_KEYS = ['private_projects_v3', 'private_projects_v2', 'private_projects_v1'];

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planejamento: 'Planejamento',
  em_desenvolvimento: 'Em desenvolvimento',
  validacao: 'Validacao',
  operacao: 'Operacao',
  pausado: 'Pausado',
};

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'em_desenvolvimento', label: 'Em desenvolvimento' },
  { value: 'validacao', label: 'Validacao' },
  { value: 'operacao', label: 'Operacao' },
  { value: 'pausado', label: 'Pausado' },
];

const GITHUB_ACCESS_OPTIONS: Array<{ value: GithubAccess; label: string }> = [
  { value: 'liberado', label: 'Liberado' },
  { value: 'restrito', label: 'Restrito' },
  { value: 'pendente', label: 'Pendente' },
];

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

const clampPercent = (value: number) => {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const EMPTY_FINANCIAL_DRAFT: FinancialMovementFormDraft = {
  nome: '',
  valor: '',
  tipo: 'entrada',
};

const parseCurrencyNumber = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const mapProjectMovements = (project: PrivateProject) => [
  ...project.financeiro.entradas.map((movement) => ({ ...movement, tipo: 'entrada' as const })),
  ...project.financeiro.saidas.map((movement) => ({ ...movement, tipo: 'saida' as const })),
];

const buildFinanceFromMovements = (
  movements: Array<FinancialMovement & { tipo: MovementType }>,
): PrivateProject['financeiro'] => {
  const entradas: FinancialMovement[] = [];
  const saidas: FinancialMovement[] = [];

  movements.forEach((movement) => {
    const base: FinancialMovement = {
      id: movement.id,
      descricao: movement.descricao,
      valor: movement.valor,
      data: movement.data || new Date().toISOString().split('T')[0],
    };

    if (movement.tipo === 'entrada') {
      entradas.push(base);
      return;
    }

    saidas.push(base);
  });

  return {
    moeda: 'BRL',
    entradas,
    saidas,
  };
};

const normalizeResponsibleIds = (values: string[], members: TeamMember[]) => {
  const memberIds = new Set(members.map((member) => member.id));
  const memberNameMap = new Map(
    members.map((member) => [member.nome.trim().toLowerCase(), member.id] as const),
  );

  const normalized = values
    .map((value) => {
      if (memberIds.has(value)) return value;
      return memberNameMap.get(value.trim().toLowerCase()) || '';
    })
    .filter(Boolean);

  return Array.from(new Set(normalized));
};

const INITIAL_PROJECTS_SEED: PrivateProjectSeed[] = [
  {
    id: 'project-autowhats',
    nome: 'Autowhats',
    descricao: 'Automacao e relacionamento via WhatsApp para operacoes comerciais.',
    features: ['Fluxos automatizados', 'Disparo segmentado', 'Integracao com CRM', 'Painel de conversao'],
    status: 'em_desenvolvimento',
    github: {
      repositorio: '',
      acesso: 'pendente',
    },
    financeiro: {
      moeda: 'BRL',
      entradas: [],
      saidas: [],
    },
    responsaveisNomes: ['Igor', 'Matheus'],
    participacaoExterna: 0,
    parceiroInvestidor: '',
    pendencias: [],
  },
  {
    id: 'project-findmy-angel',
    nome: 'Findmy Angel',
    descricao: 'Plataforma para mapear investidores e organizar pipeline de captacao.',
    features: ['Base de investidores', 'Pipeline de captacao', 'Historico de follow-up', 'Score de aderencia'],
    status: 'planejamento',
    github: {
      repositorio: '',
      acesso: 'pendente',
    },
    financeiro: {
      moeda: 'BRL',
      entradas: [],
      saidas: [],
    },
    responsaveisNomes: ['Vinicius'],
    participacaoExterna: 0,
    parceiroInvestidor: '',
    pendencias: [],
  },
  {
    id: 'project-oliva-funcional',
    nome: 'Oliva Funcional',
    descricao: 'Projeto operacional para oferta de produtos funcionais com recorrencia.',
    features: ['Catalogo de produtos', 'Assinatura recorrente', 'Gestao de estoque', 'Acompanhamento de recompra'],
    status: 'em_desenvolvimento',
    github: {
      repositorio: '',
      acesso: 'pendente',
    },
    financeiro: {
      moeda: 'BRL',
      entradas: [],
      saidas: [],
    },
    responsaveisNomes: ['Mario'],
    participacaoExterna: 0,
    parceiroInvestidor: '',
    pendencias: [],
  },
  {
    id: 'project-veloso-adv',
    nome: 'Veloso Adv',
    descricao: 'Organizacao de operacoes juridicas, atendimento e controle de prazos.',
    features: ['Controle de casos', 'Base de modelos', 'Painel de produtividade', 'Historico do cliente'],
    status: 'validacao',
    github: {
      repositorio: '',
      acesso: 'pendente',
    },
    financeiro: {
      moeda: 'BRL',
      entradas: [],
      saidas: [],
    },
    responsaveisNomes: ['Davi'],
    participacaoExterna: 0,
    parceiroInvestidor: '',
    pendencias: [],
  },
];

const buildInitialProjects = (members: TeamMember[]): PrivateProject[] =>
  INITIAL_PROJECTS_SEED.map((seed) => ({
    ...seed,
    responsaveis: normalizeResponsibleIds(seed.responsaveisNomes, members),
  }));

const normalizeProjects = (projects: PrivateProject[], members: TeamMember[]): PrivateProject[] =>
  projects.map((project) => ({
    ...project,
    responsaveis: normalizeResponsibleIds(project.responsaveis || [], members),
  }));
const normalizeStoredProjects = (storedProjects: unknown, members: TeamMember[]): PrivateProject[] => {
  if (!Array.isArray(storedProjects)) return [];

  const normalized: PrivateProject[] = [];

  for (const rawProject of storedProjects) {
    if (typeof rawProject !== 'object' || rawProject === null) continue;

    const project = rawProject as Partial<PrivateProject> & { responsaveisNomes?: string[] };
    const nome = typeof project.nome === 'string' ? project.nome.trim() : '';
    if (!nome) continue;

    const rawFeatures = Array.isArray(project.features) ? project.features : [];
    const features = rawFeatures.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );

    const rawEntradas = Array.isArray(project.financeiro?.entradas) ? project.financeiro?.entradas : [];
    const rawSaidas = Array.isArray(project.financeiro?.saidas) ? project.financeiro?.saidas : [];

    const entradas = rawEntradas
      .filter((item): item is FinancialMovement => {
        if (typeof item !== 'object' || item === null) return false;
        const movement = item as Partial<FinancialMovement>;
        return (
          typeof movement.id === 'string' &&
          typeof movement.descricao === 'string' &&
          typeof movement.data === 'string' &&
          typeof movement.valor === 'number'
        );
      })
      .map((item) => ({ ...item }));

    const saidas = rawSaidas
      .filter((item): item is FinancialMovement => {
        if (typeof item !== 'object' || item === null) return false;
        const movement = item as Partial<FinancialMovement>;
        return (
          typeof movement.id === 'string' &&
          typeof movement.descricao === 'string' &&
          typeof movement.data === 'string' &&
          typeof movement.valor === 'number'
        );
      })
      .map((item) => ({ ...item }));

    const rawPendencias = Array.isArray(project.pendencias) ? project.pendencias : [];
    const pendencias = rawPendencias
      .filter((item): item is PendingTask => {
        if (typeof item !== 'object' || item === null) return false;
        const task = item as Partial<PendingTask>;
        return (
          typeof task.id === 'string' && typeof task.titulo === 'string' && typeof task.concluida === 'boolean'
        );
      })
      .map((item) => ({ ...item }));

    const rawResponsible = Array.isArray(project.responsaveis)
      ? project.responsaveis
      : Array.isArray(project.responsaveisNomes)
        ? project.responsaveisNomes
        : [];

    const responsaveis = normalizeResponsibleIds(
      rawResponsible.filter((item): item is string => typeof item === 'string'),
      members,
    );

    const status =
      typeof project.status === 'string' && STATUS_OPTIONS.some((option) => option.value === project.status)
        ? project.status
        : 'planejamento';

    const acessoGithub =
      typeof project.github?.acesso === 'string' &&
      GITHUB_ACCESS_OPTIONS.some((option) => option.value === project.github?.acesso)
        ? project.github.acesso
        : 'pendente';

    normalized.push({
      id: typeof project.id === 'string' && project.id.trim() ? project.id : createId('project'),
      nome,
      descricao: typeof project.descricao === 'string' ? project.descricao.trim() : '',
      features,
      status,
      github: {
        repositorio: typeof project.github?.repositorio === 'string' ? project.github.repositorio.trim() : '',
        acesso: acessoGithub,
      },
      financeiro: {
        moeda: 'BRL',
        entradas,
        saidas,
      },
      responsaveis,
      participacaoExterna:
        typeof project.participacaoExterna === 'number' ? clampPercent(project.participacaoExterna) : 0,
      parceiroInvestidor:
        typeof project.parceiroInvestidor === 'string' ? project.parceiroInvestidor.trim() : '',
      pendencias,
    });
  }

  return normalized;
};

const loadProjects = (members: TeamMember[]): PrivateProject[] => {
  if (typeof window === 'undefined') return buildInitialProjects(members);

  const tryKeys = [PROJECTS_STORAGE_KEY, ...LEGACY_PROJECTS_STORAGE_KEYS];
  for (const key of tryKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeStoredProjects(parsed, members);
      if (normalized.length > 0) return normalized;
    } catch {
      continue;
    }
  }

  return buildInitialProjects(members);
};

export default function VentureCapitalPage() {
  const { members } = useTeamMembers();
  const [projects, setProjects] = useState<PrivateProject[]>(() => loadProjects(members));
  const [projectError, setProjectError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ProjectStatus>('todos');
  const [pendingDrafts, setPendingDrafts] = useState<Record<string, string>>({});
  const [financialDrafts, setFinancialDrafts] = useState<Record<string, FinancialMovementFormDraft>>({});
  const [editingPendingByProject, setEditingPendingByProject] = useState<Record<string, string | null>>({});
  const [pendingEditDrafts, setPendingEditDrafts] = useState<Record<string, string>>({});
  const [collapsedOperations, setCollapsedOperations] = useState({
    filtros: true,
    novoProjeto: true,
  });
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [newProject, setNewProject] = useState<NewProjectFormState>({
    nome: '',
    descricao: '',
    features: '',
    status: 'planejamento',
    githubRepo: '',
    githubAcesso: 'pendente',
    responsaveis: [],
    participacaoExterna: '0',
    parceiroInvestidor: '',
  });

  useEffect(() => {
    const memberIdSet = new Set(members.map((member) => member.id));

    setNewProject((prev) => ({
      ...prev,
      responsaveis: prev.responsaveis.filter((responsavelId) => memberIdSet.has(responsavelId)),
    }));

    setProjects((prev) => normalizeProjects(prev, members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const summary = useMemo(() => {
    const totalEntradas = projects.reduce(
      (acc, project) =>
        acc + project.financeiro.entradas.reduce((inner, movement) => inner + movement.valor, 0),
      0,
    );

    const totalSaidas = projects.reduce(
      (acc, project) => acc + project.financeiro.saidas.reduce((inner, movement) => inner + movement.valor, 0),
      0,
    );

    const totalPendencias = projects.reduce(
      (acc, project) => acc + project.pendencias.filter((item) => !item.concluida).length,
      0,
    );

    return {
      totalProjetos: projects.length,
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      totalPendencias,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return projects.filter((project) => {
      if (statusFilter !== 'todos' && project.status !== statusFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = `${project.nome} ${project.descricao} ${project.features.join(' ')}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [projects, searchTerm, statusFilter]);

  const updateProject = (projectId: string, updater: (project: PrivateProject) => PrivateProject) => {
    setProjects((prev) => prev.map((project) => (project.id === projectId ? updater(project) : project)));
  };

  const toggleOperationCollapse = (operation: keyof typeof collapsedOperations) => {
    setCollapsedOperations((prev) => ({
      ...prev,
      [operation]: !prev[operation],
    }));
  };

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !(prev[projectId] ?? true),
    }));
  };

  const handleToggleNewProjectMember = (memberId: string) => {
    setNewProject((prev) => {
      const alreadySelected = prev.responsaveis.includes(memberId);
      return {
        ...prev,
        responsaveis: alreadySelected
          ? prev.responsaveis.filter((item) => item !== memberId)
          : [...prev.responsaveis, memberId],
      };
    });
  };
  const handleCreateProject = (event: React.FormEvent) => {
    event.preventDefault();
    setProjectError('');

    const nome = newProject.nome.trim();
    const descricao = newProject.descricao.trim();
    const features = newProject.features
      .split(/\r?\n|,/)
      .map((feature) => feature.trim())
      .filter(Boolean);

    if (!nome) {
      setProjectError('Informe o nome do projeto.');
      return;
    }

    if (!descricao) {
      setProjectError('Informe a descricao do projeto.');
      return;
    }

    if (features.length === 0) {
      setProjectError('Informe pelo menos uma feature.');
      return;
    }

    if (newProject.responsaveis.length === 0) {
      setProjectError('Selecione ao menos um membro responsavel.');
      return;
    }

    const externalShare = clampPercent(Number(newProject.participacaoExterna.replace(',', '.')));

    setProjects((prev) => [
      {
        id: createId('project'),
        nome,
        descricao,
        features,
        status: newProject.status,
        github: {
          repositorio: newProject.githubRepo.trim(),
          acesso: newProject.githubAcesso,
        },
        financeiro: {
          moeda: 'BRL',
          entradas: [],
          saidas: [],
        },
        responsaveis: [...newProject.responsaveis],
        participacaoExterna: externalShare,
        parceiroInvestidor: newProject.parceiroInvestidor.trim(),
        pendencias: [],
      },
      ...prev,
    ]);

    setNewProject({
      nome: '',
      descricao: '',
      features: '',
      status: 'planejamento',
      githubRepo: '',
      githubAcesso: 'pendente',
      responsaveis: [],
      participacaoExterna: '0',
      parceiroInvestidor: '',
    });

    setCollapsedOperations((prev) => ({
      ...prev,
      novoProjeto: true,
    }));
  };

  const handleToggleProjectMember = (projectId: string, memberId: string) => {
    updateProject(projectId, (project) => {
      const alreadySelected = project.responsaveis.includes(memberId);
      return {
        ...project,
        responsaveis: alreadySelected
          ? project.responsaveis.filter((item) => item !== memberId)
          : [...project.responsaveis, memberId],
      };
    });
  };

  const handleProjectStatusChange = (projectId: string, status: ProjectStatus) => {
    updateProject(projectId, (project) => ({ ...project, status }));
  };

  const handleProjectGithubAccessChange = (projectId: string, acesso: GithubAccess) => {
    updateProject(projectId, (project) => ({
      ...project,
      github: {
        ...project.github,
        acesso,
      },
    }));
  };

  const handleProjectGithubRepoChange = (projectId: string, repo: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      github: {
        ...project.github,
        repositorio: repo,
      },
    }));
  };

  const handleProjectPartnerChange = (projectId: string, partnerName: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      parceiroInvestidor: partnerName,
    }));
  };

  const handleProjectExternalShareChange = (projectId: string, value: string) => {
    const parsed = clampPercent(Number(value.replace(',', '.')));
    updateProject(projectId, (project) => ({
      ...project,
      participacaoExterna: parsed,
    }));
  };

  const getFinancialDraft = (projectId: string) => financialDrafts[projectId] || EMPTY_FINANCIAL_DRAFT;

  const handleFinancialDraftChange = (
    projectId: string,
    patch: Partial<FinancialMovementFormDraft>,
  ) => {
    setFinancialDrafts((prev) => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || EMPTY_FINANCIAL_DRAFT),
        ...patch,
      },
    }));
  };

  const handleAddFinancialMovement = (projectId: string) => {
    const draft = getFinancialDraft(projectId);
    const nome = draft.nome.trim();
    const valor = parseCurrencyNumber(draft.valor);

    if (!nome || valor <= 0) return;

    updateProject(projectId, (project) => {
      const movements = mapProjectMovements(project);
      const nextMovements = [
        ...movements,
        {
          id: createId('movimento'),
          descricao: nome,
          valor,
          data: new Date().toISOString().split('T')[0],
          tipo: draft.tipo,
        },
      ];

      return {
        ...project,
        financeiro: buildFinanceFromMovements(nextMovements),
      };
    });

    setFinancialDrafts((prev) => ({
      ...prev,
      [projectId]: { ...EMPTY_FINANCIAL_DRAFT },
    }));
  };

  const handleFinanceMovementChange = (
    projectId: string,
    movementId: string,
    patch: Partial<{ descricao: string; valor: number; tipo: MovementType }>,
  ) => {
    updateProject(projectId, (project) => {
      const nextMovements = mapProjectMovements(project).map((movement) => {
        if (movement.id !== movementId) return movement;

        return {
          ...movement,
          descricao: patch.descricao ?? movement.descricao,
          valor: typeof patch.valor === 'number' ? Math.max(0, patch.valor) : movement.valor,
          tipo: patch.tipo ?? movement.tipo,
        };
      });

      return {
        ...project,
        financeiro: buildFinanceFromMovements(nextMovements),
      };
    });
  };

  const handleRemoveFinanceMovement = (projectId: string, movementId: string) => {
    updateProject(projectId, (project) => {
      const nextMovements = mapProjectMovements(project).filter((movement) => movement.id !== movementId);
      return {
        ...project,
        financeiro: buildFinanceFromMovements(nextMovements),
      };
    });
  };

  const handlePendingDraftChange = (projectId: string, value: string) => {
    setPendingDrafts((prev) => ({
      ...prev,
      [projectId]: value,
    }));
  };

  const handleAddPending = (projectId: string) => {
    const titulo = (pendingDrafts[projectId] || '').trim();
    if (!titulo) return;

    updateProject(projectId, (project) => ({
      ...project,
      pendencias: [
        ...project.pendencias,
        {
          id: createId('pendencia'),
          titulo,
          concluida: false,
        },
      ],
    }));

    setPendingDrafts((prev) => ({
      ...prev,
      [projectId]: '',
    }));
  };

  const handleTogglePending = (projectId: string, taskId: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      pendencias: project.pendencias.map((task) =>
        task.id === taskId ? { ...task, concluida: !task.concluida } : task,
      ),
    }));
  };

  const getPendingEditKey = (projectId: string, taskId: string) => `${projectId}:${taskId}`;

  const handleStartPendingEdit = (projectId: string, task: PendingTask) => {
    const editKey = getPendingEditKey(projectId, task.id);

    setEditingPendingByProject((prev) => ({
      ...prev,
      [projectId]: task.id,
    }));

    setPendingEditDrafts((prev) => ({
      ...prev,
      [editKey]: task.titulo,
    }));
  };

  const handlePendingEditDraftChange = (projectId: string, taskId: string, value: string) => {
    const editKey = getPendingEditKey(projectId, taskId);
    setPendingEditDrafts((prev) => ({
      ...prev,
      [editKey]: value,
    }));
  };

  const handleFinishPendingEdit = (projectId: string, taskId: string) => {
    const editKey = getPendingEditKey(projectId, taskId);
    const nextTitle = (pendingEditDrafts[editKey] || '').trim();

    if (!nextTitle) {
      updateProject(projectId, (project) => ({
        ...project,
        pendencias: project.pendencias.filter((task) => task.id !== taskId),
      }));
    } else {
      updateProject(projectId, (project) => ({
        ...project,
        pendencias: project.pendencias.map((task) =>
          task.id === taskId ? { ...task, titulo: nextTitle } : task,
        ),
      }));
    }

    setEditingPendingByProject((prev) => ({
      ...prev,
      [projectId]: prev[projectId] === taskId ? null : prev[projectId],
    }));

    setPendingEditDrafts((prev) => {
      const next = { ...prev };
      delete next[editKey];
      return next;
    });
  };

  return (
    <div className="venture-capital-page">
      <div className="page-header">
        <div>
          <h1>Private</h1>
          <p className="page-subtitle">
            Projetos privados com responsaveis definidos pela pagina Membros/Equipe.
          </p>
        </div>
      </div>

      <div className="private-kpis">
        <div className="private-kpi">
          <span>Projetos ativos</span>
          <strong>{summary.totalProjetos}</strong>
        </div>
        <div className="private-kpi">
          <span>Entradas</span>
          <strong className="kpi-positive">{formatCurrency(summary.totalEntradas)}</strong>
        </div>
        <div className="private-kpi">
          <span>Saidas</span>
          <strong className="kpi-negative">{formatCurrency(summary.totalSaidas)}</strong>
        </div>
        <div className="private-kpi">
          <span>Saldo</span>
          <strong>{formatCurrency(summary.saldo)}</strong>
        </div>
        <div className="private-kpi">
          <span>Pendencias abertas</span>
          <strong>{summary.totalPendencias}</strong>
        </div>
      </div>

      <Card className="private-card operation-card">
        <div className="operation-header">
          <h3>Filtros</h3>
          <button
            type="button"
            className="card-collapse-btn"
            onClick={() => toggleOperationCollapse('filtros')}
            aria-expanded={!collapsedOperations.filtros}
            title={collapsedOperations.filtros ? 'Expandir operacao' : 'Resumir operacao'}
          >
            <span className={`collapse-arrow ${collapsedOperations.filtros ? 'closed' : ''}`}>v</span>
          </button>
        </div>

        {!collapsedOperations.filtros && (
          <>
            <div className="private-filters">
              <input
                type="text"
                placeholder="Buscar projeto"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'todos' | ProjectStatus)}
              >
                <option value="todos">Todos os status</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="private-hint">
              A atribuicao de responsaveis e feita pela lista da pagina Membros/Equipe.
            </div>
          </>
        )}
      </Card>
      {filteredProjects.length === 0 ? (
        <Card title="Projetos" className="private-card">
          <div className="empty-state">Nenhum projeto encontrado.</div>
        </Card>
      ) : (
        <div className="private-projects-list">
          {filteredProjects.map((project) => {
            const entradasTotal = project.financeiro.entradas.reduce((sum, item) => sum + item.valor, 0);
            const saidasTotal = project.financeiro.saidas.reduce((sum, item) => sum + item.valor, 0);
            const participacaoInterna = Number((100 - project.participacaoExterna).toFixed(2));
            const isProjectCollapsed = collapsedProjects[project.id] ?? true;
            const financialMovements = mapProjectMovements(project);
            const financialDraft = getFinancialDraft(project.id);

            return (
              <Card key={project.id} className="private-project-card">
                <div className="project-card-header">
                  <div>
                    <h3>{project.nome}</h3>
                    <p>{project.descricao}</p>
                  </div>

                  <div className="project-header-actions">
                    <div className={`project-status-badge status-${project.status}`}>
                      {PROJECT_STATUS_LABEL[project.status]}
                    </div>
                    <button
                      type="button"
                      className="card-collapse-btn"
                      onClick={() => toggleProjectCollapse(project.id)}
                      aria-expanded={!isProjectCollapsed}
                      title={isProjectCollapsed ? 'Expandir operacao' : 'Resumir operacao'}
                    >
                      <span className={`collapse-arrow ${isProjectCollapsed ? 'closed' : ''}`}>v</span>
                    </button>
                  </div>
                </div>

                {!isProjectCollapsed && (
                  <>
                    <div className="project-features">
                      {project.features.map((feature, index) => (
                        <span key={`${project.id}_feature_${index}`} className="feature-chip">
                          {feature}
                        </span>
                      ))}
                    </div>

                    <div className="project-spec-grid">
                      <section className="project-spec-block">
                        <h4>GitHub e status</h4>
                        <label className="inline-edit-row">
                          <span>Status</span>
                          <select
                            value={project.status}
                            onChange={(event) =>
                              handleProjectStatusChange(project.id, event.target.value as ProjectStatus)
                            }
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="inline-edit-row">
                          <span>Acesso GitHub</span>
                          <select
                            value={project.github.acesso}
                            onChange={(event) =>
                              handleProjectGithubAccessChange(project.id, event.target.value as GithubAccess)
                            }
                          >
                            {GITHUB_ACCESS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="inline-edit-row">
                          <span>Repositorio</span>
                          <input
                            type="text"
                            placeholder="https://github.com/..."
                            value={project.github.repositorio}
                            onChange={(event) => handleProjectGithubRepoChange(project.id, event.target.value)}
                          />
                        </label>
                      </section>

                      <section className="project-spec-block">
                        <h4>Financeiro</h4>
                        <div className="finance-summary">
                          <span className="finance-pill positive">Entradas: {formatCurrency(entradasTotal)}</span>
                          <span className="finance-pill negative">Saidas: {formatCurrency(saidasTotal)}</span>
                          <span className="finance-pill neutral">
                            Saldo: {formatCurrency(entradasTotal - saidasTotal)}
                          </span>
                        </div>

                        <div className="finance-add-row">
                          <input
                            type="text"
                            placeholder="Nome do lancamento"
                            value={financialDraft.nome}
                            onChange={(event) =>
                              handleFinancialDraftChange(project.id, {
                                nome: event.target.value,
                              })
                            }
                          />
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="Valor"
                            value={financialDraft.valor}
                            onChange={(event) =>
                              handleFinancialDraftChange(project.id, {
                                valor: event.target.value,
                              })
                            }
                          />
                          <select
                            value={financialDraft.tipo}
                            onChange={(event) =>
                              handleFinancialDraftChange(project.id, {
                                tipo: event.target.value as MovementType,
                              })
                            }
                          >
                            <option value="entrada">Entrada</option>
                            <option value="saida">Saida</option>
                          </select>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleAddFinancialMovement(project.id)}
                          >
                            Adicionar
                          </button>
                        </div>

                        {financialMovements.length === 0 ? (
                          <p className="section-empty">Sem lancamentos cadastrados.</p>
                        ) : (
                          <div className="finance-list">
                            {financialMovements.map((item) => (
                              <div key={item.id} className="finance-item">
                                <input
                                  type="text"
                                  value={item.descricao}
                                  onChange={(event) =>
                                    handleFinanceMovementChange(project.id, item.id, {
                                      descricao: event.target.value,
                                    })
                                  }
                                  placeholder="Nome"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={item.valor}
                                  onChange={(event) =>
                                    handleFinanceMovementChange(project.id, item.id, {
                                      valor: parseCurrencyNumber(event.target.value || '0'),
                                    })
                                  }
                                />
                                <select
                                  value={item.tipo}
                                  onChange={(event) =>
                                    handleFinanceMovementChange(project.id, item.id, {
                                      tipo: event.target.value as MovementType,
                                    })
                                  }
                                >
                                  <option value="entrada">Entrada</option>
                                  <option value="saida">Saida</option>
                                </select>
                                <button
                                  type="button"
                                  className="finance-remove-btn"
                                  onClick={() => handleRemoveFinanceMovement(project.id, item.id)}
                                  title="Remover lancamento"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="project-spec-block">
                        <h4>Responsaveis</h4>
                        {members.length === 0 ? (
                          <p className="section-empty">Cadastre membros na pagina Membros/Equipe.</p>
                        ) : (
                          <div className="members-check-grid">
                            {members.map((member) => (
                              <label key={`${project.id}_${member.id}`} className="member-check-item">
                                <input
                                  type="checkbox"
                                  checked={project.responsaveis.includes(member.id)}
                                  onChange={() => handleToggleProjectMember(project.id, member.id)}
                                />
                                <span>{member.nome}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="project-spec-block">
                        <h4>Participacao</h4>
                        <label className="inline-edit-row">
                          <span>Investidor parceiro / contratante</span>
                          <input
                            type="text"
                            placeholder="Nome do parceiro investidor/contratante"
                            value={project.parceiroInvestidor}
                            onChange={(event) => handleProjectPartnerChange(project.id, event.target.value)}
                          />
                        </label>
                        <label className="inline-edit-row">
                          <span>Participacao externa (%)</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={project.participacaoExterna}
                            onChange={(event) => handleProjectExternalShareChange(project.id, event.target.value)}
                          />
                        </label>

                        <div className="finance-summary">
                          <span className="finance-pill neutral">Interna: {participacaoInterna}%</span>
                          <span className="finance-pill neutral">Externa: {project.participacaoExterna}%</span>
                        </div>
                      </section>
                    </div>

                    <section className="project-pending-list">
                      <div className="pending-header">
                        <h4>Tarefas pendentes</h4>
                        <span>{project.pendencias.filter((item) => !item.concluida).length} em aberto</span>
                      </div>

                      <div className="pending-add-row">
                        <input
                          type="text"
                          placeholder="Nova pendencia"
                          value={pendingDrafts[project.id] || ''}
                          onChange={(event) => handlePendingDraftChange(project.id, event.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleAddPending(project.id)}
                        >
                          Adicionar
                        </button>
                      </div>

                      {project.pendencias.length === 0 ? (
                        <p className="section-empty">Nenhuma pendencia cadastrada.</p>
                      ) : (
                        <div className="pending-list">
                          {project.pendencias.map((task) => {
                            const editKey = getPendingEditKey(project.id, task.id);
                            const isEditingTask = editingPendingByProject[project.id] === task.id;
                            const editingValue = pendingEditDrafts[editKey] ?? task.titulo;

                            return (
                              <div key={task.id} className={`pending-item ${task.concluida ? 'done' : ''}`}>
                                {isEditingTask ? (
                                  <input
                                    type="text"
                                    className="pending-inline-input"
                                    value={editingValue}
                                    onChange={(event) =>
                                      handlePendingEditDraftChange(project.id, task.id, event.target.value)
                                    }
                                    onBlur={() => handleFinishPendingEdit(project.id, task.id)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        handleFinishPendingEdit(project.id, task.id);
                                      }
                                    }}
                                    autoFocus
                                  />
                                ) : (
                                  <span>{task.titulo}</span>
                                )}

                                <div className="pending-item-actions">
                                  <button
                                    type="button"
                                    className="pending-edit-btn"
                                    onClick={() => handleStartPendingEdit(project.id, task)}
                                    title="Editar pendencia"
                                    aria-label="Editar pendencia"
                                  >
                                    <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                                  </button>
                                  <input
                                    type="checkbox"
                                    checked={task.concluida}
                                    onChange={() => handleTogglePending(project.id, task.id)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="private-card new-project-card operation-card">
        <div className="operation-header">
          <h3>Novo projeto</h3>
          <button
            type="button"
            className="card-collapse-btn"
            onClick={() => toggleOperationCollapse('novoProjeto')}
            aria-expanded={!collapsedOperations.novoProjeto}
            title={collapsedOperations.novoProjeto ? 'Expandir operacao' : 'Resumir operacao'}
          >
            <span className={`collapse-arrow ${collapsedOperations.novoProjeto ? 'closed' : ''}`}>v</span>
          </button>
        </div>
        {!collapsedOperations.novoProjeto && (
          <form className="private-form" onSubmit={handleCreateProject}>
            <label>
              Nome do projeto *
              <input
                type="text"
                value={newProject.nome}
                onChange={(event) => setNewProject((prev) => ({ ...prev, nome: event.target.value }))}
                required
              />
            </label>

            <label>
              Descricao *
              <textarea
                rows={3}
                value={newProject.descricao}
                onChange={(event) => setNewProject((prev) => ({ ...prev, descricao: event.target.value }))}
                required
              />
            </label>

            <label>
              Features *
              <textarea
                rows={4}
                placeholder="Uma por linha ou separadas por virgula"
                value={newProject.features}
                onChange={(event) => setNewProject((prev) => ({ ...prev, features: event.target.value }))}
                required
              />
            </label>

            <div className="private-form-row">
              <label>
                Status
                <select
                  value={newProject.status}
                  onChange={(event) =>
                    setNewProject((prev) => ({ ...prev, status: event.target.value as ProjectStatus }))
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Acesso GitHub
                <select
                  value={newProject.githubAcesso}
                  onChange={(event) =>
                    setNewProject((prev) => ({ ...prev, githubAcesso: event.target.value as GithubAccess }))
                  }
                >
                  {GITHUB_ACCESS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Repositorio GitHub
              <input
                type="url"
                placeholder="https://github.com/..."
                value={newProject.githubRepo}
                onChange={(event) => setNewProject((prev) => ({ ...prev, githubRepo: event.target.value }))}
              />
            </label>

            <div className="private-form-row">
              <label>
                Participacao externa (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={newProject.participacaoExterna}
                  onChange={(event) =>
                    setNewProject((prev) => ({ ...prev, participacaoExterna: event.target.value }))
                  }
                />
              </label>

              <label>
                Investidor parceiro / contratante
                <input
                  type="text"
                  value={newProject.parceiroInvestidor}
                  onChange={(event) =>
                    setNewProject((prev) => ({ ...prev, parceiroInvestidor: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="project-members-selector">
              <span>Membros responsaveis *</span>
              {members.length === 0 ? (
                <p className="section-empty">Cadastre membros na pagina Membros/Equipe.</p>
              ) : (
                <div className="members-check-grid">
                  {members.map((member) => (
                    <label key={member.id} className="member-check-item">
                      <input
                        type="checkbox"
                        checked={newProject.responsaveis.includes(member.id)}
                        onChange={() => handleToggleNewProjectMember(member.id)}
                      />
                      <span>{member.nome}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {projectError && <span className="private-error">{projectError}</span>}

            <button type="submit" className="btn-primary">
              + Criar projeto
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
