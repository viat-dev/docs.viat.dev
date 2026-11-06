import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { privacyErrors } from './content.mjs';

export const APPLICATIONS = ['paper-digest', 'home-assistant', 'weixin-assistant', 'cms', 'lab-jobs', 'webhook-ingestion', 'data-sync', 'reports'];
const EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.py', '.sql', '.txt', '.ts', '.sh']);

/** Publish only authored example inputs. Private operator records, databases,
 * sessions and interpreter caches never belong to a downloadable project. */
export async function exampleFiles(root, id) {
  if (!APPLICATIONS.includes(id)) throw new Error(`Unknown application example: ${id}`);
  const base = path.join(root, 'examples', id);
  const examplesRoot = await realpath(path.join(root, 'examples'));
  const actualBase = await realpath(base);
  if (actualBase !== path.join(examplesRoot, id)) throw new Error(`Example root symlink: ${id}`);
  const files = [];
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const filename = path.join(directory, entry.name);
      const relative = path.relative(base, filename).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw new Error(`${id}/${relative}: symlink is not publishable`);
      if (entry.name.startsWith('.') || ['records', '__pycache__', 'node_modules', 'target'].includes(entry.name)) throw new Error(`${id}/${relative}: private/generated content inside example source`);
      if (entry.isDirectory()) { await walk(filename); continue; }
      if (!EXTENSIONS.has(path.extname(entry.name))) throw new Error(`${id}/${relative}: file extension is not allowlisted`);
      const content = await readFile(filename, 'utf8');
      const errors = privacyErrors(content);
      if (errors.length) throw new Error(`${id}/${relative}: ${errors.join(', ')}`);
      files.push({ relative, content });
    }
  }
  await walk(base);
  const manifestFile = files.find((f) => f.relative === 'case.json');
  if (!manifestFile) throw new Error(`${id}: missing case.json`);
  const manifest = JSON.parse(manifestFile.content);
  if (manifest.id !== id || manifest.external_side_effects_default !== false) throw new Error(`${id}: inconsistent identity or unsafe default metadata`);
  return { manifest, files };
}

export async function examplesDigest(root) {
  const hash = createHash('sha256');
  for (const id of [...APPLICATIONS].sort()) {
    for (const file of (await exampleFiles(root, id)).files) {
      hash.update(JSON.stringify([id, file.relative, file.content]));
      hash.update('\n');
    }
  }
  return hash.digest('hex');
}
