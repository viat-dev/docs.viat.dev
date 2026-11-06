import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { LOCALES, pageUrl, resolveMarkdownLink } from './content.mjs';

export const CONTRACT_FILES = ['resources.json', 'languages.json', 'cli.json', 'mcp-tools.json'];

export async function readPinnedContracts(root, manifest) {
  const bundle = manifest.contract_bundle;
  if (!bundle || bundle.directory !== `contracts/${manifest.edition}` || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.edition)) {
    throw new Error('Invalid pinned contract directory or edition');
  }
  if (!/^[a-f0-9]{40}$/.test(bundle.source_sha)) throw new Error('Contract source must be a full Git SHA');
  if (JSON.stringify(Object.keys(bundle.files).sort()) !== JSON.stringify([...CONTRACT_FILES].sort())) throw new Error('Unexpected contract file inventory');
  const canonicalRoot = await realpath(root);
  const result = {};
  for (const name of CONTRACT_FILES) {
    const filename = await realpath(path.join(root, bundle.directory, name));
    if (!filename.startsWith(canonicalRoot + path.sep)) throw new Error(`Contract escapes repository: ${name}`);
    const bytes = await readFile(filename);
    if (createHash('sha256').update(bytes).digest('hex') !== bundle.files[name].sha256) throw new Error(`Pinned digest differs: ${name}`);
    const data = JSON.parse(bytes);
    if (data.schema_version !== 1 || data.source?.sha !== bundle.source_sha || data.source?.dirty !== bundle.source_dirty) throw new Error(`Contract provenance differs: ${name}`);
    if (!Array.isArray(data.source.paths) || data.source.paths.some((p) => typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))) throw new Error(`Invalid source paths: ${name}`);
    result[name] = data;
  }
  for (const [name, key] of [['resources.json', 'resources'], ['languages.json', 'languages'], ['mcp-tools.json', 'tools']]) {
    if (result[name].count !== result[name][key].length) throw new Error(`Contract count differs: ${name}`);
  }
  const cli = result['cli.json'];
  if (cli.command_count !== cli.commands.length || cli.leaf_count !== cli.commands.filter((c) => c.leaf).length) throw new Error('CLI command count differs');
  return result;
}

export function coverageReport(pages, inventory, contracts) {
  const required = new Set([
    ...inventory.required_documents,
    ...contracts['resources.json'].resources.map((r) => `resource.${r.kind}`),
    ...contracts['languages.json'].languages.map((l) => `script.${l.name}`),
    ...contracts['cli.json'].commands.filter((c) => c.leaf).map((c) => `cli.${c.path.slice(1).join('.')}`),
    ...contracts['mcp-tools.json'].tools.map((t) => `mcp.${t.name}`),
  ]);
  const locales = {};
  for (const locale of LOCALES) {
    const covered = new Set(pages.filter((p) => p.locale === locale && p.data.channel === 'stable')
      // Only CLI references deliberately group multiple leaf sections per page.
      // A resource/tool overview must not stand in for its missing detail pages.
      .flatMap((p) => [p.data.doc_id, ...(p.data.doc_id?.startsWith('cli.') ? (p.data.contract_ids ?? []).filter((id) => id.startsWith('cli.')) : [])]));
    const missing = [...required].filter((id) => !covered.has(id)).sort();
    locales[locale] = { required: required.size, covered: required.size - missing.length, missing };
  }
  return locales;
}

/** Metadata coverage cannot prove prose quality. Require a real command heading
 * as well, so declaring 144 IDs on an overview cannot satisfy CLI coverage. */
export function contractSectionErrors(page, inspection, contracts) {
  // Other guides may reference CLI contracts without claiming to be their
  // complete reference sections. Only canonical CLI pages count toward leaves.
  if (!page.data.doc_id?.startsWith('cli.')) return [];
  const errors = [];
  const ids = new Set([page.data.doc_id, ...(page.data.contract_ids ?? [])]);
  for (const command of contracts['cli.json'].commands.filter((c) => c.leaf)) {
    const id = `cli.${command.path.slice(1).join('.')}`;
    if (ids.has(id) && !inspection.headings.some((h) => h.text.replaceAll('`', '').trim() === command.path.join(' '))) {
      errors.push(`${page.relative}: ${id} requires its own full-command heading`);
    }
  }
  return errors;
}

const GENERATED_URLS = new Set(['/llms.txt', '/llms-en.txt', '/llms-zh-cn.txt', '/contracts/manifest.json', '/documentation-index.json']);

export function linkErrors(pages, inspections) {
  const errors = [];
  const byPath = new Map(pages.map((p) => [p.relative, p]));
  const byUrl = new Map(pages.map((p) => [pageUrl(p.relative), p]));
  for (const page of pages) {
    for (const { url, position } of inspections.get(page.relative).links) {
      const label = `${page.relative}:${position?.start?.line ?? '?'} (${url})`;
      if (/^(?:https?:|mailto:|tel:|\/\/)/i.test(url)) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(url)) { errors.push(`${label}: unsupported link scheme`); continue; }
      let resolved, parsed;
      try {
        resolved = resolveMarkdownLink(page.relative, url);
        parsed = new URL(url, `https://docs.viat.dev${pageUrl(page.relative)}`);
      } catch (error) { errors.push(`${label}: ${error.message}`); continue; }
      let target;
      if (resolved) target = byPath.get(resolved.target);
      else if (url.startsWith('#') || url.startsWith('?') || url === '') target = page;
      else target = byUrl.get(parsed.pathname);
      if (!target) {
        if (!parsed.hash && GENERATED_URLS.has(parsed.pathname)) continue;
        errors.push(`${label}: missing local target`);
        continue;
      }
      if (target.locale !== page.locale) errors.push(`${label}: use the same-language page (language switching is site navigation)`);
      if (parsed.hash) {
        let anchor;
        try { anchor = decodeURIComponent(parsed.hash.slice(1)); }
        catch { errors.push(`${label}: invalid encoded anchor`); continue; }
        const info = inspections.get(target.relative);
        if (![...info.headings.map((h) => h.slug), ...(info.anchors ?? [])].includes(anchor)) errors.push(`${label}: missing anchor ${anchor}`);
      }
    }
  }
  return errors;
}

export async function fixtureErrors(root, pages, inspections) {
  const errors = [];
  const pairs = new Map();
  for (const page of pages) {
    const references = [];
    for (const block of inspections.get(page.relative).codes) {
      const match = block.meta?.match(/(?:^|\s)fixture=([^\s]+)/);
      if (!match) continue;
      const relative = match[1];
      references.push(relative);
      if (!/^[a-z0-9_./-]+$/i.test(relative) || relative.startsWith('/') || relative.split('/').includes('..')) {
        errors.push(`${page.relative}: unsafe fixture path`);
        continue;
      }
      try {
        const base = await realpath(path.join(root, 'examples'));
        const filename = await realpath(path.join(base, relative));
        if (!filename.startsWith(base + path.sep)) throw new Error('fixture escapes examples directory');
        const actual = (await readFile(filename, 'utf8')).replaceAll('\r\n', '\n').trimEnd();
        if (actual !== block.value.trimEnd()) errors.push(`${page.relative}: snippet differs from examples/${relative}`);
      } catch (error) { errors.push(`${page.relative}: fixture ${relative}: ${error.message}`); }
    }
    const pair = pairs.get(page.data.doc_id) ?? {};
    pair[page.locale] = references.sort();
    pairs.set(page.data.doc_id, pair);
  }
  for (const [id, pair] of pairs) if (JSON.stringify(pair.en) !== JSON.stringify(pair['zh-cn'])) errors.push(`${id}: fixture references differ by locale`);
  return errors;
}

export function handbookDigest(pages) {
  const hash = createHash('sha256');
  for (const page of [...pages].sort((a, b) => a.relative.localeCompare(b.relative, 'en'))) {
    hash.update(JSON.stringify([page.relative, page.data, page.content]));
    hash.update('\n');
  }
  return hash.digest('hex');
}

export function releaseErrors(manifest, coverage, acceptance, digest, exampleDigest) {
  const errors = [];
  if (!manifest.publication_ready) errors.push('Publication remains explicitly blocked in manifest');
  if (manifest.contract_bundle?.source_dirty !== false || manifest.contract_bundle?.review_status !== 'verified') errors.push('Release needs a clean, reviewed contract source');
  for (const locale of LOCALES) if (coverage[locale].missing.length) errors.push(`${locale}: ${coverage[locale].missing.length} required references missing`);
  for (const gate of ['cli-examples', 'mcp-integration', 'resource-examples', 'application-examples', 'bilingual-review', 'offline-book', 'product-doc-pins', 'public-output-privacy']) {
    const evidence = acceptance?.checks?.find((c) => c.id === gate);
    if (evidence?.status !== 'passed' || !evidence.command || !evidence.evidence_sha256) errors.push(`Missing successful acceptance evidence: ${gate}`);
  }
  if (acceptance?.contract_source !== manifest.contract_bundle?.source_sha) errors.push('Acceptance evidence does not match pinned source');
  if (!digest || acceptance?.handbook_sha256 !== digest) errors.push('Acceptance evidence does not match current handbook content');
  if (!exampleDigest || acceptance?.examples_sha256 !== exampleDigest) errors.push('Acceptance evidence does not match current application sources');
  return errors;
}
