import { describe, it, expect } from "vitest";
import {
  getCurrency,
  toDinero,
  fromDinero,
  formatMoney,
  addAmounts,
  subtractAmounts,
  multiplyAmount,
  convertCurrency,
  parseDecimalToAmount,
} from "@/lib/currency";

describe("getCurrency", () => {
  it("returns currency object for valid code", () => {
    const usd = getCurrency("USD");
    expect(usd).toBeDefined();
    expect(usd.exponent).toBe(2);
  });

  it("throws for unknown currency code", () => {
    expect(() => getCurrency("XYZ")).toThrow("Unknown currency code: XYZ");
  });
});

describe("toDinero / fromDinero", () => {
  it("round-trips integer amount correctly", () => {
    const d = toDinero(1250, "USD");
    expect(fromDinero(d)).toBe(1250);
  });

  it("round-trips zero", () => {
    expect(fromDinero(toDinero(0, "USD"))).toBe(0);
  });

  it("round-trips large amount", () => {
    expect(fromDinero(toDinero(9999999, "USD"))).toBe(9999999);
  });
});

describe("formatMoney", () => {
  it("formats USD cents as dollar string", () => {
    expect(formatMoney(1250, "USD")).toBe("$12.50");
  });

  it("formats zero correctly", () => {
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("returns em dash for null", () => {
    expect(formatMoney(null, "USD")).toBe("—");
  });

  it("returns em dash for undefined", () => {
    expect(formatMoney(undefined, "USD")).toBe("—");
  });

  it("formats EUR correctly", () => {
    const result = formatMoney(1000, "EUR", "de-DE");
    // German locale: 10,00 €
    expect(result).toContain("10");
    expect(result).toContain("€");
  });
});

describe("addAmounts", () => {
  it("100 + 200 = 300", () => {
    expect(addAmounts(100, 200, "USD")).toBe(300);
  });

  it("0 + 0 = 0", () => {
    expect(addAmounts(0, 0, "USD")).toBe(0);
  });

  it("large amounts", () => {
    expect(addAmounts(500000, 250000, "USD")).toBe(750000);
  });
});

describe("subtractAmounts", () => {
  it("500 - 200 = 300", () => {
    expect(subtractAmounts(500, 200, "USD")).toBe(300);
  });

  it("0 - 0 = 0", () => {
    expect(subtractAmounts(0, 0, "USD")).toBe(0);
  });
});

describe("multiplyAmount", () => {
  it("100 × 3 = 300", () => {
    expect(multiplyAmount(100, "USD", 3)).toBe(300);
  });

  it("0 × 10 = 0", () => {
    expect(multiplyAmount(0, "USD", 10)).toBe(0);
  });

  it("1000 × 1 = 1000", () => {
    expect(multiplyAmount(1000, "USD", 1)).toBe(1000);
  });
});

describe("convertCurrency", () => {
  it("same currency returns amount unchanged", () => {
    expect(convertCurrency(500, "USD", "USD", 1.0)).toBe(500);
  });

  it("100 USD at 0.85 rate → 85 EUR cents", () => {
    // 100 cents = $1.00 USD; × 0.85 = €0.85 = 85 EUR cents
    expect(convertCurrency(100, "USD", "EUR", 0.85)).toBe(85);
  });

  it("1000 USD at 1.1 rate → 1100 EUR cents", () => {
    expect(convertCurrency(1000, "USD", "EUR", 1.1)).toBe(1100);
  });
});

describe("parseDecimalToAmount", () => {
  it('"12.50" + USD → 1250 cents', () => {
    expect(parseDecimalToAmount("12.50", "USD")).toBe(1250);
  });

  it('"0.01" + USD → 1 cent', () => {
    expect(parseDecimalToAmount("0.01", "USD")).toBe(1);
  });

  it('"100" + USD → 10000 cents', () => {
    expect(parseDecimalToAmount("100", "USD")).toBe(10000);
  });

  it("throws on non-numeric string", () => {
    expect(() => parseDecimalToAmount("abc", "USD")).toThrow("Invalid decimal: abc");
  });
});
