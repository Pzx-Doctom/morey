import { MSG } from '../shared/constants.js';
import { onMessage } from '../shared/messaging.js';

// Tab states: track which tabs have morey active
const tabStates = new Map();

// Message routing
onMessage((msg, sender) => {
  const { type, payload } = msg;
  const tabId = sender.tab?.id;

  switch (type) {
    case MSG.TOGGLE_MOREY:
      return handleToggle(payload.tabId || tabId);

    case MSG.ENTER_PICKER_MODE:
      return forwardToTab(payload.tabId, msg);

    case MSG.EXIT_PICKER_MODE:
      return forwardToTab(payload.tabId, msg);

    case MSG.SELECTOR_PICKED:
      // Content -> Background, will be fetched by popup via GET_STATUS
      if (tabId) {
        const state = getTabState(tabId);
        state.lastPickedSelector = payload.selector;
      }
      return { ok: true };

    case MSG.SAVE_SITE_CONFIG:
      return forwardToTab(payload.tabId, msg);

    case MSG.CONFIG_UPDATED:
      return forwardToTab(payload.tabId, msg);

    case MSG.SWITCH_FILE:
      return forwardToTab(payload.tabId, msg);

    case MSG.PANIC_RESTORE:
      return forwardToTab(payload.tabId || tabId, msg);

    case MSG.GET_STATUS:
      if (payload.tabId) {
        return forwardToTab(payload.tabId, msg);
      }
      return getTabState(tabId);

    default:
      return { error: 'Unknown message type: ' + type };
  }
});

function getTabState(tabId) {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, { active: false, lastPickedSelector: null });
  }
  return tabStates.get(tabId);
}

async function handleToggle(tabId) {
  if (!tabId) return { error: 'No tabId' };
  const state = getTabState(tabId);
  state.active = !state.active;
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: MSG.TOGGLE_MOREY,
      payload: { active: state.active },
    });
  } catch (e) {
    // Content script might not be loaded yet
    state.active = false;
  }
  return { active: state.active };
}

async function forwardToTab(tabId, msg) {
  if (!tabId) return { error: 'No tabId' };
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch (e) {
    return { error: e.message };
  }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  if (command === 'toggle-morey') {
    handleToggle(tab.id);
  } else if (command === 'panic-restore') {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: MSG.PANIC_RESTORE,
        payload: {},
      });
    } catch (e) {
      // ignore
    }
    const state = getTabState(tab.id);
    state.active = false;
  }
});

// Clean up tab states when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

// Initialize default config on install
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get('morey:config');
  if (!result['morey:config']) {
    await chrome.storage.local.set({
      'morey:config': {
        enabled: true,
        defaultView: 'viewer',
        lastActiveFileId: null,
      },
    });
  }
});
