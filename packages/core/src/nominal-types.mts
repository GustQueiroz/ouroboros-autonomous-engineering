export const QUANTITY_SCALE = 100_000_000n;
export const PRICE_SCALE = 10_000n;
export const RATE_SCALE = 100_000_000n;

export const NOMINAL_TYPE_ERROR_CODES = {
  MONEY_NOT_BIGINT: 'NOMINAL_MONEY_NOT_BIGINT',
  QUANTITY_NOT_BIGINT: 'NOMINAL_QUANTITY_NOT_BIGINT',
  PRICE_NOT_BIGINT: 'NOMINAL_PRICE_NOT_BIGINT',
  RATE_NOT_BIGINT: 'NOMINAL_RATE_NOT_BIGINT',
  TICK_NOT_NUMBER: 'NOMINAL_TICK_NOT_NUMBER',
  TICK_NAN: 'NOMINAL_TICK_NAN',
  TICK_POSITIVE_INFINITY: 'NOMINAL_TICK_POSITIVE_INFINITY',
  TICK_NEGATIVE_INFINITY: 'NOMINAL_TICK_NEGATIVE_INFINITY',
  TICK_NOT_INTEGER: 'NOMINAL_TICK_NOT_INTEGER',
  TICK_OUT_OF_RANGE: 'NOMINAL_TICK_OUT_OF_RANGE'
} as const;

export type NominalTypeErrorCode =
  (typeof NOMINAL_TYPE_ERROR_CODES)[keyof typeof NOMINAL_TYPE_ERROR_CODES];

export class NominalTypeError extends Error {
  readonly code: NominalTypeErrorCode;

  constructor(code: NominalTypeErrorCode, message: string) {
    super(message);
    this.name = 'NominalTypeError';
    this.code = code;
  }
}

export type Money = bigint & { readonly __ciclo_brand: 'Money' };
export type Quantity = bigint & { readonly __ciclo_brand: 'Quantity' };
export type Price = bigint & { readonly __ciclo_brand: 'Price' };
export type Rate = bigint & { readonly __ciclo_brand: 'Rate' };
export type Tick = number & { readonly __ciclo_brand: 'Tick' };

function describeType(value: unknown): string {
  if (value === null) return 'null';
  return typeof value;
}

function assertBigint(
  code: NominalTypeErrorCode,
  kind: string,
  value: unknown
): asserts value is bigint {
  if (typeof value !== 'bigint') {
    throw new NominalTypeError(
      code,
      `${kind} requires a bigint value, received ${describeType(value)}`
    );
  }
}

export function asMoney(value: bigint): Money {
  assertBigint(NOMINAL_TYPE_ERROR_CODES.MONEY_NOT_BIGINT, 'Money', value);
  return value as Money;
}

export function asQuantity(value: bigint): Quantity {
  assertBigint(NOMINAL_TYPE_ERROR_CODES.QUANTITY_NOT_BIGINT, 'Quantity', value);
  return value as Quantity;
}

export function asPrice(value: bigint): Price {
  assertBigint(NOMINAL_TYPE_ERROR_CODES.PRICE_NOT_BIGINT, 'Price', value);
  return value as Price;
}

export function asRate(value: bigint): Rate {
  assertBigint(NOMINAL_TYPE_ERROR_CODES.RATE_NOT_BIGINT, 'Rate', value);
  return value as Rate;
}

export function asTick(value: number): Tick {
  const candidate: unknown = value;
  if (typeof candidate !== 'number') {
    throw new NominalTypeError(
      NOMINAL_TYPE_ERROR_CODES.TICK_NOT_NUMBER,
      `Tick requires a number value, received ${describeType(candidate)}`
    );
  }
  if (Number.isNaN(candidate)) {
    throw new NominalTypeError(
      NOMINAL_TYPE_ERROR_CODES.TICK_NAN,
      'Tick rejects NaN'
    );
  }
  if (candidate === Number.POSITIVE_INFINITY) {
    throw new NominalTypeError(
      NOMINAL_TYPE_ERROR_CODES.TICK_POSITIVE_INFINITY,
      'Tick rejects positive infinity'
    );
  }
  if (candidate === Number.NEGATIVE_INFINITY) {
    throw new NominalTypeError(
      NOMINAL_TYPE_ERROR_CODES.TICK_NEGATIVE_INFINITY,
      'Tick rejects negative infinity'
    );
  }
  if (!Number.isInteger(candidate)) {
    throw new NominalTypeError(
      NOMINAL_TYPE_ERROR_CODES.TICK_NOT_INTEGER,
      'Tick rejects non-integer numbers'
    );
  }
  if (candidate < 0 || candidate > Number.MAX_SAFE_INTEGER) {
    throw new NominalTypeError(
      NOMINAL_TYPE_ERROR_CODES.TICK_OUT_OF_RANGE,
      'Tick must be in the inclusive range [0, Number.MAX_SAFE_INTEGER]'
    );
  }
  return candidate as Tick;
}
