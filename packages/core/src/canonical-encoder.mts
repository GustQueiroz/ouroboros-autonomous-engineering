export const CANONICAL_ENCODING_VERSION = 'canonical-v1';

export const CANONICAL_ENCODER_ERROR_CODES = {
  UNDEFINED: 'CANONICAL_UNDEFINED',
  NAN: 'CANONICAL_NAN',
  POSITIVE_INFINITY: 'CANONICAL_POSITIVE_INFINITY',
  NEGATIVE_INFINITY: 'CANONICAL_NEGATIVE_INFINITY',
  NEGATIVE_ZERO: 'CANONICAL_NEGATIVE_ZERO',
  NON_INTEGER: 'CANONICAL_NON_INTEGER',
  UNSAFE_INTEGER: 'CANONICAL_UNSAFE_INTEGER',
  UNSUPPORTED_VALUE: 'CANONICAL_UNSUPPORTED_VALUE',
  UNSUPPORTED_KEY: 'CANONICAL_UNSUPPORTED_KEY',
  MALFORMED_STRING: 'CANONICAL_MALFORMED_STRING',
  CYCLIC_REFERENCE: 'CANONICAL_CYCLIC_REFERENCE'
} as const;

export type CanonicalEncoderErrorCode =
  (typeof CANONICAL_ENCODER_ERROR_CODES)[keyof typeof CANONICAL_ENCODER_ERROR_CODES];

export class CanonicalEncoderError extends Error {
  readonly code: CanonicalEncoderErrorCode;
  readonly path: readonly string[];

  constructor(code: CanonicalEncoderErrorCode, message: string, path: readonly string[]) {
    super(message);
    this.name = 'CanonicalEncoderError';
    this.code = code;
    this.path = path;
  }
}

export type CanonicalValue =
  | null
  | boolean
  | string
  | number
  | bigint
  | readonly CanonicalValue[]
  | ReadonlySet<CanonicalValue>
  | ReadonlyMap<string, CanonicalValue>
  | { readonly [key: string]: CanonicalValue };

const TAG_NULL = 0x4e;
const TAG_TRUE = 0x54;
const TAG_FALSE = 0x46;
const TAG_INT = 0x49;
const TAG_BIGINT = 0x42;
const TAG_STRING = 0x53;
const TAG_OBJECT = 0x4f;
const TAG_LIST = 0x4c;
const TAG_SET = 0x55;
const COLON = 0x3a;
const SEMICOLON = 0x3b;
const PLUS = 0x2b;
const MINUS = 0x2d;

const SAFE_INTEGER_MAX = 9007199254740991;
const SAFE_INTEGER_MIN = -9007199254740991;

const DIGIT_ZERO = 0x30;

function formatPath(path: readonly string[]): string {
  return path.length === 0 ? '<root>' : path.join('');
}

function fail(
  code: CanonicalEncoderErrorCode,
  detail: string,
  path: readonly string[]
): never {
  throw new CanonicalEncoderError(
    code,
    `canonical encoder rejected value at ${formatPath(path)}: ${detail}`,
    [...path]
  );
}

function utf8Encode(input: string, path: readonly string[]): Uint8Array {
  const len = input.length;
  let byteLen = 0;
  for (let i = 0; i < len; i++) {
    const unit = input.charCodeAt(i);
    if (unit < 0x80) {
      byteLen += 1;
    } else if (unit < 0x800) {
      byteLen += 2;
    } else if (unit >= 0xd800 && unit <= 0xdbff) {
      if (i + 1 >= len) {
        fail(
          CANONICAL_ENCODER_ERROR_CODES.MALFORMED_STRING,
          'unpaired high surrogate at end of string',
          path
        );
      }
      const low = input.charCodeAt(i + 1);
      if (low < 0xdc00 || low > 0xdfff) {
        fail(
          CANONICAL_ENCODER_ERROR_CODES.MALFORMED_STRING,
          'high surrogate followed by non-low-surrogate code unit',
          path
        );
      }
      byteLen += 4;
      i++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail(
        CANONICAL_ENCODER_ERROR_CODES.MALFORMED_STRING,
        'unpaired low surrogate',
        path
      );
    } else {
      byteLen += 3;
    }
  }

  const bytes = new Uint8Array(byteLen);
  let j = 0;
  for (let i = 0; i < len; i++) {
    const unit = input.charCodeAt(i);
    if (unit < 0x80) {
      bytes[j++] = unit;
    } else if (unit < 0x800) {
      bytes[j++] = 0xc0 | (unit >> 6);
      bytes[j++] = 0x80 | (unit & 0x3f);
    } else if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = input.charCodeAt(i + 1);
      const codePoint = 0x10000 + ((unit - 0xd800) << 10) + (low - 0xdc00);
      bytes[j++] = 0xf0 | (codePoint >> 18);
      bytes[j++] = 0x80 | ((codePoint >> 12) & 0x3f);
      bytes[j++] = 0x80 | ((codePoint >> 6) & 0x3f);
      bytes[j++] = 0x80 | (codePoint & 0x3f);
      i++;
    } else {
      bytes[j++] = 0xe0 | (unit >> 12);
      bytes[j++] = 0x80 | ((unit >> 6) & 0x3f);
      bytes[j++] = 0x80 | (unit & 0x3f);
    }
  }
  return bytes;
}

function decimalAscii(value: number): Uint8Array {
  if (value === 0) return Uint8Array.of(DIGIT_ZERO);
  const digits: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    digits.push(DIGIT_ZERO + (remaining % 10));
    remaining = (remaining - (remaining % 10)) / 10;
  }
  const bytes = new Uint8Array(digits.length);
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[digits.length - 1 - i];
    bytes[i] = digit === undefined ? DIGIT_ZERO : digit;
  }
  return bytes;
}

function bigIntDecimalAscii(value: bigint): Uint8Array {
  if (value === 0n) return Uint8Array.of(DIGIT_ZERO);
  const digits: number[] = [];
  let remaining = value;
  while (remaining > 0n) {
    digits.push(DIGIT_ZERO + Number(remaining % 10n));
    remaining = remaining / 10n;
  }
  const bytes = new Uint8Array(digits.length);
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[digits.length - 1 - i];
    bytes[i] = digit === undefined ? DIGIT_ZERO : digit;
  }
  return bytes;
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const shorter = a.length < b.length ? a.length : b.length;
  for (let i = 0; i < shorter; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai !== undefined && bi !== undefined) {
      if (ai < bi) return -1;
      if (ai > bi) return 1;
    }
  }
  if (a.length < b.length) return -1;
  if (a.length > b.length) return 1;
  return 0;
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function encodeString(
  value: string,
  path: readonly string[],
  out: Uint8Array[]
): void {
  const bodyBytes = utf8Encode(value, path);
  out.push(Uint8Array.of(TAG_STRING));
  out.push(decimalAscii(bodyBytes.length));
  out.push(Uint8Array.of(COLON));
  out.push(bodyBytes);
}

function encodeSafeInteger(
  value: number,
  path: readonly string[],
  out: Uint8Array[]
): void {
  if (Number.isNaN(value)) fail(CANONICAL_ENCODER_ERROR_CODES.NAN, 'NaN is not canonical', path);
  if (value === Number.POSITIVE_INFINITY) {
    fail(CANONICAL_ENCODER_ERROR_CODES.POSITIVE_INFINITY, 'Infinity is not canonical', path);
  }
  if (value === Number.NEGATIVE_INFINITY) {
    fail(CANONICAL_ENCODER_ERROR_CODES.NEGATIVE_INFINITY, '-Infinity is not canonical', path);
  }
  if (Object.is(value, -0)) {
    fail(
      CANONICAL_ENCODER_ERROR_CODES.NEGATIVE_ZERO,
      'negative zero is not canonical; use +0 explicitly',
      path
    );
  }
  if (!Number.isInteger(value)) {
    fail(
      CANONICAL_ENCODER_ERROR_CODES.NON_INTEGER,
      'only safe integers or bigints are canonical numeric values',
      path
    );
  }
  if (value > SAFE_INTEGER_MAX || value < SAFE_INTEGER_MIN) {
    fail(
      CANONICAL_ENCODER_ERROR_CODES.UNSAFE_INTEGER,
      'integer outside the safe range must be a bigint',
      path
    );
  }

  const signByte = value < 0 ? MINUS : PLUS;
  const absolute = value < 0 ? -value : value;
  out.push(Uint8Array.of(TAG_INT, signByte));
  out.push(decimalAscii(absolute));
  out.push(Uint8Array.of(SEMICOLON));
}

function encodeBigInt(value: bigint, out: Uint8Array[]): void {
  const signByte = value < 0n ? MINUS : PLUS;
  const absolute = value < 0n ? -value : value;
  out.push(Uint8Array.of(TAG_BIGINT, signByte));
  out.push(bigIntDecimalAscii(absolute));
  out.push(Uint8Array.of(SEMICOLON));
}

function encodeCollectionHeader(tag: number, count: number, out: Uint8Array[]): void {
  out.push(Uint8Array.of(tag));
  out.push(decimalAscii(count));
  out.push(Uint8Array.of(COLON));
}

function isPlainObject(candidate: object): candidate is Record<string, unknown> {
  const proto = Object.getPrototypeOf(candidate);
  return proto === Object.prototype || proto === null;
}

type ObjectEntry = { readonly keyBytes: Uint8Array; readonly key: string; readonly value: unknown };

function collectObjectEntries(
  ownKeys: ReadonlyArray<string | symbol>,
  reader: (key: string) => unknown,
  path: readonly string[]
): ObjectEntry[] {
  const entries: ObjectEntry[] = [];
  for (const rawKey of ownKeys) {
    if (typeof rawKey !== 'string') {
      fail(
        CANONICAL_ENCODER_ERROR_CODES.UNSUPPORTED_KEY,
        'object and map keys must be strings',
        path
      );
    }
    entries.push({
      keyBytes: utf8Encode(rawKey, path),
      key: rawKey,
      value: reader(rawKey)
    });
  }
  entries.sort((left, right) => compareBytes(left.keyBytes, right.keyBytes));
  return entries;
}

function emitObjectEntries(
  entries: readonly ObjectEntry[],
  path: string[],
  ancestors: Set<object>,
  out: Uint8Array[]
): void {
  encodeCollectionHeader(TAG_OBJECT, entries.length, out);
  for (const entry of entries) {
    encodeString(entry.key, path, out);
    path.push('.');
    path.push(entry.key);
    encodeUnknown(entry.value, path, ancestors, out);
    path.pop();
    path.pop();
  }
}

function encodePlainObject(
  value: Record<string, unknown>,
  path: string[],
  ancestors: Set<object>,
  out: Uint8Array[]
): void {
  const entries = collectObjectEntries(
    Reflect.ownKeys(value),
    (key) => value[key],
    path
  );
  emitObjectEntries(entries, path, ancestors, out);
}

function encodeMapValue(
  value: ReadonlyMap<unknown, unknown>,
  path: string[],
  ancestors: Set<object>,
  out: Uint8Array[]
): void {
  const rawKeys: (string | symbol)[] = [];
  const contents = new Map<string, unknown>();
  for (const [key, item] of value) {
    if (typeof key !== 'string') {
      fail(
        CANONICAL_ENCODER_ERROR_CODES.UNSUPPORTED_KEY,
        'object and map keys must be strings',
        path
      );
    }
    rawKeys.push(key);
    contents.set(key, item);
  }
  const entries = collectObjectEntries(
    rawKeys,
    (key) => contents.get(key),
    path
  );
  emitObjectEntries(entries, path, ancestors, out);
}

function encodeArrayValue(
  value: readonly unknown[],
  path: string[],
  ancestors: Set<object>,
  out: Uint8Array[]
): void {
  encodeCollectionHeader(TAG_LIST, value.length, out);
  for (let i = 0; i < value.length; i++) {
    path.push('[');
    path.push(String(i));
    path.push(']');
    encodeUnknown(value[i], path, ancestors, out);
    path.pop();
    path.pop();
    path.pop();
  }
}

function encodeSetValue(
  value: ReadonlySet<unknown>,
  path: string[],
  ancestors: Set<object>,
  out: Uint8Array[]
): void {
  const memberEncodings: Uint8Array[] = [];
  let index = 0;
  for (const member of value) {
    path.push('{');
    path.push(String(index));
    path.push('}');
    const chunks: Uint8Array[] = [];
    encodeUnknown(member, path, ancestors, chunks);
    memberEncodings.push(concat(chunks));
    path.pop();
    path.pop();
    path.pop();
    index++;
  }
  memberEncodings.sort(compareBytes);
  encodeCollectionHeader(TAG_SET, memberEncodings.length, out);
  for (const encoded of memberEncodings) out.push(encoded);
}

function encodeUnknown(
  value: unknown,
  path: string[],
  ancestors: Set<object>,
  out: Uint8Array[]
): void {
  if (value === undefined) {
    fail(
      CANONICAL_ENCODER_ERROR_CODES.UNDEFINED,
      'undefined is not a canonical value',
      path
    );
  }
  if (value === null) {
    out.push(Uint8Array.of(TAG_NULL));
    return;
  }
  const kind = typeof value;
  if (kind === 'boolean') {
    out.push(Uint8Array.of(value === true ? TAG_TRUE : TAG_FALSE));
    return;
  }
  if (kind === 'number') {
    encodeSafeInteger(value as number, path, out);
    return;
  }
  if (kind === 'bigint') {
    encodeBigInt(value as bigint, out);
    return;
  }
  if (kind === 'string') {
    encodeString(value as string, path, out);
    return;
  }
  if (kind !== 'object') {
    fail(
      CANONICAL_ENCODER_ERROR_CODES.UNSUPPORTED_VALUE,
      `unsupported runtime type ${kind}`,
      path
    );
  }
  const objectValue = value as object;
  if (ancestors.has(objectValue)) {
    fail(
      CANONICAL_ENCODER_ERROR_CODES.CYCLIC_REFERENCE,
      'cyclic structures are not canonical',
      path
    );
  }
  ancestors.add(objectValue);
  try {
    if (Array.isArray(objectValue)) {
      encodeArrayValue(objectValue as readonly unknown[], path, ancestors, out);
      return;
    }
    if (objectValue instanceof Set) {
      encodeSetValue(objectValue as ReadonlySet<unknown>, path, ancestors, out);
      return;
    }
    if (objectValue instanceof Map) {
      encodeMapValue(objectValue as ReadonlyMap<unknown, unknown>, path, ancestors, out);
      return;
    }
    if (isPlainObject(objectValue)) {
      encodePlainObject(objectValue, path, ancestors, out);
      return;
    }
    fail(
      CANONICAL_ENCODER_ERROR_CODES.UNSUPPORTED_VALUE,
      'only plain objects, arrays, sets and maps are canonical containers',
      path
    );
  } finally {
    ancestors.delete(objectValue);
  }
}

export function canonicalEncode(value: CanonicalValue): Uint8Array {
  const path: string[] = [];
  const ancestors = new Set<object>();
  const out: Uint8Array[] = [];
  encodeUnknown(value, path, ancestors, out);
  return concat(out);
}

export const CanonicalEncoder = {
  ENCODING_VERSION: CANONICAL_ENCODING_VERSION,
  encode: canonicalEncode
} as const;
