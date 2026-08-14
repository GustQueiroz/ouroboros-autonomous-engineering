#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateWorkspace } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const { violations, workspaces } = validateWorkspace(REPO_ROOT);

if (violations.length > 0) {
  process.stderr.write(
    `dependency-boundary: FAIL. ${violations.length} violation(s) against §14.5.\n`
  );
  for (const v of violations) {
    process.stderr.write(
      `  ${v.file}: forbidden ${v.sourceNode} -> ${v.targetNode} via "${v.specifier}" (${v.reason})\n`
    );
  }
  process.exit(1);
}

process.stdout.write(
  `dependency-boundary: OK. ${workspaces.length} workspace packages validated against §14.5.\n`
);
