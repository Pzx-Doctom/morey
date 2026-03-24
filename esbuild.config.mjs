import { build, context } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const isWatch = process.argv.includes('--watch');

const commonOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  target: ['chrome110'],
  format: 'iife',
};

// Copy static files to dist
function copyStaticFiles() {
  // Copy manifest.json
  copyFileSync('manifest.json', 'dist/manifest.json');

  // Copy popup HTML/CSS
  if (!existsSync('dist/popup')) mkdirSync('dist/popup', { recursive: true });
  copyFileSync('src/popup/popup.html', 'dist/popup/popup.html');
  copyFileSync('src/popup/popup.css', 'dist/popup/popup.css');

  // Copy icons
  if (!existsSync('dist/icons')) mkdirSync('dist/icons', { recursive: true });
  const iconsDir = 'assets/icons';
  if (existsSync(iconsDir)) {
    for (const file of readdirSync(iconsDir)) {
      copyFileSync(join(iconsDir, file), join('dist/icons', file));
    }
  }

  // Copy content CSS
  if (!existsSync('dist/content')) mkdirSync('dist/content', { recursive: true });
  copyFileSync('src/content/content.css', 'dist/content/content.css');
}

const builds = [
  // Content script
  {
    ...commonOptions,
    entryPoints: ['src/content/content.js'],
    outfile: 'dist/content/content.js',
  },
  // Popup
  {
    ...commonOptions,
    entryPoints: ['src/popup/popup.js'],
    outfile: 'dist/popup/popup.js',
  },
  // Service worker (background)
  {
    ...commonOptions,
    entryPoints: ['src/background/service-worker.js'],
    outfile: 'dist/background/service-worker.js',
  },
];

if (isWatch) {
  const contexts = await Promise.all(builds.map(b => context(b)));
  await Promise.all(contexts.map(ctx => ctx.watch()));
  copyStaticFiles();
  console.log('Watching for changes...');
} else {
  await Promise.all(builds.map(b => build(b)));
  copyStaticFiles();
  console.log('Build complete.');
}
