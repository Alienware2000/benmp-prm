import { PocShell } from "../../nav";
import { GivingUploadClient } from "./upload-client";

export const dynamic = "force-dynamic";

export default function GivingUploadPage() {
  return (
    <PocShell
      title="Upload giving"
      subtitle="Import a MoMo, bank or Paystack statement. Every credit goes straight into the giving ledger."
    >
      <GivingUploadClient />
    </PocShell>
  );
}
