/**
 * Currency utilities using dinero.js for all monetary operations.
 * ALL money in the database is stored as integers (smallest unit, e.g. cents).
 * Never use floating-point arithmetic for money.
 */

import { dinero, add, subtract, multiply, toDecimal, toSnapshot } from "dinero.js";
import type { Dinero } from "dinero.js";
import * as currencies from "@dinero.js/currencies";

type CurrencyCode = keyof typeof currencies;

/**
 * Get a dinero.js currency object by ISO 4217 code.
 */
export function getCurrency(code: string) {
  const currency = currencies[code as CurrencyCode];
  if (!currency) throw new Error(`Unknown currency code: ${code}`);
  return currency;
}

/**
 * Create a Dinero object from a stored integer amount + currency code.
 * e.g. toDinero(1250, "USD") → $12.50
 */
export function toDinero(amount: number, currencyCode: string): Dinero<number> {
  const currency = getCurrency(currencyCode);
  return dinero({ amount, currency });
}

/**
 * Extract the integer amount from a Dinero object for storage.
 */
export function fromDinero(d: Dinero<number>): number {
  return toSnapshot(d).amount;
}

/**
 * Format a stored integer amount as a locale currency string.
 * e.g. formatMoney(1250, "USD") → "$12.50"
 */
export function formatMoney(
  amount: number | null | undefined,
  currencyCode: string,
  locale = "en-US"
): string {
  if (amount == null) return "—";
  const decimal = toDecimal(toDinero(amount, currencyCode));
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(Number(decimal));
}

/**
 * Add two stored amounts (must be same currency).
 */
export function addAmounts(
  a: number,
  b: number,
  currencyCode: string
): number {
  return fromDinero(add(toDinero(a, currencyCode), toDinero(b, currencyCode)));
}

/**
 * Subtract b from a (must be same currency).
 */
export function subtractAmounts(
  a: number,
  b: number,
  currencyCode: string
): number {
  return fromDinero(
    subtract(toDinero(a, currencyCode), toDinero(b, currencyCode))
  );
}

/**
 * Multiply a stored amount by a scalar (e.g. quantity or rate).
 * Uses integer scaling to stay in dinero's type system.
 */
export function multiplyAmount(
  amount: number,
  currencyCode: string,
  factor: number
): number {
  return fromDinero(multiply(toDinero(amount, currencyCode), factor));
}

/**
 * Convert an amount from one currency to another using a stored exchange rate.
 * @param amount - Integer amount in source currency
 * @param fromCurrency - Source ISO 4217 code
 * @param toCurrency - Target ISO 4217 code
 * @param rate - Exchange rate: 1 fromCurrency = rate toCurrency
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): number {
  if (fromCurrency === toCurrency) return amount;
  const sourceDinero = toDinero(amount, fromCurrency);
  const decimal = Number(toDecimal(sourceDinero));
  const converted = decimal * rate;
  const targetCurrency = getCurrency(toCurrency);
  const targetAmount = Math.round(converted * Math.pow(10, targetCurrency.exponent));
  return targetAmount;
}

/**
 * Parse a decimal string (e.g. "12.50") into stored integer units.
 * e.g. "12.50" + "USD" → 1250
 */
export function parseDecimalToAmount(decimal: string, currencyCode: string): number {
  const currency = getCurrency(currencyCode);
  const parsed = parseFloat(decimal);
  if (isNaN(parsed)) throw new Error(`Invalid decimal: ${decimal}`);
  return Math.round(parsed * Math.pow(10, currency.exponent));
}
