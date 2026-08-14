import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function readJson(file) {
  const source = readFileSync(file, 'utf8').replace(/\/\/[^\n]*/g, '');
  return JSON.parse(source);
}

test('lockfile is committed for npm ci', () => {
  assert.ok(
    existsSync(resolve(REPO_ROOT, 'package-lock.json')),
    'package-lock.json must be committed to support npm ci from a clean checkout'
  );
});

test('repository is free of pnpm configuration and shims', () => {
  const forbidden = [
    'pnpm-workspace.yaml',
    'pnpm-lock.yaml',
    'pnpm',
    '.pnpmfile.cjs',
    'pnpmfile.cjs'
  ];
  for (const name of forbidden) {
    assert.ok(
      !existsSync(resolve(REPO_ROOT, name)),
      `Forbidden pnpm artifact present at repository root: ${name}`
    );
  }
});

test('root package.json declares no pnpm packageManager and no pnpm dependency', () => {
  const root = readJson(resolve(REPO_ROOT, 'package.json'));
  assert.ok(
    !root.packageManager || !root.packageManager.startsWith('pnpm@'),
    'package.json must not pin pnpm via packageManager'
  );
  const allDeps = {
    ...(root.dependencies ?? {}),
    ...(root.devDependencies ?? {}),
    ...(root.optionalDependencies ?? {}),
    ...(root.peerDependencies ?? {})
  };
  assert.ok(!Object.keys(allDeps).some((name) => name === 'pnpm' || name.startsWith('@pnpm/')),
    'package.json must not depend on pnpm packages');
  const scripts = root.scripts ?? {};
  for (const [name, cmd] of Object.entries(scripts)) {
    assert.ok(
      !/(^|[\s;&|])pnpm(\s|$)/.test(cmd),
      `Script "${name}" must not invoke pnpm: ${cmd}`
    );
  }
});

test('CI workflow uses npm ci and runs the four gates', () => {
  const workflow = readFileSync(resolve(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
  assert.ok(workflow.includes('npm ci'), 'CI must run npm ci for clean installation');
  for (const step of ['npm run compile', 'npm run lint', 'npm run boundary', 'npm run test']) {
    assert.ok(workflow.includes(step), `CI must invoke ${step}`);
  }
  assert.ok(!/pnpm/i.test(workflow), 'CI workflow must not reference pnpm');
});

test('SPEC_BLOCKERS.md exists with the §19 registry fields', () => {
  const doc = readFileSync(resolve(REPO_ROOT, 'SPEC_BLOCKERS.md'), 'utf8');
  for (const field of [
    'identifier',
    'sections in conflict',
    'impact',
    'affected work fronts',
    'status'
  ]) {
    assert.ok(
      new RegExp(field, 'i').test(doc),
      `SPEC_BLOCKERS.md must document the "${field}" field`
    );
  }
});
