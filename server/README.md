# Backend - Sistema Interno

Servidor proxy para integração com a API do Asaas, resolvendo problemas de CORS.

## 🚀 Como usar

### 1. Instalar dependências

```bash
npm install
```

Ou do diretório raiz:

```bash
npm run install:backend
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na pasta `server/`:

```env
PORT=3001
NODE_ENV=development
ASAAS_API_KEY=sua_api_key_do_asaas
ASAAS_AMBIENTE=production
```

**Nota:** A API Key também pode ser enviada via header `X-Asaas-Api-Key` em cada requisição, caso prefira não armazená-la no servidor.

### 3. Iniciar o servidor

```bash
npm run dev
```

Ou do diretório raiz (para rodar frontend e backend juntos):

```bash
npm run dev:all
```

O servidor estará disponível em `http://localhost:3001`

## 📡 Endpoints

### `POST /api/asaas/proxy`

Proxy para fazer requisições à API do Asaas.

**Headers:**
- `X-Asaas-Api-Key` (opcional): API Key do Asaas. Se não fornecido, usa `ASAAS_API_KEY` do `.env`
- `X-Asaas-Ambiente` (opcional): Ambiente (`production` ou `sandbox`). Padrão: `production`

**Body:**
```json
{
  "endpoint": "/payments",
  "method": "GET",
  "params": {
    "status": "RECEIVED",
    "limit": 100
  }
}
```

**Exemplo de resposta:**
```json
{
  "object": "list",
  "hasMore": false,
  "totalCount": 10,
  "data": [...]
}
```

### `GET /api/health`

Verifica se o servidor está funcionando.

## 🔒 Segurança

- A API Key pode ser configurada via variável de ambiente (recomendado para produção)
- Ou enviada via header em cada requisição (útil para desenvolvimento)
- O backend faz as requisições à API do Asaas, mantendo a chave segura no servidor







