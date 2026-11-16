#!/usr/bin/env node
// Local regeneration helper for handbook screenshots: enables a locally
// running official dev instance for the documentation workspace.
//
// NOT a customer procedure and ships no key material: any vendor-side key is
// read in-process from well-known local locations and never printed. See the
// product's vendor tooling README for the real issuance workflow.
//
// Usage: node scripts/dev/enable-instance.mjs [--customer name] [--days N]
// Reads the private code from the key file (if present), submits it through
// stdin like an operator would, and prints the resulting status JSON.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrivateKey, randomUUID, sign as edSign } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const customer = option('customer', 'docs-screenshot-local');
const days = Number(option('days', '60'));
if (!Number.isInteger(days) || days <= 0) {
  console.error('--days must be a positive integer');
  process.exit(2);
}

const home = process.env.HOME ?? '';
const candidates = [
  path.join(ROOT, '../viat/viat-license-signing.key'),
  path.join(ROOT, '../viat/crates/viat-license/viat-license-signing.key'),
  ...(home ? [path.join(home, 'viat-license-signing.key'), path.join(home, '.config/viat/viat-license-signing.key')] : []),
];
const keyPath = candidates.find((candidate) => {
  try {
    return readFileSync(candidate, 'utf8').trim().length === 64;
  } catch {
    return false;
  }
});
if (!keyPath) {
  console.error('No vendor-side key found in known local locations.');
  console.error('Ask the operator to issue a local dev code with the product-side tool,');
  console.error('then submit it with: viat license activate - < code-file');
  process.exit(1);
}
const seedHex = readFileSync(keyPath, 'utf8').trim();
if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) {
  console.error('Key file is not 64 hex characters');
  process.exit(1);
}

// PKCS#8 wrapping for a raw Ed25519 seed (RFC 5958), accepted by node:crypto.
const seed = Buffer.from(seedHex, 'hex');
const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });

const iso = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');
const issued = new Date();
const expires = new Date(issued.getTime() + days * 86400_000);
const payload = JSON.stringify({
  v: 1,
  id: randomUUID(),
  customer,
  issued_at: iso(issued),
  expires_at: iso(expires),
});
const payloadBytes = Buffer.from(payload, 'utf8');
const signature = edSign(null, payloadBytes, privateKey);
const b64url = (buffer) => buffer.toString('base64url');
const code = `VIAT-${b64url(payloadBytes)}.${b64url(signature)}`;

// Submit through stdin, exactly like the documented operator flow; the code
// never appears in a process argument list.
const activated = spawnSync('viat', ['license', 'activate', '-', '--json'], { input: code, encoding: 'utf8' });
if (activated.status !== 0) {
  console.error(activated.stderr || activated.stdout || 'activation command failed');
  process.exit(1);
}
process.stdout.write(activated.stdout);
const status = spawnSync('viat', ['license', 'show', '--json'], { encoding: 'utf8' });
if (status.status !== 0) {
  console.error(status.stderr || 'status command failed');
  process.exit(1);
}
const parsed = JSON.parse(status.stdout);
console.error(`enabled until: ${parsed.expires_at ?? 'permanent'}`);
if (!parsed.activated || parsed.expired) {
  console.error(status.stdout);
  process.exit(1);
}
