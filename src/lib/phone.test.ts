import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  normalizePhoneForCallingCode,
  normalizeWhatsappPhone,
  samePhone,
  whatsappFormatHint,
} from "./phone";

describe("normalizePhone (Ghana-first)", () => {
  it("normalizes the leading-zero national form", () => {
    expect(normalizePhone("0244123456")).toBe("+233244123456");
  });

  it("keeps an already-international number", () => {
    expect(normalizePhone("+233 24 412 3456")).toBe("+233244123456");
  });

  it("adds the + to a country-code number without one", () => {
    expect(normalizePhone("233244123456")).toBe("+233244123456");
  });

  it("expands a bare 9-digit national significant number", () => {
    expect(normalizePhone("244123456")).toBe("+233244123456");
  });

  it("strips spaces, dashes and parentheses", () => {
    expect(normalizePhone("024-412 3456")).toBe("+233244123456");
  });

  it("returns null for empty or unusable input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("02441234")).toBeNull();
    expect(normalizePhone("024412345")).toBeNull();
  });

  it("accepts international numbers when defaultCountry is null", () => {
    expect(normalizePhone("+1 214 555 0144", null)).toBe("+12145550144");
    expect(normalizePhone("12145550144", null)).toBe("+12145550144");
    expect(normalizePhone("12345", null)).toBeNull();
  });
});

describe("samePhone", () => {
  it("matches across formats", () => {
    expect(samePhone("0244123456", "+233 244 123 456")).toBe(true);
  });

  it("does not match different numbers", () => {
    expect(samePhone("0244123456", "0201112222")).toBe(false);
  });

  it("is false when either side is unusable", () => {
    expect(samePhone("0244123456", null)).toBe(false);
    expect(samePhone("junk", "junk")).toBe(false);
  });
});

describe("normalizePhoneForCallingCode", () => {
  it("accepts the calling code already present, no leading +", () => {
    expect(normalizePhoneForCallingCode("26772973310", "267", [8])).toBe(
      "+26772973310",
    );
  });

  it("prepends the calling code to a bare national number", () => {
    expect(normalizePhoneForCallingCode("74889395", "267", [8])).toBe(
      "+26774889395",
    );
  });

  it("drops a national trunk-prefix 0 and prepends the calling code", () => {
    expect(normalizePhoneForCallingCode("07908526045", "44", [10])).toBe(
      "+447908526045",
    );
  });

  it("keeps an explicit + regardless of the given calling code", () => {
    expect(normalizePhoneForCallingCode("+233 26 060 1010", "225", [8])).toBe(
      "+233260601010",
    );
  });

  it("strips spaces and punctuation before matching", () => {
    expect(normalizePhoneForCallingCode("267 76 624 395", "267", [8])).toBe(
      "+26776624395",
    );
  });

  it("accepts any NSN length in the allowed set", () => {
    expect(normalizePhoneForCallingCode("24162182610", "241", [7, 8])).toBe(
      "+24162182610",
    );
    expect(normalizePhoneForCallingCode("6200326", "241", [7, 8])).toBe(
      "+2416200326",
    );
  });

  it("rejects a digit count that matches no recognized shape rather than guessing", () => {
    expect(
      normalizePhoneForCallingCode("12683017872611", "1", [10]),
    ).toBeNull();
    expect(normalizePhoneForCallingCode("N/A", "267", [8])).toBeNull();
    expect(normalizePhoneForCallingCode("", "267", [8])).toBeNull();
    expect(normalizePhoneForCallingCode(null, "267", [8])).toBeNull();
  });
});

describe("normalizeWhatsappPhone (hubs outside Ghana, Decision 0027)", () => {
  // The Malawi admin's sheet: every shape resolves to Malawi (+265), never Ghana.
  it("reads the local trunk form as the hub's own country", () => {
    expect(normalizeWhatsappPhone("0999 123 456", "265")).toBe("+265999123456");
    expect(normalizeWhatsappPhone("0888123456", "265")).toBe("+265888123456");
  });

  it("accepts a number whose + Excel stripped", () => {
    expect(normalizeWhatsappPhone("265999123456", "265")).toBe("+265999123456");
    expect(normalizeWhatsappPhone("265 999 123 456", "265")).toBe(
      "+265999123456",
    );
  });

  it("accepts a bare national number whose leading 0 Excel dropped", () => {
    expect(normalizeWhatsappPhone("999123456", "265")).toBe("+265999123456");
  });

  it("keeps an explicit + or 00 international number from any country", () => {
    expect(normalizeWhatsappPhone("+254 735 841 428", "265")).toBe(
      "+254735841428",
    );
    expect(normalizeWhatsappPhone("00254735841428", "265")).toBe(
      "+254735841428",
    );
    expect(normalizeWhatsappPhone("+44 7911 123456", null)).toBe(
      "+447911123456",
    );
  });

  it("without a calling code, local-form numbers are rejected rather than guessed", () => {
    expect(normalizeWhatsappPhone("0999123456", null)).toBeNull();
    expect(normalizeWhatsappPhone("265999123456", null)).toBe("+265999123456");
  });

  it("rejects junk", () => {
    expect(normalizeWhatsappPhone("N/A", "265")).toBeNull();
    expect(normalizeWhatsappPhone("12345", "265")).toBeNull();
    expect(normalizeWhatsappPhone("", "265")).toBeNull();
    expect(normalizeWhatsappPhone(null, "265")).toBeNull();
  });
});

describe("WhatsApp numbers must be real numbers (Decision 0034)", () => {
  // Hubs spanning many countries (ESCHATOS Asia, Middle East, South and Central
  // America; Europe) have no country to fall back on.
  it("keeps real international numbers in every shape that carries the code", () => {
    expect(normalizeWhatsappPhone("+55 11 98765 4321", null)).toBe(
      "+5511987654321",
    );
    expect(normalizeWhatsappPhone("5511987654321", null)).toBe(
      "+5511987654321",
    );
    expect(normalizeWhatsappPhone("00971 50 123 4567", null)).toBe(
      "+971501234567",
    );
    expect(normalizeWhatsappPhone("+1 876 555 1234", null)).toBe(
      "+18765551234",
    );
    expect(normalizeWhatsappPhone("919876543210", null)).toBe("+919876543210");
  });

  it("flags a local number typed without its country code instead of saving it wrong", () => {
    expect(normalizeWhatsappPhone("(11) 98765-4321", null)).toBeNull(); // Brazil local
    expect(normalizeWhatsappPhone("876 555 1234", null)).toBeNull(); // Jamaica local
    expect(normalizeWhatsappPhone("98765 43210", null)).toBeNull(); // India local
    expect(normalizeWhatsappPhone("8888 8888", null)).toBeNull(); // Costa Rica local
    expect(normalizeWhatsappPhone("347 123 4567", null)).toBeNull(); // Italy local
    expect(normalizeWhatsappPhone("050 123 4567", null)).toBeNull(); // UAE local
  });

  it("flags a + number that is not a real number", () => {
    expect(normalizeWhatsappPhone("+11987654321", null)).toBeNull();
    expect(normalizeWhatsappPhone("+44 7700 900123", null)).toBeNull(); // Ofcom drama range
  });

  it("Brazil hubs read local numbers as Brazilian", () => {
    expect(normalizeWhatsappPhone("(11) 98765-4321", "55")).toBe(
      "+5511987654321",
    );
    expect(normalizeWhatsappPhone("011 98765 4321", "55")).toBe(
      "+5511987654321",
    );
    expect(normalizeWhatsappPhone("(11) 3456-7890", "55")).toBe(
      "+551134567890",
    );
    expect(normalizeWhatsappPhone("5511987654321", "55")).toBe(
      "+5511987654321",
    );
    expect(normalizeWhatsappPhone("+971 50 123 4567", "55")).toBe(
      "+971501234567",
    );
    expect(normalizeWhatsappPhone("98765", "55")).toBeNull();
  });

  it("Jamaica hubs read local numbers as Jamaican, never American", () => {
    expect(normalizeWhatsappPhone("876 555 1234", "1876")).toBe("+18765551234");
    expect(normalizeWhatsappPhone("1-876-555-1234", "1876")).toBe(
      "+18765551234",
    );
    expect(normalizeWhatsappPhone("18765551234", "1876")).toBe("+18765551234");
    expect(normalizeWhatsappPhone("555 1234", "1876")).toBeNull(); // no area code
  });

  it("ESCHATOS country hubs read local numbers by their own plan (Decision 0035)", () => {
    expect(normalizeWhatsappPhone("8312 3456", "506")).toBe("+50683123456"); // Costa Rica, no trunk 0
    expect(normalizeWhatsappPhone("98765 43210", "91")).toBe("+919876543210"); // India
    expect(normalizeWhatsappPhone("098765 43210", "91")).toBe("+919876543210");
    expect(normalizeWhatsappPhone("050 123 4567", "971")).toBe("+971501234567"); // UAE
    expect(normalizeWhatsappPhone("609 1234", "592")).toBe("+5926091234"); // Guyana
    expect(normalizeWhatsappPhone("0612-345678", "212")).toBe("+212612345678"); // Morocco
    expect(normalizeWhatsappPhone("123", "506")).toBeNull();
  });

  it("hubs with a generic calling code read numbers exactly as before", () => {
    expect(normalizeWhatsappPhone("0999 123 456", "265")).toBe("+265999123456");
    expect(normalizeWhatsappPhone("999123456", "265")).toBe("+265999123456");
    expect(normalizeWhatsappPhone("+254 735 841 428", "265")).toBe(
      "+254735841428",
    );
  });

  it("tells the admin how to fix a number for their kind of hub", () => {
    expect(whatsappFormatHint(null)).toContain("country code");
    expect(whatsappFormatHint("1876")).toContain("+1 876");
    expect(whatsappFormatHint("55")).toContain("+55");
    expect(whatsappFormatHint("265")).toContain("local form (0…) or +265");
  });
});
