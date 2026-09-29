/**
 * After `vite build`, fold the CSS and JS into one HTML file so the app can be
 * opened from disk or published anywhere as a single page.
 *
 *   npm run build && npm run bundle   ->  dist/standalone.html, dist/artifact.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const cssMatch = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/);
const jsMatch = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
if (!cssMatch || !jsMatch) throw new Error('Could not find built assets in dist/index.html');
const css = readFileSync(join(dist, cssMatch[1]), 'utf8');
const js = readFileSync(join(dist, jsMatch[1]), 'utf8').replace(/<\/script/g, '<\\/script');

// Replacer functions: the bundle contains `$$` and `$'`, which a string replacement would rewrite.
html = html.replace(cssMatch[0], () => `<style>\n${css}\n</style>`).replace(jsMatch[0], () => `<script type="module">\n${js}\n</script>`);
writeFileSync(join(dist, 'standalone.html'), html);

// Artifact flavour: no document skeleton (the host wraps it), title and style first.
const title = html.match(/<title>[^<]*<\/title>/)?.[0] ?? '<title>Lifetime Financial Planner</title>';
const style = html.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? '';
const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
const script = html.match(/<script type="module">[\s\S]*?<\/script>/)?.[0] ?? '';
writeFileSync(join(dist, 'artifact.html'), `${title}\n${style}\n${body}\n${script}`);
console.log('wrote dist/standalone.html and dist/artifact.html');
