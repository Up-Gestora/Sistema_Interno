import { access, cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const serverDataDir = path.join(repoRoot, 'server', 'data');
const sharedStorageFile = path.join(serverDataDir, 'port-shared-storage.json');

const ORIGIN = 'http://localhost:5173';
const LAMINA_SNAPSHOT_KEY = 'lamina_storage_snapshot_v1';
const STORAGE_KEYS = [
  'asaas_config',
  'asaas_pagamentos_cache_v1',
  'clientes',
  'credito_update_workspace_v1',
  'dashboard_asaas_cache_v1',
  'financeiro_recebedores_saidas_custom_v1',
  'inter_manual_lancamentos_v1',
  'links_uteis_v1',
  'saidas_manual_lancamentos_v1',
];
const LAMINA_KEY_PREFIXES = ['lamina_', 'laminas_template_json_v2', 'estrategia_diaria_'];

const edgeCandidates = [
  path.join(process.env['ProgramFiles'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
];

const sourceLocalStorageDir = path.join(
  process.env.LOCALAPPDATA || '',
  'Microsoft',
  'Edge',
  'User Data',
  'Default',
  'Local Storage',
);

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getEdgePath() {
  return edgeCandidates.find((candidate) => candidate && existsSync(candidate));
}

async function copyProfileLocalStorage() {
  const leveldbDir = path.join(sourceLocalStorageDir, 'leveldb');
  if (!(await pathExists(leveldbDir))) {
    throw new Error(`Nao encontrei o Local Storage do Edge em ${leveldbDir}`);
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'sistema-interno-5173-'));
  const targetLocalStorageDir = path.join(tempRoot, 'Default', 'Local Storage');
  const targetLeveldbDir = path.join(targetLocalStorageDir, 'leveldb');

  await mkdir(targetLocalStorageDir, { recursive: true });
  await cp(leveldbDir, targetLeveldbDir, { recursive: true, force: true });
  await rm(path.join(targetLeveldbDir, 'LOCK'), { force: true });

  return tempRoot;
}

function parseStoredValue(raw) {
  if (raw === null || raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function loadExistingSharedStorage() {
  try {
    const content = await readFile(sharedStorageFile, 'utf-8');
    const parsed = JSON.parse(content);
    const values = parsed?.values;
    return values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  } catch {
    return {};
  }
}

async function saveSharedStorage(values) {
  await mkdir(serverDataDir, { recursive: true });
  await writeFile(sharedStorageFile, JSON.stringify({ values }, null, 2), 'utf-8');
}

async function loadPuppeteer() {
  try {
    return await import('puppeteer-core');
  } catch {
    throw new Error(
      'puppeteer-core nao encontrado. Execute com: npm exec --yes --package=puppeteer-core -- node recovery/migrate5173StorageToShared.mjs'
    );
  }
}

async function main() {
  const edgePath = getEdgePath();
  if (!edgePath) {
    throw new Error('Nao encontrei o executavel do Microsoft Edge.');
  }

  const { default: puppeteer } = await loadPuppeteer();
  const tempUserDataDir = await copyProfileLocalStorage();

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: true,
      userDataDir: tempUserDataDir,
      args: ['--profile-directory=Default'],
    });

    const page = await browser.newPage();
    await page.goto(ORIGIN, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const { rawValues, laminaSnapshot } = await page.evaluate((keys, laminaPrefixes) => {
      const rawValues = Object.fromEntries(keys.map((key) => [key, window.localStorage.getItem(key)]));
      const laminaSnapshot = {};

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        if (!laminaPrefixes.some((prefix) => key.startsWith(prefix))) continue;
        const value = window.localStorage.getItem(key);
        if (typeof value !== 'string') continue;
        laminaSnapshot[key] = value;
      }

      return { rawValues, laminaSnapshot };
    }, STORAGE_KEYS, LAMINA_KEY_PREFIXES);

    const existingValues = await loadExistingSharedStorage();
    const mergedValues = { ...existingValues };
    const importedKeys = [];

    for (const key of STORAGE_KEYS) {
      const parsed = parseStoredValue(rawValues[key]);
      if (parsed === undefined) continue;
      mergedValues[key] = parsed;
      importedKeys.push(key);
    }

    if (Object.keys(laminaSnapshot).length > 0) {
      mergedValues[LAMINA_SNAPSHOT_KEY] = laminaSnapshot;
      importedKeys.push(LAMINA_SNAPSHOT_KEY);
    }

    await saveSharedStorage(mergedValues);
    console.log(JSON.stringify({ importedKeys, rawKeys: Object.keys(rawValues) }, null, 2));
  } finally {
    if (browser) {
      await browser.close();
    }
    try {
      await rm(tempUserDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // ignore cleanup errors from browser lock files
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
