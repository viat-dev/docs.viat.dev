import { readFile, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, privacyErrors, readPages, pageUrl } from './lib/content.mjs';
import { publicUrl, stripBase, withBase } from './lib/site.mjs';

const dist = path.join(ROOT, 'dist');
const errors = [];
const files = new Set();
const html = new Map();
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    const relative = path.relative(dist, filename).split(path.sep).join('/');
    if (entry.isSymbolicLink()) { errors.push(`${relative}: output symlink`); continue; }
    if (entry.isDirectory()) { await walk(filename); continue; }
    files.add(relative);
    if (/(^|\/)(?:feedback|plans|node_modules|\.git)(\/|$)/.test(relative)) errors.push(`${relative}: non-public directory`);
    if (/\.(?:html|json|txt|md|js|css|xml)$/.test(entry.name)) {
      const text = await readFile(filename, 'utf8');
      errors.push(...privacyErrors(text).map((error) => `${relative}: ${error}`));
      if (entry.name.endsWith('.html')) html.set(relative, text);
    }
  }
}
if (!(await lstat(dist)).isDirectory() || (await lstat(dist)).isSymbolicLink()) throw new Error('Static output is not a real directory');
await walk(dist);
for (const [relative, text] of html) {
  for (const [, url] of text.matchAll(/(?:href|src)="([^"<>]+)"/g)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) continue;
    let pathname;
    try {
      const local = stripBase(decodeURIComponent(new URL(url, publicUrl(`/${relative}`)).pathname));
      if (local === null) { errors.push(`${relative}: link escapes site base ${url}`); continue; }
      pathname = local.slice(1);
    } catch { errors.push(`${relative}: malformed URL ${url}`); continue; }
    if (!files.has(pathname) && !files.has(pathname.replace(/\/?$/, '/') + 'index.html') && !(pathname === '' && files.has('index.html'))) errors.push(`${relative}: missing built link ${url}`);
  }
}
for (const page of await readPages()) {
  const route = pageUrl(page.relative).slice(1) + 'index.html';
  if (!files.has(route)) errors.push(`${page.relative}: missing website route ${route}`);
  if (!files.has(`markdown/${page.relative}`)) errors.push(`${page.relative}: missing raw Markdown`);
  if (!html.get(route)?.includes(withBase(`/markdown/${page.relative}`))) errors.push(`${page.relative}: page does not link to its actual raw Markdown file`);
  const language = page.locale === 'zh-cn' ? 'zh-CN' : 'en';
  if (!html.get(route)?.includes(`lang="${language}"`)) errors.push(`${page.relative}: incorrect page language`);
}
for (const required of ['index.html', 'llms.txt', 'llms-en.txt', 'llms-zh-cn.txt', 'documentation-index.json', 'contracts/manifest.json']) if (!files.has(required)) errors.push(`Missing output ${required}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Checked ${files.size} output files: privacy patterns, page/raw routes, languages and local asset links. This scan is not a manual privacy review.`);
