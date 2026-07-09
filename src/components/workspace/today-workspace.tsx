"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  CommunicationChannel,
  CommunicationSegment,
  ContributionRecord,
  FollowUpTask,
  MessageBatch,
  PartnerRecord,
} from "@/lib/data";
import { minorCurrency, cn } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/primitives";

type WorkspaceMode = "gift" | "partner" | "task" | "message";

type StoredWorkspace = {
  partners: PartnerRecord[];
  gifts: ContributionRecord[];
  tasks: FollowUpTask[];
  messages: MessageBatch[];
};

const storageKey = "benmp-prm-local-workspace-v1";

const channels: CommunicationChannel[] = ["WhatsApp", "SMS", "Email", "Phone"];

const partnerLevels = ["Monthly", "Quarterly", "Annual", "Major", "Prayer"];

function getWorkspaceMode(value: string | null): WorkspaceMode | null {
  if (
    value === "gift" ||
    value === "partner" ||
    value === "task" ||
    value === "message"
  ) {
    return value;
  }

  return null;
}

function getInitialWorkspace(fallback: StoredWorkspace): StoredWorkspace {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(storageKey);

  if (!stored) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(stored) as StoredWorkspace;

    return {
      partners: parsed.partners?.length ? parsed.partners : fallback.partners,
      gifts: parsed.gifts?.length ? parsed.gifts : fallback.gifts,
      tasks: parsed.tasks?.length ? parsed.tasks : fallback.tasks,
      messages: parsed.messages?.length ? parsed.messages : fallback.messages,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return fallback;
  }
}

function estimateUsdForDemo(amount: number, currency: string) {
  const rates: Record<string, number> = {
    CAD: 0.73,
    GBP: 1.25,
    GHS: 0.08,
    USD: 1,
    XOF: 0.0017,
  };

  return amount * (rates[currency.toUpperCase()] ?? 1);
}

export function TodayWorkspace({
  initialPartners,
  initialGifts,
  initialTasks,
  initialMessages,
  segments,
}: {
  initialPartners: PartnerRecord[];
  initialGifts: ContributionRecord[];
  initialTasks: FollowUpTask[];
  initialMessages: MessageBatch[];
  segments: CommunicationSegment[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = getWorkspaceMode(searchParams.get("mode")) ?? "gift";
  const fallbackWorkspace = useMemo<StoredWorkspace>(
    () => ({
      partners: initialPartners,
      gifts: initialGifts,
      tasks: initialTasks,
      messages: initialMessages,
    }),
    [initialGifts, initialMessages, initialPartners, initialTasks],
  );
  const [workspace, setWorkspace] = useState<StoredWorkspace>(() =>
    getInitialWorkspace(fallbackWorkspace),
  );
  const [selectedSegmentId, setSelectedSegmentId] = useState(
    segments[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState(
    workspace.partners[0]?.id ?? "",
  );
  const [notice, setNotice] = useState("Ready");

  const selectedPartner =
    workspace.partners.find((partner) => partner.id === selectedPartnerId) ??
    workspace.partners[0];
  const selectedSegment =
    segments.find((segment) => segment.id === selectedSegmentId) ?? segments[0];

  const filteredPartners = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return workspace.partners;
    }

    return workspace.partners.filter((partner) =>
      [
        partner.fullName,
        partner.country,
        partner.city,
        partner.church,
        partner.preferredCommunication,
        partner.partnershipLevel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, workspace.partners]);

  const openTasks = workspace.tasks.filter((task) => task.status !== "Done");
  const pendingGiftAcknowledgements = workspace.gifts.filter(
    (gift) =>
      gift.acknowledgementStatus === "Pending" ||
      gift.acknowledgementStatus === "Drafted",
  );
  const reviewMessages = workspace.messages.filter(
    (message) => message.status === "Review" || message.status === "Draft",
  );

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(workspace));
  }, [workspace]);

  function resetWorkspace() {
    const resetState = {
      partners: initialPartners,
      gifts: initialGifts,
      tasks: initialTasks,
      messages: initialMessages,
    };
    setWorkspace(resetState);
    setSelectedPartnerId(initialPartners[0]?.id ?? "");
    setNotice("Local changes reset");
    window.localStorage.removeItem(storageKey);
  }

  function selectMode(nextMode: WorkspaceMode) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("mode", nextMode);
    router.replace(`${pathname}?${nextParams.toString()}#workspace`, {
      scroll: false,
    });
  }

  function recordGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const donorName = String(formData.get("donorName") ?? "").trim();
    const amount = Number(formData.get("amount") ?? 0);

    if (!donorName || !amount) {
      setNotice("Donor name and amount are required");
      return;
    }

    const currency = String(formData.get("currency") ?? "USD").trim();
    const usdEstimate = estimateUsdForDemo(amount, currency);
    const attentionTier =
      usdEstimate >= 100
        ? "High touch"
        : usdEstimate >= 60
          ? "Active year covered"
          : "Standard";
    const annualCoverageMonths = Math.min(Math.floor(usdEstimate / 5), 12);
    const id = `local_gift_${Date.now()}`;
    const paymentMethod = String(
      formData.get("paymentMethod") ?? "Mobile Money",
    ).trim();
    const provider = String(formData.get("provider") ?? "Manual entry").trim();

    const gift: ContributionRecord = {
      id,
      contributionDate: "Today",
      partnerId: `local_donor_${Date.now()}`,
      partnerName: donorName,
      amount: { amountMinor: Math.round(amount * 100), currency },
      paymentMethod,
      campaignName: String(formData.get("campaignName") ?? "General").trim(),
      provider,
      providerReference:
        String(formData.get("providerReference") ?? "").trim() ||
        `LOCAL-${Date.now()}`,
      status: "Succeeded",
      reconciliationStatus: "Probable",
      acknowledgementStatus: "Drafted",
      attentionTier,
      annualCoverageMonths,
      followUpRequired: attentionTier !== "Standard",
    };

    const followUpTask: FollowUpTask | null =
      attentionTier === "Standard"
        ? null
        : {
            id: `local_task_${Date.now()}`,
            partnerName: donorName,
            country: String(formData.get("country") ?? "Unknown").trim(),
            reason:
              attentionTier === "High touch"
                ? "High-touch donor call"
                : "Annual BENMP covered",
            owner:
              attentionTier === "High touch"
                ? "Major partners team"
                : "Regional coordinator",
            channel: "Phone",
            priority: attentionTier === "High touch" ? "High" : "Medium",
            status: "Open",
            dueOn: "Today",
            source: `${provider} ${paymentMethod}`,
            nextAction:
              attentionTier === "High touch"
                ? "Call personally and thank them for going above and beyond."
                : "Send a warm thank-you and mark the donor active for the year.",
          };

    setWorkspace((current) => ({
      ...current,
      gifts: [gift, ...current.gifts],
      tasks: followUpTask ? [followUpTask, ...current.tasks] : current.tasks,
    }));
    setNotice(`${donorName} gift recorded; thank-you drafted`);
    event.currentTarget.reset();
  }

  function addPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const country = String(formData.get("country") ?? "").trim();

    if (!fullName || !country) {
      setNotice("Name and country are required");
      return;
    }

    const channel = String(
      formData.get("preferredCommunication") ?? "WhatsApp",
    ) as CommunicationChannel;
    const id = `local_partner_${Date.now()}`;
    const nextPartner: PartnerRecord = {
      id,
      fullName,
      mobileNumber: String(formData.get("mobileNumber") ?? "").trim(),
      whatsappNumber: String(formData.get("whatsappNumber") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      country,
      city: String(formData.get("city") ?? "").trim(),
      church: String(formData.get("church") ?? "").trim(),
      partnerSince: "Today",
      partnershipLevel: String(formData.get("partnershipLevel") ?? "Monthly"),
      givingFrequency: String(formData.get("givingFrequency") ?? "Monthly"),
      preferredCommunication: channel,
      status: "New",
      owner: "Unassigned",
      lifetimeGiving: { amountMinor: 0, currency: "USD" },
      lastContributionDate: "No gifts yet",
      lastContactedAt: "Not yet contacted",
      prayerSummary: String(formData.get("prayerSummary") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      tags: ["Local draft"],
    };

    setWorkspace((current) => ({
      ...current,
      partners: [nextPartner, ...current.partners],
    }));
    setSelectedPartnerId(id);
    setNotice(`${fullName} added locally`);
    event.currentTarget.reset();
  }

  function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPartner) {
      setNotice("Select a partner first");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get("reason") ?? "").trim();

    if (!reason) {
      setNotice("Task reason is required");
      return;
    }

    const task: FollowUpTask = {
      id: `local_task_${Date.now()}`,
      partnerName: selectedPartner.fullName,
      country: selectedPartner.country,
      reason,
      owner: String(formData.get("owner") ?? "Coordinator").trim(),
      channel: String(
        formData.get("channel") ?? "WhatsApp",
      ) as CommunicationChannel,
      priority: String(formData.get("priority") ?? "Medium") as
        "High" | "Medium" | "Low",
      status: "Open",
      dueOn: String(formData.get("dueOn") ?? "Today"),
      source: "Manual",
      nextAction: String(formData.get("nextAction") ?? "").trim(),
    };

    setWorkspace((current) => ({
      ...current,
      tasks: [task, ...current.tasks],
    }));
    setNotice(`Task created for ${selectedPartner.fullName}`);
    event.currentTarget.reset();
  }

  function stageMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const segmentId = String(formData.get("segmentId") ?? selectedSegmentId);
    const segment =
      segments.find((item) => item.id === segmentId) ?? segments[0];

    if (!segment) {
      setNotice("No segment is available");
      return;
    }

    const batch: MessageBatch = {
      id: `local_message_${Date.now()}`,
      name: String(formData.get("name") ?? "Partner message").trim(),
      segmentName: segment.name,
      channel: String(
        formData.get("channel") ?? segment.channel,
      ) as CommunicationChannel,
      recipientCount: segment.recipientCount,
      status: "Review",
      templateStatus:
        segment.channel === "WhatsApp" ? "Needs review" : "Not required",
      approvalOwner: String(
        formData.get("approvalOwner") ?? "Communications lead",
      ),
      scheduledFor: "Not scheduled",
    };

    setWorkspace((current) => ({
      ...current,
      messages: [batch, ...current.messages],
    }));
    setNotice(`${batch.name} staged for review`);
    event.currentTarget.reset();
  }

  function completeTask(id: string) {
    setWorkspace((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, status: "Done" } : task,
      ),
    }));
    setNotice("Task marked done");
  }

  function acknowledgeGift(id: string) {
    setWorkspace((current) => ({
      ...current,
      gifts: current.gifts.map((gift) =>
        gift.id === id ? { ...gift, acknowledgementStatus: "Sent" } : gift,
      ),
    }));
    setNotice("Gift acknowledgement marked sent");
  }

  function approveMessage(id: string) {
    setWorkspace((current) => ({
      ...current,
      messages: current.messages.map((message) =>
        message.id === id ? { ...message, status: "Queued" } : message,
      ),
    }));
    setNotice("Message moved to queue");
  }

  return (
    <section
      id="workspace"
      className="rounded-lg border border-border bg-surface shadow-sm"
    >
      <div className="grid min-w-0 gap-0 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-border p-4 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Today
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                Operations Console
              </h2>
            </div>
            <button
              onClick={resetWorkspace}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition hover:text-foreground"
              title="Reset local changes"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            <ModeButton
              active={mode === "gift"}
              icon={CircleDollarSign}
              label="Acknowledge Gift"
              count={pendingGiftAcknowledgements.length}
              onClick={() => selectMode("gift")}
            />
            <ModeButton
              active={mode === "partner"}
              icon={UserRound}
              label="Capture Partner"
              count={workspace.partners.length}
              onClick={() => selectMode("partner")}
            />
            <ModeButton
              active={mode === "task"}
              icon={ClipboardList}
              label="Assign Follow-up"
              count={openTasks.length}
              onClick={() => selectMode("task")}
            />
            <ModeButton
              active={mode === "message"}
              icon={MessageCircle}
              label="Approve Messaging"
              count={reviewMessages.length}
              onClick={() => selectMode("message")}
            />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold text-foreground">{notice}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Local workspace. Backend adapter pending.
            </p>
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-5">
          {mode === "gift" ? (
            <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <WorkflowHeader
                  eyebrow="Money in"
                  title="Acknowledge Gift"
                  detail={`${pendingGiftAcknowledgements.length.toLocaleString()} acknowledgements open`}
                />
                <GiftForm onSubmit={recordGift} />
              </div>
              <RecentGifts gifts={workspace.gifts.slice(0, 5)} />
            </div>
          ) : null}

          {mode === "partner" ? (
            <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                <WorkflowHeader
                  eyebrow="New intake"
                  title="Capture Partner"
                  detail={`${workspace.partners.length.toLocaleString()} records in workspace`}
                />
                <PartnerForm onSubmit={addPartner} />
              </div>
              <RecentPartners partners={workspace.partners.slice(0, 5)} />
            </div>
          ) : null}

          {mode === "task" ? (
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(250px,0.42fr)_minmax(0,1fr)]">
              <PartnerPicker
                query={query}
                onQueryChange={setQuery}
                partners={filteredPartners}
                selectedPartner={selectedPartner}
                onSelect={setSelectedPartnerId}
              />
              <div className="min-w-0">
                <SelectedPartnerSummary partner={selectedPartner} />
                <TaskForm
                  onSubmit={createTask}
                  selectedPartner={selectedPartner}
                />
              </div>
            </div>
          ) : null}

          {mode === "message" ? (
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(250px,0.42fr)_minmax(0,1fr)]">
              <SegmentPicker
                segments={segments}
                selectedSegment={selectedSegment}
                onSelect={setSelectedSegmentId}
              />
              <div className="min-w-0">
                {selectedSegment ? (
                  <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
                    <WorkflowHeader
                      eyebrow="Audience"
                      title={selectedSegment.name}
                      detail={`${selectedSegment.recipientCount.toLocaleString()} recipients - ${selectedSegment.channel}`}
                    />
                  </div>
                ) : null}
                <MessageForm
                  onSubmit={stageMessage}
                  segments={segments}
                  selectedSegmentId={selectedSegment?.id ?? ""}
                  onSegmentChange={setSelectedSegmentId}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 border-t border-border p-4 xl:grid-cols-3">
        <ActivityPanel
          title="Gift Acknowledgements"
          emptyLabel="No gift acknowledgements"
          items={pendingGiftAcknowledgements.slice(0, 4).map((gift) => ({
            id: gift.id,
            title: gift.partnerName,
            detail: `${minorCurrency(
              gift.amount.amountMinor,
              gift.amount.currency,
            )} - ${gift.paymentMethod} - ${gift.attentionTier}`,
            status: gift.acknowledgementStatus,
            actionLabel: "Sent",
            onAction: () => acknowledgeGift(gift.id),
          }))}
        />
        <ActivityPanel
          title="Open Follow-ups"
          emptyLabel="No open follow-ups"
          items={openTasks.slice(0, 4).map((task) => ({
            id: task.id,
            title: task.partnerName,
            detail: `${task.reason} - ${task.owner} - ${task.dueOn}`,
            status: task.status,
            actionLabel: "Done",
            onAction: () => completeTask(task.id),
          }))}
        />
        <ActivityPanel
          title="Message Review"
          emptyLabel="No message drafts"
          items={reviewMessages.slice(0, 4).map((message) => ({
            id: message.id,
            title: message.name,
            detail: `${message.segmentName} - ${message.recipientCount.toLocaleString()} recipients`,
            status: message.status,
            actionLabel: "Queue",
            onAction: () => approveMessage(message.id),
          }))}
        />
      </div>
    </section>
  );
}

function GiftForm({
  onSubmit,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 rounded-lg border border-border p-4"
    >
      <FormTitle title="Record Gift" />
      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
        <TextField name="donorName" label="Donor name" required />
        <TextField name="country" label="Country" defaultValue="Ghana" />
        <TextField name="amount" label="Amount" type="number" required />
        <SelectField
          name="currency"
          label="Currency"
          options={["GHS", "USD", "GBP", "CAD", "XOF"]}
        />
        <SelectField
          name="paymentMethod"
          label="Method"
          options={["Mobile Money", "Card", "Bank transfer"]}
        />
        <SelectField
          name="provider"
          label="Source"
          options={["MoMo statement", "Bank CSV", "Remittance export", "Manual entry"]}
        />
        <TextField name="providerReference" label="Source ref" />
        <TextField name="campaignName" label="Campaign" defaultValue="Banjul" />
      </div>
      <SubmitButton label="Draft Thank-you" icon={CircleDollarSign} />
    </form>
  );
}

function RecentGifts({ gifts }: { gifts: ContributionRecord[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Recent Gifts</h3>
        <span className="text-xs font-semibold text-muted-foreground">
          {gifts.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {gifts.map((gift) => (
          <div key={gift.id} className="rounded-lg bg-muted/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {gift.partnerName}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {minorCurrency(gift.amount.amountMinor, gift.amount.currency)}{" "}
                  via {gift.paymentMethod}
                </p>
              </div>
              <StatusBadge label={gift.acknowledgementStatus} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge label={gift.attentionTier} />
              <StatusBadge label={gift.reconciliationStatus} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkflowHeader({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="mb-4 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="mt-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="truncate text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="text-sm font-medium text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function RecentPartners({ partners }: { partners: PartnerRecord[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Recent Partners
        </h3>
        <span className="text-xs font-semibold text-muted-foreground">
          {partners.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {partners.map((partner) => (
          <div key={partner.id} className="rounded-lg bg-muted/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {partner.fullName}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {partner.city || "Unknown city"}, {partner.country}
                </p>
              </div>
              <StatusBadge label={partner.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span className="truncate">{partner.preferredCommunication}</span>
              <span className="truncate">{partner.partnershipLevel}</span>
              <span className="truncate">
                {minorCurrency(
                  partner.lifetimeGiving.amountMinor,
                  partner.lifetimeGiving.currency,
                )}
              </span>
              <span className="truncate">{partner.owner}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PartnerPicker({
  query,
  onQueryChange,
  partners,
  selectedPartner,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  partners: PartnerRecord[];
  selectedPartner?: PartnerRecord;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border p-4">
      <WorkflowHeader
        eyebrow="Follow-up"
        title="Choose Partner"
        detail={`${partners.length.toLocaleString()} visible`}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-10 w-full min-w-0 rounded-lg border border-border bg-muted pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
          placeholder="Find a partner"
        />
      </div>

      <div className="mt-4 max-h-[460px] space-y-2 overflow-y-auto pr-1">
        {partners.length ? (
          partners.map((partner) => (
            <button
              key={partner.id}
              onClick={() => onSelect(partner.id)}
              className={cn(
                "w-full min-w-0 rounded-lg border p-3 text-left transition",
                selectedPartner?.id === partner.id
                  ? "border-primary bg-amber-50"
                  : "border-border bg-white hover:bg-muted/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {partner.fullName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {partner.city || "Unknown city"}, {partner.country}
                  </p>
                </div>
                <StatusBadge label={partner.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {partner.preferredCommunication}
                </span>
                <span className="truncate">{partner.partnershipLevel}</span>
                <span className="truncate">{partner.owner}</span>
                <span className="truncate">{partner.lastContributionDate}</span>
              </div>
            </button>
          ))
        ) : (
          <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            No matching partners
          </p>
        )}
      </div>
    </section>
  );
}

function SelectedPartnerSummary({ partner }: { partner?: PartnerRecord }) {
  if (!partner) {
    return (
      <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-base font-semibold text-foreground">
          No Partner Selected
        </h3>
      </div>
    );
  }

  return (
    <div className="mb-4 min-w-0 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">
            {partner.fullName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {partner.church || "No church listed"}
          </p>
        </div>
        <StatusBadge label={partner.status} />
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Info
          label="Preferred channel"
          value={partner.preferredCommunication}
        />
        <Info label="Owner" value={partner.owner} />
        <Info label="Last gift" value={partner.lastContributionDate} />
        <Info
          label="Prayer"
          value={partner.prayerSummary || "No prayer note"}
        />
      </div>
    </div>
  );
}

function SegmentPicker({
  segments,
  selectedSegment,
  onSelect,
}: {
  segments: CommunicationSegment[];
  selectedSegment?: CommunicationSegment;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border p-4">
      <WorkflowHeader
        eyebrow="Messaging"
        title="Choose Audience"
        detail={`${segments.length.toLocaleString()} segments`}
      />
      <div className="space-y-2">
        {segments.map((segment) => (
          <button
            key={segment.id}
            onClick={() => onSelect(segment.id)}
            className={cn(
              "w-full min-w-0 rounded-lg border p-3 text-left transition",
              selectedSegment?.id === segment.id
                ? "border-primary bg-amber-50"
                : "border-border bg-white hover:bg-muted/60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {segment.name}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {segment.recipientCount.toLocaleString()} recipients
                </p>
              </div>
              <StatusBadge label={segment.complianceStatus} />
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">
              {segment.channel} - {segment.owner}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

function ModeButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: typeof UserRound;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition",
        active
          ? "border-sidebar bg-sidebar text-white"
          : "border-border bg-white text-foreground hover:bg-muted/70",
      )}
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span
        className={cn(
          "rounded-md px-2 py-1 text-xs font-semibold",
          active ? "bg-white/10 text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

function PartnerForm({
  onSubmit,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 rounded-lg border border-border p-4"
    >
      <FormTitle title="Capture Partner" />
      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
        <TextField name="fullName" label="Full name" required />
        <TextField name="country" label="Country" required />
        <TextField name="city" label="City" />
        <TextField name="church" label="Church" />
        <TextField name="mobileNumber" label="Mobile" />
        <TextField name="whatsappNumber" label="WhatsApp" />
        <TextField name="email" label="Email" type="email" />
        <SelectField
          name="preferredCommunication"
          label="Channel"
          options={channels}
        />
        <SelectField
          name="partnershipLevel"
          label="Level"
          options={partnerLevels}
        />
        <SelectField
          name="givingFrequency"
          label="Frequency"
          options={["Monthly", "Quarterly", "Annually", "Irregular"]}
        />
      </div>
      <TextAreaField name="prayerSummary" label="Prayer request" />
      <TextAreaField name="notes" label="Notes" />
      <SubmitButton label="Add Partner" icon={Plus} />
    </form>
  );
}

function TaskForm({
  onSubmit,
  selectedPartner,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedPartner?: PartnerRecord;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 rounded-lg border border-border p-4"
    >
      <FormTitle title="Assign Follow-up" />
      <p className="mt-2 text-sm text-muted-foreground">
        {selectedPartner
          ? selectedPartner.fullName
          : "Select a partner before creating a task"}
      </p>
      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
        <TextField name="reason" label="Reason" required />
        <TextField name="owner" label="Owner" defaultValue="Coordinator" />
        <SelectField name="channel" label="Channel" options={channels} />
        <SelectField
          name="priority"
          label="Priority"
          options={["High", "Medium", "Low"]}
        />
        <TextField name="dueOn" label="Due" defaultValue="Today" />
      </div>
      <TextAreaField name="nextAction" label="Next action" />
      <SubmitButton label="Create Task" icon={ClipboardList} />
    </form>
  );
}

function MessageForm({
  onSubmit,
  segments,
  selectedSegmentId,
  onSegmentChange,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  segments: CommunicationSegment[];
  selectedSegmentId: string;
  onSegmentChange: (id: string) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 rounded-lg border border-border p-4"
    >
      <FormTitle title="Stage Message Batch" />
      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
        <TextField
          name="name"
          label="Batch name"
          defaultValue="Partner update"
        />
        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-semibold text-muted-foreground">
            Segment
          </span>
          <select
            name="segmentId"
            value={selectedSegmentId}
            onChange={(event) => onSegmentChange(event.target.value)}
            className="h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            {segments.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.name}
              </option>
            ))}
          </select>
        </label>
        <SelectField name="channel" label="Channel" options={channels} />
        <TextField
          name="approvalOwner"
          label="Approval owner"
          defaultValue="Communications lead"
        />
      </div>
      <SubmitButton label="Stage for Review" icon={MessageCircle} />
    </form>
  );
}

function FormTitle({ title }: { title: string }) {
  return <h3 className="text-base font-semibold text-foreground">{title}</h3>;
}

function TextField({
  name,
  label,
  type = "text",
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[];
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <select
        name={name}
        className="h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ name, label }: { name: string; label: string }) {
  return (
    <label className="mt-3 grid min-w-0 gap-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <textarea
        name={name}
        className="min-h-[78px] w-full min-w-0 resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

function SubmitButton({
  label,
  icon: Icon,
}: {
  label: string;
  icon: typeof Plus;
}) {
  return (
    <button className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ActivityPanel({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{
    id: string;
    title: string;
    detail: string;
    status: string;
    actionLabel: string;
    onAction: () => void;
  }>;
}) {
  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs font-semibold text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <StatusBadge label={item.status} />
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
              <button
                onClick={item.onAction}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-white px-2 text-xs font-semibold text-foreground"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {item.actionLabel}
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}
