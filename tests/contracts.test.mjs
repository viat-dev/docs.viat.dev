import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';
import { readPinnedContracts } from '../scripts/lib/validation.mjs';
import { argumentArity } from '../scripts/lib/cli.mjs';

test('variadic argument limits preserve exported null as unbounded', () => {
  assert.equal(argumentArity({ min: 1, max: null }), '1..∞');
  assert.equal(argumentArity({ min: 0, max: 0 }), '0');
  assert.equal(argumentArity({ min: 1, max: 1 }), '1');
  assert.equal(argumentArity({ min: 0, max: 1 }), '0..1');
});

test('checked-in contract inputs retain exact digests and canonical inventories', async () => {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'contracts/manifest.json'), 'utf8'));
  const contracts = await readPinnedContracts(ROOT, manifest);
  assert.equal(contracts['resources.json'].count, 20);
  assert.equal(contracts['languages.json'].count, 9);
  assert.equal(contracts['cli.json'].leaf_count, 144);
  assert.equal(contracts['mcp-tools.json'].count, 46);
  const paths = contracts['cli.json'].commands.map((c) => c.path.join(' '));
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(!paths.includes('viat project push'));
  assert.ok(!paths.includes('viat tokens create'));
  const push = contracts['cli.json'].commands.find((c) => c.path.join(' ') === 'viat push');
  assert.ok(!push.arguments.some((a) => a.long === 'prune'));
});

test('edited contracts cannot retain old digests or change source silently', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viat-doc-contract-'));
  try {
    const source = { sha: 'a'.repeat(40), dirty: false, paths: ['crates/example.rs'] };
    const data = {
      'resources.json': { count: 0, resources: [] },
      'languages.json': { count: 0, languages: [] },
      'cli.json': { command_count: 0, leaf_count: 0, commands: [] },
      'mcp-tools.json': { count: 0, tools: [] },
    };
    const manifest = { edition: '1.1.0', contract_bundle: { directory: 'contracts/1.1.0', source_sha: source.sha, source_dirty: false, files: {} } };
    await mkdir(path.join(root, 'contracts/1.1.0'), { recursive: true });
    for (const [name, body] of Object.entries(data)) {
      const bytes = JSON.stringify({ schema_version: 1, source, ...body });
      await writeFile(path.join(root, 'contracts/1.1.0', name), bytes);
      manifest.contract_bundle.files[name] = { sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    await readPinnedContracts(root, manifest);
    await writeFile(path.join(root, 'contracts/1.1.0/resources.json'), '{}');
    await assert.rejects(readPinnedContracts(root, manifest), /Pinned digest differs/);
    manifest.contract_bundle.directory = '../private';
    await assert.rejects(readPinnedContracts(root, manifest), /Invalid pinned contract directory/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
