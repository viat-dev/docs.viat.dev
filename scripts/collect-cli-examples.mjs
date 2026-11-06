import { mkdir, writeFile, lstat, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ROOT, readPages } from './lib/content.mjs';
import { inspectMarkdown } from './lib/markdown.mjs';

if (process.argv.length !== 2) throw new Error('Usage: node scripts/collect-cli-examples.mjs');
const blocks = [];
for (const page of await readPages()) {
  const { codes } = await inspectMarkdown(page);
  for (const code of codes) if (['sh', 'bash', 'shell', 'console'].includes(code.lang)) blocks.push({ page: page.relative, value: code.value });
}
const parsed = JSON.parse(execFileSync('python3', ['-I', path.join(ROOT, 'scripts/tokenize-cli-examples.py')], {
  input: JSON.stringify(blocks), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}));
const reviewed = JSON.parse(await readFile(path.join(ROOT, 'contracts/cli-shell-fixtures.json'), 'utf8'));
const byCommand = new Map();
for (const entry of reviewed) {
  if (typeof entry.command !== 'string' || !Array.isArray(entry.argv) || entry.argv[0] !== 'viat' || entry.argv.some((a) => typeof a !== 'string') || byCommand.has(entry.command)) throw new Error('Invalid or duplicate reviewed shell fixture');
  byCommand.set(entry.command, entry.argv);
}
parsed.reviewed_shell = parsed.manual.filter((r) => byCommand.has(r.original)).map((r) => ({ ...r, argv: byCommand.get(r.original), review: 'Only CLI tokens are parser-checked; redirection permissions, files and runtime effects are separate.' }));
parsed.manual = parsed.manual.filter((r) => !byCommand.has(r.original));
const output = path.join(ROOT, 'exports');
try { if ((await lstat(output)).isSymbolicLink()) throw new Error('Refusing symlink output directory'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(output, { recursive: true });
const extra = [];
for (const filename of ['foundation-argv.json', 'cli-argv.json']) {
  const argv = JSON.parse(await readFile(path.join(ROOT, 'examples', filename), 'utf8'));
  if (!Array.isArray(argv) || argv.some((a) => !Array.isArray(a) || a[0] !== 'viat' || a.some((s) => typeof s !== 'string'))) throw new Error(`Invalid argv inventory: ${filename}`);
  extra.push(...argv);
}
const unique = [...new Map([...extra, ...parsed.collected.map((r) => r.argv), ...parsed.reviewed_shell.map((r) => r.argv)].map((a) => [JSON.stringify(a), a])).values()];
for (const [filename, value] of [['cli-examples.json', unique], ['cli-example-report.json', parsed]]) {
  const target = path.join(output, filename);
  try { if ((await lstat(target)).isSymbolicLink()) throw new Error(`Refusing output symlink: ${filename}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(target, JSON.stringify(value, null, 2) + '\n');
}
console.log(`Collected ${unique.length} distinct parser inputs (${parsed.collected.length} fenced commands plus explicit argv inventories).`);
console.log(`${parsed.manual.length} shell-dependent commands require manual token fixtures; see exports/cli-example-report.json. None were executed.`);
