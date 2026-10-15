# Core idea and data model

**Okafor-Lindqvist 2025 tax workpaper**

## The idea: every number is a claim that carries its own proof

A workpaper is usually a grid with ticks and notes beside it. The proof sits next to the number, and nothing keeps it true when the number moves. Here every number is a **claim** in a graph, and each claim carries four things:

- **Where** it came from: a document, page and field, or a client answer, prior-year record or agency record.
- **Why** it has this value: the engine rule and the claims it was computed from, so any total opens down to documents.
- **How it was verified**: agreed to source, recalculated, confirmed with the client, agreed to prior year, agreed to a third-party record.
- **What is open**: findings, review notes, adjustments and sign-offs that touch it.

Three mechanisms keep this honest:

1. **Independent checks.** The packet "contains confident mistakes" (every one I found had pipeline confidence 0.94 to 0.99), so neither the engine nor the confidence score is the checker. Checks compare documents with documents, answers with documents, and the return with the IRS and FTB records. Result: 29 findings, 11 at error level, none in the engine's own diagnostics, plus 29 reconciliations that recompute from the live return.
2. **An append-only, hash-chained event log.** Every adjustment, verification, question, sign-off, release, signature and filing step is an event. State is a replay of the log, which gives undo, "what changed since I last looked", a tamper check, and a record that survives a 2028 examination.
3. **Dependency-driven reopening.** A sign-off stores the value of every line it covers and reopens by itself if any changes. The same rule makes a release or an e-signature go stale if the return changes after it was given.

Adjustments never overwrite: each is its own entry with who, why, evidence and tax effect. Sums and carries re-evaluate through the graph, so AGI moves live. Tax effect is change × the engine's per-dollar rate, since the README says the engine cannot be rerun. At filing the return freezes (snapshot and hash); later changes are amendments on top.

## Data model

| Entity | Key fields | Source |
|---|---|---|
| Document | id, pages, extraction status, disposition | `documents[]` |
| Observation | document, page, field, as printed, value, confidence | `extracted_values[]` |
| Claim | key, value, rule, inputs, sources, area | `return_versions[].lines[]` |
| Finding | severity, evidence refs, affected claims, suggested adjustments, status | checks + diagnostics |
| Adjustment | target, set or delta, category, reason, evidence, author, status | new (event) |
| Verification, Thread, Decision | target, type, evidence; assignee, due, blocking; authority relied on | new (events) |
| Sign-off | area, level, values at signing, state (valid or reopened) | new (event) |
| Event | actor, role, type, payload, previous hash, hash | everything above |

All 16 CPA records are views over these claims, so nothing is typed twice.

## Trade-offs

- **Static app, browser storage:** it runs from a link and saves everything, but "several people at once" means several tabs of one browser. A server would replace the log store; the event model would not change.
- **Simulated source pages** are rendered from `printed_content`; real page images can replace them without changing any trace link.
- **Tax effects are estimates**, labelled as such; large changes can cross thresholds.
