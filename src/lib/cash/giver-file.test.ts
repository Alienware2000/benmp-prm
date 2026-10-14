import { describe, expect, it } from "vitest";
import { parseCashGiverRows } from "./giver-file";

describe("parseCashGiverRows", () => {
  it("reads the template columns", () => {
    const result = parseCashGiverRows([
      {
        Name: "Kofi Mensah",
        Phone: "0244123456",
        "Amount (GHS)": "20",
        "Receipt No": "R1",
      },
      {
        Name: "Ama Owusu",
        Phone: "",
        "Amount (GHS)": "1,050.50",
        "Receipt No": "",
      },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.givers).toEqual([
      {
        name: "Kofi Mensah",
        phone: "0244123456",
        amountMinor: 2000,
        transactionRef: "R1",
      },
      { name: "Ama Owusu", phone: "", amountMinor: 105050, transactionRef: "" },
    ]);
  });

  it("matches loose header spellings", () => {
    const result = parseCashGiverRows([
      {
        "Full Name": "Yaw Boateng",
        "Phone No.": "0201112222",
        AMOUNT: "GHS 5",
        "Receipt #": "9",
      },
    ]);
    expect(result.givers).toEqual([
      {
        name: "Yaw Boateng",
        phone: "0201112222",
        amountMinor: 500,
        transactionRef: "9",
      },
    ]);
  });

  it("skips blank lines and a trailing total line", () => {
    const result = parseCashGiverRows([
      { Name: "Kofi Mensah", Phone: "", Amount: "20" },
      { Name: "", Phone: "", Amount: "" },
      { Name: "TOTAL", Phone: "", Amount: "20" },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.givers).toHaveLength(1);
  });

  it("reports bad rows by spreadsheet row number", () => {
    const result = parseCashGiverRows([
      { Name: "Kofi Mensah", Amount: "20" },
      { Name: "Ama Owusu", Amount: "abc" },
      { Name: "A", Amount: "5" },
    ]);
    expect(result.givers).toHaveLength(1);
    expect(result.errors).toEqual([
      'Row 3: amount "abc" is not a valid amount above zero.',
      "Row 4: needs a name or a phone number.",
    ]);
  });

  it("rejects a sheet without an amount column", () => {
    const result = parseCashGiverRows([{ Name: "Kofi", Phone: "0244123456" }]);
    expect(result.givers).toEqual([]);
    expect(result.errors[0]).toMatch(/No amount column/);
  });

  it("rejects an empty sheet", () => {
    expect(parseCashGiverRows([]).errors).toEqual([
      "The file has no giver rows.",
    ]);
  });
});
