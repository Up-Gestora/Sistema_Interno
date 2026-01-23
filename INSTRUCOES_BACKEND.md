# 🚀 Instruções para Configurar o Backend

## Passo a Passo

### 1. Instalar Dependências do Backend

Abra o terminal na raiz do projeto e execute:

```bash
cd server
npm install
```

Ou, se preferir instalar manualmente:

```bash
cd server
npm install express cors dotenv
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` dentro da pasta `server/` com o seguinte conteúdo:

```env
PORT=3001
NODE_ENV=development
ASAAS_API_KEY=sua_api_key_do_asaas_aqui
ASAAS_AMBIENTE=production
```

**Importante:** 
- Substitua `sua_api_key_do_asaas_aqui` pela sua API Key real do Asaas
- Use `production` para ambiente de produção ou `sandbox` para testes

### 3. Iniciar o Backend

Você tem duas opções:

#### Opção A: Rodar apenas o backend
```bash
cd server
npm run dev
```

#### Opção B: Rodar frontend e backend juntos (recomendado)
Na raiz do projeto:
```bash
npm run install:backend  # Apenas na primeira vez
npm run dev:all
```

Isso iniciará:
- Frontend na porta **5173** (http://localhost:5173)
- Backend na porta **3001** (http://localhost:3001)

### 4. Verificar se está funcionando

Abra no navegador:
- http://localhost:3001/api/health

Você deve ver:
```json
{
  "status": "ok",
  "message": "Backend está funcionando!"
}
```

## ✅ Pronto!

Agora você pode:
1. Acessar a página "Asaas" no sistema
2. Configurar sua API Key (ela será enviada via header para o backend)
3. Visualizar pagamentos e cobranças sem problemas de CORS!

## 🔧 Solução de Problemas

### Erro: "Cannot find module 'express'"
**Solução:** Execute `npm install` dentro da pasta `server/`

### Erro: "Port 3001 is already in use"
**Solução:** Altere a porta no arquivo `server/.env`:
```env
PORT=3002
```

E atualize o `vite.config.ts` para usar a nova porta no proxy.

### Erro: "Failed to fetch" no frontend
**Solução:** 
1. Verifique se o backend está rodando (http://localhost:3001/api/health)
2. Verifique se a API Key está correta no `.env` ou no formulário do frontend
3. Verifique se o Vite está configurado para fazer proxy (já está configurado)

## 📝 Notas Importantes

- A API Key pode ser configurada de duas formas:
  1. **Via arquivo `.env`** (recomendado para produção) - mais seguro
  2. **Via formulário no frontend** - enviada como header em cada requisição

- O backend faz as requisições à API do Asaas, então sua API Key nunca é exposta diretamente no navegador
- Todas as requisições passam pelo backend, resolvendo problemas de CORS automaticamente





