import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exampleFiles } from '../scripts/lib/examples.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viat-example-export-'));
  const directory = path.join(root, 'examples/cms');
  await mkdir(path.join(directory, 'project/scripts'), { recursive: true });
  await writeFile(path.join(directory, 'case.json'), JSON.stringify({ id: 'cms', external_side_effects_default: false }));
  await writeFile(path.join(directory, 'project/scripts/hello.py'), 'def main():\n    return {"ok": True}\n');
  return { root, directory };
}

test('example publication preserves full source paths and rejects private records', async () => {
  const { root, directory } = await fixture();
  try {
    assert.deepEqual((await exampleFiles(root, 'cms')).files.map((f) => f.relative), ['case.json', 'project/scripts/hello.py']);
    await mkdir(path.join(directory, 'records'));
    await assert.rejects(exampleFiles(root, 'cms'), /private\/generated/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('example publication refuses credentials, unknown binaries and symlinks', async () => {
  const { root, directory } = await fixture();
  try {
    await writeFile(path.join(directory, 'token.txt'), 'vis_pat_' + 'a'.repeat(43));
    await assert.rejects(exampleFiles(root, 'cms'), /potential live credential/);
    await rm(path.join(directory, 'token.txt'));
    await writeFile(path.join(directory, 'state.sqlite'), 'private database');
    await assert.rejects(exampleFiles(root, 'cms'), /not allowlisted/);
    await rm(path.join(directory, 'state.sqlite'));
    await symlink(path.join(directory, 'case.json'), path.join(directory, 'other.json'));
    await assert.rejects(exampleFiles(root, 'cms'), /symlink/);
    await assert.rejects(exampleFiles(root, '../private'), /Unknown application/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
