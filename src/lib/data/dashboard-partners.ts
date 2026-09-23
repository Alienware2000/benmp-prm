/**
 * Direct PostgREST read of the partners table for the overview dashboard.
 *
 * Hub admins ingest partners via the wizard (src/app/hub/ingest-wizard.tsx),
 * which writes to the Supabase `partners` table through src/lib/hub/db.ts.
 * This module reads those rows back so they appear on the main dashboard
 * (/) — no repository abstraction, just a typed fetch + map.
 *
 * Server-only: uses the service role key, same pattern as src/lib/hub/db.ts.
 */

import type { PartnerRecord, PartnerStatus } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type PartnerRow = {
  id: string;
  full_name: string;
  momo_phone_number: string | null;
  whatsapp_number: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  church: string | null;
  partner_since: string | null;
  partnership_level: string | null;
  preferred_giving_frequency: string | null;
  preferred_communication_method: string | null;
  status: string | null;
  lifetime_giving_minor: number | null;
  lifetime_giving_currency: string | null;
  last_contribution_date: string | null;
  last_contacted_at: string | null;
  tags: string[] | null;
  notes: string | null;
  assigned_to: string | null;
};

const SELECT = [
  "id",
  "full_name",
  "momo_phone_number",
  "whatsapp_number",
  "email",
  "country",
  "city",
  "church",
  "partner_since",
  "partnership_level",
  "preferred_giving_frequency",
  "preferred_communication_method",
  "status",
  "lifetime_giving_minor",
  "lifetime_giving_currency",
  "last_contribution_date",
  "last_contacted_at",
  "tags",
  "notes",
  "assigned_to",
].join(",");

/** PostgREST column value -> our display enum, matching db-schema.md. */
const STATUS_MAP: Record<string, PartnerStatus> = {
  new: "New",
  active: "Active",
  needs_follow_up: "Needs follow-up",
  paused: "Paused",
  inactive: "Inactive",
  do_not_contact: "Do not contact",
};

function titleCase(snake: string | null): string {
  if (!snake) return "Unknown";
  return snake
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** db enum (lowercase: whatsapp, sms, email, phone, none) → display label. */
function capitalizeChannel(value: string | null): PartnerRecord["preferredCommunication"] {
  if (!value) return "None";
  const cap = value.charAt(0).toUpperCase() + value.slice(1);
  return (cap === "Whatsapp" ? "WhatsApp" : cap) as PartnerRecord["preferredCommunication"];
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toPartner(row: PartnerRow): PartnerRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    momoPhoneNumber: row.momo_phone_number ?? "",
    whatsappNumber: row.whatsapp_number ?? "",
    email: row.email ?? "",
    country: row.country ?? "",
    city: row.city ?? "",
    church: row.church ?? "",
    partnerSince: formatDate(row.partner_since),
    partnershipLevel: titleCase(row.partnership_level),
    givingFrequency: titleCase(row.preferred_giving_frequency),
    preferredCommunication: capitalizeChannel(
      row.preferred_communication_method,
    ),
    status: STATUS_MAP[row.status ?? "new"] ?? "New",
    owner: row.assigned_to ?? "Unassigned",
    lifetimeGiving: {
      amountMinor: row.lifetime_giving_minor ?? 0,
      currency: row.lifetime_giving_currency ?? "USD",
    },
    lastContributionDate: formatDate(row.last_contribution_date),
    lastContactedAt: formatDate(row.last_contacted_at),
    prayerSummary: "",
    notes: row.notes ?? "",
    tags: row.tags ?? [],
  };
}

/**
 * Fetch the most recently ingested partners from Supabase, newest first.
 *
 * Returns an empty array (not a throw) when Supabase is not configured, so the
 * dashboard degrades to "no partners" rather than crashing during local dev
 * without env.
 */
export async function getDashboardPartners(
  limit = 100,
): Promise<PartnerRecord[]> {
  if (!SUPABASE_URL || !KEY) return [];

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/partners?select=${SELECT}` +
      `&order=created_at.desc,id.asc&limit=${limit}`,
    {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(
      `getDashboardPartners: ${res.status} ${await res.text()}`,
    );
  }

  const rows = (await res.json()) as PartnerRow[];
  return rows.map(toPartner);
}

/** Total partner count via PostgREST content-range header. */
export async function getDashboardPartnerCount(): Promise<number> {
  if (!SUPABASE_URL || !KEY) return 0;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/partners?select=id&limit=1`,
    {
      method: "GET",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Prefer: "count=exact",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) return 0;
  const range = res.headers.get("content-range"); // e.g. "0-0/807"
  const total = range?.split("/")[1];
  return total && total !== "*" ? Number(total) : 0;
}