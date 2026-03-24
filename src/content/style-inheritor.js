/**
 * style-inheritor.js - Extract computed styles from host page elements
 * to make injected Markdown content blend with the original page
 */

const STYLE_PROPS = [
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'color', 'backgroundColor',
  'textAlign', 'direction',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'maxWidth',
];

/**
 * Extract relevant styles from a target element
 */
export function extractStyles(element) {
  const computed = getComputedStyle(element);
  const styles = {};
  for (const prop of STYLE_PROPS) {
    styles[prop] = computed[prop];
  }

  // Try to extract link color from existing <a> tags
  const link = element.querySelector('a');
  if (link) {
    styles.linkColor = getComputedStyle(link).color;
  }

  return styles;
}

/**
 * Apply extracted styles to the rendered markdown container
 */
export function applyStyles(container, styles) {
  for (const prop of STYLE_PROPS) {
    if (styles[prop]) {
      container.style[prop] = styles[prop];
    }
  }

  // Apply link color
  if (styles.linkColor) {
    const links = container.querySelectorAll('a');
    links.forEach(a => { a.style.color = styles.linkColor; });
  }
}

/**
 * Generate a minimal CSS string for code blocks and tables
 * that adapts to the host page theme
 */
export function generatePatchCSS(styles) {
  const bg = styles.backgroundColor || '#fff';
  const color = styles.color || '#333';

  // Determine if dark theme
  const isDark = isColorDark(bg);
  const codeBg = isDark ? lighten(bg, 0.1) : darken(bg, 0.04);
  const borderColor = isDark ? lighten(bg, 0.2) : darken(bg, 0.1);

  return `
    .morey-rendered pre,
    .morey-rendered code {
      background: ${codeBg};
      border-radius: 4px;
    }
    .morey-rendered pre {
      padding: 12px 16px;
      overflow-x: auto;
      margin: 1em 0;
    }
    .morey-rendered code {
      padding: 2px 4px;
      font-size: 0.9em;
    }
    .morey-rendered pre code {
      padding: 0;
      background: none;
    }
    .morey-rendered table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    .morey-rendered th,
    .morey-rendered td {
      border: 1px solid ${borderColor};
      padding: 8px 12px;
      text-align: left;
    }
    .morey-rendered th {
      background: ${codeBg};
      font-weight: 600;
    }
    .morey-rendered blockquote {
      border-left: 4px solid ${borderColor};
      padding-left: 16px;
      margin: 1em 0;
      color: ${isDark ? lighten(color, 0.3) : darken(color, 0.3)};
    }
    .morey-rendered img {
      max-width: 100%;
      height: auto;
    }
    .morey-rendered hr {
      border: none;
      border-top: 1px solid ${borderColor};
      margin: 1.5em 0;
    }
    .morey-rendered ul.task-list {
      list-style: none;
      padding-left: 0;
    }
    .morey-rendered ul.task-list li {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
  `;
}

// Color utilities
function isColorDark(color) {
  const rgb = parseColor(color);
  if (!rgb) return false;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.5;
}

function parseColor(color) {
  if (!color) return null;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return null;
}

function lighten(color, amount) {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * amount));
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * amount));
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function darken(color, amount) {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const r = Math.max(0, Math.round(rgb.r * (1 - amount)));
  const g = Math.max(0, Math.round(rgb.g * (1 - amount)));
  const b = Math.max(0, Math.round(rgb.b * (1 - amount)));
  return `rgb(${r}, ${g}, ${b})`;
}
