# Design notes

## What the design is for
Every person at the firm opens the same evidence, but a preparer, a reviewer, a partner, the firm administrator, the quality reviewer and the client do different jobs. So the shell changes with the role:

| Role | Rail | Home | Top-bar action | Signal colour |
|---|---|---|---|---|
| Preparer | Home, Findings, Return, Changes, Documents, People, Records, Filing | "N things need you": tax bridge, findings by area, my queue, readiness ring | + Adjustment | indigo |
| Reviewer | Review desk, Approvals, Sign-offs, Findings, Return, Records | Awaiting approval (inline approve/reject with the role rules), areas ready to sign, blocking notes | Approvals · n | teal |
| Partner | Partner desk, Release & filing, Sign-offs, Approvals, Findings, Firm, Audit log | Release blockers, items that need a partner, risk and outside filings, readiness ring | Release & filing | violet |
| Firm administrator | Firm desk, Standards & time, Team & roles, Audit log | Team and clearance, time against budget, thresholds, chain integrity, view-log count | Log time | amber |
| Quality reviewer | QA desk, Frozen return, Findings, Notice response, Records | Sign-off coverage, frozen hash, amendments, reconciliations | Frozen return | slate |
| Client | Home, My questions, My documents, Approve & sign, My copy | Plain-language journey, what we need from you, what we changed | Approve & sign | green |

## References used
These are design influences from products I know well, applied from memory. I did not browse or copy any assets, and none of this is a pixel match.
- **Linear**: command palette (Ctrl K), dense list-then-inspector pattern, keyboard-first. Used for the palette and the slide-over inspector.
- **Stripe Dashboard**: restrained colour, tabular numerals, KPI strips above detail tables. Used for the home KPIs and the tables.
- **GitHub pull-request review**: threads attached to specific lines, review notes that block merge, approvals with rules. Used for review notes, approvals and sign-offs.
- **Figma / Notion**: right-hand inspector for the selected object. Used for the trace drawer.
- **Financial terminals and ledgers**: monospaced tabular figures, strikethrough for superseded values. Used for numbers and adjustments.
- **Waterfall (bridge) charts** from finance reporting: used for "where the tax moves".
- Typography: Manrope (UI) and IBM Plex Mono (figures), both from Google Fonts, with system fallbacks. Palette: ink rail, cool paper canvas, one accent, per-role signal colour; light and dark.

## New features in this version
Role-aware navigation, top bar and home desks; command palette; notifications menu; tax bridge chart; findings-by-area heat bars; readiness ring; first-run guide per role and a guide drawer; client journey; "Load demo activity" to populate every desk; mobile bottom navigation.

## Feature ideas, in the order I would build them
1. **Real multi-user**: move the event log to a shared store (a hosted database or a small server) so people on different machines see changes live; add sign-in so roles come from identity, not a switcher.
2. **Page-image overlay**: render real pages from the extraction pipeline and draw the packet's coordinates over them.
3. **Export**: review memo, client copy and IRS response as PDF or Word; one-click audit bundle (log + evidence).
4. **Client portal**: uploads with automatic "what is this?" classification, e-signature with real identity proofing, SMS/email reminders.
5. **Deadlines calendar** with extension and estimate reminders; a firm-wide board across clients; time tracking with timers.
6. **Saved views, bulk editing of variances, keyboard shortcuts in lists**; comparison of two document versions side by side.
7. **Risk scoring** across the firm's returns: which clients repeat the same error types.
