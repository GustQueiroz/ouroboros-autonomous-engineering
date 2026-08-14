import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, cpSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { ESLint } from 'eslint';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const FIXTURES_DIR = resolve(REPO_ROOT, 'tests', 'fixtures', 'lint');

const eslint = new ESLint({
  cwd: REPO_ROOT,
  overrideConfigFile: resolve(REPO_ROOT, 'eslint.config.mjs')
});

async function lintFixture(fixtureRelativePath, targetInsidePackage) {
  const source = readFileSync(resolve(FIXTURES_DIR, fixtureRelativePath), 'utf8');
  const filePath = resolve(REPO_ROOT, targetInsidePackage);
  const [result] = await eslint.lintText(source, { filePath });
  return result;
}

const FORBIDDEN_CASES = [
  { fixture: 'forbidden/math-random.mts', target: 'packages/core/src/__lint_probe__.mts', rule: 'no-restricted-syntax' },
  { fixture: 'forbidden/math-random.cts', target: 'packages/core/src/__lint_probe__.cts', rule: 'no-restricted-syntax' },
  { fixture: 'forbidden/wall-clock-date-now.mts', target: 'packages/core/src/__lint_probe__.mts', rule: 'no-restricted-syntax' },
  { fixture: 'forbidden/set-timeout.cts', target: 'packages/core/src/__lint_probe__.cts', rule: 'no-restricted-globals' },
  { fixture: 'forbidden/transcendental.mts', target: 'packages/core/src/__lint_probe__.mts', rule: 'no-restricted-syntax' },
  { fixture: 'forbidden/transcendental.cts', target: 'packages/core/src/__lint_probe__.cts', rule: 'no-restricted-syntax' },
  { fixture: 'forbidden/console.mts', target: 'packages/core/src/__lint_probe__.mts', rule: 'no-console' },
  { fixture: 'forbidden/fetch.cts', target: 'packages/core/src/__lint_probe__.cts', rule: 'no-restricted-globals' },
  { fixture: 'forbidden/electron-import.mts', target: 'packages/core/src/__lint_probe__.mts', rule: 'no-restricted-imports' },
  { fixture: 'forbidden/node-fs-import.cts', target: 'packages/core/src/__lint_probe__.cts', rule: 'no-restricted-imports' },
  { fixture: 'forbidden/object-keys.mts', target: 'packages/core/src/__lint_probe__.mts', rule: 'no-restricted-syntax' },
  { fixture: 'forbidden/sort-no-comparator.cts', target: 'packages/core/src/__lint_probe__.cts', rule: 'no-restricted-syntax' },
  { fixture: 'forbidden/json-stringify.mts', target: 'packages/core/src/__lint_probe__.mts', rule: 'no-restricted-syntax' },
  { fixture: 'forbidden/float-literal.cts', target: 'packages/core/src/__lint_probe__.cts', rule: 'no-restricted-syntax' }
];

for (const { fixture, target, rule } of FORBIDDEN_CASES) {
  test(`lint rejects fixture ${fixture} at pure-package path`, async () => {
    const result = await lintFixture(fixture, target);
    assert.ok(result.errorCount > 0, `Expected lint errors for ${fixture}`);
    const rules = result.messages.map((m) => m.ruleId);
    assert.ok(
      rules.includes(rule),
      `Expected rule ${rule} to fire for ${fixture}; got ${JSON.stringify(rules)}`
    );
  });
}

test('lint allows a compliant .mts pure-package source', async () => {
  const result = await lintFixture(
    'allowed/pure.mts',
    'packages/core/src/__lint_probe__.mts'
  );
  assert.equal(
    result.errorCount,
    0,
    `Expected zero errors, got: ${JSON.stringify(result.messages)}`
  );
});

test('lint allows a compliant .cts pure-package source', async () => {
  const result = await lintFixture(
    'allowed/pure.cts',
    'packages/core/src/__lint_probe__.cts'
  );
  assert.equal(
    result.errorCount,
    0,
    `Expected zero errors, got: ${JSON.stringify(result.messages)}`
  );
});

test('impure allowlist (packages/adapters) permits console output', async () => {
  const result = await lintFixture(
    'forbidden/console.mts',
    'packages/adapters/src/__lint_probe__.mts'
  );
  const consoleErrors = result.messages.filter((m) => m.ruleId === 'no-console');
  assert.equal(consoleErrors.length, 0, 'Adapters must be exempted from no-console');
});

test('impure allowlist (packages/ui) permits console output', async () => {
  const result = await lintFixture(
    'forbidden/console.mts',
    'packages/ui/src/__lint_probe__.mts'
  );
  const consoleErrors = result.messages.filter((m) => m.ruleId === 'no-console');
  assert.equal(consoleErrors.length, 0, 'UI must be exempted from no-console');
});
