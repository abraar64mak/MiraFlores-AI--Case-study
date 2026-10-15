# Core idea and data model

## The idea: a return is a set of claims, and every claim carries its own proof

A traditional workpaper is a grid of numbers with ticks and notes beside it. The proof lives next to the number, and nothing keeps it true when the number moves.

Here every number is a **claim**, and a claim is a node in a graph:

- **Where** it came from: a document, a page and a field (the packet's `extracted_values`), or a client answer, a prior-year record, an agency record.
- **Why** it has this value: the engine rule and the claims it was computed from (`inputs`), so any total opens into a tree down to documents.
- **How it was verified**: agreed to source, recalculated, confirmed with the client, agreed to prior year, agreed to a third-party record.
- **What is open**: findings, review notes, adjustments, sign-offs that cover it.

Three mechanisms make this trustworthy rather than decorative:

1. **Independent checks.** The packet "contains confident mistakes" (pipeline confidence is 0.94–0.99 on every one I found), so neither the engine nor the extraction score is the checker. Checks compare documents with documents (a 1099-K that is a subset of a 1099-NEC, a page scanned twice, one interest account on two forms), answers with documents, and the return with outside records (IRS transcript, FTB account). 29 findings, 11 error-level, none in the engine's own diagnostics. 29 reconciliations ("figures that should agree") recompute from the live return, so a correction makes the difference disappear.
2. **An append-only, hash-chained event log.** Everything the workpaper knows beyond the packet is an event (adjustment, verification, question, sign-off, view of a sensitive value, release, signature, e-file result, freeze). State is a projection of the log. That gives undo in batches, "what changed since I last looked", a tamper check, and a record that can be exported years later.
3. **Dependency-driven reopening.** A sign-off stores the value of every line it covers. If any value changes, it reopens by itself. The same digest idea makes the partner's release and the clients' e-signatures go stale when the return changes after they were given.

Adjustments never overwrite. An adjustment is its own entry (who, why, evidence, tax effect). Sums and carries are re-evaluated through the graph so AGI moves live; tax effect is `change × the engine's per-dollar rate`, because the README says the engine cannot be rerun. At filing the return freezes (snapshot + hash); later changes are flagged as amendments layered on top.

## Data model

| Entity | Key fields | Built from |
|---|---|---|
| Document | id, type, pages, extraction status, disposition (used / superseded / duplicate / procedural / not extracted) | `documents[]` |
| Observation | document, page, field, text as printed, value, confidence | `extracted_values[]` |
| Claim | key, value, rule, inputs, sources, jurisdiction, area | `return_versions[].lines[]` |
| Finding | id, severity, kind, evidence refs, affected claims, suggested adjustments, status | independent checks + engine diagnostics |
| Adjustment | target, set/delta, category, sign, reason, evidence, author, status, what-if, amendment | new (event) |
| Verification | target, type, evidence, author | new (event) |
| Thread | kind (client question, colleague question, review note, task), target, assignee, due, blocking, messages | `client.*` + new |
| Decision | kind (judgment, election, due diligence, penalty), authority relied on, approvals | new |
| Sign-off | area, level, values at signing, state (valid / reopened) | new |
| Event | actor, role, type, payload, batch, prev hash, hash | everything above |

Everything on the Records tab (16 records a CPA expects) is a view over these claims; nothing is typed twice.

## Trade-offs

- **Static client-side app, browser storage.** It runs from a link and saves everything, but several people at once means several browser tabs or windows of one browser (storage events and a broadcast channel keep them in sync, with presence). A server with per-user auth would replace the log store; the event model would not change.
- **Simulated source documents** are rendered from `printed_content`; highlights are placed by text match. Real page images with the packet's coordinates can replace the view without changing any trace link.
- **Tax effects are estimates** (change × rate) and are labelled so; large changes can cross thresholds.
