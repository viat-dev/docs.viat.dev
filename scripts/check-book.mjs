import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, privacyErrors } from './lib/content.mjs';

const root = path.join(ROOT, 'exports/mdbook/book');
const info = await lstat(root);
if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Run mdbook build exports/mdbook first');
const files = new Set();
const pages = new Map();
const errors = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    const relative = path.relative(root, filename).split(path.sep).join('/');
    if (entry.isSymbolicLink()) { errors.push(`${relative}: symlink in book`); continue; }
    if (entry.isDirectory()) { await walk(filename); continue; }
    files.add(relative);
    if (/\.(?:html|js|css|json)$/.test(relative)) {
      const text = await readFile(filename, 'utf8');
      errors.push(...privacyErrors(text).map((error) => `${relative}: ${error}`));
      if (relative.endsWith('.html')) pages.set(relative, text);
    }
  }
}
await walk(root);
for (const prefix of ['/_docs/', '/viat/_docs/']) {
  for (const [filename, html] of pages) {
    const pageAddress = `https://offline.example.test${prefix}${filename}`;
    const baseHref = html.match(/<base\b[^>]*href="([^"<>]+)"/i)?.[1];
    const baseAddress = baseHref ? new URL(baseHref, pageAddress).href : pageAddress;
    for (const [, raw] of html.matchAll(/(?:href|src)="([^"<>]+)"/g)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue;
      const url = new URL(raw.replaceAll('&amp;', '&'), baseAddress);
      if (!url.pathname.startsWith(prefix)) { errors.push(`${prefix}${filename}: link leaves mount: ${raw}`); continue; }
      let target = decodeURIComponent(url.pathname.slice(prefix.length));
      if (!target || target.endsWith('/')) target += 'index.html';
      if (!files.has(target)) { errors.push(`${prefix}${filename}: missing ${raw}`); continue; }
      if (url.hash && pages.has(target)) {
        const id = decodeURIComponent(url.hash.slice(1));
        const ids = [...pages.get(target).matchAll(/\bid="([^"<>]+)"/g)].map((m) => m[1]);
        if (!ids.includes(id)) errors.push(`${prefix}${filename}: missing anchor ${raw}`);
      }
    }
    // A link to a provider is fine; rendering/search must not load a CDN.
    for (const match of html.matchAll(/<(script|link)\b[^>]*(?:src|href)="(https?:\/\/[^"<>]+)"[^>]*>/gi)) {
      if (match[1].toLowerCase() === 'script' || /rel="stylesheet"/.test(match[0])) errors.push(`${filename}: external runtime dependency ${match[2]}`);
    }
  }
}
if (errors.length) { console.error([...new Set(errors)].join('\n')); process.exitCode = 1; }
else console.log(`Checked ${pages.size} offline HTML pages under /_docs/ and /viat/_docs/: local links/anchors, assets, privacy patterns and no external script/stylesheets. Browser interaction is a separate acceptance step.`);
