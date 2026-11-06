import { mkdir, writeFile, readFile, copyFile, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, LOCALES, readPages, rawMarkdown, pageUrl, pairErrors } from './lib/content.mjs';
import { readPinnedContracts } from './lib/validation.mjs';
import { publicUrl, withBase } from './lib/site.mjs';
import { rewriteRootLinks } from './lib/markdown.mjs';

const dist = path.join(ROOT, 'dist');
const info = await lstat(dist);
if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Build the static site before exporting Markdown');
const manifest = JSON.parse(await readFile(path.join(ROOT, 'contracts/manifest.json'), 'utf8'));
const pages = await readPages();
const errors = pairErrors(pages);
if (errors.length) throw new Error(errors.join('\n'));
await readPinnedContracts(ROOT, manifest);
const availability = manifest.publication_ready
  ? '> Release-pinned reference. Read page prerequisites, supported versions and explicit limitations.'
  : '> Documentation reconstruction preview; final acceptance is incomplete. Read explicit limitations and do not invent missing commands or integrations.';
// These are owned generated outputs. Prune removed pages instead of retaining
// stale or withdrawn content from a prior build.
for (const directory of ['markdown', 'contracts', 'llms']) {
  await rm(path.join(dist, directory), { recursive: true, force: true });
  await mkdir(path.join(dist, directory), { recursive: true });
}
for (const page of pages) {
  const target = path.join(dist, 'markdown', page.relative);
  await mkdir(path.dirname(target), { recursive: true });
  const content = await rewriteRootLinks(page, (url) => publicUrl(/\.md(?:[?#]|$)/.test(url) ? '/markdown' + url : url));
  await writeFile(target, rawMarkdown({ ...page, content }));
}
const source = publicUrl('');
for (const locale of LOCALES) {
  const stable = pages.filter((p) => p.locale === locale && p.data.channel === 'stable');
  const lines = [
    `# Viat ${manifest.edition} — ${locale}`,
    '',
    availability,
    '> Client versions are independent. Only stable capability references are listed here.',
    '',
  ];
  for (const page of stable) lines.push(`- [${page.data.title}](${source}/markdown/${page.relative}): ${page.data.description}`);
  await writeFile(path.join(dist, `llms-${locale}.txt`), lines.join('\n') + '\n');
  const sections = new Map();
  for (const page of stable) {
    const section = page.localPath.split('/')[0].replace(/\.md$/, '');
    const list = sections.get(section) ?? [];
    list.push(`- [${page.data.title}](${source}/markdown/${page.relative}): ${page.data.description}`);
    sections.set(section, list);
  }
  for (const [section, links] of sections) {
    const target = path.join(dist, 'llms', locale, `${section}.txt`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `# Viat ${manifest.edition} / ${section} / ${locale}\n\n${links.join('\n')}\n`);
  }
}
await writeFile(path.join(dist, 'llms.txt'), [
  '# Viat product handbook', '',
  `> Server/CLI baseline ${manifest.server.version}; native client ${manifest.client.version} is independently versioned.`,
  availability, '',
  '## Documentation',
  `- [简体中文](${source}/llms-zh-cn.txt): Chinese task and reference index.`,
  `- [English](${source}/llms-en.txt): English task and reference index.`,
  `- [Contract provenance](${source}/contracts/manifest.json): Source revision, artifact version and candidate/review state.`,
  '',
  '## Operating rules',
  '- Confirm instance, project, identity and installed version before acting.',
  '- Do not invent commands, silently accept publication warnings or equate tool success with business success.',
  '- Real messages, paid model calls and device operations require explicit opt-in.',
  '- Preview capabilities are not stable release capabilities. Raw Markdown is available per page.',
  '',
].join('\n'));
await copyFile(path.join(ROOT, 'contracts/manifest.json'), path.join(dist, 'contracts/manifest.json'));
if (manifest.contract_bundle) {
  const target = path.join(dist, 'contracts', manifest.edition);
  await mkdir(target, { recursive: true });
  for (const name of Object.keys(manifest.contract_bundle.files)) {
    if (!/^[a-z-]+\.json$/.test(name)) throw new Error('Unexpected contract filename');
    await copyFile(path.join(ROOT, manifest.contract_bundle.directory, name), path.join(target, name));
  }
}
await writeFile(path.join(dist, 'documentation-index.json'), JSON.stringify(pages.map((p) => ({
  id: p.data.doc_id, locale: p.locale, channel: p.data.channel,
  verified_release: p.data.verified_release, url: withBase(pageUrl(p.relative)), markdown: withBase(`/markdown/${p.relative}`),
})), null, 2) + '\n');
await writeFile(path.join(dist, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n' + (manifest.publication_ready ? '' : '  X-Robots-Tag: noindex, nofollow\n'));
console.log(`Exported ${pages.length} Markdown pages and bilingual stable task indexes.`);
