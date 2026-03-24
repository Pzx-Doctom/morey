// Storage keys
export const STORAGE_KEYS = {
  CONFIG: 'morey:config',
  SITES: 'morey:sites',
  FILES_INDEX: 'morey:files:index',
  FILE_PREFIX: 'morey:file:',
};

// Message types
export const MSG = {
  TOGGLE_MOREY: 'TOGGLE_MOREY',
  ENTER_PICKER_MODE: 'ENTER_PICKER_MODE',
  EXIT_PICKER_MODE: 'EXIT_PICKER_MODE',
  SELECTOR_PICKED: 'SELECTOR_PICKED',
  SAVE_SITE_CONFIG: 'SAVE_SITE_CONFIG',
  DELETE_SITE_CONFIG: 'DELETE_SITE_CONFIG',
  CONFIG_UPDATED: 'CONFIG_UPDATED',
  SWITCH_FILE: 'SWITCH_FILE',
  GET_STATUS: 'GET_STATUS',
  PANIC_RESTORE: 'PANIC_RESTORE',
};

// Default config
export const DEFAULT_CONFIG = {
  enabled: true,
  defaultView: 'viewer',
  lastActiveFileId: null,
};

// File ID generator
export function generateFileId() {
  return 'file_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
