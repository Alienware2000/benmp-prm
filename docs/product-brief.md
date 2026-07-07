# Product Brief

## One-liner

BENMP PRM is an internal partner stewardship platform for BENMP and the Healing Jesus Campaign.

## Problem

BENMP needs more than a contact list. Staff need a reliable way to know who partners are, how they give, how they prefer to be contacted, what crusades they support, what prayer needs they have shared, and who needs follow-up.

Many partners may not use a portal. The ministry team should meet them through familiar channels: WhatsApp, SMS, email, and phone calls.

## Users

- Super admin: owns configuration, roles, and all data.
- Finance: manages giving imports, payment reconciliation, receipts, and recurring giving health.
- Communications: builds segments and sends WhatsApp, SMS, and email campaigns.
- Regional coordinator: sees partners and follow-up queues in assigned countries or regions.
- Prayer team: manages prayer requests and pastoral follow-up.
- Viewer/auditor: read-only access for reporting and oversight.

## MVP Scope

1. Partner profiles
   - Full name, mobile, WhatsApp, email, country, city, church, partner date, level, giving frequency, preferred communication, birthday, prayer requests, notes, tags, assigned coordinator.

2. Giving records
   - Contribution date, amount, currency, payment method, campaign/crusade, lifetime giving, last gift, recurring status, missed-month flags.

3. Campaigns/crusades
   - Upcoming campaigns, funding appeal status, partner support, reports, testimonies, media links, communication history.

4. Communication
   - Segments, templates, message drafts, channel preference, consent/opt-out tracking, send history.

5. Follow-up
   - Tasks, owners, due dates, priority, channel, reason, outcome, call notes.

6. Prayer requests
   - Request text, status, sensitivity, assigned team, response history.

7. Operations
   - Imports, exports, audit log, role-based access, country-by-country reports.

## AI Later, Not First

The AI layer should make staff work easier after clean data exists. Early examples:

- Summarize a partner before a phone call.
- Draft WhatsApp/SMS/email variants for a selected segment.
- Convert natural language into reviewable filters.
- Reconcile payment exports and flag ambiguous records.
- Produce country coordinator briefs.
- Suggest follow-up tasks from missed gifts and prayer notes.

AI actions must be supervised first. Any send, export, data mutation, or bulk action requires staff review and approval.

## Non-goals For MVP

- Public donor portal replacement.
- Social network/community app for partners.
- Autonomous unsupervised messaging.
- Card storage or payment processing inside the app.
- Full call center implementation.
