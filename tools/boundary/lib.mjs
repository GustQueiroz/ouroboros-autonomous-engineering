import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import {
  DIRECT_EDGES,
  WORKSPACE_PACKAGES,
  WORKSPACE_PATHS,
  isDirectEdgeAllowed
} from './graph.mjs';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];

export function listSourceFiles(rootDir) {
  const results = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        for (const ext of SOURCE_EXTENSIONS) {
          if (entry.name.endsWith(ext)) {
            results.push(full);
            break;
          }
        }
      }
    }
  };
  walk(rootDir);
  return results;
}

const IMPORT_STATIC_RE =
  /(?:^|[\s;])(?:import|export)\s+(?:[^'"`;\n]*?\s+from\s+)?["']([^"']+)["']/gm;
const IMPORT_DYNAMIC_RE = /(?:^|[^A-Za-z0-9_$])import\s*\(\s*["']([^"']+)["']\s*\)/gm;
const REQUIRE_RE = /(?:^|[^A-Za-z0-9_$])require\s*\(\s*["']([^"']+)["']\s*\)/gm;

export function extractImports(source) {
  const specifiers = new Set();
  for (const re of [IMPORT_STATIC_RE, IMPORT_DYNAMIC_RE, REQUIRE_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) {
      specifiers.add(m[1]);
    }
  }
  return [...specifiers];
}

function findWorkspaceForFile(absoluteFile, workspaceRoots) {
  const rel = relative(workspaceRoots.repoRoot, absoluteFile).split(sep).join('/');
  let best = null;
  for (const ws of workspaceRoots.list) {
    const wsPathWithSep = `${ws.path}/`;
    if (rel === ws.path || rel.startsWith(wsPathWithSep)) {
      if (!best || ws.path.length > best.path.length) best = ws;
    }
  }
  return best;
}

export function resolveImportTarget(specifier, importerFile, workspaceRoots) {
  if (specifier.startsWith('@ciclo/')) {
    const pkgName = specifier.split('/').slice(0, 2).join('/');
    const meta = WORKSPACE_PACKAGES[pkgName];
    if (!meta) return null;
    return { kind: 'package', pkgName, node: meta.node, path: meta.path };
  }
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const resolvedAbs = resolve(dirname(importerFile), specifier);
    const target = findWorkspaceForFile(resolvedAbs, workspaceRoots);
    if (!target) return { kind: 'relative-external', resolvedAbs };
    return {
      kind: 'relative',
      pkgName: target.pkgName,
      node: target.node,
      path: target.path,
      resolvedAbs
    };
  }
  return null;
}

export function validateWorkspace(repoRoot, options = {}) {
  const workspaceRoots = {
    repoRoot,
    list: WORKSPACE_PATHS.map((ws) => ({ ...ws, absPath: join(repoRoot, ws.path) }))
  };
  const violations = [];
  for (const ws of workspaceRoots.list) {
    const srcRoot = join(ws.absPath, 'src');
    let hasSrc = true;
    try {
      hasSrc = statSync(srcRoot).isDirectory();
    } catch {
      hasSrc = false;
    }
    if (!hasSrc) continue;
    const files = listSourceFiles(srcRoot);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const specifiers = extractImports(source);
      for (const spec of specifiers) {
        const target = resolveImportTarget(spec, file, workspaceRoots);
        if (!target) continue;
        if (target.pkgName === ws.pkgName) continue;
        const sameNode = target.node === ws.node;
        const allowed = !sameNode && isDirectEdgeAllowed(ws.node, target.node);
        if (!allowed) {
          const reason = target.kind === 'relative'
            ? `Relative import crosses workspace boundary from ${ws.pkgName} into ${target.pkgName}.`
            : sameNode
              ? `Cross-workspace edge ${ws.pkgName} -> ${target.pkgName} is not a declared §14.5 direct edge (same architecture node ${ws.node} does not imply permission).`
              : `Direct edge ${ws.node} -> ${target.node} is not declared in §14.5.`;
          violations.push({
            file: relative(repoRoot, file),
            specifier: spec,
            sourceNode: ws.node,
            sourcePackage: ws.pkgName,
            targetNode: target.node,
            targetPackage: target.pkgName,
            kind: target.kind,
            reason
          });
        }
      }
    }
  }
  return { violations, workspaces: workspaceRoots.list };
}

export { WORKSPACE_PACKAGES, WORKSPACE_PATHS, DIRECT_EDGES, isDirectEdgeAllowed };
