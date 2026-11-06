import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, readPages, pairErrors } from './lib/content.mjs';
import { inspectMarkdown } from './lib/markdown.mjs';
import { examplesDigest } from './lib/examples.mjs';
import { readPinnedContracts, coverageReport, contractSectionErrors, linkErrors, releaseErrors, handbookDigest, fixtureErrors } from './lib/validation.mjs';

const args = process.argv.slice(2);
if (args.some((a) => !['--release', '--inventory'].includes(a))) throw new Error('Usage: node scripts/check-content.mjs [--release] [--inventory]');
const readJson = async (relative) => JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));
const manifest = await readJson('contracts/manifest.json');
const inventory = await readJson('contracts/coverage.json');
const contracts = await readPinnedContracts(ROOT, manifest);
const pages = await readPages();
const errors = pairErrors(pages);
if (!pages.length) errors.push('No documentation pages');
const inspections = new Map();
for (const page of pages) {
  const inspection = await inspectMarkdown(page);
  inspections.set(page.relative, inspection);
  errors.push(...contractSectionErrors(page, inspection, contracts));
  for (const code of inspection.codes.filter((c) => c.lang === 'json')) {
    try { JSON.parse(code.value); }
    catch (error) { errors.push(`${page.relative}: invalid JSON example (${error.message}); mark intentionally incomplete syntax as text, not json`); }
  }
  if (page.data.channel === 'stable' && page.data.verified_release !== manifest.server.version) errors.push(`${page.relative}: stable baseline differs from manifest`);
}
errors.push(...linkErrors(pages, inspections));
errors.push(...await fixtureErrors(ROOT, pages, inspections));
const coverage = coverageReport(pages, inventory, contracts);
for (const [locale, entry] of Object.entries(coverage)) {
  console.log(`${locale}: ${entry.covered}/${entry.required} required reference IDs covered; ${entry.missing.length} missing`);
  if (args.includes('--inventory')) console.log(JSON.stringify({ locale, missing: entry.missing }, null, 2));
}
if (args.includes('--release') || manifest.publication_ready) {
  let acceptance;
  try { acceptance = await readJson('contracts/acceptance.json'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  errors.push(...releaseErrors(manifest, coverage, acceptance, handbookDigest(pages), await examplesDigest(ROOT)));
}
if (errors.length) {
  console.error(errors.map((error) => `ERROR ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${pages.length} pages: paired metadata, pinned contracts, Markdown links/anchors, JSON fences and shared fixture snippets.`);
  if (!manifest.publication_ready) console.log('Preview only: incomplete coverage and unexecuted examples are NOT accepted as a release.');
}
