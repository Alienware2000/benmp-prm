import {
  messagingConfiguration,
  type MessagingConfiguration,
} from "./configuration";

type Environment = Record<string, string | undefined>;
type WaliDevice = {
  id?: string;
  _id?: string;
  status?: string;
};

const WALI_DEVICES_URL = "https://api.wali.chat/v1/devices";
const WALI_RECONNECT_NOTE =
  "The BENMP WhatsApp sender is not connected in WaliChat. Reconnect the BENMP number in WaliChat, then refresh this page.";

let cache:
  | {
      apiKey: string;
      deviceId: string;
      expiresAt: number;
      value: MessagingConfiguration;
    }
  | undefined;

function devicesFromResponse(data: unknown): WaliDevice[] | null {
  if (Array.isArray(data)) return data as WaliDevice[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { devices?: unknown }).devices)
  ) {
    return (data as { devices: WaliDevice[] }).devices;
  }
  return null;
}

export async function messagingRuntimeConfiguration(
  environment: Environment = process.env,
  fetcher: typeof fetch = fetch,
): Promise<MessagingConfiguration> {
  const configured = messagingConfiguration(environment);
  if (!configured.ready || configured.provider !== "wali") return configured;

  const apiKey = environment.WALI_API_KEY?.trim() ?? "";
  const deviceId = environment.WALI_DEVICE_ID?.trim() ?? "";
  const useCache = environment === process.env && fetcher === fetch;
  if (
    useCache &&
    cache?.apiKey === apiKey &&
    cache.deviceId === deviceId &&
    cache.expiresAt > Date.now()
  ) {
    return cache.value;
  }

  let value: MessagingConfiguration;
  try {
    const response = await fetcher(WALI_DEVICES_URL, {
      headers: { Accept: "application/json", Token: apiKey },
      cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => null);
    const devices = devicesFromResponse(data);

    if (!response.ok || devices === null) {
      value = {
        provider: "wali",
        ready: false,
        note: "The BENMP WhatsApp connection could not be verified with WaliChat. Check the WaliChat account and try again.",
      };
    } else {
      const device = devices.find(
        (candidate) => (candidate.id ?? candidate._id) === deviceId,
      );
      value =
        device?.status === "operative"
          ? { provider: "wali", ready: true }
          : { provider: "wali", ready: false, note: WALI_RECONNECT_NOTE };
    }
  } catch {
    value = {
      provider: "wali",
      ready: false,
      note: "The BENMP WhatsApp connection could not be checked right now. No message will be sent until the connection is confirmed.",
    };
  }

  if (useCache) {
    cache = {
      apiKey,
      deviceId,
      expiresAt: Date.now() + 30_000,
      value,
    };
  }
  return value;
}
