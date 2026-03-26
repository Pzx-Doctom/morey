/**
 * markdown-panel.js - The core Markdown viewer/editor panel
 * Injected into the target element, uses Shadow DOM for UI isolation
 */

import markdownit from 'markdown-it';
import { extractStyles, applyStyles, generatePatchCSS, CODE_STYLES } from './style-inheritor.js';
import { getFileContent, saveFile, getFilesIndex, getSiteConfig, saveSiteConfig } from '../shared/storage.js';
import { importFiles, setupDragDrop, exportFile } from './file-manager.js';

const md = markdownit({
  html: false,
  linkify: true,
  typographer: true,
});

// State
let targetElement = null;
let originalHTML = null;
let moreyRoot = null;
let shadowRoot = null;
let renderedContainer = null;
let currentMode = 'viewer'; // 'viewer' | 'editor'
let currentFileId = null;
let currentFileName = '';
let currentContent = '';
let hostStyles = null;
let autoSaveTimer = null;
let currentDomain = '';
let currentCodeStyle = 'blend'; // 'blend' | 'github'
let patchStyleElement = null;
try { currentDomain = window.location.hostname; } catch (e) { /* ignore */ }

/**
 * Initialize the markdown panel in the target element
 */
export async function initPanel(element, fileId) {
  if (targetElement && targetElement !== element) {
    destroy();
  }

  targetElement = element;
  originalHTML = element.innerHTML;

  // Extract host styles before replacing content
  hostStyles = extractStyles(element);

  // Clear target and create morey root
  element.innerHTML = '';
  moreyRoot = document.createElement('div');
  moreyRoot.id = 'morey-root';
  moreyRoot.style.position = 'relative';

  // Load remembered panel height and code style
  const siteConfig = await getSiteConfig(currentDomain);
  const savedHeight = siteConfig?.panelHeight || '50vh';
  currentCodeStyle = siteConfig?.codeStyle || 'blend';
  moreyRoot.style.maxHeight = savedHeight;
  moreyRoot.style.overflowY = 'auto';

  element.appendChild(moreyRoot);

  // Create Shadow DOM for toolbar and editor UI
  shadowRoot = moreyRoot.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = getShadowHTML();

  // Create rendered container outside shadow DOM (inherits host styles)
  renderedContainer = document.createElement('div');
  renderedContainer.className = 'morey-rendered';
  moreyRoot.appendChild(renderedContainer);

  // Apply host styles to rendered container
  applyStyles(renderedContainer, hostStyles);

  // Add patch CSS for code blocks, tables, etc.
  patchStyleElement = document.createElement('style');
  patchStyleElement.textContent = generatePatchCSS(hostStyles, currentCodeStyle);
  moreyRoot.appendChild(patchStyleElement);

  // Update code style button text
  updateCodeStyleButton();

  // Set up drag and drop
  setupDragDrop(moreyRoot, async (fileId, fileName) => {
    await switchFile(fileId);
  });

  // Bind toolbar events
  bindToolbarEvents();

  // Load file
  if (fileId) {
    await switchFile(fileId);
  } else {
    currentContent = '# Morey 已就绪\n\n> 请点击扩展图标，导入 Markdown 文件后即可显示内容。\n>\n> 也可以直接拖拽 `.md` 文件到此区域。';
    renderMarkdown();
  }

  return true;
}

/**
 * Switch to a different file
 */
export async function switchFile(fileId) {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
    // Save current content before switching
    if (currentFileId && currentContent) {
      await saveFile(currentFileId, currentFileName, currentContent);
    }
  }

  currentFileId = fileId;
  const files = await getFilesIndex();
  const meta = files.find(f => f.id === fileId);
  currentFileName = meta ? meta.name : 'untitled.md';
  currentContent = await getFileContent(fileId);

  // Update toolbar file name
  const nameEl = shadowRoot?.querySelector('.toolbar-filename');
  if (nameEl) nameEl.textContent = currentFileName;

  // Render
  if (currentMode === 'viewer') {
    renderMarkdown();
  } else {
    showEditor();
  }
}

/**
 * Render markdown content to the rendered container
 */
function renderMarkdown() {
  if (!renderedContainer) return;
  renderedContainer.style.display = '';
  renderedContainer.innerHTML = md.render(currentContent);

  // Apply link colors from host
  if (hostStyles?.linkColor) {
    renderedContainer.querySelectorAll('a').forEach(a => {
      a.style.color = hostStyles.linkColor;
    });
  }

  // Hide editor
  const editor = shadowRoot?.querySelector('.morey-editor');
  if (editor) editor.style.display = 'none';

  updateToolbarMode('viewer');
}

/**
 * Show the editor
 */
function showEditor() {
  if (!renderedContainer) return;
  renderedContainer.style.display = 'none';

  const editor = shadowRoot?.querySelector('.morey-editor');
  if (editor) {
    editor.style.display = 'block';
    editor.value = currentContent;
    editor.focus();
  }

  updateToolbarMode('editor');
}

/**
 * Toggle between viewer and editor
 */
export function toggleMode() {
  if (currentMode === 'viewer') {
    currentMode = 'editor';
    showEditor();
  } else {
    // Save editor content
    const editor = shadowRoot?.querySelector('.morey-editor');
    if (editor) {
      currentContent = editor.value;
      scheduleAutoSave();
    }
    currentMode = 'viewer';
    renderMarkdown();
  }
}

function updateToolbarMode(mode) {
  const viewBtn = shadowRoot?.querySelector('.btn-view');
  const editBtn = shadowRoot?.querySelector('.btn-edit');
  if (viewBtn) viewBtn.classList.toggle('active', mode === 'viewer');
  if (editBtn) editBtn.classList.toggle('active', mode === 'editor');
}

/**
 * Update code style button text
 */
function updateCodeStyleButton() {
  const btn = shadowRoot?.querySelector('.btn-code-style');
  if (btn) {
    btn.textContent = `代码:${CODE_STYLES[currentCodeStyle] || '融合'}`;
  }
}

/**
 * Toggle code block style and save preference
 */
async function toggleCodeStyle() {
  // Toggle between 'blend' and 'github'
  currentCodeStyle = currentCodeStyle === 'blend' ? 'github' : 'blend';
  
  // Update patch CSS
  if (patchStyleElement && hostStyles) {
    patchStyleElement.textContent = generatePatchCSS(hostStyles, currentCodeStyle);
  }
  
  // Update button text
  updateCodeStyleButton();
  
  // Save preference
  const siteConfig = await getSiteConfig(currentDomain) || {};
  siteConfig.codeStyle = currentCodeStyle;
  await saveSiteConfig(currentDomain, siteConfig);
}

/**
 * Schedule auto-save with debounce
 */
function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    if (currentFileId && currentContent) {
      await saveFile(currentFileId, currentFileName, currentContent);
      const status = shadowRoot?.querySelector('.save-status');
      if (status) {
        status.textContent = '已保存';
        setTimeout(() => { status.textContent = ''; }, 1500);
      }
    }
  }, 500);
}

/**
 * Destroy the panel and restore original content
 */
export function destroy() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }

  // Save before destroying
  if (currentFileId && currentContent) {
    const editor = shadowRoot?.querySelector('.morey-editor');
    if (editor && currentMode === 'editor') {
      currentContent = editor.value;
    }
    saveFile(currentFileId, currentFileName, currentContent);
  }

  if (targetElement && originalHTML !== null) {
    targetElement.innerHTML = originalHTML;
  }

  targetElement = null;
  originalHTML = null;
  moreyRoot = null;
  shadowRoot = null;
  renderedContainer = null;
  currentMode = 'viewer';
}

export function isActive() {
  return targetElement !== null;
}

export function getTargetElement() {
  return targetElement;
}

// ===== Shadow DOM Template =====

function getShadowHTML() {
  return `
    <style>
      :host {
        display: block !important;
        position: relative !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      * {
        box-sizing: border-box;
      }
      .morey-toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        background: rgba(128, 128, 128, 0.08);
        border-radius: 4px;
        margin-bottom: 8px;
        opacity: 0.4;
        transition: opacity 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        color: #666;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .morey-toolbar:hover {
        opacity: 1;
        background: rgba(128, 128, 128, 0.12);
      }
      .toolbar-filename {
        flex: 1;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }
      .toolbar-btn {
        padding: 3px 8px;
        border: 1px solid #ddd;
        border-radius: 3px;
        background: #fff;
        color: #555;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.15s;
        font-family: inherit;
      }
      .toolbar-btn:hover {
        background: #f0f0f0;
      }
      .toolbar-btn.active {
        background: #4a90d9;
        color: #fff;
        border-color: #4a90d9;
      }
      .toolbar-sep {
        width: 1px;
        height: 16px;
        background: #ddd;
      }
      .save-status {
        font-size: 10px;
        color: #999;
      }
      .morey-editor {
        display: none;
        width: 100%;
        min-height: 300px;
        height: 60vh;
        border: 1px solid rgba(128, 128, 128, 0.2);
        border-radius: 4px;
        padding: 12px 16px;
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        font-size: 14px;
        line-height: 1.6;
        resize: vertical;
        outline: none;
        color: inherit;
        background: transparent;
        tab-size: 4;
      }
      .morey-editor:focus {
        border-color: #4a90d9;
      }
      .morey-resize-handle {
        height: 6px;
        cursor: row-resize;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.3;
        transition: opacity 0.2s;
      }
      .morey-resize-handle:hover {
        opacity: 0.8;
      }
      .morey-resize-handle::after {
        content: '';
        width: 40px;
        height: 2px;
        background: #999;
        border-radius: 1px;
      }
    </style>
    <div class="morey-toolbar">
      <span class="toolbar-filename">未选择文件</span>
      <span class="save-status"></span>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn btn-view active" title="查看模式">查看</button>
      <button class="toolbar-btn btn-edit" title="编辑模式">编辑</button>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn btn-import" title="导入文件">导入</button>
      <button class="toolbar-btn btn-export" title="导出文件">导出</button>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn btn-code-style" title="切换代码块样式">代码:融合</button>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn btn-close" title="恢复原始页面">退出</button>
    </div>
    <textarea class="morey-editor" placeholder="在此编辑 Markdown 内容..."></textarea>
    <slot></slot>
    <div class="morey-resize-handle"></div>
  `;
}

function bindToolbarEvents() {
  if (!shadowRoot) return;

  // View button
  shadowRoot.querySelector('.btn-view')?.addEventListener('click', () => {
    if (currentMode === 'editor') {
      const editor = shadowRoot.querySelector('.morey-editor');
      if (editor) {
        currentContent = editor.value;
        scheduleAutoSave();
      }
      currentMode = 'viewer';
      renderMarkdown();
    }
  });

  // Edit button
  shadowRoot.querySelector('.btn-edit')?.addEventListener('click', () => {
    if (currentMode === 'viewer') {
      currentMode = 'editor';
      showEditor();
    }
  });

  // Import button
  shadowRoot.querySelector('.btn-import')?.addEventListener('click', async () => {
    const fileId = await importFiles();
    if (fileId) {
      await switchFile(fileId);
    }
  });

  // Export button
  shadowRoot.querySelector('.btn-export')?.addEventListener('click', () => {
    if (currentFileId) {
      exportFile(currentFileId);
    }
  });

  // Code style toggle button
  shadowRoot.querySelector('.btn-code-style')?.addEventListener('click', () => {
    toggleCodeStyle();
  });

  // Close/restore button
  shadowRoot.querySelector('.btn-close')?.addEventListener('click', () => {
    destroy();
  });

  // Editor auto-save on input
  shadowRoot.querySelector('.morey-editor')?.addEventListener('input', (e) => {
    currentContent = e.target.value;
    scheduleAutoSave();
  });

  // Tab key support in editor
  shadowRoot.querySelector('.morey-editor')?.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '\t' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      currentContent = textarea.value;
      scheduleAutoSave();
    }
  });

  // Resize handle drag logic
  const handle = shadowRoot.querySelector('.morey-resize-handle');
  let heightSaveTimer = null;

  handle?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = moreyRoot.offsetHeight;

    function onMouseMove(ev) {
      const newHeight = startHeight + (ev.clientY - startY);
      const clamped = Math.max(150, Math.min(newHeight, window.innerHeight - 50));
      moreyRoot.style.maxHeight = clamped + 'px';
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Debounced save
      if (heightSaveTimer) clearTimeout(heightSaveTimer);
      heightSaveTimer = setTimeout(() => {
        savePanelHeight(moreyRoot.style.maxHeight);
      }, 300);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

async function savePanelHeight(height) {
  const siteConfig = await getSiteConfig(currentDomain);
  if (siteConfig) {
    siteConfig.panelHeight = height;
    await saveSiteConfig(currentDomain, siteConfig);
  }
}
