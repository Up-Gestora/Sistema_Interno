# 🚀 Guia Completo - Integração Asaas

## 📋 O que você precisa

1. **API Key do Asaas** - Você já tem isso
2. **Node.js instalado** - Para rodar o backend
3. **Terminal/PowerShell** - Para executar comandos

---

## 🔧 Passo 1: Verificar se o backend está configurado

O código do backend já está pronto em `server/index.js`. Vamos verificar se está tudo certo:

### Estrutura do Backend

```
server/
├── index.js          (código do servidor)
├── package.json      (dependências)
└── .env             (variáveis de ambiente - você vai criar)
```

---

## 📝 Passo 2: Instalar dependências do backend

Abra um terminal na pasta `server` e execute:

```bash
cd server
npm install
```

Isso vai instalar:
- `express` - servidor web
- `cors` - permite requisições do frontend
- `dotenv` - gerencia variáveis de ambiente
- `node-fetch` - faz requisições HTTP

---

## ⚙️ Passo 3: Configurar variáveis de ambiente (opcional)

Crie um arquivo `.env` na pasta `server/`:

```env
PORT=3001
NODE_ENV=development
ASAAS_API_KEY=sua_api_key_aqui
ASAAS_AMBIENTE=production
```

**Nota:** Você NÃO precisa criar esse arquivo se preferir configurar a API Key diretamente no frontend (via modal). O backend aceita a API Key via header também.

---

## 🚀 Passo 4: Iniciar o backend

Abra um terminal e execute:

```bash
cd server
npm run dev
```

Você deve ver:
```
🚀 Servidor backend rodando na porta 3001
📡 Endpoint proxy: http://localhost:3001/api/asaas/proxy
💡 Configure a API Key do Asaas via variável de ambiente ASAAS_API_KEY ou header X-Asaas-Api-Key
```

**IMPORTANTE:** Deixe esse terminal aberto enquanto usar o sistema!

---

## 🌐 Passo 5: Iniciar o frontend

Abra OUTRO terminal (deixe o backend rodando) e execute:

```bash
npm run dev
```

O frontend vai rodar na porta 5173 e já está configurado para usar o backend na porta 3001.

---

## 🔑 Passo 6: Configurar API Key no sistema

1. Acesse a aba "Asaas" no sistema
2. Clique em "⚙️ Configurar API"
3. Cole sua API Key do Asaas
4. Selecione o ambiente (Produção ou Sandbox)
5. Clique em "Salvar e Conectar"

A API Key será salva no navegador (localStorage) e enviada para o backend via header.

---

## 🔍 Verificar se está funcionando

### Teste 1: Health Check do Backend

Abra no navegador: `http://localhost:3001/api/health`

Deve retornar:
```json
{
  "status": "ok",
  "message": "Backend está funcionando!"
}
```

### Teste 2: No sistema

1. Configure a API Key no modal
2. O sistema deve carregar os pagamentos automaticamente
3. Você deve ver cards com resumo financeiro
4. A tabela deve mostrar pagamentos e cobranças

---

## ⚠️ Possíveis Problemas

### Erro: "Failed to fetch" ou "ECONNREFUSED"

**Causa:** Backend não está rodando

**Solução:**
1. Verifique se o backend está rodando (veja Passo 4)
2. Verifique se a porta 3001 está livre
3. Tente acessar `http://localhost:3001/api/health` no navegador

### Erro: "API Key não fornecida"

**Causa:** API Key não foi configurada

**Solução:**
1. Configure a API Key no modal do sistema
2. Ou crie o arquivo `.env` com `ASAAS_API_KEY`

### Erro: "401 Unauthorized" ou "403 Forbidden"

**Causa:** API Key inválida ou sem permissões

**Solução:**
1. Verifique se a API Key está correta
2. Verifique se está usando o ambiente correto (Produção/Sandbox)
3. Verifique se a API Key tem permissões para ler pagamentos

### Erro: "500 Internal Server Error"

**Causa:** Problema no backend ao fazer requisição para Asaas

**Solução:**
1. Verifique os logs do backend (no terminal onde está rodando)
2. Verifique se a API Key está correta
3. Verifique se o endpoint do Asaas está acessível

---

## 📊 O que o sistema faz

### Funcionalidades implementadas:

1. **Visualizar Pagamentos**
   - Lista todos os pagamentos
   - Filtro por status (Recebido, Pendente, Vencido, etc.)
   - Informações: valor, data, cliente, status

2. **Resumo Financeiro**
   - Saldo atual
   - Recebido este mês
   - Pendente
   - Esperado este mês
   - Vencido

3. **Buscar Cobranças**
   - Lista cobranças a receber
   - Filtros por status e data

4. **Buscar Clientes**
   - Lista clientes do Asaas
   - Filtros por nome, email, CPF/CNPJ

---

## 🔐 Segurança

- A API Key é armazenada no localStorage do navegador
- A API Key é enviada para o backend via header `X-Asaas-Api-Key`
- O backend faz as requisições à API do Asaas (evita CORS)
- A API Key nunca é exposta no código do frontend

---

## 📝 Código do Backend (já está pronto)

O arquivo `server/index.js` já contém todo o código necessário. Ele:

1. Cria um servidor Express na porta 3001
2. Configura CORS para aceitar requisições do frontend
3. Cria um endpoint `/api/asaas/proxy` que:
   - Recebe requisições do frontend
   - Adiciona a API Key do Asaas nos headers
   - Faz a requisição à API do Asaas
   - Retorna a resposta para o frontend

---

## 🎯 Próximos Passos (opcional)

Você pode expandir a integração adicionando:

1. **Criar cobranças** - Criar novas cobranças via API
2. **Atualizar pagamentos** - Marcar pagamentos como recebidos
3. **Sincronizar clientes** - Sincronizar clientes do Asaas com o sistema
4. **Webhooks** - Receber notificações do Asaas em tempo real
5. **Relatórios** - Gerar relatórios baseados nos dados do Asaas

---

## 📞 Precisa de ajuda?

Se encontrar algum problema:

1. Verifique os logs do backend (terminal onde está rodando)
2. Verifique o console do navegador (F12 → Console)
3. Verifique se a API Key está correta
4. Verifique se o backend está rodando

---

## ✅ Checklist Final

- [ ] Backend instalado (`npm install` na pasta `server`)
- [ ] Backend rodando (`npm run dev` na pasta `server`)
- [ ] Frontend rodando (`npm run dev` na raiz)
- [ ] API Key configurada no sistema
- [ ] Health check funcionando (`http://localhost:3001/api/health`)
- [ ] Dados do Asaas aparecendo no sistema

---

**Tudo pronto!** 🎉




