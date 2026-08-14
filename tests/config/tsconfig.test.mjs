import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const MANDATED_TS_PROJECTS = [
  'packages/core',
  'packages/contracts',
  'packages/world',
  'packages/domain',
  'packages/narrative',
  'packages/application',
  'packages/adapters',
  'packages/ui',
  'apps/desktop/main',
  'apps/desktop/preload',
  'apps/desktop/renderer',
  'apps/desktop/simulation-worker',
  'tools/replay',
  'tools/bench',
  'tools/package'
];

const REQUIRED_EXTENSIONS = ['ts', 'tsx', 'mts', 'cts'];

function readJson(file) {
  const source = readFileSync(file, 'utf8').replace(/\/\/[^\n]*/g, '');
  return JSON.parse(source);
}

const BASE_CONFIG = readJson(resolve(REPO_ROOT, 'tsconfig.base.json'));

function resolveEffectiveConfig(projectDir) {
  const cfg = readJson(resolve(REPO_ROOT, projectDir, 'tsconfig.json'));
  assert.ok(cfg.extends, `${projectDir}/tsconfig.json must extend the shared base config`);
  const extendsPath = isAbsolute(cfg.extends)
    ? cfg.extends
    : resolve(REPO_ROOT, projectDir, cfg.extends);
  const canonical = resolve(REPO_ROOT, 'tsconfig.base.json');
  assert.equal(
    extendsPath,
    canonical,
    `${projectDir}/tsconfig.json must extend the repository base tsconfig`
  );
  const merged = {
    ...BASE_CONFIG.compilerOptions,
    ...(cfg.compilerOptions ?? {})
  };
  return { raw: cfg, merged };
}

test('shared base tsconfig enables strict and noUncheckedIndexedAccess', () => {
  assert.equal(BASE_CONFIG.compilerOptions.strict, true);
  assert.equal(BASE_CONFIG.compilerOptions.noUncheckedIndexedAccess, true);
});

test('every mandated TypeScript project extends the base and inherits strict flags', () => {
  for (const project of MANDATED_TS_PROJECTS) {
    const { merged } = resolveEffectiveConfig(project);
    assert.equal(merged.strict, true, `${project} must inherit strict:true`);
    assert.equal(
      merged.noUncheckedIndexedAccess,
      true,
      `${project} must inherit noUncheckedIndexedAccess:true`
    );
  }
});

test('every mandated TypeScript project includes .ts, .tsx, .mts, .cts sources', () => {
  for (const project of MANDATED_TS_PROJECTS) {
    const { raw } = resolveEffectiveConfig(project);
    const includes = Array.isArray(raw.include) ? raw.include : [];
    for (const ext of REQUIRED_EXTENSIONS) {
      const covered = includes.some((pattern) => pattern.endsWith(`*.${ext}`));
      assert.ok(
        covered,
        `${project}/tsconfig.json include patterns must cover .${ext} sources; found: ${JSON.stringify(includes)}`
      );
    }
  }
});

test('root tsconfig references every mandated TypeScript project', () => {
  const root = readJson(resolve(REPO_ROOT, 'tsconfig.json'));
  const refs = (root.references ?? []).map((r) => r.path.replace(/^\.\//, ''));
  for (const project of MANDATED_TS_PROJECTS) {
    assert.ok(
      refs.includes(project),
      `Root tsconfig.json is missing project reference for ${project}. Present: ${JSON.stringify(refs)}`
    );
  }
});

test('root package.json declares all 16 mandated workspaces', () => {
  const root = readJson(resolve(REPO_ROOT, 'package.json'));
  const workspaces = root.workspaces ?? [];
  const expected = [
    ...MANDATED_TS_PROJECTS,
    'docs/decisions'
  ];
  for (const dir of expected) {
    assert.ok(
      workspaces.includes(dir),
      `Root package.json workspaces must include ${dir}. Present: ${JSON.stringify(workspaces)}`
    );
  }
  assert.equal(
    workspaces.length,
    expected.length,
    `Exactly ${expected.length} workspaces expected; got ${workspaces.length}`
  );
});

test('root package.json exposes compile, lint, boundary, test scripts', () => {
  const root = readJson(resolve(REPO_ROOT, 'package.json'));
  const scripts = root.scripts ?? {};
  for (const name of ['compile', 'lint', 'boundary', 'test']) {
    assert.ok(scripts[name], `Root script "${name}" must be defined`);
  }
});
