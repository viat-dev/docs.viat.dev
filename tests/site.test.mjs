import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';
import { rewriteRootLinks } from '../scripts/lib/markdown.mjs';

const moduleUrl = pathToFileURL(path.join(ROOT, 'scripts/lib/site.mjs')).href;
function evaluate(base) {
  const script = `import {withBase,publicUrl,stripBase} from ${JSON.stringify(moduleUrl)};console.log(JSON.stringify([withBase('/en/'),publicUrl('/llms.txt'),stripBase(${JSON.stringify(base === '/' ? '/en/' : base + '/en/')}),stripBase('/other/en/')]));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, DOCS_SITE: 'https://docs.example.test', DOCS_BASE: base }, encoding: 'utf8',
  }));
}

test('project-site URLs retain the mount and reject paths outside it', () => {
  assert.deepEqual(evaluate('/docs.viat.dev'), ['/docs.viat.dev/en/', 'https://docs.example.test/docs.viat.dev/llms.txt', '/en/', null]);
});

test('custom-domain root URLs do not retain the repository prefix', () => {
  assert.deepEqual(evaluate('/'), ['/en/', 'https://docs.example.test/llms.txt', '/en/', '/other/en/']);
});

test('raw Markdown root links are rebased without changing source code', async () => {
  const page = { absolute: path.join(ROOT, 'src/content/docs/en/index.md'), relative: 'en/index.md', content: '[Index](/llms.txt)\n\n```sh\ncurl /llms.txt\n```\n' };
  const result = await rewriteRootLinks(page, (url) => '/repo' + url);
  assert.match(result, /\[Index\]\(\/repo\/llms.txt\)/);
  assert.match(result, /curl \/llms.txt/);
});
