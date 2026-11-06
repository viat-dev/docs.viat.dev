import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const input = process.argv[2];
if (!input || process.argv.length !== 3) throw new Error('Usage: node scripts/import-contracts.mjs EXPORTED_DIRECTORY');
const names = ['resources.json', 'languages.json', 'cli.json', 'mcp-tools.json'];
const records = await Promise.all(names.map(async (name) => {
  const bytes = await readFile(path.resolve(input, name));
  const value = JSON.parse(bytes);
  if (value.schema_version !== 1 || !/^[a-f0-9]{40}$/.test(value.source?.sha)) throw new Error(`Invalid contract provenance: ${name}`);
  if (typeof value.source.dirty !== 'boolean' || !Array.isArray(value.source.paths) || value.source.paths.some((p) => typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))) throw new Error(`Unsafe source path or dirty flag: ${name}`);
  if (/\/Users\/|\/private\/var\//.test(bytes.toString())) throw new Error(`Private path in contract: ${name}`);
  return { name, bytes, value, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
if (new Set(records.map((r) => `${r.value.source.sha}:${r.value.source.dirty}`)).size !== 1) throw new Error('Contracts must come from one source revision and worktree state');
for (const [name, expected] of [['resources.json', 20], ['languages.json', 9], ['mcp-tools.json', 46]]) {
  if (records.find((r) => r.name === name).value.count !== expected) throw new Error(`Review changed inventory before importing ${name}`);
}
const manifestPath = path.join(root, 'contracts/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.edition)) throw new Error('Invalid edition');
const directory = `contracts/${manifest.edition}`;
for (const relative of ['contracts', directory, ...names.map((name) => `${directory}/${name}`)]) {
  try {
    const info = await lstat(path.join(root, relative));
    if (info.isSymbolicLink()) throw new Error(`Refusing symlink import target: ${relative}`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await mkdir(path.join(root, directory), { recursive: true });
// The caller explicitly requested an import; retain provenance instead of
// pretending an uncommitted source export is a published product release.
for (const record of records) await writeFile(path.join(root, directory, record.name), record.bytes);
manifest.contract_bundle = {
  directory,
  source_sha: records[0].value.source.sha,
  source_dirty: records.some((r) => r.value.source.dirty),
  review_status: 'candidate',
  files: Object.fromEntries(records.map(({ name, sha256 }) => [name, { sha256 }])),
};
manifest.publication_ready = false;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Imported resource/language/CLI/MCP contracts; CLI leaf commands: ${records.find((r) => r.name === 'cli.json').value.leaf_count}. Publication remains gated.`);
