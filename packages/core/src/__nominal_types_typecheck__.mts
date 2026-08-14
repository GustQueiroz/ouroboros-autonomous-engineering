import {
  asMoney,
  asPrice,
  asQuantity,
  asRate,
  asTick
} from './nominal-types.mjs';
import type { Money, Price, Quantity, Rate, Tick } from './nominal-types.mjs';

const money: Money = asMoney(1n);
const quantity: Quantity = asQuantity(1n);
const price: Price = asPrice(1n);
const rate: Rate = asRate(1n);
const tick: Tick = asTick(0);

export const positive = { money, quantity, price, rate, tick };

// Raw primitives must not satisfy any brand without going through a public constructor.
// @ts-expect-error primitive bigint is not assignable to Money
export const primitiveBigintAsMoney: Money = 1n;
// @ts-expect-error primitive bigint is not assignable to Quantity
export const primitiveBigintAsQuantity: Quantity = 1n;
// @ts-expect-error primitive bigint is not assignable to Price
export const primitiveBigintAsPrice: Price = 1n;
// @ts-expect-error primitive bigint is not assignable to Rate
export const primitiveBigintAsRate: Rate = 1n;
// @ts-expect-error primitive number is not assignable to Tick
export const primitiveNumberAsTick: Tick = 0;

// Values of one brand must not assign to another brand.
// @ts-expect-error Money is not assignable to Quantity
export const moneyAsQuantity: Quantity = asMoney(1n);
// @ts-expect-error Quantity is not assignable to Price
export const quantityAsPrice: Price = asQuantity(1n);
// @ts-expect-error Price is not assignable to Rate
export const priceAsRate: Rate = asPrice(1n);
// @ts-expect-error Rate is not assignable to Money
export const rateAsMoney: Money = asRate(1n);
// @ts-expect-error Money is not assignable to Tick
export const moneyAsTick: Tick = asMoney(1n);
// @ts-expect-error Tick is not assignable to Money
export const tickAsMoney: Money = asTick(0);
// @ts-expect-error Tick is not assignable to Quantity
export const tickAsQuantity: Quantity = asTick(0);
// @ts-expect-error Tick is not assignable to Price
export const tickAsPrice: Price = asTick(0);
// @ts-expect-error Tick is not assignable to Rate
export const tickAsRate: Rate = asTick(0);
