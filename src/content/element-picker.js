/**
 * element-picker.js - Allow user to select a page element by hovering/clicking
 * Similar to browser DevTools element inspector
 */

let active = false;
let overlay = null;
let infoBox = null;
let currentTarget = null;
let resolveSelection = null;

/**
 * Enter element picking mode. Returns a promise that resolves
 * with the CSS selector of the picked element, or null if cancelled.
 */
export function startPicker() {
  return new Promise((resolve) => {
    if (active) {
      resolve(null);
      return;
    }
    active = true;
    resolveSelection = resolve;
    createOverlay();
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
  });
}

export function stopPicker() {
  if (!active) return;
  active = false;
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  removeOverlay();
  currentTarget = null;
  if (resolveSelection) {
    resolveSelection(null);
    resolveSelection = null;
  }
}

function createOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'morey-picker-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0', left: '0', right: '0', bottom: '0',
    zIndex: '2147483646',
    pointerEvents: 'none',
  });

  infoBox = document.createElement('div');
  infoBox.id = 'morey-picker-info';
  Object.assign(infoBox.style, {
    position: 'fixed',
    zIndex: '2147483647',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    display: 'none',
  });

  document.body.appendChild(overlay);
  document.body.appendChild(infoBox);
}

function removeOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  if (infoBox) {
    infoBox.remove();
    infoBox = null;
  }
  // Remove highlight from last target
  clearHighlight();
}

let highlightedElement = null;
let originalOutline = '';

function highlightElement(el) {
  if (highlightedElement === el) return;
  clearHighlight();
  highlightedElement = el;
  originalOutline = el.style.outline;
  el.style.outline = '2px solid #4a90d9';
  el.style.outlineOffset = '-1px';
}

function clearHighlight() {
  if (highlightedElement) {
    highlightedElement.style.outline = originalOutline;
    highlightedElement.style.outlineOffset = '';
    highlightedElement = null;
    originalOutline = '';
  }
}

function handleMouseMove(e) {
  if (!active) return;

  // Temporarily hide overlay elements to get the real element underneath
  if (overlay) overlay.style.display = 'none';
  if (infoBox) infoBox.style.display = 'none';

  const el = document.elementFromPoint(e.clientX, e.clientY);

  if (overlay) overlay.style.display = '';
  // infoBox display is restored below based on target

  if (!el || el === document.body || el === document.documentElement) {
    clearHighlight();
    if (infoBox) infoBox.style.display = 'none';
    currentTarget = null;
    return;
  }

  // Skip morey's own elements
  if (el.id && el.id.startsWith('morey-')) return;

  currentTarget = el;
  highlightElement(el);

  // Update info box
  if (infoBox) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    const rect = el.getBoundingClientRect();
    const size = `${Math.round(rect.width)}x${Math.round(rect.height)}`;

    infoBox.textContent = `${tag}${id}${cls} (${size})`;
    infoBox.style.display = 'block';

    // Position info box near cursor
    let top = e.clientY + 20;
    let left = e.clientX + 10;
    if (top + 30 > window.innerHeight) top = e.clientY - 30;
    if (left + 200 > window.innerWidth) left = e.clientX - 200;
    infoBox.style.top = top + 'px';
    infoBox.style.left = left + 'px';
  }
}

function handleClick(e) {
  if (!active || !currentTarget) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const selector = generateSelector(currentTarget);
  active = false;

  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  removeOverlay();

  if (resolveSelection) {
    resolveSelection(selector);
    resolveSelection = null;
  }
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    stopPicker();
  }
}

/**
 * Generate a unique CSS selector for the given element
 * Priority: id > unique class combo > data attributes > nth-child path
 */
function generateSelector(el) {
  // Strategy 1: ID
  if (el.id) {
    const sel = '#' + CSS.escape(el.id);
    if (isUnique(sel)) return sel;
  }

  // Strategy 2: Unique class combination
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).filter(c => c.length > 0);
    if (classes.length > 0) {
      const tag = el.tagName.toLowerCase();
      // Try tag + all classes
      const sel = tag + '.' + classes.map(c => CSS.escape(c)).join('.');
      if (isUnique(sel)) return sel;
      // Try just classes
      const selClasses = '.' + classes.map(c => CSS.escape(c)).join('.');
      if (isUnique(selClasses)) return selClasses;
    }
  }

  // Strategy 3: data attributes
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-') && attr.value) {
      const sel = `[${attr.name}="${CSS.escape(attr.value)}"]`;
      if (isUnique(sel)) return sel;
    }
  }

  // Strategy 4: nth-child path
  return buildNthChildPath(el);
}

function buildNthChildPath(el) {
  const parts = [];
  let current = el;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift('#' + CSS.escape(current.id));
      break;
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        c => c.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function isUnique(selector) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}
