import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOMINAL_TYPE_ERROR_CODES,
  NominalTypeError,
  PRICE_SCALE,
  QUANTITY_SCALE,
  RATE_SCALE,
  asMoney,
  asPrice,
  asQuantity,
  asRate,
  asTick
} from '../../packages/core/dist/index.mjs';

function expectError(fn, expectedCode) {
  let caught;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof NominalTypeError, `Expected NominalTypeError, got ${caught}`);
  assert.equal(caught.code, expectedCode, `Expected code ${expectedCode}, got ${caught.code}`);
}

test('QUANTITY_SCALE equals 100_000_000n as a bigint constant', () => {
  assert.equal(typeof QUANTITY_SCALE, 'bigint');
  assert.equal(QUANTITY_SCALE, 100_000_000n);
});

test('PRICE_SCALE equals 10_000n as a bigint constant', () => {
  assert.equal(typeof PRICE_SCALE, 'bigint');
  assert.equal(PRICE_SCALE, 10_000n);
});

test('RATE_SCALE equals 100_000_000n as a bigint constant', () => {
  assert.equal(typeof RATE_SCALE, 'bigint');
  assert.equal(RATE_SCALE, 100_000_000n);
});

const BIGINT_CONSTRUCTORS = [
  { name: 'Money', build: asMoney, code: NOMINAL_TYPE_ERROR_CODES.MONEY_NOT_BIGINT },
  { name: 'Quantity', build: asQuantity, code: NOMINAL_TYPE_ERROR_CODES.QUANTITY_NOT_BIGINT },
  { name: 'Price', build: asPrice, code: NOMINAL_TYPE_ERROR_CODES.PRICE_NOT_BIGINT },
  { name: 'Rate', build: asRate, code: NOMINAL_TYPE_ERROR_CODES.RATE_NOT_BIGINT }
];

for (const { name, build, code } of BIGINT_CONSTRUCTORS) {
  test(`${name} constructor accepts bigint zero without precision conversion`, () => {
    const result = build(0n);
    assert.equal(typeof result, 'bigint');
    assert.equal(result, 0n);
  });

  test(`${name} constructor accepts a large positive bigint without precision conversion`, () => {
    const huge = 123456789012345678901234567890n;
    const result = build(huge);
    assert.equal(typeof result, 'bigint');
    assert.equal(result, huge);
  });

  test(`${name} constructor accepts a negative bigint without precision conversion`, () => {
    const result = build(-1n);
    assert.equal(typeof result, 'bigint');
    assert.equal(result, -1n);
  });

  test(`${name} constructor rejects a plain number`, () => {
    expectError(() => build(1), code);
  });

  test(`${name} constructor rejects a decimal number`, () => {
    expectError(() => build(1.5), code);
  });

  test(`${name} constructor rejects a numeric string`, () => {
    expectError(() => build('1'), code);
  });

  test(`${name} constructor rejects null`, () => {
    expectError(() => build(null), code);
  });

  test(`${name} constructor rejects undefined`, () => {
    expectError(() => build(undefined), code);
  });

  test(`${name} constructor rejects boolean true`, () => {
    expectError(() => build(true), code);
  });

  test(`${name} constructor rejects an object`, () => {
    expectError(() => build({ value: 1n }), code);
  });

  test(`${name} constructor rejects a symbol`, () => {
    expectError(() => build(Symbol('x')), code);
  });
}

test('Tick constructor accepts 0', () => {
  const result = asTick(0);
  assert.equal(typeof result, 'number');
  assert.equal(result, 0);
});

test('Tick constructor accepts Number.MAX_SAFE_INTEGER', () => {
  const result = asTick(Number.MAX_SAFE_INTEGER);
  assert.equal(typeof result, 'number');
  assert.equal(result, Number.MAX_SAFE_INTEGER);
});

test('Tick constructor accepts a mid-range positive integer', () => {
  const result = asTick(525_600);
  assert.equal(result, 525_600);
});

test('Tick constructor rejects -1 as out of range', () => {
  expectError(() => asTick(-1), NOMINAL_TYPE_ERROR_CODES.TICK_OUT_OF_RANGE);
});

test('Tick constructor rejects Number.MAX_SAFE_INTEGER + 1 as out of range', () => {
  expectError(
    () => asTick(Number.MAX_SAFE_INTEGER + 1),
    NOMINAL_TYPE_ERROR_CODES.TICK_OUT_OF_RANGE
  );
});

test('Tick constructor rejects a fractional value as non-integer', () => {
  expectError(() => asTick(1.5), NOMINAL_TYPE_ERROR_CODES.TICK_NOT_INTEGER);
});

test('Tick constructor rejects Number.NaN', () => {
  expectError(() => asTick(Number.NaN), NOMINAL_TYPE_ERROR_CODES.TICK_NAN);
});

test('Tick constructor rejects positive infinity', () => {
  expectError(
    () => asTick(Number.POSITIVE_INFINITY),
    NOMINAL_TYPE_ERROR_CODES.TICK_POSITIVE_INFINITY
  );
});

test('Tick constructor rejects negative infinity', () => {
  expectError(
    () => asTick(Number.NEGATIVE_INFINITY),
    NOMINAL_TYPE_ERROR_CODES.TICK_NEGATIVE_INFINITY
  );
});

test('Tick constructor rejects a bigint value', () => {
  expectError(() => asTick(0n), NOMINAL_TYPE_ERROR_CODES.TICK_NOT_NUMBER);
});

test('Tick constructor rejects a string value', () => {
  expectError(() => asTick('0'), NOMINAL_TYPE_ERROR_CODES.TICK_NOT_NUMBER);
});

test('Tick constructor rejects null', () => {
  expectError(() => asTick(null), NOMINAL_TYPE_ERROR_CODES.TICK_NOT_NUMBER);
});

test('Tick constructor rejects undefined', () => {
  expectError(() => asTick(undefined), NOMINAL_TYPE_ERROR_CODES.TICK_NOT_NUMBER);
});

test('Tick constructor rejects a boolean value', () => {
  expectError(() => asTick(true), NOMINAL_TYPE_ERROR_CODES.TICK_NOT_NUMBER);
});

test('Tick constructor rejects an object value', () => {
  expectError(() => asTick({ tick: 0 }), NOMINAL_TYPE_ERROR_CODES.TICK_NOT_NUMBER);
});

test('Tick constructor rejects a symbol value', () => {
  expectError(() => asTick(Symbol('t')), NOMINAL_TYPE_ERROR_CODES.TICK_NOT_NUMBER);
});

test('NominalTypeError has a stable name and code property', () => {
  try {
    asMoney(1);
  } catch (err) {
    assert.ok(err instanceof NominalTypeError);
    assert.equal(err.name, 'NominalTypeError');
    assert.equal(err.code, NOMINAL_TYPE_ERROR_CODES.MONEY_NOT_BIGINT);
    return;
  }
  assert.fail('expected asMoney(1) to throw');
});

test('NOMINAL_TYPE_ERROR_CODES contains all documented codes', () => {
  assert.equal(NOMINAL_TYPE_ERROR_CODES.MONEY_NOT_BIGINT, 'NOMINAL_MONEY_NOT_BIGINT');
  assert.equal(NOMINAL_TYPE_ERROR_CODES.QUANTITY_NOT_BIGINT, 'NOMINAL_QUANTITY_NOT_BIGINT');
  assert.equal(NOMINAL_TYPE_ERROR_CODES.PRICE_NOT_BIGINT, 'NOMINAL_PRICE_NOT_BIGINT');
  assert.equal(NOMINAL_TYPE_ERROR_CODES.RATE_NOT_BIGINT, 'NOMINAL_RATE_NOT_BIGINT');
  assert.equal(NOMINAL_TYPE_ERROR_CODES.TICK_NOT_NUMBER, 'NOMINAL_TICK_NOT_NUMBER');
  assert.equal(NOMINAL_TYPE_ERROR_CODES.TICK_NAN, 'NOMINAL_TICK_NAN');
  assert.equal(NOMINAL_TYPE_ERROR_CODES.TICK_POSITIVE_INFINITY, 'NOMINAL_TICK_POSITIVE_INFINITY');
  assert.equal(NOMINAL_TYPE_ERROR_CODES.TICK_NEGATIVE_INFINITY, 'NOMINAL_TICK_NEGATIVE_INFINITY');
  assert.equal(NOMINAL_TYPE_ERROR_CODES.TICK_NOT_INTEGER, 'NOMINAL_TICK_NOT_INTEGER');
  assert.equal(NOMINAL_TYPE_ERROR_CODES.TICK_OUT_OF_RANGE, 'NOMINAL_TICK_OUT_OF_RANGE');
});
