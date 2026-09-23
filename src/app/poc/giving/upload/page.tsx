import { PocShell } from "../../nav";
import { GivingUploadClient } from "./upload-client";

export const dynamic = "force-dynamic";

export default function GivingUploadPage() {
  return (
    <PocShell
      title="Upload giving"
      subtitle="Import the fixed MoMo CSV or Ecobank statement, auto-match safe rows, and review the rest before updating the giving ledger."
    >
      <GivingUploadClient />
    </PocShell>
  );
}
