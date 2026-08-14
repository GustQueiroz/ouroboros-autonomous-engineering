export const PURE_RESTRICTED_GLOBALS = [
  { name: 'Math.random', message: 'Prohibited by §13: use rand(seed, namespace, ...coordinates).' },
  { name: 'Date', message: 'Prohibited by §13: pure packages must not read wall-clock time.' },
  { name: 'setTimeout', message: 'Prohibited by §13: pure packages have no timers.' },
  { name: 'setInterval', message: 'Prohibited by §13: pure packages have no timers.' },
  { name: 'clearTimeout', message: 'Prohibited by §13: pure packages have no timers.' },
  { name: 'clearInterval', message: 'Prohibited by §13: pure packages have no timers.' },
  { name: 'performance', message: 'Prohibited by §13: pure packages must not read wall-clock time.' },
  { name: 'fetch', message: 'Prohibited by §13: pure packages have no network I/O.' },
  { name: 'XMLHttpRequest', message: 'Prohibited by §13: pure packages have no network I/O.' },
  { name: 'crypto', message: 'Prohibited by §13: entropy source is forbidden in pure packages.' }
];

export const PURE_RESTRICTED_SYNTAX = [
  {
    selector: "MemberExpression[object.name='Math'][property.name=/^(sin|cos|tan|asin|acos|atan|atan2|exp|log|log2|log10|pow|sqrt|cbrt|hypot|expm1|log1p|sinh|cosh|tanh)$/]",
    message: 'Prohibited by §13: transcendental Math functions are non-portable across engines.'
  },
  {
    selector: "MemberExpression[object.name='Math'][property.name='random']",
    message: 'Prohibited by §13: use rand(seed, namespace, ...coordinates).'
  },
  {
    selector: "MemberExpression[object.name='Date'][property.name='now']",
    message: 'Prohibited by §13: pure packages must not read wall-clock time.'
  },
  {
    selector: "NewExpression[callee.name='Date']",
    message: 'Prohibited by §13: pure packages must not construct Date.'
  },
  {
    selector: "MemberExpression[object.name='performance'][property.name='now']",
    message: 'Prohibited by §13: pure packages must not read wall-clock time.'
  },
  {
    selector: "MemberExpression[object.name='crypto'][property.name='randomUUID']",
    message: 'Prohibited by §13: entropy source is forbidden in pure packages.'
  },
  {
    selector: "MemberExpression[object.name='Intl']",
    message: 'Prohibited by §13: locale-sensitive formatting is forbidden in pure packages.'
  },
  {
    selector: "CallExpression[callee.property.name='toLocaleString']",
    message: 'Prohibited by §13: locale-sensitive formatting is forbidden in pure packages.'
  },
  {
    selector: "CallExpression[callee.property.name='sort'][arguments.length=0]",
    message: 'Prohibited by §13: Array.prototype.sort requires an explicit total comparator.'
  },
  {
    selector: "CallExpression[callee.object.name='Object'][callee.property.name=/^(keys|values|entries)$/]",
    message: 'Prohibited by §13: iterating an object without explicit ordering is forbidden.'
  },
  {
    selector: "ForInStatement",
    message: 'Prohibited by §13: for-in iteration has no defined order.'
  },
  {
    selector: "CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
    message: 'Prohibited by §13: JSON.stringify is forbidden in pure packages; use the canonical encoder.'
  },
  {
    selector: "Literal[raw=/^-?[0-9]+\\.[0-9]+([eE][+-]?[0-9]+)?$/]",
    message: 'Prohibited by §13: floating-point literals are forbidden in pure packages.'
  }
];

export const PURE_RESTRICTED_IMPORTS = {
  paths: [
    { name: 'electron', message: 'Prohibited by §13: pure packages must not import electron.' },
    { name: 'fs', message: 'Prohibited by §13: pure packages must not touch the filesystem.' },
    { name: 'node:fs', message: 'Prohibited by §13: pure packages must not touch the filesystem.' },
    { name: 'path', message: 'Prohibited by §13: pure packages must not import node:path.' },
    { name: 'node:path', message: 'Prohibited by §13: pure packages must not import node:path.' },
    { name: 'os', message: 'Prohibited by §13: pure packages must not import node:os.' },
    { name: 'node:os', message: 'Prohibited by §13: pure packages must not import node:os.' },
    { name: 'child_process', message: 'Prohibited by §13: pure packages must not import child_process.' },
    { name: 'node:child_process', message: 'Prohibited by §13: pure packages must not import child_process.' },
    { name: 'node:crypto', message: 'Prohibited by §13: entropy source is forbidden in pure packages.' },
    { name: 'crypto', message: 'Prohibited by §13: entropy source is forbidden in pure packages.' },
    { name: 'better-sqlite3', message: 'Prohibited by §13: pure packages must not import a database driver.' },
    { name: 'sqlite3', message: 'Prohibited by §13: pure packages must not import a database driver.' },
    { name: 'node:net', message: 'Prohibited by §13: pure packages must not open sockets.' },
    { name: 'net', message: 'Prohibited by §13: pure packages must not open sockets.' },
    { name: 'node:http', message: 'Prohibited by §13: pure packages must not open sockets.' },
    { name: 'http', message: 'Prohibited by §13: pure packages must not open sockets.' },
    { name: 'node:https', message: 'Prohibited by §13: pure packages must not open sockets.' },
    { name: 'https', message: 'Prohibited by §13: pure packages must not open sockets.' }
  ],
  patterns: [
    { group: ['node:fs/*'], message: 'Prohibited by §13: pure packages must not touch the filesystem.' }
  ]
};

export const PURE_PACKAGE_EXTENSIONS = ['ts', 'tsx', 'mts', 'cts'];

export const PURE_PACKAGE_GLOBS = PURE_PACKAGE_EXTENSIONS.map((ext) => `packages/**/*.${ext}`);

export const IMPURE_ALLOWLIST = ['adapters', 'ui'];

export const IMPURE_PACKAGE_GLOBS = IMPURE_ALLOWLIST.flatMap((pkg) =>
  PURE_PACKAGE_EXTENSIONS.map((ext) => `packages/${pkg}/**/*.${ext}`)
);
