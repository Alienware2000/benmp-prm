import { describe, expect, it } from "vitest";
import {
  buildPaymentRows,
  extractEcobankPayerName,
  isPaidInMonth,
  matchNormalizedRows,
  normalizePartnerName,
  parseEcobankRows,
  parseMomoRows,
  parseJsonArray,
  parseJsonObject,
  type PartnerForPaymentMatch,
} from "./payment-upload";

const partners: PartnerForPaymentMatch[] = [
  {
    id: "peter-id",
    fullName: "Apostle Peter Nsowah",
    momoPhoneNumber: "+233244123456",
    whatsappNumber: "+233244123456",
    church: "Qodesh",
    country: "Ghana",
  },
  {
    id: "ama-id",
    fullName: "Dr. Ama Serwaa Mensah",
    momoPhoneNumber: null,
    whatsappNumber: "+233201111111",
    church: "Qodesh",
    country: "Ghana",
  },
  {
    id: "ama-dup-id",
    fullName: "Ama Serwaa Mensah",
    momoPhoneNumber: null,
    whatsappNumber: "+233202222222",
    church: "Qodesh",
    country: "Ghana",
  },
];

describe("payment upload parsers", () => {
  it("parses successful MoMo rows with From account as the primary payer key", () => {
    const result = parseMomoRows([
      {
        Id: "1001",
        Date: "2026-09-03 10:12:00",
        Status: "Successful",
        Type: "Transfer",
        From: "FRI:233244123456/MSISDN",
        "From account": "0244123456",
        "From name": "APOSTLE PETER NSOWAH APOSTLE PETER NSOWAH",
        "To message": "BENMP",
        Amount: "50.00",
        Balance: "1,000.00",
      },
      {
        Id: "1002",
        Date: "2026-09-03 10:13:00",
        Status: "Failed",
        "From account": "0244000000",
        "From name": "Failed Person",
        Amount: "20.00",
      },
    ]);

    expect(result.rejects).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      source: "momo",
      sourceRowId: "1001",
      transactionDate: "2026-09-03T10:12:00.000Z",
      amountMinor: 5000,
      currency: "GHS",
      payerName: "APOSTLE PETER NSOWAH",
      payerPhoneOrAccount: "+233244123456",
      providerReference: "1001",
    });
  });

  it("falls back to From account when the MoMo From column has no phone", () => {
    const result = parseMomoRows([
      {
        Id: "1003",
        Date: "2026-09-03 10:12:00",
        Status: "Successful",
        From: "",
        "From account": "0244123456",
        "From name": "Apostle Peter Nsowah",
        Amount: "50.00",
      },
    ]);

    expect(result.rows[0].payerPhoneOrAccount).toBe("+233244123456");
  });

  it("uses the MoMo From MSISDN before the shorter From account id", () => {
    const result = parseMomoRows([
      {
        Id: "1004",
        Date: "2026-09-03 10:12:00",
        Status: "Successful",
        From: "FRI:233244123456/MSISDN",
        "From account": "12345678",
        "From name": "Apostle Peter Nsowah",
        Amount: "50.00",
      },
    ]);

    expect(result.rows[0].payerPhoneOrAccount).toBe("+233244123456");
  });

  it("parses Ecobank credit rows and ignores debit rows", () => {
    const result = parseEcobankRows([
      {
        Account: "1441000220876",
        "Account Currency": "GHS",
        Narration:
          "H21SIP1191790813//5689313843//STANDING ORDER TRANSFER IFO HEALING JESUS CRUSADE B/O DR. JOSEPH ATO QUANSAH, STANDING ORDER",
        VALUE_DATE: "03-AUG-26",
        POSTING_DATE: "03-AUG-26",
        Credit: "25.00",
        Debit: "",
        "Sr. No.": "3",
      },
      {
        Account: "1441000220876",
        "Account Currency": "GHS",
        Narration: "BANK CHARGE",
        VALUE_DATE: "03-AUG-26",
        POSTING_DATE: "03-AUG-26",
        Credit: "",
        Debit: "10.00",
        "Sr. No.": "4",
      },
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      source: "ecobank",
      transactionDate: "2026-08-03T00:00:00.000Z",
      amountMinor: 2500,
      currency: "GHS",
      payerName: "DR. JOSEPH ATO QUANSAH",
      payerPhoneOrAccount: null,
    });
    expect(result.rows[0].sourceRowId).toContain("1441000220876:3:2026-08-03");
  });

  it("extracts payer names from common Ecobank narration patterns", () => {
    expect(
      extractEcobankPayerName(
        "H43CHDP262150021//5691834493//CASH DEPOSITED-CASH DEPOSIT BY AUGUSTINE AYIMBILLAH",
      ),
    ).toBe("AUGUSTINE AYIMBILLAH");
    expect(extractEcobankPayerName("H01//123//STO BO KWABENA APPIAH-DENKYIRA")).toBe(
      "KWABENA APPIAH-DENKYIRA",
    );
  });
});

describe("payment upload matching", () => {
  it("ignores ministry titles when normalizing partner names", () => {
    expect(normalizePartnerName("Bishop Dr. Ama Serwaa Mensah")).toBe(
      normalizePartnerName("ama serwaa mensah"),
    );
  });

  it("auto-matches by exact normalized phone before name", () => {
    const [match] = matchNormalizedRows(
      [
        {
          source: "momo",
          sourceRowId: "row-1",
          transactionDate: "2026-09-03T00:00:00.000Z",
          amountMinor: 5000,
          currency: "GHS",
          payerName: "Wrong Name",
          payerPhoneOrAccount: "+233244123456",
          providerReference: "row-1",
          rawRow: {},
        },
      ],
      partners,
    );

    expect(match.status).toBe("auto");
    expect(match.partner?.id).toBe("peter-id");
    expect(match.reason).toBe("Exact phone match");
  });

  it("auto-matches Ghana phone numbers by the last 9 digits across country-code formats", () => {
    const [match] = matchNormalizedRows(
      [
        {
          source: "momo",
          sourceRowId: "row-1",
          transactionDate: "2026-09-03T00:00:00.000Z",
          amountMinor: 5000,
          currency: "GHS",
          payerName: "Different Display Name",
          payerPhoneOrAccount: "FRI:233244123456/MSISDN",
          providerReference: "row-1",
          rawRow: {},
        },
      ],
      [
        {
          id: "local-id",
          fullName: "Stored Partner",
          momoPhoneNumber: "0244123456",
          whatsappNumber: null,
          church: null,
          country: "Ghana",
        },
      ],
    );

    expect(match.status).toBe("auto");
    expect(match.partner?.id).toBe("local-id");
    expect(match.reason).toBe("Exact phone match");
  });

  it("auto-matches unique first-and-last names when middle names differ", () => {
    const [match] = matchNormalizedRows(
      [
        {
          source: "ecobank",
          sourceRowId: "row-1",
          transactionDate: "2026-09-03T00:00:00.000Z",
          amountMinor: 5000,
          currency: "GHS",
          payerName: "BISHOP JOHN KWAME MENSAH",
          payerPhoneOrAccount: null,
          providerReference: "row-1",
          rawRow: {},
        },
      ],
      [
        {
          id: "john-id",
          fullName: "Rev John Mensah",
          momoPhoneNumber: null,
          whatsappNumber: null,
          church: null,
          country: "Ghana",
        },
      ],
    );

    expect(match.status).toBe("auto");
    expect(match.partner?.id).toBe("john-id");
    expect(match.reason).toBe("Unique first-last name match");
  });

  it("auto-matches exact normalized names only when unique", () => {
    const [unique, duplicate] = matchNormalizedRows(
      [
        {
          source: "ecobank",
          sourceRowId: "row-1",
          transactionDate: "2026-09-03T00:00:00.000Z",
          amountMinor: 5000,
          currency: "GHS",
          payerName: "Apostle Peter Nsowah",
          payerPhoneOrAccount: null,
          providerReference: "row-1",
          rawRow: {},
        },
        {
          source: "ecobank",
          sourceRowId: "row-2",
          transactionDate: "2026-09-03T00:00:00.000Z",
          amountMinor: 5000,
          currency: "GHS",
          payerName: "Mrs Ama Serwaa Mensah",
          payerPhoneOrAccount: null,
          providerReference: "row-2",
          rawRow: {},
        },
      ],
      partners,
    );

    expect(unique.status).toBe("auto");
    expect(unique.partner?.id).toBe("peter-id");
    expect(duplicate.status).toBe("review");
    expect(duplicate.candidates.map((c) => c.id).sort()).toEqual([
      "ama-dup-id",
      "ama-id",
    ]);
  });
});

describe("payment upload persistence mapping", () => {
  it("builds POC payment rows with matched partner phone for name-only bank matches", () => {
    const rows = buildPaymentRows([
      {
        row: {
          source: "ecobank",
          sourceRowId: "bank-1",
          transactionDate: "2026-09-04T00:00:00.000Z",
          amountMinor: 5000,
          currency: "GHS",
          payerName: "Apostle Peter Nsowah",
          payerPhoneOrAccount: null,
          providerReference: "bank-1",
          rawRow: { Credit: "50.00" },
        },
        partner: partners[0],
      },
    ]);

    expect(rows).toEqual([
      {
        reference: "ecobank:bank-1",
        paid_at: "2026-09-04T00:00:00.000Z",
        status: "Successful",
        payer_name: "Apostle Peter Nsowah",
        payer_phone_e164: "+233244123456",
        amount_minor: 5000,
        currency: "GHS",
        raw_row: { Credit: "50.00", matched_partner_id: "peter-id", source: "ecobank" },
      },
    ]);
  });

  it("marks a partner paid when any contribution exists in the selected month", () => {
    expect(
      isPaidInMonth(
        [
          { partnerId: "p1", paidAt: "2026-09-01T00:00:00.000Z" },
          { partnerId: "p2", paidAt: "2026-08-31T23:59:59.000Z" },
        ],
        "p1",
        "2026-09",
      ),
    ).toBe(true);
    expect(
      isPaidInMonth(
        [{ partnerId: "p2", paidAt: "2026-08-31T23:59:59.000Z" }],
        "p2",
        "2026-09",
      ),
    ).toBe(false);
  });
});

describe("payment upload JSON helpers", () => {
  it("treats blank JSON array input as empty instead of throwing", () => {
    expect(parseJsonArray("")).toEqual([]);
    expect(parseJsonArray(null)).toEqual([]);
  });

  it("treats blank JSON object input as empty instead of throwing", () => {
    expect(parseJsonObject("")).toEqual({});
    expect(parseJsonObject(null)).toEqual({});
  });
});
