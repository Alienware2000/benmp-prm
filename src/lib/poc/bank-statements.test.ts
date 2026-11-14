import { describe, expect, it } from "vitest";
import type { PdfLine } from "../pdf-lines";
import {
  fidelityPayerName,
  parseFidelityPdf,
  parseMomoWalletGrid,
  parseStanbicPdf,
  parseStanbicSheet,
  parseStatementDate,
  parseZenithPdf,
  phoneInText,
  stanbicPayerName,
  zenithPayerName,
} from "./bank-statements";

/** A PDF line from [x, text] pairs; width ≈ 5pt per character. */
function line(
  page: number,
  y: number,
  ...cells: Array<[number, string]>
): PdfLine {
  const fragments = cells.map(([x, text]) => ({
    x,
    right: x + text.length * 5,
    text,
  }));
  return {
    page,
    y,
    fragments,
    text: fragments.map((fragment) => fragment.text).join(" "),
  };
}

describe("parseStatementDate", () => {
  it("reads the bank date shapes", () => {
    expect(parseStatementDate("05-10-2026")).toBe("2026-10-05T00:00:00.000Z");
    expect(parseStatementDate("05/10/2026")).toBe("2026-10-05T00:00:00.000Z");
    expect(parseStatementDate("04-Aug-2026")).toBe("2026-08-04T00:00:00.000Z");
    expect(parseStatementDate("05-Oct-2026 01:55:34 PM")).toBe(
      "2026-10-05T13:55:34.000Z",
    );
    expect(parseStatementDate("not a date")).toBeNull();
  });
});

describe("payer names", () => {
  it("Stanbic: standing orders, cash deposits, phones, HJC prefix", () => {
    expect(
      stanbicPayerName("SI BO AMA KOFI MENSAH SI BO AMA KOFI MENSAH"),
    ).toBe("AMA KOFI MENSAH");
    expect(stanbicPayerName("BO YAW BOATENG SI BO YAW BOATENG")).toBe(
      "YAW BOATENG",
    );
    expect(
      stanbicPayerName("CASH DEPOSIT KOFI ASANTE 0541234567 X11X111 DEPSL : 1"),
    ).toBe("KOFI ASANTE");
    expect(stanbicPayerName("ESI 233241234567 XX11X1X")).toBe("ESI");
    expect(stanbicPayerName("HJC ABENA NYARKO")).toBe("ABENA NYARKO");
  });

  it("Zenith: transfer wording, slash accounts, C2B, account-only rows", () => {
    expect(zenithPayerName("Recurring - TRF FROM AKUA DOE")).toBe("AKUA DOE");
    expect(zenithPayerName("Recurring - TFR FROM KWAME OSEI")).toBe(
      "KWAME OSEI",
    );
    expect(zenithPayerName("Recurring - ESI NUNOO/6020600000")).toBe(
      "ESI NUNOO",
    );
    expect(
      zenithPayerName("C2B- 016ACME TRADING 026HEALING JESUS CA 965900000000"),
    ).toBe("ACME TRADING");
    expect(zenithPayerName("Recurring - S/O TRF FRM 9061100000")).toBeNull();
  });

  it("Fidelity: the debit account holder beats the typed B/O name", () => {
    expect(
      fidelityPayerName(
        "SI B/O AMA IFO HEALING JESUS CRUSADE Credit Ac.=105 (LCI) Debit Ac.=1060000000001 (AMA SERWAA BOATENG)",
      ),
    ).toBe("AMA SERWAA BOATENG");
    expect(fidelityPayerName("STANDING ORDER B/O KOJO ANAN IFO HJC")).toBe(
      "KOJO ANAN",
    );
  });

  it("finds Ghana phones in free text", () => {
    expect(phoneInText("CASH DEPOSIT KOFI 0541234567 X")).toBe("+233541234567");
    expect(phoneInText("ESI 233241234567 AA")).toBe("+233241234567");
    expect(phoneInText("ACCOUNT 1060000000001")).toBeNull();
  });
});

describe("parseZenithPdf", () => {
  const header = [
    line(1, 641, [38, "Account Name: HEALING JESUS CAMPAIGN (HJC)"]),
    line(1, 622, [38, "Account No:"], [106, "6010000000"]),
    line(
      1,
      588,
      [54, "DATE"],
      [98, "PARTICULARS"],
      [320, "DEBIT"],
      [365, "CREDIT"],
      [407, "VALUE DATE"],
      [479, "BALANCE"],
    ),
    line(
      1,
      573,
      [98, "OPENING BALANCE"],
      [411, "01/10/2026"],
      [471, "1,000.00"],
    ),
  ];

  it("joins particulars wrapped above the dated line, drops debits, checks TOTALS", () => {
    const result = parseZenithPdf([
      ...header,
      line(
        1,
        559,
        [40, "01/10/2026 Recurring - TRF FROM AKUA DOE"],
        [373, "50.00"],
        [411, "01/10/2026"],
        [471, "1,050.00"],
      ),
      line(1, 385, [98, "Recurring - TRF FRM DREAMS & VISION"]),
      line(
        1,
        370,
        [40, "27/10/2026"],
        [98, "BOOKSHOP"],
        [359, "1,000.00"],
        [411, "27/10/2026"],
        [471, "2,050.00"],
      ),
      line(
        1,
        167,
        [40, "28/10/2026 CIB-MaintenanceFee-October2026"],
        [321, "50.00"],
        [411, "28/10/2026"],
        [471, "2,000.00"],
      ),
      line(
        1,
        138,
        [98, "TOTALS"],
        [321, "50.00"],
        [353, "1,050.00"],
        [471, "2,000.00"],
      ),
    ]);
    expect(result.rows.map((row) => [row.amountMinor, row.payerName])).toEqual([
      [5000, "AKUA DOE"],
      [100000, "DREAMS & VISION BOOKSHOP"],
    ]);
    expect(result.rows[0].source).toBe("zenith");
    expect(result.rows[0].providerReference).toBe(
      "6010000000:2026-10-01:5000:Recurring - TRF FROM AKUA DOE",
    );
    expect(result.skipped).toHaveLength(1);
    expect(result.warnings).toBeUndefined();
  });

  it("rejects the file when a row doesn't explain the balance", () => {
    expect(() =>
      parseZenithPdf([
        ...header,
        line(
          1,
          559,
          [40, "01/10/2026 Recurring - TRF FROM AKUA DOE"],
          [373, "50.00"],
          [411, "01/10/2026"],
          [471, "1,060.00"],
        ),
      ]),
    ).toThrow(/running balance/);
  });

  it("warns when the printed credit total differs", () => {
    const result = parseZenithPdf([
      ...header,
      line(
        1,
        559,
        [40, "01/10/2026 Recurring - TRF FROM AKUA DOE"],
        [373, "50.00"],
        [411, "01/10/2026"],
        [471, "1,050.00"],
      ),
      line(
        1,
        138,
        [98, "TOTALS"],
        [321, "0.00"],
        [353, "60.00"],
        [471, "1,050.00"],
      ),
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.warnings?.[0]).toMatch(/credit total is 60.00/);
  });

  it("explains a missing text layer", () => {
    expect(() => parseZenithPdf([])).toThrow(/no text layer/);
  });
});

describe("parseFidelityPdf", () => {
  it("groups wrapped blocks, follows a block over a page break and ignores the footer", () => {
    const result = parseFidelityPdf([
      line(1, 644, [419, "1050000000000"]),
      line(1, 611, [313, "OPENING BALANCE:"], [417, "100.00"]),
      line(1, 594, [314, "CLOSING BALANCE:"], [417, "130.00"]),
      line(
        1,
        526,
        [41, "DATE"],
        [145, "DESCRIPTION"],
        [276, "VALUE DATE"],
        [368, "DEBIT"],
        [440, "CREDIT"],
        [514, "BALANCE"],
      ),
      // Block 1: description above and below the amounts line.
      line(1, 464, [88, "HAATSO BRANCH: STANDING"]),
      line(1, 453, [88, "INSTRUCTION ( PAYMENT ); SI B/O AMA"]),
      line(1, 426, [23, "04-Aug-2026"]),
      line(
        1,
        420,
        [88, "HEALING JESUS CRUSADE"],
        [278, "03-Aug-2026"],
        [407, "--"],
        [462, "10.00"],
        [535, "110.00"],
      ),
      line(1, 411, [88, "Credit Ac.=1050000000000 (LCI)"]),
      line(1, 401, [88, "Debit Ac.=1060000000001 (AMA SERWAA"]),
      line(1, 391, [88, "BOATENG)"]),
      // Block 2 starts at the bottom of page 1 and finishes on page 2.
      line(1, 103, [88, "OSU BRANCH:"]),
      line(
        1,
        94,
        [23, "31-Aug-2026"],
        [88, "STANDING INSTRUCTION ( PAYMENT );"],
      ),
      line(
        1,
        88,
        [278, "28-Aug-2026"],
        [407, "--"],
        [467, "20.00"],
        [535, "130.00"],
      ),
      line(1, 50, [
        27,
        "Fidelity Bank Ghana Ltd is a member of the Ghana Deposit Protection Scheme.",
      ]),
      line(1, 23, [290, "1"]),
      line(2, 791, [88, "C) Debit Ac.=1090000000002 (KOFI"]),
      line(2, 781, [88, "MENSAH)"]),
    ]);
    expect(
      result.rows.map((row) => [
        row.transactionDate.slice(0, 10),
        row.amountMinor,
        row.payerName,
      ]),
    ).toEqual([
      ["2026-08-04", 1000, "AMA SERWAA BOATENG"],
      ["2026-08-31", 2000, "KOFI MENSAH"],
    ]);
    expect(result.rows[0].payerPhoneOrAccount).toBeNull();
  });

  it("refuses a statement that doesn't end on its closing balance", () => {
    expect(() =>
      parseFidelityPdf([
        line(1, 611, [313, "OPENING BALANCE:"], [417, "100.00"]),
        line(1, 594, [314, "CLOSING BALANCE:"], [417, "999.00"]),
        line(
          1,
          526,
          [41, "DATE"],
          [145, "DESCRIPTION"],
          [276, "VALUE DATE"],
          [368, "DEBIT"],
          [440, "CREDIT"],
          [514, "BALANCE"],
        ),
        line(
          1,
          420,
          [23, "04-Aug-2026"],
          [88, "B/O AMA"],
          [278, "03-Aug-2026"],
          [407, "--"],
          [462, "10.00"],
          [535, "110.00"],
        ),
      ]),
    ).toThrow(/closing balance/);
  });
});

describe("parseStanbicPdf", () => {
  it("takes the depositor from the line under the transaction and its phone", () => {
    const result = parseStanbicPdf([
      line(1, 470, [342, "Account Number : 9040000000000"]),
      line(
        1,
        410,
        [162, "Transaction Description"],
        [308, "Fee"],
        [361, "Debits"],
        [431, "Credits"],
        [508, "Balance"],
      ),
      line(1, 392, [129, "STATEMENT OPENING BALANCE"], [530, "4,080.17"]),
      line(
        1,
        374,
        [33, "16-10-2026"],
        [81, "16-10-2026"],
        [129, "CASH DEPOSIT"],
        [454, "390.00"],
        [530, "4,470.17"],
      ),
      line(1, 364, [129, "KOFI ASANTE 0541234567"], [314, "5.00#"]),
      line(1, 355, [129, "11X111X"]),
      line(
        1,
        337,
        [33, "31-10-2026"],
        [81, "31-10-2026"],
        [129, "SERVICE FEE"],
        [375, "99.99"],
        [530, "4,370.18"],
      ),
      line(
        2,
        100,
        [300, "Overdraft limit 0"],
        [450, "Credits"],
        [500, "390.00"],
      ),
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      source: "stanbic",
      amountMinor: 39000,
      payerName: "KOFI ASANTE",
      payerPhoneOrAccount: "+233541234567",
    });
    expect(result.skipped).toHaveLength(1);
    expect(result.warnings).toBeUndefined();
  });
});

describe("parseStanbicSheet", () => {
  const grid = [
    ["BANK STATEMENT / TAX INVOICE", "", "", "", "", "", "", ""],
    [
      "Account Name",
      "HEALING JESUS CRUSADE",
      "Account Number",
      "9040000000001",
      "",
      "",
      "",
      "",
    ],
    [
      "Transaction Date",
      "Value Date",
      "Transaction Description",
      "Fee",
      "Debits",
      "Credits",
      "Balance",
      "Page",
    ],
    ["", "", "STATEMENT OPENING BALANCE", "", "", "", "", "1"],
    [
      "01-10-2026",
      "01-10-2026",
      "ESI 233241234567 XX11X1X",
      "5.4",
      "",
      "3000",
      "3500",
      "1",
    ],
    [
      "02-10-2026",
      "02-10-2026",
      "SI BO AMA MENSAH SI BO AMA MENSAH",
      "",
      "",
      "100",
      "3600",
      "1",
    ],
    [
      "08-10-2026",
      "08-10-2026",
      "TRANSFER TRANSACTION IFO HEALING JESUS CAMPAIGN",
      "",
      "500",
      "",
      "3100",
      "1",
    ],
    ["", "", "BALANCE AS AT 31-10-2026", "", "", "", "3100", "2"],
    ["Summary of Transactions", "", "", "", "", "", "", ""],
    ["Credits", "3200", "", "", "", "", "", ""],
  ];

  it("finds the header under the account block and keeps credits only", () => {
    const result = parseStanbicSheet(grid);
    expect(
      result.rows.map((row) => [
        row.amountMinor,
        row.payerName,
        row.payerPhoneOrAccount,
      ]),
    ).toEqual([
      [300000, "ESI", "+233241234567"],
      [10000, "AMA MENSAH", null],
    ]);
    expect(result.skipped).toHaveLength(1);
  });

  it("warns (not fails) when the printed summary differs from the lines", () => {
    expect(parseStanbicSheet(grid).warnings?.[0]).toMatch(
      /credit total is 3200.00 but its transaction lines add up to 3100.00/,
    );
  });
});

describe("parseMomoWalletGrid", () => {
  it("reads the headerless single-wallet export and checks the balance change", () => {
    const result = parseMomoWalletGrid([
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      [
        "05-Oct-2026 01:55:34 AM",
        "68400000",
        "KOFI ASANTE",
        "233591234567",
        "TRANSFER",
        "100",
        "1",
        "36281.41",
        "36381.41",
        "233540000000",
        "HEALING JESUS CRUSADE",
        "69100000",
        "90860000000",
        "11",
        "Internal",
      ],
      [
        "06-Oct-2026 09:00:00 AM",
        "68400001",
        "AMA MENSAH",
        "233591234568",
        "TRANSFER",
        "50",
        "1",
        "100.00",
        "120.00",
        "233540000000",
        "HEALING JESUS CRUSADE",
        "69100001",
        "90860000001",
        "11",
        "Internal",
      ],
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      source: "momo",
      providerReference: "90860000000",
      amountMinor: 10000,
      payerName: "KOFI ASANTE",
      payerPhoneOrAccount: "+233591234567",
    });
    expect(result.rejects[0].reason).toMatch(/balance change/);
  });
});
