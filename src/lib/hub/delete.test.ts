import { describe, expect, it } from "vitest";
import { partnersAddedByUpload, planHubPartnerDeletion } from "./delete";

const p = (id: string, hub = "hub-1", wa = `+2332000000${id}`) => ({
  id,
  hub_id: hub,
  full_name: `Person ${id}`,
  whatsapp_number: wa,
  momo_phone_number: null,
});
const noGiving = {
  paidPhones: new Set<string>(),
  linkedPartnerIds: new Set<string>(),
};

describe("planHubPartnerDeletion", () => {
  it("deletes the hub's own partners", () => {
    const plan = planHubPartnerDeletion(
      "hub-1",
      ["1", "2"],
      [p("1"), p("2")],
      noGiving,
    );
    expect(plan.deleteIds).toEqual(["1", "2"]);
    expect(plan.kept).toEqual([]);
  });

  it("never deletes another hub's partner, or an id that doesn't exist", () => {
    const plan = planHubPartnerDeletion(
      "hub-1",
      ["1", "9"],
      [p("1", "hub-2")],
      noGiving,
    );
    expect(plan.deleteIds).toEqual([]);
    expect(plan.kept.map((k) => k.id)).toEqual(["1", "9"]);
  });

  it("keeps anyone with a payment from their number", () => {
    const plan = planHubPartnerDeletion("hub-1", ["1", "2"], [p("1"), p("2")], {
      paidPhones: new Set(["+23320000001"]),
      linkedPartnerIds: new Set(),
    });
    expect(plan.deleteIds).toEqual(["2"]);
    expect(plan.kept[0]).toMatchObject({ id: "1", name: "Person 1" });
    expect(plan.kept[0].reason).toMatch(/giving/);
  });

  it("keeps anyone linked to a contribution or statement row", () => {
    const plan = planHubPartnerDeletion("hub-1", ["1"], [p("1")], {
      paidPhones: new Set(),
      linkedPartnerIds: new Set(["1"]),
    });
    expect(plan.deleteIds).toEqual([]);
  });

  it("ignores a repeated id", () => {
    const plan = planHubPartnerDeletion(
      "hub-1",
      ["1", "1"],
      [p("1")],
      noGiving,
    );
    expect(plan.deleteIds).toEqual(["1"]);
  });
});

describe("partnersAddedByUpload", () => {
  const upload = {
    id: "b1",
    created_at: "2026-09-26T10:00:00Z",
    submitted_at: "2026-09-26T10:00:03Z",
  };
  it("includes partners created while the upload was saving", () => {
    const rows = [
      { id: "a", created_at: "2026-09-26T10:00:01Z" },
      { id: "b", created_at: "2026-09-26T09:00:00Z" },
    ];
    expect(partnersAddedByUpload(upload, rows).map((r) => r.id)).toEqual(["a"]);
  });

  it("an upload that never finished added nobody", () => {
    expect(
      partnersAddedByUpload({ ...upload, submitted_at: null }, [
        { id: "a", created_at: "2026-09-26T10:00:01Z" },
      ]),
    ).toEqual([]);
  });
});
