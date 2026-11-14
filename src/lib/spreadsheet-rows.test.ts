import { describe, expect, it } from "vitest";
import { readSheetRows, rowsFromGrid } from "./spreadsheet-rows";

describe("rowsFromGrid", () => {
  it("finds the header below a title row and suffixes repeated names", () => {
    const rows = rowsFromGrid(
      [
        ["103307789_2026-10-01_2026-10-31 (1)", "", "", ""],
        ["Id", "Status", "Currency", "Currency"],
        ["91279407275", "Successful", "GHS", "USD"],
        ["", "", "", ""],
      ],
      ["Id", "Status"],
    );
    expect(rows).toEqual([
      {
        Id: "91279407275",
        Status: "Successful",
        Currency: "GHS",
        Currency_1: "USD",
      },
    ]);
  });

  it("trims header names (Ecobank's ' Account Name')", () => {
    expect(
      rowsFromGrid(
        [
          [" Account Name", "Credit "],
          ["HJC", "50"],
        ],
        ["Account Name", "Credit"],
      ),
    ).toEqual([{ "Account Name": "HJC", Credit: "50" }]);
  });

  it("names the missing columns when no header row matches", () => {
    expect(() => rowsFromGrid([["a", "b"]], ["Id", "Status"])).toThrow(
      /Id, Status/,
    );
  });
});

describe("readSheetRows with required headers", () => {
  it("reads a CSV whose header isn't the first line", () => {
    const csv = new TextEncoder().encode(
      "Exported 2026-11-01\nReference,Status,Amount Paid\nT1,success,300\n",
    );
    const buffer = csv.buffer.slice(
      csv.byteOffset,
      csv.byteOffset + csv.byteLength,
    ) as ArrayBuffer;
    expect(
      readSheetRows("paystack.csv", buffer, undefined, ["Reference", "Status"]),
    ).toEqual([{ Reference: "T1", Status: "success", "Amount Paid": "300" }]);
  });
});
