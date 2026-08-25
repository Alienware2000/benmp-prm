/**
 * Reset one hub account back to its starting state (HP-4): password = the hub
 * number again, must_change_password = true, so the leader is forced to pick
 * a fresh one on next sign-in. For when a leader forgets their password or a
 * test locked an account.
 *
 * Run: npx tsx --env-file=.env.local scripts/reset-hub-password.ts <hubNumber>
 */
import { hashPassword, initialHubPassword } from "../src/lib/hub/password";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const arg = process.argv[2];
  const hubNumber = Number(arg);
  if (!SUPABASE_URL || !KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  if (!Number.isInteger(hubNumber) || hubNumber < 1) {
    throw new Error(`usage: reset-hub-password.ts <hubNumber> (got ${JSON.stringify(arg)})`);
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/hub_accounts?username=eq.${hubNumber}`,
    {
      method: "PATCH",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        password_hash: hashPassword(initialHubPassword(hubNumber)),
        must_change_password: true,
      }),
    },
  );
  if (!res.ok) throw new Error(`PATCH failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as unknown[];
  if (rows.length === 0) throw new Error(`no account with username ${hubNumber}`);
  console.log(
    `hub ${hubNumber}: password reset to the hub number, change forced on next sign-in`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
