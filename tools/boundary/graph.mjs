export const NODES = [
  'core',
  'contracts',
  'world',
  'domain',
  'narrative',
  'application',
  'adapters',
  'ui',
  'apps',
  'tools'
];

export const DIRECT_EDGES = {
  core: [],
  contracts: ['core'],
  world: ['core'],
  domain: ['core'],
  narrative: ['core'],
  application: ['domain', 'world', 'narrative', 'contracts'],
  adapters: ['application', 'contracts'],
  ui: ['contracts'],
  apps: ['adapters', 'ui', 'contracts'],
  tools: []
};

export function isDirectEdgeAllowed(sourceNode, targetNode) {
  const allowed = DIRECT_EDGES[sourceNode];
  if (!allowed) return false;
  return allowed.includes(targetNode);
}

export const WORKSPACE_PACKAGES = {
  '@ciclo/core': { node: 'core', path: 'packages/core' },
  '@ciclo/contracts': { node: 'contracts', path: 'packages/contracts' },
  '@ciclo/world': { node: 'world', path: 'packages/world' },
  '@ciclo/domain': { node: 'domain', path: 'packages/domain' },
  '@ciclo/narrative': { node: 'narrative', path: 'packages/narrative' },
  '@ciclo/application': { node: 'application', path: 'packages/application' },
  '@ciclo/adapters': { node: 'adapters', path: 'packages/adapters' },
  '@ciclo/ui': { node: 'ui', path: 'packages/ui' },
  '@ciclo/desktop-main': { node: 'apps', path: 'apps/desktop/main' },
  '@ciclo/desktop-preload': { node: 'apps', path: 'apps/desktop/preload' },
  '@ciclo/desktop-renderer': { node: 'apps', path: 'apps/desktop/renderer' },
  '@ciclo/desktop-simulation-worker': { node: 'apps', path: 'apps/desktop/simulation-worker' },
  '@ciclo/tools-replay': { node: 'tools', path: 'tools/replay' },
  '@ciclo/tools-bench': { node: 'tools', path: 'tools/bench' },
  '@ciclo/tools-package': { node: 'tools', path: 'tools/package' }
};

export const WORKSPACE_PATHS = Object.entries(WORKSPACE_PACKAGES).map(
  ([pkgName, meta]) => ({ pkgName, ...meta })
);
