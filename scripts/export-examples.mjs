import { mkdir, writeFile, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';
import { APPLICATIONS, exampleFiles } from './lib/examples.mjs';
import { withBase } from './lib/site.mjs';

const book = process.argv.slice(2).includes('--book');
if (process.argv.slice(2).some((a) => a !== '--book')) throw new Error('Usage: node scripts/export-examples.mjs [--book]');
const base = path.join(ROOT, book ? 'exports/mdbook/book' : 'dist');
const info = await lstat(base);
if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Build the destination before exporting examples');
// Validate all inputs before replacing the owned generated directory.
const cases = await Promise.all(APPLICATIONS.map(async (id) => ({ id, ...await exampleFiles(ROOT, id) })));
const output = path.join(base, 'examples');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const index = [];
for (const entry of cases) {
  const directory = path.join(output, entry.id);
  await mkdir(directory, { recursive: true });
  for (const file of entry.files) {
    const destination = path.join(directory, file.relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content);
  }
  const guide = (locale) => book ? `../../${locale}/applications/${entry.id}.html` : withBase(`/${locale}/applications/${entry.id}/`);
  const rows = entry.files.map((f) => `<li><a download href="${encodeURI(f.relative)}">${escape(f.relative)}</a></li>`).join('\n');
  await writeFile(path.join(directory, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>Viat example: ${entry.id}</title><body><h1>${entry.id}</h1><p>Example source files / 示例源码。Read the complete guide before applying; downloads do not execute commands. 下载不会执行命令，应用前先读完整指南。</p><p><a href="${guide('en')}">English guide</a> · <a href="${guide('zh-cn')}">中文指南</a></p><p>Keep the listed directory layout. Readmes retain repository-relative source links; use the guide links above outside a checkout. 请保留目录结构；脱离仓库时使用上方指南链接。</p><ul>${rows}</ul></body></html>\n`);
  index.push({ id: entry.id, server_version: entry.manifest.server_version, files: entry.files.map((f) => f.relative) });
}
await writeFile(path.join(output, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`Exported allowlisted sources for ${cases.length} applications; no examples executed.`);
