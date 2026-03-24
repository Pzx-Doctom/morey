/**
 * Send message to background service worker
 */
export function sendMessage(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, payload });
}

/**
 * Send message to a specific tab's content script
 */
export function sendToTab(tabId, type, payload = {}) {
  return chrome.tabs.sendMessage(tabId, { type, payload });
}

/**
 * Listen for messages
 */
export function onMessage(handler) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const result = handler(msg, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch(err => sendResponse({ error: err.message }));
      return true; // keep channel open for async response
    }
    if (result !== undefined) {
      sendResponse(result);
    }
  });
}
