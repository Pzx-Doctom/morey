import { MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import {
  getConfig, saveConfig,
  getAllSiteConfigs, getSiteConfig, saveSiteConfig, deleteSiteConfig,
  getFilesIndex, getFileContent, createFile, deleteFile,
} from '../shared/storage.js';

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// DOM refs
const globalToggle = document.getElementById('globalToggle');
const siteDomain = document.getElementById('siteDomain');
const selectorValue = document.getElementById('selectorValue');
const btnPickElement = document.getElementById('btnPickElement');
const btnClearSite = document.getElementById('btnClearSite');
const autoApplyRow = document.getElementById('autoApplyRow');
const autoApplyCheck = document.getElementById('autoApplyCheck');
const fileList = document.getElementById('fileList');
const btnImportFile = document.getElementById('btnImportFile');
const btnExportFile = document.getElementById('btnExportFile');
const fileInput = document.getElementById('fileInput');
const siteList = document.getElementById('siteList');

let currentTabId = null;
let currentDomain = null;
let activeFileId = null;

// ===== Init =====

async function init() {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabId = tab.id;
    try {
      const url = new URL(tab.url);
      currentDomain = url.hostname;
    } catch {
      currentDomain = null;
    }
  }

  // Load config
  const config = await getConfig();
  globalToggle.checked = config.enabled;
  activeFileId = config.lastActiveFileId;

  // Load site info
  if (currentDomain) {
    siteDomain.textContent = currentDomain;
    const siteConfig = await getSiteConfig(currentDomain);
    if (siteConfig) {
      selectorValue.textContent = siteConfig.selector;
      btnClearSite.disabled = false;
      autoApplyRow.style.display = 'flex';
      autoApplyCheck.checked = siteConfig.autoApply || false;
      if (siteConfig.lastFileId) {
        activeFileId = siteConfig.lastFileId;
      }
    }
  } else {
    siteDomain.textContent = '不可用';
    btnPickElement.disabled = true;
  }

  // Load files
  await refreshFileList();

  // Load all site configs
  await refreshSiteList();
}

// ===== File List =====

async function refreshFileList() {
  const files = await getFilesIndex();
  if (files.length === 0) {
    fileList.innerHTML = '<div class="empty-hint">暂无文件，请导入</div>';
    btnExportFile.disabled = true;
    return;
  }

  fileList.innerHTML = '';
  for (const file of files) {
    const item = document.createElement('div');
    item.className = 'file-item' + (file.id === activeFileId ? ' active' : '');
    item.innerHTML = `
      <input type="radio" class="file-radio" name="activeFile"
        value="${esc(file.id)}" ${file.id === activeFileId ? 'checked' : ''}>
      <span class="file-name" title="${esc(file.name)}">${esc(file.name)}</span>
      <button class="file-delete" data-id="${esc(file.id)}" title="删除">&times;</button>
    `;
    fileList.appendChild(item);
  }

  btnExportFile.disabled = !activeFileId;
}

// ===== Site List =====

async function refreshSiteList() {
  const sites = await getAllSiteConfigs();
  const domains = Object.keys(sites);
  if (domains.length === 0) {
    siteList.innerHTML = '<div class="empty-hint">暂无配置</div>';
    return;
  }

  siteList.innerHTML = '';
  for (const domain of domains) {
    const item = document.createElement('div');
    item.className = 'site-config-item';
    item.innerHTML = `
      <span class="domain">${esc(domain)}</span>
      <span style="color:#999;font-family:monospace;font-size:11px">${esc(sites[domain].selector)}</span>
      <button class="delete-site" data-domain="${esc(domain)}" title="删除">&times;</button>
    `;
    siteList.appendChild(item);
  }
}

// ===== Event Handlers =====

// Global toggle
globalToggle.addEventListener('change', async () => {
  await saveConfig({ enabled: globalToggle.checked });
  if (currentTabId) {
    sendMessage(MSG.TOGGLE_MOREY, { tabId: currentTabId });
  }
});

// Pick element
btnPickElement.addEventListener('click', async () => {
  if (!currentTabId) return;
  await sendMessage(MSG.ENTER_PICKER_MODE, { tabId: currentTabId });
  window.close(); // Close popup so user can interact with the page
});

// Clear site config
btnClearSite.addEventListener('click', async () => {
  if (!currentDomain) return;
  await deleteSiteConfig(currentDomain);
  if (currentTabId) {
    sendMessage(MSG.PANIC_RESTORE, { tabId: currentTabId });
  }
  selectorValue.textContent = '未配置';
  btnClearSite.disabled = true;
  autoApplyRow.style.display = 'none';
  await refreshSiteList();
});

// Auto apply
autoApplyCheck.addEventListener('change', async () => {
  if (!currentDomain) return;
  const siteConfig = await getSiteConfig(currentDomain);
  if (siteConfig) {
    siteConfig.autoApply = autoApplyCheck.checked;
    await saveSiteConfig(currentDomain, siteConfig);
  }
});

// Import file
btnImportFile.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files.length) return;

  for (const file of files) {
    const content = await file.text();
    const fileId = await createFile(file.name, content);
    // Set as active if it's the first file
    if (!activeFileId) {
      activeFileId = fileId;
      await saveConfig({ lastActiveFileId: fileId });
    }
  }

  await refreshFileList();
  fileInput.value = '';

  // Notify content script to switch to the active file
  if (currentTabId && activeFileId) {
    sendMessage(MSG.SWITCH_FILE, { tabId: currentTabId, fileId: activeFileId });
  }
});

// Export file
btnExportFile.addEventListener('click', async () => {
  if (!activeFileId) return;
  const files = await getFilesIndex();
  const fileMeta = files.find(f => f.id === activeFileId);
  if (!fileMeta) return;

  const content = await getFileContent(activeFileId);
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileMeta.name;
  a.click();
  URL.revokeObjectURL(url);
});

// File selection (via event delegation)
fileList.addEventListener('click', async (e) => {
  // Handle delete
  const deleteBtn = e.target.closest('.file-delete');
  if (deleteBtn) {
    const fileId = deleteBtn.dataset.id;
    await deleteFile(fileId);
    if (activeFileId === fileId) {
      activeFileId = null;
      await saveConfig({ lastActiveFileId: null });
    }
    await refreshFileList();
    return;
  }

  // Handle selection
  const item = e.target.closest('.file-item');
  if (item) {
    const radio = item.querySelector('.file-radio');
    if (radio) {
      radio.checked = true;
      activeFileId = radio.value;
      await saveConfig({ lastActiveFileId: activeFileId });

      // Update active class
      fileList.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      btnExportFile.disabled = false;

      // Update site config if applicable
      if (currentDomain) {
        const siteConfig = await getSiteConfig(currentDomain);
        if (siteConfig) {
          siteConfig.lastFileId = activeFileId;
          await saveSiteConfig(currentDomain, siteConfig);
        }
      }

      // Notify content script
      if (currentTabId) {
        sendMessage(MSG.SWITCH_FILE, { tabId: currentTabId, fileId: activeFileId });
      }
    }
  }
});

// Site list delete (event delegation)
siteList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.delete-site');
  if (btn) {
    const domain = btn.dataset.domain;
    await deleteSiteConfig(domain);
    await refreshSiteList();
  }
});

// Listen for messages from background (e.g., selector picked)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === MSG.SELECTOR_PICKED) {
    handleSelectorPicked(msg.payload.selector);
  }
});

async function handleSelectorPicked(selector) {
  if (!currentDomain || !selector) return;

  selectorValue.textContent = selector;
  btnClearSite.disabled = false;
  autoApplyRow.style.display = 'flex';

  await saveSiteConfig(currentDomain, {
    selector,
    autoApply: true,
    lastFileId: activeFileId,
  });

  autoApplyCheck.checked = true;
  await refreshSiteList();
}

// Init
init();
