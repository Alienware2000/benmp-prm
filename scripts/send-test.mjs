// Prove the system can send a message. Standalone — hits Twilio's REST API directly
// (no SDK, no app code), so it works on any branch with just the .env.local creds.
//
//   npm run send:test -- +14753659443 "BENMP test"          # SMS
//   npm run send:test -- +14753659443 "BENMP test" --whatsapp # WhatsApp (sandbox)
//
// Trial account: SMS only reaches Twilio-verified numbers; WhatsApp only reaches phones
// that have texted "join twilio-trial" to the sandbox number.

const args = process.argv.slice(2);
const whatsapp = args.includes("--whatsapp");
const positional = args.filter((a) => !a.startsWith("--"));
const to = positional[0];
const body = positional[1] ?? "BENMP PRM test message — the system can send. 🎉";

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const smsFrom = process.env.TWILIO_SMS_FROM;
const waFrom = process.env.TWILIO_WHATSAPP_SENDER;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!to) fail('Usage: npm run send:test -- <+E164number> "message" [--whatsapp]');
if (!sid || !token) fail("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set in .env.local");

const from = whatsapp ? waFrom : smsFrom;
if (!from) fail(whatsapp ? "TWILIO_WHATSAPP_SENDER not set" : "TWILIO_SMS_FROM not set");

const toAddr = whatsapp ? `whatsapp:${to.replace(/^whatsapp:/, "")}` : to;

const form = new URLSearchParams({ To: toAddr, From: from, Body: body });

console.log(`→ sending ${whatsapp ? "WhatsApp" : "SMS"} from ${from} to ${toAddr} …`);

const res = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  },
);

const data = await res.json();

if (!res.ok) {
  fail(`Twilio ${res.status}: ${data.message ?? JSON.stringify(data)}${data.more_info ? `\n  ${data.more_info}` : ""}`);
}

console.log(`✓ accepted by Twilio — sid ${data.sid}, status "${data.status}"`);
console.log("  (check your phone; watch delivery in Twilio console → Monitor → Logs → Messaging)");
