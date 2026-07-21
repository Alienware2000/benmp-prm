import {
  PartnerWorkspace,
  type PartnerSearchParams,
} from "../directory/partner-workspace";

export const dynamic = "force-dynamic";

export default function MessagesPage({
  searchParams,
}: {
  searchParams: PartnerSearchParams;
}) {
  return <PartnerWorkspace searchParams={searchParams} mode="messages" />;
}
