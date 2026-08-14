import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRECT_EDGES, isDirectEdgeAllowed } from '../../tools/boundary/graph.mjs';
import { validateWorkspace } from '../../tools/boundary/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function makeFakeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ciclo-boundary-'));
  return dir;
}

function writeFile(root, relPath, contents) {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contents, 'utf8');
}

test('§14.5 direct-edge map matches the specification', () => {
  assert.deepEqual(DIRECT_EDGES.core, []);
  assert.deepEqual(DIRECT_EDGES.contracts, ['core']);
  assert.deepEqual(DIRECT_EDGES.world, ['core']);
  assert.deepEqual(DIRECT_EDGES.domain, ['core']);
  assert.deepEqual(DIRECT_EDGES.narrative, ['core']);
  assert.deepEqual(DIRECT_EDGES.application.sort(), ['contracts', 'domain', 'narrative', 'world'].sort());
  assert.deepEqual(DIRECT_EDGES.adapters.sort(), ['application', 'contracts'].sort());
  assert.deepEqual(DIRECT_EDGES.ui, ['contracts']);
  assert.deepEqual(DIRECT_EDGES.apps.sort(), ['adapters', 'contracts', 'ui'].sort());
});

test('isDirectEdgeAllowed refuses undeclared direct edges', () => {
  assert.equal(isDirectEdgeAllowed('world', 'domain'), false);
  assert.equal(isDirectEdgeAllowed('domain', 'world'), false);
  assert.equal(isDirectEdgeAllowed('narrative', 'domain'), false);
  assert.equal(isDirectEdgeAllowed('narrative', 'world'), false);
  assert.equal(isDirectEdgeAllowed('ui', 'application'), false);
  assert.equal(isDirectEdgeAllowed('ui', 'domain'), false);
  assert.equal(isDirectEdgeAllowed('ui', 'world'), false);
  assert.equal(isDirectEdgeAllowed('core', 'domain'), false);
  assert.equal(isDirectEdgeAllowed('apps', 'application'), false);
  assert.equal(isDirectEdgeAllowed('apps', 'domain'), false);
  assert.equal(isDirectEdgeAllowed('apps', 'world'), false);
});

test('isDirectEdgeAllowed accepts declared direct edges', () => {
  assert.equal(isDirectEdgeAllowed('domain', 'core'), true);
  assert.equal(isDirectEdgeAllowed('application', 'domain'), true);
  assert.equal(isDirectEdgeAllowed('adapters', 'application'), true);
  assert.equal(isDirectEdgeAllowed('ui', 'contracts'), true);
  assert.equal(isDirectEdgeAllowed('apps', 'adapters'), true);
});

test('validateWorkspace accepts a declared direct edge (domain -> core)', () => {
  const root = makeFakeRepo();
  try {
    writeFile(root, 'packages/domain/src/index.ts', `import { anything } from '@ciclo/core';\nexport { anything };\n`);
    writeFile(root, 'packages/core/src/index.ts', `export const anything = 1n;\n`);
    const { violations } = validateWorkspace(root);
    assert.deepEqual(violations, [], `Expected no violations, got ${JSON.stringify(violations)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateWorkspace rejects a forbidden direct package edge (world -> domain)', () => {
  const root = makeFakeRepo();
  try {
    writeFile(root, 'packages/world/src/index.ts', `import { Ledger } from '@ciclo/domain';\nexport { Ledger };\n`);
    writeFile(root, 'packages/domain/src/index.ts', `export type Ledger = unknown;\n`);
    const { violations } = validateWorkspace(root);
    assert.equal(violations.length, 1, `Expected 1 violation, got ${violations.length}`);
    assert.equal(violations[0].sourceNode, 'world');
    assert.equal(violations[0].targetNode, 'domain');
    assert.equal(violations[0].kind, 'package');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateWorkspace rejects an edge justified only by transitive reach (ui -> core)', () => {
  const root = makeFakeRepo();
  try {
    writeFile(root, 'packages/ui/src/index.ts', `import { anything } from '@ciclo/core';\nexport { anything };\n`);
    writeFile(root, 'packages/core/src/index.ts', `export const anything = 0n;\n`);
    writeFile(root, 'packages/contracts/src/index.ts', `import '@ciclo/core';\nexport {};\n`);
    const { violations } = validateWorkspace(root);
    assert.ok(
      violations.some((v) => v.sourceNode === 'ui' && v.targetNode === 'core'),
      `Expected transitive-only ui -> core edge to be rejected; got ${JSON.stringify(violations)}`
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateWorkspace rejects a relative import that crosses into a disallowed workspace', () => {
  const root = makeFakeRepo();
  try {
    writeFile(
      root,
      'packages/narrative/src/index.ts',
      `import { Order } from '../../domain/src/index';\nexport { Order };\n`
    );
    writeFile(root, 'packages/domain/src/index.ts', `export type Order = unknown;\n`);
    const { violations } = validateWorkspace(root);
    assert.ok(
      violations.some(
        (v) =>
          v.sourceNode === 'narrative' && v.targetNode === 'domain' && v.kind === 'relative'
      ),
      `Expected relative-import violation; got ${JSON.stringify(violations)}`
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateWorkspace tolerates relative imports inside the same workspace', () => {
  const root = makeFakeRepo();
  try {
    writeFile(root, 'packages/domain/src/index.ts', `export * from './ledger';\n`);
    writeFile(root, 'packages/domain/src/ledger.ts', `export const KIND = 'ledger';\n`);
    const { violations } = validateWorkspace(root);
    assert.deepEqual(violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('isDirectEdgeAllowed does not treat same-node as an implicit self-edge', () => {
  assert.equal(isDirectEdgeAllowed('apps', 'apps'), false);
  assert.equal(isDirectEdgeAllowed('tools', 'tools'), false);
  assert.equal(isDirectEdgeAllowed('core', 'core'), false);
  assert.equal(isDirectEdgeAllowed('domain', 'domain'), false);
});

test('validateWorkspace rejects a package import between distinct same-node app workspaces', () => {
  const root = makeFakeRepo();
  try {
    writeFile(
      root,
      'apps/desktop/main/src/index.ts',
      `import { preloadApi } from '@ciclo/desktop-preload';\nexport { preloadApi };\n`
    );
    writeFile(
      root,
      'apps/desktop/preload/src/index.ts',
      `export const preloadApi = 0;\n`
    );
    const { violations } = validateWorkspace(root);
    assert.equal(violations.length, 1, `Expected 1 violation, got ${JSON.stringify(violations)}`);
    assert.equal(violations[0].sourcePackage, '@ciclo/desktop-main');
    assert.equal(violations[0].targetPackage, '@ciclo/desktop-preload');
    assert.equal(violations[0].sourceNode, 'apps');
    assert.equal(violations[0].targetNode, 'apps');
    assert.equal(violations[0].kind, 'package');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateWorkspace rejects a relative import between distinct same-node app workspaces', () => {
  const root = makeFakeRepo();
  try {
    writeFile(
      root,
      'apps/desktop/renderer/src/index.ts',
      `import { workerApi } from '../../simulation-worker/src/index';\nexport { workerApi };\n`
    );
    writeFile(
      root,
      'apps/desktop/simulation-worker/src/index.ts',
      `export const workerApi = 0;\n`
    );
    const { violations } = validateWorkspace(root);
    assert.ok(
      violations.some(
        (v) =>
          v.sourcePackage === '@ciclo/desktop-renderer' &&
          v.targetPackage === '@ciclo/desktop-simulation-worker' &&
          v.kind === 'relative'
      ),
      `Expected relative same-node app violation; got ${JSON.stringify(violations)}`
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateWorkspace rejects a package import between distinct same-node tool workspaces', () => {
  const root = makeFakeRepo();
  try {
    writeFile(
      root,
      'tools/replay/src/index.ts',
      `import { runBench } from '@ciclo/tools-bench';\nexport { runBench };\n`
    );
    writeFile(root, 'tools/bench/src/index.ts', `export const runBench = 0;\n`);
    const { violations } = validateWorkspace(root);
    assert.equal(violations.length, 1, `Expected 1 violation, got ${JSON.stringify(violations)}`);
    assert.equal(violations[0].sourcePackage, '@ciclo/tools-replay');
    assert.equal(violations[0].targetPackage, '@ciclo/tools-bench');
    assert.equal(violations[0].sourceNode, 'tools');
    assert.equal(violations[0].targetNode, 'tools');
    assert.equal(violations[0].kind, 'package');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateWorkspace rejects a relative import between distinct same-node tool workspaces', () => {
  const root = makeFakeRepo();
  try {
    writeFile(
      root,
      'tools/replay/src/index.ts',
      `import { pkg } from '../../package/src/index';\nexport { pkg };\n`
    );
    writeFile(root, 'tools/package/src/index.ts', `export const pkg = 0;\n`);
    const { violations } = validateWorkspace(root);
    assert.ok(
      violations.some(
        (v) =>
          v.sourcePackage === '@ciclo/tools-replay' &&
          v.targetPackage === '@ciclo/tools-package' &&
          v.kind === 'relative'
      ),
      `Expected relative same-node tool violation; got ${JSON.stringify(violations)}`
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateWorkspace still accepts self-package imports inside the same workspace', () => {
  const root = makeFakeRepo();
  try {
    writeFile(
      root,
      'packages/domain/src/index.ts',
      `import { KIND } from '@ciclo/domain';\nexport { KIND };\n`
    );
    const { violations } = validateWorkspace(root);
    assert.deepEqual(violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateWorkspace passes on the committed repository state', () => {
  const { violations } = validateWorkspace(REPO_ROOT);
  assert.deepEqual(
    violations,
    [],
    `Committed repository must satisfy the boundary check; violations: ${JSON.stringify(violations)}`
  );
});
