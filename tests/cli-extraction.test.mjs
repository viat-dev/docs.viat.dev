import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';

function tokenize(value) {
  return JSON.parse(execFileSync('python3', ['-I', path.join(ROOT, 'scripts/tokenize-cli-examples.py')], {
    input: JSON.stringify([{ page: 'en/fixture.md', value }]), encoding: 'utf8',
  }));
}

test('CLI collection preserves JSON protocol data and substitutes only fixture variables', () => {
  const parsed = tokenize('viat endpoint show "$ENDPOINT_ID" --json\nviat call --body \'{"secret":{"$secret":"token"}}\' /hello\n');
  assert.equal(parsed.manual.length, 0);
  assert.equal(parsed.collected[0].argv[3], '11111111-1111-4111-8111-111111111111');
  assert.equal(parsed.collected[1].argv[3], '{"secret":{"$secret":"token"}}');
});

test('CLI collection records unevaluated shell-dependent commands rather than running them', () => {
  const parsed = tokenize('viat logs query | jq .\nviat call --body "$(touch ignored-file)" /hello\nX=$(viat project list)\nviat script run hello --args \'{"name":"Ada"}\'\n');
  assert.equal(parsed.manual.length, 3);
  assert.equal(parsed.collected.length, 1);
  assert.deepEqual(parsed.collected[0].argv, ['viat', 'script', 'run', 'hello', '--args', '{"name":"Ada"}']);
});
