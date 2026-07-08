# Product Brief

## One-liner

BENMP PRM is an internal donation intake and partner stewardship platform for BENMP and the Healing Jesus Campaign.

## Problem

BENMP needs more than a contact list. A gift should immediately become a relationship moment: the donor is identified, thanked, classified, and placed into the right follow-up or care workflow.

Staff need a reliable way to know who partners are, how they give, how they prefer to be contacted, what crusades they support, what prayer needs they have shared, and who needs follow-up.

Many partners may not use a portal. The ministry team should meet them through familiar channels: WhatsApp, SMS, email, and phone calls.

## Users

- Super admin: owns configuration, roles, and all data.
- Finance: manages giving imports, payment reconciliation, receipts, and recurring giving health.
- Communications: builds segments and sends WhatsApp, SMS, and email campaigns.
- Regional coordinator: sees partners and follow-up queues in assigned countries or regions.
- Prayer team: manages prayer requests and pastoral follow-up.
- Viewer/auditor: read-only access for reporting and oversight.

## MVP Scope

1. Donation intake
   - Accept or ingest Mobile Money, card, and bank-transfer gifts through provider webhooks/imports.
   - Store raw payment events before matching so finance can reconcile ambiguous donations.
   - Match donors by phone, MoMo number, email, provider customer, or manual review.

2. Acknowledgement workflow
   - Every successful gift creates an approved thank-you message or a staff review item.
   - Messages should feel personal: name, amount, campaign, continued partnership, and appropriate tone.
   - Failed or unmatched acknowledgements stay visible until resolved.

3. Partner profiles
   - Full name, mobile, WhatsApp, email, country, city, church, partner date, level, giving frequency, preferred communication, birthday, prayer requests, notes, tags, assigned coordinator.

4. Giving records and donor status
   - Contribution date, amount, currency, payment method, campaign/crusade, provider reference, lifetime giving, last gift, recurring status, missed-month flags.
   - $5/month is the BENMP baseline assumption.
   - $60 or local equivalent marks the donor active for the year.
   - $100 or board-defined local equivalent marks the donor for high-touch acknowledgement and personal care.

5. Campaigns/crusades
   - Upcoming campaigns, funding appeal status, partner support, reports, testimonies, media links, communication history.

6. Communication
   - Segments, templates, message drafts, channel preference, consent/opt-out tracking, send history.
   - Donation-triggered thank-yous, crusade updates, reports, testimonies, birthday greetings, and gentle reminders.

7. Follow-up
   - Tasks, owners, due dates, priority, channel, reason, outcome, call notes.
   - All donors may receive a call; high-touch donors should be prioritized for faster personal attention.

8. Prayer requests
   - Request text, status, sensitivity, assigned team, response history.

9. Operations
   - Imports, exports, audit log, role-based access, country-by-country reports.

## AI Later, Not First

The AI layer should make staff work easier after clean data exists. Early examples:

- Summarize a partner before a phone call.
- Draft WhatsApp/SMS/email variants for a selected segment.
- Convert natural language into reviewable filters.
- Reconcile payment exports and flag ambiguous records.
- Produce country coordinator briefs.
- Suggest follow-up tasks from missed gifts and prayer notes.
- Draft personalized donor thank-yous from contribution context, while keeping staff approval for sensitive or bulk sends.

AI actions must be supervised first. Any send, export, data mutation, or bulk action requires staff review and approval.

## Non-goals For MVP

- Public donor portal replacement.
- Social network/community app for partners.
- Autonomous unsupervised messaging.
- Card storage or payment processing inside the app.
- Full call center implementation.
