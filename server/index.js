import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import multer from 'multer';

// Carregar variáveis de ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer({ storage: multer.memoryStorage() });

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
let dashboardCache = {
  timestamp: 0,
  ambiente: '',
  apiKey: '',
  customersMap: {},
  overdueSet: new Set(),
};

// Middlewares
app.use(cors());
app.use(express.json());

// Log de requisições (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Endpoint de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend está funcionando!' });
});

// Endpoint proxy para API do Asaas
app.post('/api/asaas/proxy', async (req, res) => {
  try {
    const { endpoint, method = 'GET', params, body: requestBody } = req.body;
    const apiKey = req.headers['x-asaas-api-key'] || process.env.ASAAS_API_KEY;
    const ambiente = req.headers['x-asaas-ambiente'] || process.env.ASAAS_AMBIENTE || 'production';

    console.log('📥 Requisição recebida:', { endpoint, method, ambiente, hasApiKey: !!apiKey });

    // Validar API Key
    if (!apiKey) {
      console.error('❌ API Key não fornecida');
      return res.status(400).json({ 
        error: 'API Key do Asaas não fornecida. Configure via header X-Asaas-Api-Key ou variável de ambiente ASAAS_API_KEY' 
      });
    }

    // Validar endpoint
    if (!endpoint || typeof endpoint !== 'string') {
      console.error('❌ Endpoint inválido:', endpoint);
      return res.status(400).json({ error: 'Endpoint é obrigatório' });
    }

    // URLs base da API do Asaas
    const baseUrls = {
      sandbox: 'https://sandbox.asaas.com/api/v3',
      production: 'https://api.asaas.com/v3', // URL oficial da API
    };

    const baseUrl = baseUrls[ambiente] || baseUrls.production;
    
    // Construir URL completa
    let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    // Adicionar query params se existirem
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    console.log('🌐 Fazendo requisição para:', url);

    // Fazer requisição à API do Asaas
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Sistema-Interno/1.0.0', // Recomendado pela documentação
      },
    };

    // Adicionar body se for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && requestBody) {
      fetchOptions.body = JSON.stringify(requestBody);
    }

    let response;
    try {
      // Usar node-fetch para compatibilidade
      response = await fetch(url, fetchOptions);
    } catch (fetchError) {
      console.error('❌ Erro ao fazer fetch:', fetchError);
      throw new Error(`Erro de conexão: ${fetchError.message}`);
    }

    // Ler resposta
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    console.log(`✅ Resposta recebida: ${response.status} ${response.statusText}`);

    // Retornar status e dados
    res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ Erro no proxy Asaas:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Erro ao fazer requisição à API do Asaas',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoint proxy para API do Assinafy
app.post('/api/assinafy/proxy', async (req, res) => {
  try {
    const { endpoint, method = 'GET', params, body: requestBody } = req.body || {};
    const apiKey = req.headers['x-assinafy-api-key'] || process.env.ASSINAFY_API_KEY;
    const ambiente = req.headers['x-assinafy-ambiente'] || process.env.ASSINAFY_AMBIENTE || 'production';

    if (!apiKey) {
      return res.status(400).json({
        error: 'API Key do Assinafy não fornecida. Configure via header X-Assinafy-Api-Key ou variável de ambiente ASSINAFY_API_KEY',
      });
    }

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Endpoint é obrigatório' });
    }

    const baseUrls = {
      sandbox: 'https://api-staging.assinafy.com.br/v1',
      production: 'https://api.assinafy.com.br/v1',
    };

    const baseUrl = baseUrls[ambiente] || baseUrls.production;

    let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Sistema-Interno/1.0.0',
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && requestBody) {
      fetchOptions.body = JSON.stringify(requestBody);
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type');
    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ Erro no proxy Assinafy:', error);
    return res.status(500).json({
      error: 'Erro ao fazer requisição à API do Assinafy',
      message: error.message,
    });
  }
});

// Endpoint upload de documento para Assinafy
app.post('/api/assinafy/upload', upload.single('file'), async (req, res) => {
  try {
    const apiKey = req.headers['x-assinafy-api-key'] || process.env.ASSINAFY_API_KEY;
    const ambiente = req.headers['x-assinafy-ambiente'] || process.env.ASSINAFY_AMBIENTE || 'production';
    const accountId = req.body?.accountId;

    if (!apiKey) {
      return res.status(400).json({
        error: 'API Key do Assinafy não fornecida. Configure via header X-Assinafy-Api-Key ou variável de ambiente ASSINAFY_API_KEY',
      });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'Workspace Account ID é obrigatório.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado.' });
    }

    const baseUrls = {
      sandbox: 'https://api-staging.assinafy.com.br/v1',
      production: 'https://api.assinafy.com.br/v1',
    };

    const baseUrl = baseUrls[ambiente] || baseUrls.production;
    const url = `${baseUrl}/accounts/${accountId}/documents`;

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);
    if (req.body?.name) {
      formData.append('name', req.body.name);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'User-Agent': 'Sistema-Interno/1.0.0',
      },
      body: formData,
    });

    const contentType = response.headers.get('content-type');
    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ Erro no upload Assinafy:', error);
    return res.status(500).json({
      error: 'Erro ao enviar documento para o Assinafy',
      message: error.message,
    });
  }
});

// Endpoint de resumo para o Dashboard (contatos + inadimplência)
app.post('/api/asaas/dashboard-data', async (req, res) => {
  try {
    const { customerIds } = req.body || {};
    const apiKey = req.headers['x-asaas-api-key'] || process.env.ASAAS_API_KEY;
    const ambiente = req.headers['x-asaas-ambiente'] || process.env.ASAAS_AMBIENTE || 'production';

    if (!apiKey) {
      return res.status(400).json({
        error: 'API Key do Asaas não fornecida. Configure via header X-Asaas-Api-Key ou variável de ambiente ASAAS_API_KEY',
      });
    }

    const baseUrls = {
      sandbox: 'https://sandbox.asaas.com/api/v3',
      production: 'https://api.asaas.com/v3',
    };

    const baseUrl = baseUrls[ambiente] || baseUrls.production;

    const buildUrl = (endpoint, params) => {
      let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      if (params && Object.keys(params).length > 0) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, String(value));
          }
        });
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }
      return url;
    };

    const asaasGet = async (endpoint, params) => {
      const url = buildUrl(endpoint, params);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'Sistema-Interno/1.0.0',
        },
      });

      if (!response.ok) {
        let errorMessage = `Erro na API: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorData.errors?.[0]?.description || errorMessage;
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }

      return response.json();
    };

    const buscarPaginado = async (endpoint, params) => {
      const limit = 100;
      let offset = 0;
      const todos = [];

      while (true) {
        const resposta = await asaasGet(endpoint, { ...params, limit, offset });
        todos.push(...(resposta.data || []));
        if (!resposta.hasMore) break;
        offset += limit;
      }

      return todos;
    };

    const agora = Date.now();
    const cacheValido =
      dashboardCache.timestamp > 0 &&
      agora - dashboardCache.timestamp < DASHBOARD_CACHE_TTL_MS &&
      dashboardCache.apiKey === apiKey &&
      dashboardCache.ambiente === ambiente;

    if (!cacheValido) {
      const clientes = await buscarPaginado('/customers', {});
      const pagamentosVencidos = await buscarPaginado('/payments', { status: 'OVERDUE' });

      const customersMap = {};
      clientes.forEach((cliente) => {
        customersMap[cliente.id] = {
          email: cliente.email,
          telefone: cliente.mobilePhone || cliente.phone,
        };
      });

      const overdueSet = new Set(pagamentosVencidos.map((pagamento) => pagamento.customer));

      dashboardCache = {
        timestamp: agora,
        ambiente,
        apiKey,
        customersMap,
        overdueSet,
      };
    }

    const ids = Array.isArray(customerIds) ? customerIds : Object.keys(dashboardCache.customersMap);
    const contatos = {};
    const status = {};

    ids.forEach((id) => {
      if (dashboardCache.customersMap[id]) {
        contatos[id] = dashboardCache.customersMap[id];
      }
      status[id] = dashboardCache.overdueSet.has(id) ? 'Inad' : 'OK';
    });

    return res.json({
      contatos,
      status,
      cacheAt: dashboardCache.timestamp,
      ttlMs: DASHBOARD_CACHE_TTL_MS,
    });
  } catch (error) {
    console.error('❌ Erro no dashboard-data:', error);
    return res.status(500).json({
      error: 'Erro ao carregar dados do Asaas',
      message: error.message,
    });
  }
});

// Servir arquivos estáticos em produção (se necessário)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend rodando na porta ${PORT}`);
  console.log(`📡 Endpoint proxy: http://localhost:${PORT}/api/asaas/proxy`);
  console.log(`💡 Configure a API Key do Asaas via variável de ambiente ASAAS_API_KEY ou header X-Asaas-Api-Key`);
});
