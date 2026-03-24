import { STORAGE_KEYS, DEFAULT_CONFIG, generateFileId } from './constants.js';

const { CONFIG, SITES, FILES_INDEX, FILE_PREFIX } = STORAGE_KEYS;

// ===== Config =====

export async function getConfig() {
  const result = await chrome.storage.local.get(CONFIG);
  return { ...DEFAULT_CONFIG, ...result[CONFIG] };
}

export async function saveConfig(config) {
  const current = await getConfig();
  await chrome.storage.local.set({ [CONFIG]: { ...current, ...config } });
}

// ===== Site Configs =====

export async function getAllSiteConfigs() {
  const result = await chrome.storage.local.get(SITES);
  return result[SITES] || {};
}

export async function getSiteConfig(domain) {
  const sites = await getAllSiteConfigs();
  return sites[domain] || null;
}

export async function saveSiteConfig(domain, config) {
  const sites = await getAllSiteConfigs();
  sites[domain] = config;
  await chrome.storage.local.set({ [SITES]: sites });
}

export async function deleteSiteConfig(domain) {
  const sites = await getAllSiteConfigs();
  delete sites[domain];
  await chrome.storage.local.set({ [SITES]: sites });
}

// ===== File Management =====

export async function getFilesIndex() {
  const result = await chrome.storage.local.get(FILES_INDEX);
  return result[FILES_INDEX] || [];
}

export async function getFileContent(fileId) {
  const key = FILE_PREFIX + fileId;
  const result = await chrome.storage.local.get(key);
  return result[key]?.content || '';
}

export async function saveFile(fileId, name, content) {
  const index = await getFilesIndex();
  const now = Date.now();
  const existing = index.find(f => f.id === fileId);

  if (existing) {
    existing.name = name;
    existing.size = new Blob([content]).size;
    existing.updatedAt = now;
  } else {
    index.push({
      id: fileId,
      name,
      size: new Blob([content]).size,
      createdAt: now,
      updatedAt: now,
    });
  }

  await chrome.storage.local.set({
    [FILES_INDEX]: index,
    [FILE_PREFIX + fileId]: { content },
  });

  return fileId;
}

export async function createFile(name, content) {
  const fileId = generateFileId();
  await saveFile(fileId, name, content);
  return fileId;
}

export async function deleteFile(fileId) {
  const index = await getFilesIndex();
  const filtered = index.filter(f => f.id !== fileId);
  await chrome.storage.local.set({ [FILES_INDEX]: filtered });
  await chrome.storage.local.remove(FILE_PREFIX + fileId);
}

export async function renameFile(fileId, newName) {
  const index = await getFilesIndex();
  const file = index.find(f => f.id === fileId);
  if (file) {
    file.name = newName;
    file.updatedAt = Date.now();
    await chrome.storage.local.set({ [FILES_INDEX]: index });
  }
}
