/**
 * file-manager.js - Handle file import, export, and drag & drop
 */

import { getFilesIndex, getFileContent, createFile, saveFile, saveConfig, getConfig } from '../shared/storage.js';

/**
 * Open file picker and import .md files
 * Returns the ID of the first imported file
 */
export function importFiles() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const files = input.files;
      let firstId = null;

      for (const file of files) {
        const content = await file.text();
        const id = await createFile(file.name, content);
        if (!firstId) firstId = id;
      }

      input.remove();
      resolve(firstId);
    });

    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });

    input.click();
  });
}

/**
 * Set up drag & drop on a container element
 * @param {HTMLElement} container - The drop target
 * @param {Function} onFileImported - Callback with (fileId, fileName)
 */
export function setupDragDrop(container, onFileImported) {
  let dropOverlay = null;

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropOverlay) {
      dropOverlay = document.createElement('div');
      Object.assign(dropOverlay.style, {
        position: 'absolute',
        top: '0', left: '0', right: '0', bottom: '0',
        background: 'rgba(74, 144, 217, 0.15)',
        border: '2px dashed #4a90d9',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        color: '#4a90d9',
        fontWeight: '600',
        zIndex: '100',
        pointerEvents: 'none',
      });
      dropOverlay.textContent = '松开以导入文件';
      container.style.position = container.style.position || 'relative';
      container.appendChild(dropOverlay);
    }
  });

  container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropOverlay && !container.contains(e.relatedTarget)) {
      dropOverlay.remove();
      dropOverlay = null;
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropOverlay) {
      dropOverlay.remove();
      dropOverlay = null;
    }

    const files = e.dataTransfer.files;
    for (const file of files) {
      if (file.name.match(/\.(md|markdown|txt)$/i)) {
        const content = await file.text();
        const fileId = await createFile(file.name, content);
        if (onFileImported) {
          onFileImported(fileId, file.name);
        }
      }
    }
  });
}

/**
 * Export/download a file
 */
export async function exportFile(fileId) {
  const files = await getFilesIndex();
  const meta = files.find(f => f.id === fileId);
  if (!meta) return;

  const content = await getFileContent(fileId);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = meta.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
