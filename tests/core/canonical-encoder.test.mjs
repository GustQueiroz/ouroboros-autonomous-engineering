import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_ENCODING_VERSION,
  CANONICAL_ENCODER_ERROR_CODES,
  CanonicalEncoder,
  CanonicalEncoderError,
  canonicalEncode
} from '../../packages/core/dist/index.mjs';

const encoder = new TextEncoder();

function bytesOf(str) {
  return encoder.encode(str);
}

function concat(chunks) {
  const total = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

test('encoding version is stable and exposed by the CanonicalEncoder', () => {
  assert.equal(CANONICAL_ENCODING_VERSION, 'canonical-v1');
  assert.equal(CanonicalEncoder.ENCODING_VERSION, 'canonical-v1');
  assert.equal(typeof CanonicalEncoder.encode, 'function');
});

test('golden scalar: null → single N byte', () => {
  const bytes = canonicalEncode(null);
  assert.deepEqual(Array.from(bytes), [0x4e]);
});

test('golden scalar: true → single T byte', () => {
  assert.deepEqual(Array.from(canonicalEncode(true)), [0x54]);
});

test('golden scalar: false → single F byte', () => {
  assert.deepEqual(Array.from(canonicalEncode(false)), [0x46]);
});

test('golden scalar: safe integer zero → I+0;', () => {
  const bytes = canonicalEncode(0);
  assert.deepEqual(bytes, bytesOf('I+0;'));
});

test('golden scalar: positive safe integer → I+N;', () => {
  const bytes = canonicalEncode(1_234_567);
  assert.deepEqual(bytes, bytesOf('I+1234567;'));
});

test('golden scalar: negative safe integer → I-N;', () => {
  const bytes = canonicalEncode(-42);
  assert.deepEqual(bytes, bytesOf('I-42;'));
});

test('golden scalar: safe integer at both edges of the safe range', () => {
  assert.deepEqual(canonicalEncode(9007199254740991), bytesOf('I+9007199254740991;'));
  assert.deepEqual(canonicalEncode(-9007199254740991), bytesOf('I-9007199254740991;'));
});

test('golden scalar: bigint zero → B+0;', () => {
  assert.deepEqual(canonicalEncode(0n), bytesOf('B+0;'));
});

test('golden scalar: positive bigint → B+N;', () => {
  assert.deepEqual(canonicalEncode(123456789012345678901234567890n), bytesOf('B+123456789012345678901234567890;'));
});

test('golden scalar: negative bigint → B-N;', () => {
  assert.deepEqual(canonicalEncode(-1n), bytesOf('B-1;'));
});

test('golden scalar: empty string → S0:', () => {
  assert.deepEqual(canonicalEncode(''), bytesOf('S0:'));
});

test('golden scalar: ascii string uses UTF-8 byte length prefix', () => {
  assert.deepEqual(canonicalEncode('abc'), bytesOf('S3:abc'));
});

test('golden scalar: string with 2-byte UTF-8 characters', () => {
  const value = 'é';
  const utf8 = bytesOf(value);
  assert.equal(utf8.length, 2);
  const expected = concat([bytesOf('S2:'), utf8]);
  assert.deepEqual(canonicalEncode(value), expected);
});

test('golden scalar: string with a 3-byte character and a 4-byte character', () => {
  const value = 'á€𐍈';
  const utf8 = bytesOf(value);
  assert.equal(utf8.length, 2 + 3 + 4);
  const expected = concat([bytesOf(`S${utf8.length}:`), utf8]);
  assert.deepEqual(canonicalEncode(value), expected);
});

test('golden collection: empty array → L0:', () => {
  assert.deepEqual(canonicalEncode([]), bytesOf('L0:'));
});

test('golden collection: ordered array of safe integers', () => {
  assert.deepEqual(canonicalEncode([1, 2, 3]), bytesOf('L3:I+1;I+2;I+3;'));
});

test('golden collection: empty Set → U0:', () => {
  assert.deepEqual(canonicalEncode(new Set()), bytesOf('U0:'));
});

test('golden collection: Set of safe integers sorts by encoded byte order', () => {
  const literal = new Set([3, 1, 2]);
  assert.deepEqual(canonicalEncode(literal), bytesOf('U3:I+1;I+2;I+3;'));
});

test('golden collection: empty plain object → O0:', () => {
  assert.deepEqual(canonicalEncode({}), bytesOf('O0:'));
});

test('golden collection: plain object emits keys in ascending UTF-8 byte order', () => {
  const value = { b: 2, a: 1 };
  assert.deepEqual(canonicalEncode(value), bytesOf('O2:S1:aI+1;S1:bI+2;'));
});

test('golden collection: Map matches plain object encoding for identical entries', () => {
  const literal = { alpha: 1n, beta: 'x' };
  const asMap = new Map([['beta', 'x'], ['alpha', 1n]]);
  const literalBytes = canonicalEncode(literal);
  const mapBytes = canonicalEncode(asMap);
  assert.deepEqual(literalBytes, mapBytes);
  assert.deepEqual(literalBytes, bytesOf('O2:S5:alphaB+1;S4:betaS1:x'));
});

test('golden collection: nested containers combine correctly', () => {
  const value = { list: [1, 2], set: new Set(['b', 'a']) };
  assert.deepEqual(
    canonicalEncode(value),
    bytesOf('O2:S4:listL2:I+1;I+2;S3:setU2:S1:aS1:b')
  );
});

test('determinism: repeated encoding of the same logical value returns identical bytes', () => {
  const value = { z: [1, 2, 3], a: new Set(['b', 'a']), m: new Map([['x', 1n], ['y', 2n]]) };
  const first = canonicalEncode(value);
  const second = canonicalEncode(value);
  const third = canonicalEncode({ a: new Set(['a', 'b']), m: new Map([['y', 2n], ['x', 1n]]), z: [1, 2, 3] });
  assert.deepEqual(first, second);
  assert.deepEqual(first, third);
});

test('UTF-8 key ordering differs from JavaScript UTF-16 code-unit ordering', () => {
  const supplementary = String.fromCodePoint(0x1f600);
  const bmp = 'ﬀ';
  const utf16Order = [supplementary, bmp].sort();
  assert.deepEqual(utf16Order, [supplementary, bmp], 'JS default sort orders high surrogates before BMP');
  const bytes = canonicalEncode({ [supplementary]: 1, [bmp]: 2 });
  const bmpBytes = bytesOf(bmp);
  const supBytes = bytesOf(supplementary);
  assert.ok(bmpBytes[0] < supBytes[0], 'BMP UTF-8 bytes must precede supplementary UTF-8 bytes');
  const bmpEncoded = concat([Uint8Array.of(0x53), bytesOf(String(bmpBytes.length) + ':'), bmpBytes, bytesOf('I+2;')]);
  const supEncoded = concat([Uint8Array.of(0x53), bytesOf(String(supBytes.length) + ':'), supBytes, bytesOf('I+1;')]);
  const expected = concat([bytesOf('O2:'), bmpEncoded, supEncoded]);
  assert.deepEqual(bytes, expected);
});

test('UTF-8 key ordering ignores locale-sensitive collation', () => {
  const bytes = canonicalEncode({ I: 1, i: 2 });
  assert.deepEqual(bytes, bytesOf('O2:S1:II+1;S1:iI+2;'));
  const firstKeyByte = bytes[bytesOf('O2:S1:').length];
  assert.equal(firstKeyByte, 0x49, 'byte order must sort I (0x49) before i (0x69), not by any collation');
});

test('UTF-8 key ordering ranks combining marks after their base by byte code, not by canonical equivalence', () => {
  const bytes = canonicalEncode({ 'ä': 1, 'ä': 2 });
  const precomposedKeyBytes = bytesOf('ä');
  const decomposedKeyBytes = bytesOf('ä');
  const cmp = precomposedKeyBytes[0] - decomposedKeyBytes[0];
  assert.ok(cmp !== 0, 'precomposed and NFD forms encode to different UTF-8 byte sequences');
  const expectedFirst = cmp < 0 ? precomposedKeyBytes : decomposedKeyBytes;
  const expectedFirstValue = cmp < 0 ? bytesOf('I+1;') : bytesOf('I+2;');
  const expectedSecond = cmp < 0 ? decomposedKeyBytes : precomposedKeyBytes;
  const expectedSecondValue = cmp < 0 ? bytesOf('I+2;') : bytesOf('I+1;');
  const expected = concat([
    bytesOf('O2:'),
    Uint8Array.of(0x53),
    bytesOf(String(expectedFirst.length) + ':'),
    expectedFirst,
    expectedFirstValue,
    Uint8Array.of(0x53),
    bytesOf(String(expectedSecond.length) + ':'),
    expectedSecond,
    expectedSecondValue
  ]);
  assert.deepEqual(bytes, expected);
});

test('insertion order does not affect object encoding', () => {
  const a = { first: 1, second: 2, third: 3 };
  const b = { third: 3, second: 2, first: 1 };
  assert.deepEqual(canonicalEncode(a), canonicalEncode(b));
});

test('insertion order does not affect Map encoding', () => {
  const a = new Map([['x', 10], ['y', 20]]);
  const b = new Map([['y', 20], ['x', 10]]);
  assert.deepEqual(canonicalEncode(a), canonicalEncode(b));
});

test('insertion order does not affect Set encoding', () => {
  const a = new Set([1, 2, 3]);
  const b = new Set([3, 1, 2]);
  assert.deepEqual(canonicalEncode(a), canonicalEncode(b));
});

test('ordered collection is sensitive to element order', () => {
  const forward = canonicalEncode([1, 2, 3]);
  const reversed = canonicalEncode([3, 2, 1]);
  assert.ok(!bytesEqual(forward, reversed), `ordered arrays must diverge on order swap; got ${toHex(forward)}`);
});

test('unordered collection ignores element order but ordered collection does not', () => {
  const set = canonicalEncode(new Set([1, 2, 3]));
  const list = canonicalEncode([1, 2, 3]);
  assert.ok(!bytesEqual(set, list), 'set and list encodings must differ by type tag');
});

test('type separation: bigint 1n and safe integer 1 never collide', () => {
  assert.ok(!bytesEqual(canonicalEncode(1n), canonicalEncode(1)));
});

test('type separation: scalar vs single-item ordered collection', () => {
  assert.ok(!bytesEqual(canonicalEncode(1), canonicalEncode([1])));
});

test('type separation: single-item ordered vs unordered collection with same member', () => {
  assert.ok(!bytesEqual(canonicalEncode([1]), canonicalEncode(new Set([1]))));
});

test('type separation: object key vs value with same lexical text', () => {
  const withKey = canonicalEncode({ x: null });
  const withValue = canonicalEncode({ '': 'x' });
  assert.ok(!bytesEqual(withKey, withValue));
});

test('type separation: null distinct from boolean false and from empty string', () => {
  const nullBytes = canonicalEncode(null);
  const falseBytes = canonicalEncode(false);
  const emptyStringBytes = canonicalEncode('');
  assert.ok(!bytesEqual(nullBytes, falseBytes));
  assert.ok(!bytesEqual(nullBytes, emptyStringBytes));
  assert.ok(!bytesEqual(falseBytes, emptyStringBytes));
});

test('type separation: full collision-separation corpus is unique', () => {
  const corpus = [
    null,
    true,
    false,
    0,
    1,
    -1,
    0n,
    1n,
    -1n,
    '',
    '0',
    '1',
    '1n',
    'a',
    [],
    [1],
    [1, 2],
    [2, 1],
    new Set(),
    new Set([1]),
    new Set([1, 2]),
    {},
    { '': null },
    { a: 1 },
    { a: 1n },
    { a: [1] },
    { a: new Set([1]) }
  ];
  const encodings = corpus.map((value) => toHex(canonicalEncode(value)));
  const unique = new Set(encodings);
  assert.equal(
    unique.size,
    encodings.length,
    `Every logically-distinct value must have a unique encoding; duplicates: ${JSON.stringify(
      encodings.reduce((acc, hex, i) => {
        const dup = encodings.findIndex((other, j) => j !== i && other === hex);
        if (dup !== -1) acc.push({ i, dup, hex });
        return acc;
      }, [])
    )}`
  );
});

test('map / plain object equivalence: same logical value encodes identically for every container-shape pair', () => {
  const pairs = [
    [{}, new Map()],
    [{ a: 1 }, new Map([['a', 1]])],
    [{ a: 1n, b: 2n }, new Map([['a', 1n], ['b', 2n]])],
    [{ a: [1, 2], b: new Set(['x']) }, new Map([['a', [1, 2]], ['b', new Set(['x'])]])]
  ];
  for (const [obj, map] of pairs) {
    assert.deepEqual(canonicalEncode(obj), canonicalEncode(map));
  }
});

test('rejection: undefined at root throws CANONICAL_UNDEFINED', () => {
  assert.throws(
    () => canonicalEncode(undefined),
    (err) => err instanceof CanonicalEncoderError && err.code === CANONICAL_ENCODER_ERROR_CODES.UNDEFINED
  );
});

test('rejection: undefined nested inside an object throws with a path', () => {
  assert.throws(
    () => canonicalEncode({ ok: 1, bad: undefined }),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.UNDEFINED &&
      err.path.length > 0
  );
});

test('rejection: NaN throws CANONICAL_NAN', () => {
  assert.throws(
    () => canonicalEncode(Number.NaN),
    (err) => err instanceof CanonicalEncoderError && err.code === CANONICAL_ENCODER_ERROR_CODES.NAN
  );
});

test('rejection: positive Infinity throws CANONICAL_POSITIVE_INFINITY', () => {
  assert.throws(
    () => canonicalEncode(Number.POSITIVE_INFINITY),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.POSITIVE_INFINITY
  );
});

test('rejection: negative Infinity throws CANONICAL_NEGATIVE_INFINITY', () => {
  assert.throws(
    () => canonicalEncode(Number.NEGATIVE_INFINITY),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.NEGATIVE_INFINITY
  );
});

test('rejection: negative zero throws CANONICAL_NEGATIVE_ZERO', () => {
  assert.throws(
    () => canonicalEncode(-0),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.NEGATIVE_ZERO
  );
});

test('rejection: non-integer float throws CANONICAL_NON_INTEGER', () => {
  assert.throws(
    () => canonicalEncode(1.5),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.NON_INTEGER
  );
});

test('rejection: unsafe integer throws CANONICAL_UNSAFE_INTEGER', () => {
  assert.throws(
    () => canonicalEncode(9007199254740992),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.UNSAFE_INTEGER
  );
});

test('rejection: unsupported symbol value throws CANONICAL_UNSUPPORTED_VALUE', () => {
  assert.throws(
    () => canonicalEncode(Symbol('anything')),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.UNSUPPORTED_VALUE
  );
});

test('rejection: unsupported host object (Date) throws CANONICAL_UNSUPPORTED_VALUE', () => {
  assert.throws(
    () => canonicalEncode(new Date(0)),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.UNSUPPORTED_VALUE
  );
});

test('rejection: symbol-keyed object property throws CANONICAL_UNSUPPORTED_KEY', () => {
  const sym = Symbol('secret');
  const value = { a: 1, [sym]: 2 };
  assert.throws(
    () => canonicalEncode(value),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.UNSUPPORTED_KEY
  );
});

test('rejection: cyclic object throws CANONICAL_CYCLIC_REFERENCE', () => {
  const cyclic = { a: 1 };
  cyclic.self = cyclic;
  assert.throws(
    () => canonicalEncode(cyclic),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.CYCLIC_REFERENCE
  );
});

test('rejection: cyclic array throws CANONICAL_CYCLIC_REFERENCE', () => {
  const arr = [1];
  arr.push(arr);
  assert.throws(
    () => canonicalEncode(arr),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.CYCLIC_REFERENCE
  );
});

test('same reference appearing twice in siblings (not in ancestry) is not a cycle', () => {
  const shared = { k: 1 };
  const wrapper = { first: shared, second: shared };
  const bytes = canonicalEncode(wrapper);
  const encodedShared = 'O1:S1:kI+1;';
  const expected = bytesOf(
    'O2:S5:first' + encodedShared + 'S6:second' + encodedShared
  );
  assert.deepEqual(bytes, expected);
});

test('rejection: unpaired high surrogate throws CANONICAL_MALFORMED_STRING', () => {
  const bad = '\uD83D';
  assert.throws(
    () => canonicalEncode(bad),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.MALFORMED_STRING
  );
});

test('rejection: high surrogate followed by non-low-surrogate throws CANONICAL_MALFORMED_STRING', () => {
  const bad = '\uD83Dx';
  assert.throws(
    () => canonicalEncode(bad),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.MALFORMED_STRING
  );
});

test('rejection: unpaired low surrogate throws CANONICAL_MALFORMED_STRING', () => {
  const bad = 'x\uDC00';
  assert.throws(
    () => canonicalEncode(bad),
    (err) =>
      err instanceof CanonicalEncoderError &&
      err.code === CANONICAL_ENCODER_ERROR_CODES.MALFORMED_STRING
  );
});

test('CanonicalEncoderError carries its code as a stable string', () => {
  try {
    canonicalEncode(undefined);
    assert.fail('expected throw');
  } catch (err) {
    assert.ok(err instanceof CanonicalEncoderError);
    assert.equal(err.name, 'CanonicalEncoderError');
    assert.equal(err.code, 'CANONICAL_UNDEFINED');
    assert.ok(Array.isArray(err.path));
  }
});
