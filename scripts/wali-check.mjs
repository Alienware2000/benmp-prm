const apiKey = process.env.WALI_API_KEY;
const expectedDeviceId = process.env.WALI_DEVICE_ID;

function fail(message) {
  console.error(`Wali check failed: ${message}`);
  process.exit(1);
}

if (!apiKey || !expectedDeviceId) {
  fail("WALI_API_KEY and WALI_DEVICE_ID must be set in .env.local");
}

const response = await fetch("https://api.wali.chat/v1/devices", {
  headers: {
    Accept: "application/json",
    Token: apiKey,
  },
});

const data = await response.json().catch(() => null);
if (!response.ok) {
  fail(`API returned HTTP ${response.status}`);
}

const devices = Array.isArray(data) ? data : data?.devices;
if (!Array.isArray(devices)) {
  fail("API returned an unexpected device response");
}

const device = devices.find((candidate) => candidate?.id === expectedDeviceId);
if (!device) {
  fail("configured device was not returned by the Wali account");
}

if (device.status !== "operative") {
  fail(`configured device is ${device.status ?? "not operative"}`);
}

const digits = String(device.phone ?? "").replace(/\D/g, "");
const maskedPhone = digits
  ? `+${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
  : "unknown";
console.log(
  `Wali is ready: ${device.name ?? "configured sender"} (${maskedPhone}) is operative.`,
);
