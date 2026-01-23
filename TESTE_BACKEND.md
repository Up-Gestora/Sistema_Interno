# 🧪 Como Testar o Backend

## 1. Verificar se o backend está rodando

Abra o terminal e execute:

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

## 2. Testar o endpoint de health

Abra no navegador ou use curl:
```
http://localhost:3001/api/health
```

Deve retornar:
```json
{
  "status": "ok",
  "message": "Backend está funcionando!"
}
```

## 3. Verificar os logs

Quando você fizer uma requisição do frontend, você deve ver no terminal do backend:

```
📥 Requisição recebida: { endpoint: '/payments', method: 'GET', ambiente: 'production', hasApiKey: true }
🌐 Fazendo requisição para: https://www.asaas.com/api/v3/payments?limit=100
✅ Resposta recebida: 200 OK
```

## 4. Se houver erro

Os logs mostrarão:
- ❌ Se a API Key não foi fornecida
- ❌ Se o endpoint está inválido
- ❌ Se houve erro de conexão
- ❌ O stack trace completo do erro

## 5. Solução de Problemas

### Erro: "Cannot find module 'node-fetch'"
```bash
cd server
npm install
```

### Erro: "Port 3001 is already in use"
Altere a porta no arquivo `server/.env`:
```env
PORT=3002
```

E atualize o `vite.config.ts` para usar a nova porta.

### Erro 500 no backend
Verifique os logs do terminal do backend. Eles mostrarão exatamente qual é o problema.





