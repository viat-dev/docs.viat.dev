import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readPages, pageUrl, resolveMarkdownLink, pairErrors, rawMarkdown, privacyErrors } from '../scripts/lib/content.mjs';
import { inspectMarkdown, escapeGeneratedHtml } from '../scripts/lib/markdown.mjs';
import { coverageReport, linkErrors, contractSectionErrors, releaseErrors, fixtureErrors, handbookDigest } from '../scripts/lib/validation.mjs';

function page(locale = 'en', overrides = {}) {
  return { absolute: '/synthetic/docs/en/guide.md', relative: `${locale}/guide.md`, locale, localPath: 'guide.md', data: {
    title: 'Guide', description: 'A complete guide.', doc_id: 'guide.test', verified_release: '1.1.0', channel: 'stable',
  }, content: '## Before you begin\n\nAn actual explanation.\n', ...overrides };
}
const contracts = {
  'resources.json': { resources: [{ kind: 'http_api' }] },
  'languages.json': { languages: [{ name: 'python' }] },
  'cli.json': { commands: [{ path: ['viat', 'project', 'member', 'ls'], leaf: true }, { path: ['viat', 'project'], leaf: false }] },
  'mcp-tools.json': { tools: [{ name: 'list_scripts' }] },
};

test('source URLs preserve wire identifiers and collapse only index pages', () => {
  assert.equal(pageUrl('en/index.md'), '/en/');
  assert.equal(pageUrl('zh-cn/assets/resources/index.md'), '/zh-cn/assets/resources/');
  assert.equal(pageUrl('en/assets/resources/http_api.md'), '/en/assets/resources/http_api/');
  assert.throws(() => pageUrl('../private.md'));
  assert.throws(() => pageUrl('en/guide.txt'));
});

test('relative source links retain query and fragment without permitting escape', () => {
  assert.deepEqual(resolveMarkdownLink('en/assets/scripts/python.md', '../resources/http_api.md#configuration'), { target: 'en/assets/resources/http_api.md', suffix: '#configuration' });
  assert.deepEqual(resolveMarkdownLink('en/index.md', '/en/guide.md?mode=read#before'), { target: 'en/guide.md', suffix: '?mode=read#before' });
  assert.equal(resolveMarkdownLink('en/guide.md', 'https://example.com/source.md'), null);
  assert.equal(resolveMarkdownLink('en/guide.md', '#before'), null);
  assert.throws(() => resolveMarkdownLink('en/guide.md', '../../private.md'));
});

test('translation matching enforces IDs, paths, versions and contract parity', () => {
  const en = page(), zh = page('zh-cn');
  assert.deepEqual(pairErrors([en, zh]), []);
  assert.match(pairErrors([en]).join('\n'), /missing translation/);
  assert.match(pairErrors([en, en, zh]).join('\n'), /duplicate/);
  const changed = page('zh-cn', { data: { ...zh.data, verified_release: '2.0.0', contract_ids: ['resource.http_api'] } });
  assert.match(pairErrors([en, changed]).join('\n'), /verified_release differs/);
  assert.match(pairErrors([en, changed]).join('\n'), /contract coverage differs/);
  assert.match(pairErrors([en, page('zh-cn', { localPath: 'wrong.md' })]).join('\n'), /locale paths differ/);
});

test('privacy checks apply to frontmatter as well as prose', () => {
  assert.match(pairErrors([page('en', { data: { ...page().data, description: '/Users/example/private' } })]).join('\n'), /private local path/);
  assert.ok(privacyErrors('vpat_' + 'a'.repeat(40)).length);
  assert.ok(privacyErrors('vis_pat_' + 'a'.repeat(43)).length);
  assert.ok(privacyErrors('vsk_shortid.' + 'a'.repeat(43)).length);
  assert.ok(privacyErrors('-----BEGIN PRIVATE KEY-----\n' + 'A'.repeat(100) + '\n-----END PRIVATE KEY-----').length);
  assert.ok(privacyErrors('11111111-2222222222222222').length);
  assert.deepEqual(privacyErrors('vpat_REPLACE_ME; fixture-only-password'), []);
});

test('raw Markdown avoids duplicating an existing H1 and preserves source links', () => {
  const output = rawMarkdown(page('en', { content: '# Guide\n\n[Next](next.md)\n' }));
  assert.equal(output.match(/^# Guide$/gm).length, 1);
  assert.match(output, /Verified release: 1.1.0/);
  assert.match(output, /\[Next\]\(next\.md\)/);
  assert.match(rawMarkdown(page()), /^# Guide\n/);
});

test('AST inspection ignores link-looking code and collects duplicate heading slugs', async () => {
  const item = page('en', { content: '## Heading\n\n## Heading\n\n[Actual](other.md#target)\n\n```sh\n[not a link](missing.md)\n```\n\n<a id="manual"></a>\n' });
  const result = await inspectMarkdown(item);
  assert.deepEqual(result.links.map((l) => l.url), ['other.md#target']);
  assert.deepEqual(result.headings.map((h) => h.slug), ['heading', 'heading-1']);
  assert.deepEqual(result.anchors, ['manual']);
  assert.equal(result.codes[0].lang, 'sh');
});

test('generated placeholders remain visible without changing code or metadata', async () => {
  const source = '---\ntitle: "Value <type>"\n---\n\narray<string> and created <slug>. `Vec<String>`\n\n```rust\nlet values: Vec<String>;\n```\n';
  const output = await escapeGeneratedHtml(source);
  assert.match(output, /title: "Value <type>"/);
  assert.match(output, /array&lt;string&gt; and created &lt;slug&gt;/);
  assert.ok(output.includes('`Vec<String>`'));
  assert.ok(output.includes('let values: Vec<String>;'));
  assert.equal(await escapeGeneratedHtml(output), output);
});

test('link checks reject missing anchors and cross-language links', async () => {
  const first = page('en', { content: '[Good](other.md#target)\n[Bad](other.md#missing)\n[Wrong language](/zh-cn/guide.md)\n' });
  const second = page('en', { relative: 'en/other.md', localPath: 'other.md', content: '## Target\n' });
  const third = page('zh-cn');
  const pages = [first, second, third];
  const inspections = new Map(await Promise.all(pages.map(async (p) => [p.relative, await inspectMarkdown(p)])));
  const errors = linkErrors(pages, inspections);
  assert.equal(errors.length, 2);
  assert.match(errors.join('\n'), /missing anchor missing/);
  assert.match(errors.join('\n'), /same-language/);
});

test('inventory covers canonical leaves, not groups or preview claims', () => {
  const required = ['resource.http_api', 'script.python', 'cli.project.member.ls', 'mcp.list_scripts'];
  const en = page('en', { data: { ...page().data, contract_ids: required } });
  const zh = page('zh-cn', { data: { ...page().data, channel: 'preview', contract_ids: required } });
  const result = coverageReport([en, zh], { required_documents: ['guide.test'] }, contracts);
  assert.equal(result.en.required, 5);
  assert.equal(result.en.covered, 1); // Cross-references are not canonical detail coverage.
  assert.equal(result['zh-cn'].missing.length, 5);
  const details = required.filter((id) => !id.startsWith('cli.')).map((doc_id) => page('en', { data: { ...page().data, doc_id } }));
  const cli = page('en', { data: { ...page().data, doc_id: 'cli.project', contract_ids: ['cli.project.member.ls'] } });
  assert.equal(coverageReport([en, cli, ...details], { required_documents: ['guide.test'] }, contracts).en.missing.length, 0);
});

test('CLI coverage declarations require an actual full-command heading', () => {
  const item = page('en', { data: { ...page().data, doc_id: 'cli.project', contract_ids: ['cli.project.member.ls'] } });
  assert.equal(contractSectionErrors(item, { headings: [{ text: 'viat project member ls' }] }, contracts).length, 0);
  assert.equal(contractSectionErrors(item, { headings: [{ text: 'Overview' }] }, contracts).length, 1);
});

test('release blocks dirty provenance and missing acceptance even if coverage is full', () => {
  const coverage = { en: { missing: [] }, 'zh-cn': { missing: [] } };
  const errors = releaseErrors({ publication_ready: true, contract_bundle: { source_sha: 'a'.repeat(40), source_dirty: true, review_status: 'candidate' } }, coverage);
  assert.match(errors.join('\n'), /clean, reviewed/);
  assert.match(errors.join('\n'), /cli-examples/);
  assert.match(errors.join('\n'), /Acceptance evidence does not match/);
});

test('release evidence becomes stale when only application code changes', () => {
  const source = 'a'.repeat(40);
  const manifest = { publication_ready: true, contract_bundle: { source_sha: source, source_dirty: false, review_status: 'verified' } };
  const coverage = { en: { missing: [] }, 'zh-cn': { missing: [] } };
  const acceptance = {
    contract_source: source, handbook_sha256: 'handbook', examples_sha256: 'examples',
    checks: ['cli-examples', 'mcp-integration', 'resource-examples', 'application-examples', 'bilingual-review', 'offline-book', 'product-doc-pins', 'public-output-privacy'].map((id) => ({ id, status: 'passed', command: 'test fixture', evidence_sha256: 'b'.repeat(64) })),
  };
  assert.deepEqual(releaseErrors(manifest, coverage, acceptance, 'handbook', 'examples'), []);
  assert.match(releaseErrors(manifest, coverage, acceptance, 'handbook', 'changed-example').join('\n'), /application sources/);
});

test('shared examples must match the actual file and both translations', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viat-doc-fixture-'));
  try {
    await mkdir(path.join(root, 'examples'));
    await writeFile(path.join(root, 'examples/hello.py'), 'print("fixture")\n');
    const pages = [page('en'), page('zh-cn')];
    const block = { meta: 'fixture=hello.py', value: 'print("fixture")' };
    const inspections = new Map(pages.map((p) => [p.relative, { codes: [block] }]));
    assert.deepEqual(await fixtureErrors(root, pages, inspections), []);
    inspections.set(pages[0].relative, { codes: [{ ...block, value: 'wrong' }] });
    assert.match((await fixtureErrors(root, pages, inspections)).join('\n'), /snippet differs/);
    inspections.set(pages[0].relative, { codes: [{ ...block, meta: 'fixture=../outside.py' }] });
    assert.match((await fixtureErrors(root, pages, inspections)).join('\n'), /unsafe fixture path/);
    inspections.set(pages[0].relative, { codes: [] });
    assert.match((await fixtureErrors(root, pages, inspections)).join('\n'), /fixture references differ/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('acceptance content digest changes with prose but not filesystem location', () => {
  assert.equal(handbookDigest([page()]), handbookDigest([page('en', { absolute: '/elsewhere/guide.md' })]));
  assert.notEqual(handbookDigest([page()]), handbookDigest([page('en', { content: 'Changed behavior' })]));
});

test('content loader refuses symlinks and non-Markdown public assets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viat-doc-content-'));
  try {
    const dir = path.join(root, 'src/content/docs/en');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'guide.md'), '---\ntitle: Guide\n---\nBody\n');
    assert.equal((await readPages(root)).length, 1);
    await writeFile(path.join(dir, 'secret.txt'), 'not public');
    await assert.rejects(readPages(root), /Only allowlisted Markdown/);
    await rm(path.join(dir, 'secret.txt'));
    await symlink(path.join(dir, 'guide.md'), path.join(dir, 'linked.md'));
    await assert.rejects(readPages(root), /symlinks are not publishable/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
