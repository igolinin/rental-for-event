import { describe, it, expect } from "vitest";
import { parseCSV, toCSV, missingFields } from "@/lib/csv";

describe("parseCSV", () => {
  it("parses a simple CSV into row objects", () => {
    const csv = "name,qty\nCable,10\nLight,5";
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      { name: "Cable", qty: "10" },
      { name: "Light", qty: "5" },
    ]);
  });

  it("trims header and cell whitespace", () => {
    const csv = " name , qty \n  Cable  ,  10  ";
    const rows = parseCSV(csv);
    expect(rows[0]).toEqual({ name: "Cable", qty: "10" });
  });

  it("skips empty lines", () => {
    const csv = "name\nCable\n\n\nLight";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });

  it("returns empty array for header-only CSV", () => {
    expect(parseCSV("name,qty")).toEqual([]);
  });

  it("handles quoted values with commas", () => {
    const csv = 'name,description\nCable,"Long, flexible cable"';
    const rows = parseCSV(csv);
    expect(rows[0].description).toBe("Long, flexible cable");
  });
});

describe("toCSV", () => {
  it("serializes rows with a header order", () => {
    const rows = [
      { name: "Cable", qty: 10 },
      { name: "Light", qty: 5 },
    ];
    const csv = toCSV(rows, ["name", "qty"]);
    expect(csv).toContain("name,qty");
    expect(csv).toContain("Cable,10");
    expect(csv).toContain("Light,5");
  });

  it("fills missing fields with empty string", () => {
    const rows = [{ name: "Cable" }];
    const csv = toCSV(rows, ["name", "qty"]);
    const lines = csv.split(/\r?\n/);
    expect(lines[1]).toBe("Cable,");
  });

  it("round-trips through parseCSV", () => {
    const rows = [{ name: "Item A", qty: "3" }];
    const csv = toCSV(rows, ["name", "qty"]);
    expect(parseCSV(csv)).toEqual(rows);
  });

  it("quotes values containing commas", () => {
    const rows = [{ name: "A, B", qty: "1" }];
    const csv = toCSV(rows, ["name", "qty"]);
    expect(csv).toContain('"A, B"');
  });
});

describe("missingFields", () => {
  it("returns missing required fields", () => {
    const row = { name: "Cable", category: "" };
    expect(missingFields(row, ["name", "category", "trackingMode"])).toEqual([
      "category",
      "trackingMode",
    ]);
  });

  it("returns empty array when all present", () => {
    const row = { name: "Cable", category: "Audio" };
    expect(missingFields(row, ["name", "category"])).toEqual([]);
  });

  it("treats whitespace-only as missing", () => {
    const row = { name: "   " };
    expect(missingFields(row, ["name"])).toEqual(["name"]);
  });
});
