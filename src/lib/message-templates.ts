import { firstName } from "./messages";

export type SpecialMessageCategory =
  "ordinary" | "consistent" | "top" | "first_time" | "returning";

export type SpecialMessageTemplate = {
  id: string;
  label: string;
  category: SpecialMessageCategory;
  body: string;
};

export const SPECIAL_MESSAGE_CATEGORY_LABELS: Record<
  SpecialMessageCategory,
  string
> = {
  ordinary: "Ordinary givers",
  consistent: "Repeat givers",
  top: "Top givers",
  first_time: "First-time givers",
  returning: "Returning givers",
};

/** Twenty editable drafts requested by the BENMP office, grouped by giver context. */
export const SPECIAL_MESSAGE_TEMPLATES: SpecialMessageTemplate[] = [
  {
    id: "ordinary-grateful",
    label: "Every gift matters",
    category: "ordinary",
    body: "Hi {name}, thank you for {amount} to BENMP. Every gift matters and we are grateful that you chose to stand with the ministry. God richly bless you!",
  },
  {
    id: "ordinary-partnership",
    label: "Partnership appreciation",
    category: "ordinary",
    body: "Hello {name}, we sincerely appreciate {amount}. Your partnership helps the work of BENMP continue, and we do not take your support for granted.",
  },
  {
    id: "ordinary-prayer",
    label: "Gratitude and prayer",
    category: "ordinary",
    body: "Dear {name}, thank you for {amount} to BENMP. We pray that God rewards your kindness and continues to strengthen you in every area of your life.",
  },
  {
    id: "ordinary-crusade",
    label: "Supporting the mission",
    category: "ordinary",
    body: "Hi {name}, thank you for {amount}. Your support is helping BENMP and the Healing Jesus Campaign reach people with the gospel. We are grateful for you.",
  },
  {
    id: "consistent-faithful",
    label: "Faithful partnership",
    category: "consistent",
    body: "Hi {name}, thank you for your continued partnership with BENMP and for {amount}. Your consistency is deeply appreciated. God bless you for standing with us.",
  },
  {
    id: "consistent-monthly",
    label: "Consistent monthly support",
    category: "consistent",
    body: "Dear {name}, your faithful support of BENMP continues to make a difference. Thank you for {amount} and for remembering the ministry so consistently.",
  },
  {
    id: "consistent-dependable",
    label: "Dependable partner",
    category: "consistent",
    body: "Hello {name}, we are grateful for the dependable way you continue to support BENMP. Thank you for {amount}. May the Lord honour your faithfulness.",
  },
  {
    id: "consistent-impact",
    label: "Continuing impact",
    category: "consistent",
    body: "Hi {name}, your consistent partnership helps us plan and continue the work with confidence. Thank you for {amount} and for remaining part of the BENMP family.",
  },
  {
    id: "top-generous",
    label: "Generous contribution",
    category: "top",
    body: "Dear {name}, we are deeply grateful for your generous support of {amount}. Thank you for standing with BENMP in such a significant way. God richly bless you.",
  },
  {
    id: "top-above-beyond",
    label: "Above and beyond",
    category: "top",
    body: "Hello {name}, thank you for going above and beyond through {amount}. Your generosity is a great encouragement to BENMP and the work of the Healing Jesus Campaign.",
  },
  {
    id: "top-personal",
    label: "Special personal appreciation",
    category: "top",
    body: "Dear {name}, we wanted to personally acknowledge {amount} and express our heartfelt appreciation. Your exceptional partnership means a great deal to BENMP.",
  },
  {
    id: "top-stewardship",
    label: "Kingdom stewardship",
    category: "top",
    body: "Hi {name}, thank you for your remarkable generosity of {amount}. We are honoured to steward your support toward the work of BENMP. May God reward you abundantly.",
  },
  {
    id: "first-welcome",
    label: "Welcome to BENMP",
    category: "first_time",
    body: "Hi {name}, thank you for your first recorded gift of {amount} to BENMP. We are delighted to welcome you and grateful to begin this partnership with you.",
  },
  {
    id: "first-thank-you",
    label: "First gift appreciation",
    category: "first_time",
    body: "Dear {name}, thank you for choosing to support BENMP with {amount}. Your first gift is sincerely appreciated, and we look forward to staying connected with you.",
  },
  {
    id: "first-mission",
    label: "Welcome to the mission",
    category: "first_time",
    body: "Hello {name}, welcome to the BENMP partner family. Thank you for {amount} and for joining us in supporting the work of the Healing Jesus Campaign.",
  },
  {
    id: "first-blessing",
    label: "First gift blessing",
    category: "first_time",
    body: "Hi {name}, we received {amount} with gratitude. Thank you for taking this first step of partnership with BENMP. We pray this marks the beginning of a blessed relationship.",
  },
  {
    id: "returning-welcome-back",
    label: "Welcome back",
    category: "returning",
    body: "Hi {name}, it is wonderful to hear from you again. Thank you for renewing your support with {amount}. We are grateful to have you standing with BENMP.",
  },
  {
    id: "returning-renewed",
    label: "Renewed partnership",
    category: "returning",
    body: "Dear {name}, thank you for {amount} and for renewing your partnership with BENMP. Your return is deeply appreciated, and we are glad to reconnect with you.",
  },
  {
    id: "returning-remembered",
    label: "You are remembered",
    category: "returning",
    body: "Hello {name}, thank you for {amount}. You have remained part of the BENMP family, and we are genuinely grateful to receive your support again.",
  },
  {
    id: "returning-new-season",
    label: "A new season together",
    category: "returning",
    body: "Hi {name}, we warmly welcome your renewed partnership through {amount}. Thank you for beginning this new season with BENMP. God richly bless you.",
  },
];

export function renderSpecialMessage(
  template: SpecialMessageTemplate,
  fullName: string,
  amountMinor?: number,
): string {
  const amount =
    amountMinor && amountMinor > 0
      ? `GHS ${(amountMinor / 100).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}`
      : "your support";
  return template.body
    .replaceAll("{name}", firstName(fullName))
    .replaceAll("{amount}", amount);
}
