import { describe, expect, it } from "vitest";
import { nonBlankMembers } from "./new-members";

describe("nonBlankMembers", () => {
  it("trims every field and drops rows left completely empty", () => {
    expect(
      nonBlankMembers([
        {
          name: "  Ama  Mensah ",
          whatsappPhone: " 024 412 3456",
          momoPhone: "",
        },
        { name: "", whatsappPhone: "  ", momoPhone: "" },
        { name: "", whatsappPhone: "0201111111", momoPhone: "" },
      ]),
    ).toEqual([
      { name: "Ama  Mensah", whatsappPhone: "024 412 3456", momoPhone: "" },
      { name: "", whatsappPhone: "0201111111", momoPhone: "" },
    ]);
  });
});
