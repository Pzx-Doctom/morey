/**
 * content.js - Main content script entry point
 * Coordinates element picker, markdown panel, and messaging
 */

import { MSG } from '../shared/constants.js';
import { onMessage, sendMessage } from '../shared/messaging.js';
import { getSiteConfig, saveSiteConfig, getConfig } from '../shared/storage.js';
import { startPicker, stopPicker } from './element-picker.js';
import { initPanel, switchFile, destroy, isActive, toggleMode } from './markdown-panel.js';

let currentDomain = '';
try {
  currentDomain = window.location.hostname;
} catch (e) {
  // ignore
}

// ===== Message Handling =====

onMessage((msg, sender) => {
  const { type, payload } = msg;

  switch (type) {
    case MSG.TOGGLE_MOREY:
      return handleToggle(payload);

    case MSG.ENTER_PICKER_MODE:
      handlePickerMode();
      return { ok: true };

    case MSG.EXIT_PICKER_MODE:
      stopPicker();
      return { ok: true };

    case MSG.SWITCH_FILE:
      handleSwitchFile(payload);
      return { ok: true };

    case MSG.PANIC_RESTORE:
      handlePanicRestore();
      return { ok: true };

    case MSG.CONFIG_UPDATED:
      handleConfigUpdated();
      return { ok: true };

    case MSG.SAVE_SITE_CONFIG:
      handleSiteConfigSaved(payload);
      return { ok: true };

    case MSG.GET_STATUS:
      return {
        active: isActive(),
        domain: currentDomain,
      };

    default:
      return undefined;
  }
});

// ===== Handlers =====

function handleToggle(payload) {
  if (payload.active) {
    tryAutoApply();
  } else {
    destroy();
  }
  return { ok: true };
}

async function handlePickerMode() {
  const selector = await startPicker();
  if (!selector) return;

  // Save site config
  await saveSiteConfig(currentDomain, {
    selector,
    autoApply: true,
    lastFileId: null,
  });

  // Notify background that selector was picked
  sendMessage(MSG.SELECTOR_PICKED, { selector });

  // Apply immediately
  const config = await getConfig();
  const element = document.querySelector(selector);
  if (element) {
    await initPanel(element, config.lastActiveFileId);
  }
}

function handlePanicRestore() {
  stopPicker();
  destroy();
}

async function handleConfigUpdated() {
  if (isActive()) {
    // Refresh if needed
  }
}

async function handleSiteConfigSaved(payload) {
  // Re-apply if active
  if (payload.selector && !isActive()) {
    const config = await getConfig();
    const element = document.querySelector(payload.selector);
    if (element) {
      await initPanel(element, config.lastActiveFileId);
    }
  }
}

async function handleSwitchFile(payload) {
  if (!payload.fileId) return;

  if (isActive()) {
    // Panel already active, just switch the file
    await switchFile(payload.fileId);
  } else {
    // Panel not active — try to initialize with site config first
    const siteConfig = await getSiteConfig(currentDomain);
    if (siteConfig && siteConfig.selector) {
      const element = document.querySelector(siteConfig.selector);
      if (element) {
        await initPanel(element, payload.fileId);
      }
    }
  }
}

// ===== Auto-apply on page load =====

async function tryAutoApply() {
  if (!currentDomain) return;

  const config = await getConfig();
  if (!config.enabled) return;

  const siteConfig = await getSiteConfig(currentDomain);
  if (!siteConfig || !siteConfig.autoApply || !siteConfig.selector) return;

  const fileId = siteConfig.lastFileId || config.lastActiveFileId;

  // Wait for the target element to appear
  waitForElement(siteConfig.selector, 10000).then(async (element) => {
    if (element && !isActive()) {
      await initPanel(element, fileId);
    }
  });
}

/**
 * Wait for an element matching the selector to appear in the DOM
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) {
      resolve(el);
      return;
    }

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

// ===== SPA Navigation Detection =====

let lastUrl = location.href;

function detectNavigation() {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // URL changed - check if we need to re-apply
    if (isActive()) {
      // Target element might have been removed, re-check
      setTimeout(() => tryAutoApply(), 500);
    } else {
      tryAutoApply();
    }
  }
}

// Intercept pushState/replaceState
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function (...args) {
  originalPushState.apply(this, args);
  detectNavigation();
};

history.replaceState = function (...args) {
  originalReplaceState.apply(this, args);
  detectNavigation();
};

window.addEventListener('popstate', detectNavigation);

// ===== Initialize =====

tryAutoApply();
