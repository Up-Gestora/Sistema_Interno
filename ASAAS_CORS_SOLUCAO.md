# Solução para Problema de CORS com API do Asaas

## Problema

O erro "Failed to fetch" ocorre porque a API do Asaas não permite requisições diretas do navegador devido a políticas de CORS (Cross-Origin Resource Sharing).

## Soluções

### Opção 1: Backend/Proxy (Recomendado para Produção)

A melhor solução é criar um endpoint no seu backend que faça as requisições à API do Asaas. Isso:
- ✅ Resolve problemas de CORS
- ✅ Mantém sua API Key segura (não exposta no frontend)
- ✅ Permite controle total sobre as requisições

#### Exemplo de Endpoint no Backend (Node.js/Express):

```javascript
// Backend: /api/asaas/proxy
app.post('/api/asaas/proxy', async (req, res) => {
  const { endpoint, method = 'GET', params } = req.body;
  const apiKey = process.env.ASAAS_API_KEY; // API Key no servidor
  
  const baseUrl = 'https://www.asaas.com/api/v3';
  const url = `${baseUrl}${endpoint}${params ? '?' + new URLSearchParams(params).toString() : ''}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### No Frontend, modifique `asaasService.ts`:

```typescript
async function asaasRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Usar seu backend como proxy
  const response = await fetch('/api/asaas/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint,
      method: options.method || 'GET',
      params: extractParamsFromEndpoint(endpoint),
    }),
  });
  
  return response.json();
}
```

### Opção 2: Extensão do Navegador (Apenas Desenvolvimento)

Para desenvolvimento local, você pode usar uma extensão que desabilita CORS:

1. **Chrome/Edge:**
   - Instale "CORS Unblock" ou "Allow CORS: Access-Control-Allow-Origin"
   - Ative a extensão apenas para desenvolvimento local

2. **Firefox:**
   - Use "CORS Everywhere" ou configure `about:config`

⚠️ **IMPORTANTE:** Nunca use isso em produção! É apenas para desenvolvimento.

### Opção 3: Proxy CORS Público (Não Recomendado)

Existem proxies CORS públicos, mas:
- ❌ Não são seguros (sua API Key passa por servidores de terceiros)
- ❌ Podem estar indisponíveis
- ❌ Não são adequados para produção

## Verificações

1. **API Key correta?**
   - Verifique se está usando a API Key correta do Asaas
   - Confirme se está no ambiente correto (Produção/Sandbox)

2. **URL da API correta?**
   - Produção: `https://www.asaas.com/api/v3`
   - Sandbox: `https://sandbox.asaas.com/api/v3`

3. **Header correto?**
   - A API do Asaas usa `access_token` como header (não `Authorization`)

## Próximos Passos

1. Se você tem um backend, implemente a Opção 1
2. Se está apenas desenvolvendo, use a Opção 2 temporariamente
3. Para produção, sempre use a Opção 1 (backend/proxy)





