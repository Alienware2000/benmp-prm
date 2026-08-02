import { describe, expect, it } from "vitest";
import {
  renderSpecialMessage,
  SPECIAL_MESSAGE_TEMPLATES,
} from "./message-templates";

describe("special message templates", () => {
  it("provides exactly twenty drafts across the five giver categories", () => {
    expect(SPECIAL_MESSAGE_TEMPLATES).toHaveLength(20);
    expect(
      new Set(SPECIAL_MESSAGE_TEMPLATES.map((template) => template.category)),
    ).toEqual(
      new Set(["ordinary", "consistent", "top", "first_time", "returning"]),
    );
  });

  it("renders the recipient and recorded amount without leaving merge fields", () => {
    const message = renderSpecialMessage(
      SPECIAL_MESSAGE_TEMPLATES[0],
      "Rev. Kofi Boateng",
      5_050,
    );
    expect(message).toContain("Kofi");
    expect(message).toContain("GHS 50.5");
    expect(message).not.toContain("{");
  });

  it("uses support wording when no amount is available", () => {
    expect(
      renderSpecialMessage(SPECIAL_MESSAGE_TEMPLATES[0], "", undefined),
    ).toContain("your support");
  });
});
