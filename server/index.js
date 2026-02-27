import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import multer from 'multer';

// Carregar variáveis de ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const assinafyUpload = multer({ storage: multer.memoryStorage() });
const reportCoverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const REPORT_COVER_UPLOAD_DIR = join(__dirname, 'uploads', 'report-covers');
const REPORT_COVER_DATA_DIR = join(__dirname, 'data');
const REPORT_COVER_META_FILE = join(REPORT_COVER_DATA_DIR, 'report-covers.json');
const REPORT_COVER_ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const REPORT_COVER_DEFAULT_ADJUSTMENT = { scale: 1, offsetX: 0, offsetY: 0 };

let reportCoverItems = [];
let reportCoverInitialized = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeReportCoverAdjustment = (adjustment) => {
  const scaleRaw = Number(adjustment?.scale);
  const offsetXRaw = Number(adjustment?.offsetX);
  const offsetYRaw = Number(adjustment?.offsetY);

  const scale = Number.isFinite(scaleRaw)
    ? clamp(scaleRaw, 1, 2.5)
    : REPORT_COVER_DEFAULT_ADJUSTMENT.scale;
  const offsetX = Number.isFinite(offsetXRaw) ? offsetXRaw : REPORT_COVER_DEFAULT_ADJUSTMENT.offsetX;
  const offsetY = Number.isFinite(offsetYRaw) ? offsetYRaw : REPORT_COVER_DEFAULT_ADJUSTMENT.offsetY;

  return { scale, offsetX, offsetY };
};

const toPublicReportCoverItem = (item) => ({
  id: item.id,
  name: item.name,
  url: item.url,
  mimeType: item.mimeType,
  sizeBytes: item.sizeBytes,
  createdAt: item.createdAt,
  adjustment: normalizeReportCoverAdjustment(item.adjustment),
});

const extractFilenameFromUrl = (url) => {
  if (typeof url !== 'string') return '';
  const clean = url.split('?')[0].split('#')[0];
  return clean.split('/').pop() || '';
};

const ensureReportCoverStorage = async () => {
  await fs.mkdir(REPORT_COVER_UPLOAD_DIR, { recursive: true });
  await fs.mkdir(REPORT_COVER_DATA_DIR, { recursive: true });

  try {
    await fs.access(REPORT_COVER_META_FILE);
  } catch {
    await fs.writeFile(REPORT_COVER_META_FILE, JSON.stringify({ items: [] }, null, 2), 'utf-8');
  }
};

const loadReportCoverItemsFromDisk = async () => {
  try {
    const content = await fs.readFile(REPORT_COVER_META_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    return items
      .map((item) => {
        const mimeType = REPORT_COVER_ALLOWED_MIME[item?.mimeType] ? item.mimeType : 'image/jpeg';
        const id = typeof item?.id === 'string' && item.id ? item.id : randomUUID();
        const name = typeof item?.name === 'string' && item.name ? item.name : `capa-${id}`;
        const createdAt = typeof item?.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : new Date().toISOString();
        const sizeBytesRaw = Number(item?.sizeBytes);
        const sizeBytes = Number.isFinite(sizeBytesRaw) && sizeBytesRaw >= 0 ? sizeBytesRaw : 0;
        const extension = REPORT_COVER_ALLOWED_MIME[mimeType];

        let fileName = typeof item?.fileName === 'string' && item.fileName ? item.fileName : '';
        if (!fileName) {
          fileName = extractFilenameFromUrl(item?.url);
        }
        if (!fileName) {
          fileName = `${id}.${extension}`;
        }

        return {
          id,
          name,
          url: `/uploads/report-covers/${fileName}`,
          mimeType,
          sizeBytes,
          createdAt,
          adjustment: normalizeReportCoverAdjustment(item?.adjustment),
          fileName,
        };
      })
      .filter((item) => typeof item.id === 'string' && typeof item.fileName === 'string');
  } catch (error) {
    console.error('❌ Erro ao ler metadata de capas:', error.message);
    return [];
  }
};

const persistReportCoverItems = async () => {
  const payload = {
    items: reportCoverItems.map((item) => ({
      ...toPublicReportCoverItem(item),
      fileName: item.fileName,
    })),
  };

  await fs.writeFile(REPORT_COVER_META_FILE, JSON.stringify(payload, null, 2), 'utf-8');
};

const initializeReportCoverRepository = async () => {
  if (reportCoverInitialized) return;

  await ensureReportCoverStorage();
  reportCoverItems = await loadReportCoverItemsFromDisk();
  reportCoverInitialized = true;
};

const ensureReportCoverRepositoryReady = async () => {
  if (!reportCoverInitialized) {
    await initializeReportCoverRepository();
  }
};

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
app.use('/uploads', express.static(join(__dirname, 'uploads')));

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

app.get('/api/relatorios/capas', async (req, res) => {
  try {
    await ensureReportCoverRepositoryReady();
    return res.json({ items: reportCoverItems.map(toPublicReportCoverItem) });
  } catch (error) {
    console.error('❌ Erro ao listar capas:', error);
    return res.status(500).json({ error: 'Erro ao listar capas do repositorio local.' });
  }
});

app.post('/api/relatorios/capas', (req, res, next) => {
  reportCoverUpload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo excede o limite de 10MB.' });
    }

    return res.status(400).json({ error: 'Falha no upload da imagem.' });
  });
}, async (req, res) => {
  try {
    await ensureReportCoverRepositoryReady();

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo nao enviado.' });
    }

    const extension = REPORT_COVER_ALLOWED_MIME[req.file.mimetype];
    if (!extension) {
      return res.status(400).json({ error: 'Formato invalido. Use JPG, PNG ou WEBP.' });
    }

    const id = randomUUID();
    const fileName = `${id}.${extension}`;
    const filePath = join(REPORT_COVER_UPLOAD_DIR, fileName);

    await fs.writeFile(filePath, req.file.buffer);

    const item = {
      id,
      name: req.file.originalname || `capa-${id}.${extension}`,
      url: `/uploads/report-covers/${fileName}`,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      createdAt: new Date().toISOString(),
      adjustment: { ...REPORT_COVER_DEFAULT_ADJUSTMENT },
      fileName,
    };

    reportCoverItems = [item, ...reportCoverItems];
    await persistReportCoverItems();

    return res.status(201).json({ item: toPublicReportCoverItem(item) });
  } catch (error) {
    console.error('❌ Erro ao salvar capa:', error);
    return res.status(500).json({ error: 'Erro ao salvar capa no repositorio local.' });
  }
});

app.patch('/api/relatorios/capas/:id/ajuste', async (req, res) => {
  try {
    await ensureReportCoverRepositoryReady();

    const id = req.params.id;
    const coverIndex = reportCoverItems.findIndex((item) => item.id === id);
    if (coverIndex < 0) {
      return res.status(404).json({ error: 'Capa nao encontrada.' });
    }

    const adjustment = req.body?.adjustment;
    const scale = Number(adjustment?.scale);
    const offsetX = Number(adjustment?.offsetX);
    const offsetY = Number(adjustment?.offsetY);

    if (!Number.isFinite(scale) || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
      return res.status(400).json({ error: 'Ajuste invalido. Envie scale, offsetX e offsetY numericos.' });
    }
    if (scale < 1 || scale > 2.5) {
      return res.status(400).json({ error: 'Ajuste invalido. scale deve ficar entre 1 e 2.5.' });
    }

    const normalized = normalizeReportCoverAdjustment({ scale, offsetX, offsetY });
    reportCoverItems[coverIndex] = {
      ...reportCoverItems[coverIndex],
      adjustment: normalized,
    };

    await persistReportCoverItems();
    return res.json({ item: toPublicReportCoverItem(reportCoverItems[coverIndex]) });
  } catch (error) {
    console.error('❌ Erro ao atualizar ajuste da capa:', error);
    return res.status(500).json({ error: 'Erro ao atualizar ajuste da capa.' });
  }
});

app.delete('/api/relatorios/capas/:id', async (req, res) => {
  try {
    await ensureReportCoverRepositoryReady();

    const id = req.params.id;
    const coverIndex = reportCoverItems.findIndex((item) => item.id === id);
    if (coverIndex < 0) {
      return res.status(404).json({ error: 'Capa nao encontrada.' });
    }

    const [cover] = reportCoverItems.splice(coverIndex, 1);
    const fileName = cover?.fileName || extractFilenameFromUrl(cover?.url);
    const filePath = join(REPORT_COVER_UPLOAD_DIR, fileName);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    await persistReportCoverItems();
    return res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir capa:', error);
    return res.status(500).json({ error: 'Erro ao excluir capa.' });
  }
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
app.post('/api/assinafy/upload', assinafyUpload.single('file'), async (req, res) => {
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
const startServer = async () => {
  try {
    await initializeReportCoverRepository();
  } catch (error) {
    console.error('Erro ao inicializar repositorio de capas:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Servidor backend rodando na porta ${PORT}`);
    console.log(`Endpoint proxy: http://localhost:${PORT}/api/asaas/proxy`);
    console.log('Configure a API Key do Asaas via variavel de ambiente ASAAS_API_KEY ou header X-Asaas-Api-Key');
  });
};

startServer();
