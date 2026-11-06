import { readFile, mkdtemp, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/content.mjs';

const CASES = ['paper-digest', 'home-assistant', 'weixin-assistant', 'cms', 'lab-jobs', 'webhook-ingestion', 'data-sync', 'reports'];
const selected = process.argv.slice(2);
if (selected.some((name) => !CASES.includes(name))) throw new Error('Pass supported case names, or none for all eight');
const manifest = JSON.parse(await readFile(path.join(ROOT, 'contracts/manifest.json'), 'utf8'));
const home = await mkdtemp(path.join(os.tmpdir(), 'viat-example-home-'));
let failed = 0;
try {
  for (const name of selected.length ? selected : CASES) {
    try {
      const directory = path.join(ROOT, 'examples', name);
      if ((await lstat(directory)).isSymbolicLink()) throw new Error('Example directory may not be a symlink');
      const contract = JSON.parse(await readFile(path.join(directory, 'case.json'), 'utf8'));
      if (contract.id !== name || contract.server_version !== manifest.server.version || contract.external_side_effects_default !== false) throw new Error('Example identity/version/safety metadata differs');
      if (JSON.stringify(contract.validation_command) !== JSON.stringify(['python3', '-I', 'validate.py'])) throw new Error('Unexpected validation command; unit acceptance does not execute arbitrary manifest commands');
      const result = spawnSync('python3', ['-I', '-B', path.join(ROOT, 'scripts/validate-example.py'), directory], {
        env: { PATH: process.env.PATH, HOME: home, LANG: 'C.UTF-8' },
        encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024,
      });
      process.stdout.write(`\n== ${name}: offline unit validation ==\n${result.stdout ?? ''}`);
      process.stderr.write(result.stderr ?? '');
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`validator exit ${result.status}; signal ${result.signal ?? 'none'}`);
      console.log(`${name}: passed offline validation; server/provider acceptance is separate`);
    } catch (error) { failed++; console.error(`${name}: FAILED: ${error.message}`); }
  }
} finally { await rm(home, { recursive: true, force: true }); }
if (failed) process.exitCode = 1;
