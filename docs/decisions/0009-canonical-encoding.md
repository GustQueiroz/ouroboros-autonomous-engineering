# ADR-009 — Canonical state encoding

- Status: accepted
- Cycle: CYCLE-000090
- Resolves DEFINIR items and TRAVADO clauses of §3 (ADR-009), §12 (INV-22, INV-23) and §15 (FASE-1 acceptance) of CICLO_SPEC.md v1.3.1.

## Context

INV-22 requires that two logically-equal states produce byte-identical canonical bytes and that two logically-different states never collide. ADR-009 of CICLO_SPEC.md forbids `JSON.stringify` for anything that carries an economic value and rejects any implicit normalization of runtime edge cases.

JavaScript's default serializations do not satisfy the invariant on their own:

- `Object` property iteration order depends on insertion order and on numeric-key promotion rules.
- `bigint` has no JSON representation.
- `undefined`, function values, symbols and cyclic structures are either silently dropped or throw at unpredictable places.
- `NaN`, `Infinity`, `-Infinity` and `-0` are indistinguishable from their neighbours in JSON.
- Locale-sensitive string comparison (`String.prototype.localeCompare`) does not agree with byte-order comparison for strings that mix ASCII and higher planes.

FASE-1 acceptance requires a canonical encoder before any state or save hash exists. This ADR fixes the byte format so that every future contributor — including the hash function chosen by ADR-002 and the save envelope of ADR-006 — encodes state the same way.

## Decision

`packages/core` exports a `CanonicalEncoder` whose sole entry point is a pure function `encode(value: CanonicalValue): Uint8Array`. Both the type domain and the byte layout are normative and versioned by the constant `CANONICAL_ENCODING_VERSION`.

### Supported value domain

The encoder accepts a closed algebraic value model. Any value outside this model raises a typed `CanonicalEncoderError` with a stable `code`. No implicit coercion, no silent skipping, no default value.

Supported forms:

| Form | Runtime shape |
|---|---|
| null | `null` |
| boolean | `true`, `false` |
| safe integer | `number` restricted to `Number.isSafeInteger` and not `-0` |
| bigint | `bigint` |
| string | `string`, must contain no unpaired surrogates |
| object | Plain object whose prototype is `Object.prototype` or `null`, with string keys only |
| ordered collection | `Array` |
| unordered collection | `Set` |
| map | `Map` with string keys only |

`Map` and plain object share the object type tag: the canonical form of a `Map<string, V>` and of the equivalent object literal is identical, because both express the same logical structure. Two logically-equal states written with different container choices must not diverge byte-wise.

### Rejected values

Every rejection raises `CanonicalEncoderError` with a distinct `code`. The mapping is stable and forms part of this ADR.

| Runtime value | Error code |
|---|---|
| `undefined` (root or property) | `CANONICAL_UNDEFINED` |
| `NaN` | `CANONICAL_NAN` |
| `Infinity` | `CANONICAL_POSITIVE_INFINITY` |
| `-Infinity` | `CANONICAL_NEGATIVE_INFINITY` |
| `-0` | `CANONICAL_NEGATIVE_ZERO` |
| Non-integer `number` | `CANONICAL_NON_INTEGER` |
| Integer `number` outside `[-(2^53-1), 2^53-1]` | `CANONICAL_UNSAFE_INTEGER` |
| `symbol`, `function`, `Date`, `RegExp`, typed array, `WeakMap`, class instance, etc. | `CANONICAL_UNSUPPORTED_VALUE` |
| Non-string object/map key | `CANONICAL_UNSUPPORTED_KEY` |
| String containing an unpaired surrogate | `CANONICAL_MALFORMED_STRING` |
| Object, array, set or map that appears in its own ancestry | `CANONICAL_CYCLIC_REFERENCE` |

The check for `-0` uses `Object.is(value, -0)`; `NaN` uses `Number.isNaN`; the range check uses `Number.isSafeInteger`.

### Byte layout

The output is a `Uint8Array`. Every element is fully self-delimiting.

The type tag is a single ASCII byte:

| Tag | Byte | Form |
|---|---|---|
| `N` | 0x4E | null |
| `T` | 0x54 | boolean true |
| `F` | 0x46 | boolean false |
| `I` | 0x49 | safe integer |
| `B` | 0x42 | bigint |
| `S` | 0x53 | string |
| `O` | 0x4F | object / map |
| `L` | 0x4C | ordered collection |
| `U` | 0x55 | unordered collection |

Delimiters are `:` (0x3A) after a count or length prefix and `;` (0x3B) after a signed decimal payload. Sign markers are `+` (0x2B) and `-` (0x2D).

- `null` → `N`.
- `true` → `T`.
- `false` → `F`.
- Safe integer `n` → `I` `<sign>` `<digits>` `;`. `<sign>` is `+` for `0` and positive, `-` for negative. `<digits>` is the base-10 representation of the absolute value produced by `String(Math.abs(n))`, which is exact for safe integers and never has leading zeros. Zero is encoded as `I+0;`.
- `bigint` `n` → `B` `<sign>` `<digits>` `;`. Same sign convention. `<digits>` is `n < 0n ? (-n).toString() : n.toString()` (base 10). Zero is `B+0;`. No leading zeros; no exponential form.
- string `s` → `S` `<byteLen>` `:` `<utf8-bytes>`. `<byteLen>` is the base-10 count of the UTF-8 bytes that follow, encoded as decimal ASCII with no leading zeros (except `S0:` for the empty string). `<utf8-bytes>` is the exact UTF-8 encoding of `s`.
- ordered collection `[a0, a1, ..., a_{n-1}]` → `L` `<n>` `:` `enc(a0)` `enc(a1)` … `enc(a_{n-1})`.
- unordered collection with encoded members `m_i` → `U` `<n>` `:` `sorted(m_0, m_1, …, m_{n-1})` concatenated. `sorted` uses lexicographic byte comparison of each member's fully-encoded byte string. Duplicate encoded members are preserved (a set's own uniqueness is a caller invariant, not the encoder's).
- object / map with entries `{k_i: v_i}` → `O` `<n>` `:` `pairs`, where `n` is the entry count and `pairs` is the concatenation, in ascending UTF-8-byte order of `k_i`, of `encString(k_i)` `enc(v_i)`. Duplicate keys are impossible on a valid `Map` or object literal.

`<n>` and `<byteLen>` never carry leading zeros (`0` is written as `0`, `10` as `10`).

### Ordering rules

- Object and map keys are compared as UTF-8 byte sequences using unsigned octet comparison. This is not `String.prototype.localeCompare`, not JavaScript's default string comparison of UTF-16 code units, and not `Intl.Collator`. It is byte-for-byte comparison of the encoded UTF-8 form.
- The comparator is a strict total order (antisymmetric, transitive). It never returns zero for distinct byte sequences, because two distinct byte sequences differ at some position and the differing byte decides the order.
- Unordered collection members are compared by their fully-encoded byte string, using the same octet comparator.
- Ordered collections preserve their input order: the encoding of `[a, b]` is not equal to the encoding of `[b, a]` for `a ≠ b`.

### Version policy

`CANONICAL_ENCODING_VERSION` is exported as the string `"canonical-v1"`. This is the value the save envelope's `encodingVersion` field carries for saves produced under this ADR. Any change to the byte layout, the accepted value domain, the ordering rules or the rejection rules requires:

1. a new ADR that supersedes ADR-009 for the affected clauses,
2. a bump of `CANONICAL_ENCODING_VERSION`, and
3. a compatibility note explaining what changed and whether prior saves stay loadable under their own recorded version.

Bumping `CANONICAL_ENCODING_VERSION` participates in `SaveHash` as required by §14.4 of CICLO_SPEC.md and by ADR-009's original text.

## Consequences

- The encoder is a foundation for both `StateHash` and `SaveHash`, but neither is introduced by this ADR. Consumers concatenate `CANONICAL_ENCODING_VERSION` (as a string) into the wrapping object they hand to the encoder when that participation is required.
- `JSON.stringify` remains forbidden in pure packages by §13 and this ADR does not rescind that ban.
- Two logically-equal states written with different container choices (`{a: 1}` vs `new Map([['a', 1]])`) produce identical bytes. Two logically-distinct forms (`Array` vs `Set`, safe integer vs bigint, object vs list) produce different bytes because they carry different type tags.
- Determinism lint (§13) continues to apply to the encoder: no `Object.keys`, no `for-in`, no `Array.prototype.sort` without a comparator, no floating-point literal, no locale-sensitive routines. The encoder uses `Reflect.ownKeys`, a byte comparator, integer arithmetic and its own UTF-8 encoder.
- Runtime environments must provide `Uint8Array`. UTF-8 encoding is implemented in-package to avoid any implicit coupling to `TextEncoder` availability and to keep the algorithm auditable byte-for-byte.

## Rejected alternatives

- **JSON.** Rejected: no `bigint`, drops `undefined`, cannot distinguish `1` from `1n`, cannot express ordered vs unordered collections, and its stringify implementations differ subtly across engines.
- **MessagePack / CBOR.** Rejected: their canonical variants exist but bring cross-runtime library dependencies, and their integer promotion rules would silently merge our safe-integer and bigint domains.
- **Bencode-only netstrings.** Considered as inspiration for `<len>:<bytes>` framing. Rejected as a complete format because bencode collapses booleans and null onto integers and has no unordered collection.
- **Locale-sensitive key sorting (`localeCompare`).** Rejected because the invariant requires cross-platform byte identity and `Intl` is forbidden in pure packages by §13.
