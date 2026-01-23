# Sistema Interno - Dashboard Administrativo

Sistema para organização administrativa com foco em gestão de clientes e patrimônio líquido.

## 🚀 Tecnologias

- **React 18** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Superset do JavaScript com tipagem estática
- **Vite** - Build tool moderna e rápida
- **Recharts** - Biblioteca para gráficos e visualizações
- **CSS3** - Estilização moderna e responsiva

## 📦 Instalação

1. Instale as dependências:
```bash
npm install
```

2. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

3. Acesse o sistema no navegador:
```
http://localhost:5173
```

## 🏗️ Estrutura do Projeto

```
src/
├── components/          # Componentes React
│   ├── Card/           # Componente de card reutilizável
│   ├── Clientes/       # Componente de listagem de clientes
│   ├── Dashboard/      # Componente principal do dashboard
│   ├── Layout/         # Layout principal da aplicação
│   ├── PatrimonioLiquido/  # Componente de patrimônio líquido
│   └── StatCard/       # Card de estatísticas
├── data/               # Dados mockados
├── types/              # Definições TypeScript
├── utils/              # Funções utilitárias
├── App.tsx            # Componente raiz
├── main.tsx           # Ponto de entrada
└── index.css          # Estilos globais
```

## ✨ Funcionalidades

### Dashboard
- Visão geral com estatísticas principais
- Cards informativos com métricas importantes

### Clientes
- Listagem completa de clientes
- Filtros por status (Todos, Ativos, Inativos)
- Informações detalhadas: nome, email, telefone, empresa, data de cadastro e valor total de contratos

### Patrimônio Líquido
- Resumo patrimonial (Ativos, Passivos, Patrimônio Líquido)
- Gráficos interativos:
  - Gráfico de pizza: Distribuição Ativos vs Passivos
  - Gráfico de barras: Patrimônio por tipo
- Listagem detalhada de todos os itens patrimoniais

## 🎨 Design

O sistema utiliza um design moderno e responsivo com:
- Cores consistentes e profissionais
- Layout adaptável para diferentes tamanhos de tela
- Animações suaves e transições
- Interface intuitiva e fácil de usar

## 📝 Próximos Passos

- [ ] Integração com backend/API
- [ ] Sistema de autenticação
- [ ] CRUD completo de clientes
- [ ] CRUD completo de patrimônio
- [ ] Exportação de relatórios
- [ ] Filtros e buscas avançadas
- [ ] Histórico e auditoria

## 🔧 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run preview` - Preview do build de produção
- `npm run lint` - Executa o linter

