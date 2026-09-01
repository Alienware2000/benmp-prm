import { describe, expect, it } from "vitest";
import { FALLBACK_GREETING_NAME, greetingName } from "./greeting-name";

describe("greetingName", () => {
  it("takes the first name from a full name", () => {
    expect(greetingName("Samuel Yeboah")).toBe("Samuel");
  });

  it("repairs ALL CAPS — 1,549 of the archived names are shouting", () => {
    expect(greetingName("LYDIA ASANTE")).toBe("Lydia");
    expect(greetingName("KWESI")).toBe("Kwesi");
  });

  it("repairs all-lowercase too", () => {
    expect(greetingName("ama mensah")).toBe("Ama");
  });

  it("keeps hyphens and apostrophes cased correctly", () => {
    expect(greetingName("AMA-SERWAA BOATENG")).toBe("Ama-Serwaa");
    expect(greetingName("d'almeida")).toBe("D'Almeida");
  });

  it("skips a title to reach the real name", () => {
    expect(greetingName("REV. PRINCE FRIMPONG")).toBe("Prince");
    expect(greetingName("Mrs. Dadzie")).toBe("Dadzie");
    expect(greetingName("Dr Kofi")).toBe("Kofi");
  });

  it("falls back when the name is only a title", () => {
    expect(greetingName("MR.")).toBe(FALLBACK_GREETING_NAME);
  });

  it("falls back on initials — 'Dear K.' reads as broken", () => {
    expect(greetingName("K. NANA ACQUAYE")).toBe(FALLBACK_GREETING_NAME);
  });

  it("falls back on the import's placeholders and junk", () => {
    // These shapes are real: the archive carries them from a shifted spreadsheet.
    expect(greetingName("Unknown")).toBe(FALLBACK_GREETING_NAME);
    expect(greetingName("No Name")).toBe("No"); // guarded separately by isSensibleName
    expect(greetingName("FL73")).toBe(FALLBACK_GREETING_NAME);
    expect(greetingName("1.0")).toBe(FALLBACK_GREETING_NAME);
  });

  it("falls back on empty, null and undefined", () => {
    expect(greetingName("")).toBe(FALLBACK_GREETING_NAME);
    expect(greetingName("   ")).toBe(FALLBACK_GREETING_NAME);
    expect(greetingName(null)).toBe(FALLBACK_GREETING_NAME);
    expect(greetingName(undefined)).toBe(FALLBACK_GREETING_NAME);
  });

  it("never returns something containing a digit", () => {
    for (const raw of ["FL1061", "233241234567", "Kwame2"]) {
      expect(greetingName(raw)).toBe(FALLBACK_GREETING_NAME);
    }
  });
});
