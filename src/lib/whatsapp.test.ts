import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "./whatsapp";

describe("buildWhatsAppUrl", () => {
  it("normalizes the phone and encodes the message", () => {
    expect(buildWhatsAppUrl("0244 123 456", "Thank you, Kofi!")).toBe(
      "https://wa.me/233244123456?text=Thank%20you%2C%20Kofi!",
    );
  });

  it("supports an international demo recipient", () => {
    expect(buildWhatsAppUrl("+243 989 426 841", "BENMP test")).toBe(
      "https://wa.me/243989426841?text=BENMP%20test",
    );
  });

  it("returns null for an invalid phone or empty message", () => {
    expect(buildWhatsAppUrl("123", "Hello")).toBeNull();
    expect(buildWhatsAppUrl("+233244123456", "   ")).toBeNull();
  });
});
