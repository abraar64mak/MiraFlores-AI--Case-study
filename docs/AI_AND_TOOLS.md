# How AI and other tools were used

The brief allows any tools, including AI, and asks how they were used.

**Tool.** I worked with Claude Code (an AI coding assistant) in an interactive session. I used it for research summaries, analysis scripts, implementation, test automation and first drafts of documents.

**My part.** I set the direction and scope: the evidence-and-claims idea, independent checks between sources, the roles and their rules, and which parts to build deeply and which lightly. I reviewed what the tool produced, ran it, and corrected it.

**How the packet was read.** With scripts, not by eye: structure dumps, comparisons of each page's `printed_content` against its `extracted_values`, comparisons between documents, and diffs between the three return versions. I confirmed every error in `ERRORS_FOUND.md` against the printed text of the documents before it became a check.

**Research.** Before building I searched for related work on provenance, rules as code and automation bias (W3C PROV, why- and where-provenance, provenance semirings, Catala, Parasuraman and Manzey, auditor automation studies, local-first software). I used it to shape the design. Several papers were only read as abstracts and are described that way.

**Testing.** A headless browser walk through every route (`tools/e2e.mjs`), a scripted season through the real app code including role enforcement, stale sign-offs, an e-file rejection and acceptance, freeze and amendment (`tools/flow.mjs`), and a logic test (`tools/logic-test.mjs`).

**AI in the app.** None. The checks that find the errors are deterministic code, so the same packet always produces the same findings, and nothing in the app calls a model.

**Known limits.** Tax effects are estimates (change multiplied by the rate the packet gives, because the engine cannot be rerun). The source pages are rendered from the packet's text, not real page images. The app has no server, so "several people at once" means several tabs of one browser.
