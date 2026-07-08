# Operations Runbook

> Practical office workflow guide for BENMP PRM. This is the "how staff use it" companion to the technical specs.

## 1. Operating Principle

Every gift should become a relationship touch.

The office workflow is:

1. Receive or import money evidence.
2. Verify and match the donor.
3. Record the contribution.
4. Thank the partner.
5. Queue any needed call or follow-up.
6. Keep the partner informed about crusades, testimonies, and prayer updates.
7. Close the month with clear regional answers.

## 2. Daily Office Routine

Daily finance/comms check:

1. Open Today.
2. Review new gifts.
3. Review unmatched payment events.
4. Approve or edit thank-you drafts.
5. Call high-touch partners.
6. Review failed messages.
7. Review urgent prayer requests.
8. Check provider status.

Daily questions:

- Which gifts arrived since yesterday?
- Who has not been thanked?
- Which gifts need reconciliation?
- Which partners crossed the high-touch threshold?
- Which calls are due today?
- Did any sends fail?

## 3. Importing Partners

Trigger:

- Office provides Excel export.
- benmp.com export is provided.
- A regional coordinator provides a cleaned partner sheet.

Workflow:

1. Convert the sheet to CSV outside git.
2. Open partner import.
3. Upload CSV.
4. Preview rows.
5. Fix invalid phone/country/name rows.
6. Review duplicate candidates.
7. Confirm region-block assignment.
8. Commit import.
9. Review import summary.

Rules:

- Do not commit partner exports.
- Do not import rows without a usable name and at least one contact path.
- Prefer normalized phone matching over name-only matching.
- Unknown country should be corrected before production import where possible.

## 4. Gift Received Through Webhook

Trigger:

- Paystack, Stripe, or Hubtel sends a signed webhook.

Expected system behavior:

1. Webhook verifies signature.
2. Payment event is recorded.
3. Provider transaction is verified where possible.
4. Partner is matched by phone/customer/email.
5. Contribution is created.
6. Thank-you draft is queued.
7. Threshold rules update partner status.
8. High-touch task is created if needed.

Staff checks:

- Confirm unmatched events do not sit too long.
- Confirm acknowledgements are drafted.
- Confirm high-touch gifts have call owners.

## 5. Statement Import

Trigger:

- Mobile money wallet statement.
- Bank account statement.
- Remittance landing into wallet/bank without webhook.

Workflow:

1. Download statement from provider/bank portal.
2. Keep the file outside git.
3. Open Giving import.
4. Select statement type.
5. Upload CSV.
6. Preview mapping.
7. Confirm import.
8. Review matched, duplicate, ambiguous, and unmatched rows.
9. Resolve reconciliation queue.

Rules:

- Statement import is the ledger for webhook-less money.
- SMS can help staff understand a case, but it is not the ledger.
- Re-importing the same statement should not duplicate contributions.

## 6. Reconciliation

Use reconciliation when the system cannot confidently match money to a partner.

Actions:

| Action                       | When To Use                                                         |
| ---------------------------- | ------------------------------------------------------------------- |
| Match existing partner       | Sender phone/name/reference clearly belongs to an existing partner. |
| Create new partner and match | Donor is new but enough contact detail exists.                      |
| Leave pending                | More office investigation is needed.                                |
| Dismiss with reason          | Row is not a BENMP gift, is reversed, or was handled elsewhere.     |

Rules:

- Finance/admin role required.
- Dismissal requires a reason.
- Every action writes audit history.
- Matched rows promote through the same contribution path.

## 7. Thank-You Workflow

Trigger:

- New verified contribution.

Workflow:

1. Review thank-you draft.
2. Confirm partner name and amount.
3. Confirm channel preference.
4. Edit tone if needed.
5. Approve send.
6. Confirm sent/delivered status.
7. If failed, retry on another allowed channel or assign follow-up.

Rules:

- Auto-send is off until leadership approves it.
- Bulk thank-yous require approval.
- High-touch partners may need both message and phone call.

## 8. High-Touch Calls

Trigger:

- Gift meets or exceeds high-touch threshold.
- Gift is unusually high for that partner.
- Partner covers annual commitment.
- Important prayer/care note appears.

Workflow:

1. Task appears in Today/follow-up.
2. Owner calls partner.
3. Staff records outcome.
4. Staff records prayer requests or notes.
5. Staff schedules next action if needed.

Suggested call posture:

- Thank them sincerely.
- Confirm receipt.
- Ask if they have prayer needs.
- Share a short ministry update if appropriate.
- Avoid making the call feel transactional.

## 9. Messaging Batches

Use for:

- Monthly reminders.
- Monthly thank-yous.
- Crusade reports.
- Testimonies.
- Pre-crusade invitations.
- Birthday greetings.
- Lapsed partner care.

Workflow:

1. Choose segment.
2. Choose template.
3. Preview merged messages.
4. Check opt-outs.
5. Check WhatsApp template status.
6. Get named approval.
7. Send in controlled batches.
8. Review delivery failures.

Rules:

- No bulk send without named approval.
- No opted-out partner should receive a send.
- Messages in Bishop Dag's name require extra approval.
- AI drafts are drafts only until approved.

## 10. Monthly Close

Before Phase 5 snapshots, month-end reports may compute live values. Once snapshots exist, close freezes the month.

Close workflow:

1. Confirm all statements for the month are imported.
2. Resolve high-priority reconciliation rows.
3. Confirm major gifts are reviewed.
4. Confirm acknowledgements are sent or queued.
5. Run month close.
6. Review region-block snapshot.
7. Generate lapsed partner follow-up tasks.
8. Draft leadership summary.

Month-end questions:

- How many partners gave this month?
- Who did not give this month?
- What percentage is active by region block?
- How much came in by currency and USD equivalent?
- Which region needs follow-up?
- Which partners became active for the year?
- Which gifts need special attention?

## 11. Prayer Requests

Workflow:

1. Prayer request enters from partner record, message, call note, or staff entry.
2. Prayer team reviews queue.
3. Sensitive requests stay restricted.
4. Staff marks praying/responded/closed.
5. If a response is sent, it follows messaging approval rules where applicable.

Rules:

- Default prayer request sensitivity is high.
- Do not use prayer text casually in AI prompts.
- Do not expose prayer requests in broad reports.

## 12. AI Assistant Usage

Safe early uses:

- Ask for partner brief before a call.
- Ask who gave this month.
- Ask which reconciliation rows are open.
- Ask for a segment preview.
- Draft a thank-you message.
- Draft a coordinator brief.

Unsafe requests the AI must not perform directly:

- Send this message now.
- Mark this person as paid without evidence.
- Delete or hide this contribution.
- Ignore opt-out.
- Message everyone from Bishop Dag without approval.
- Show prayer requests outside role scope.

Staff should treat AI as a fast analyst and drafter, not as the final authority.

## 13. Handling Mistakes

Common cases:

| Problem                      | Response                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Wrong partner matched        | Finance/admin corrects match through audited correction path.                                         |
| Duplicate gift               | Mark duplicate through reconciliation/correction; preserve evidence.                                  |
| Wrong amount/currency        | Correct with audit note; keep original evidence.                                                      |
| Message sent to wrong person | Pause affected batch, record incident, contact partner if appropriate.                                |
| Provider webhook failure     | Review dead-letter/replay queue once Phase 6 exists; before then inspect logs and provider dashboard. |
| Partner opt-out missed       | Immediately mark opt-out, stop future sends, review consent bug.                                      |

## 14. Emergency Pause

Situations that justify pause:

- Provider sends duplicate or incorrect webhooks.
- Bad message template is about to send broadly.
- Partner PII is exposed.
- AI produces unsafe drafts at scale.
- Staff account appears compromised.

Pause actions:

1. Disable auto-send or message dispatch feature flag.
2. Disable provider webhook promotion if needed.
3. Remove or deactivate compromised user.
4. Preserve logs and audit trail.
5. Notify technical owner.
6. Record incident summary and fix before resuming.

## 15. Weekly Review

Weekly office review:

- New partners added.
- Total giving by region block.
- Unmatched gifts still pending.
- High-touch calls completed.
- Failed messages.
- Prayer requests needing response.
- Provider/account issues.
- Upcoming crusades needing partner updates.

The weekly review should produce action owners, not just reports.
