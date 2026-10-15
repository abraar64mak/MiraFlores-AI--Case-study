# Video script (word for word, about 8 minutes)

Read it in your own voice. Change any words that don't sound like you. Text in *[brackets]* is what to do on screen. About 130 words per minute is a comfortable pace.

---

## 1. Intro and the link (0:00 to 0:40)

*[Show the live site loading.]*

Hi, I'm Abraar. This is my answer to the Miraflores case study, "Redesign the Tax Workpaper".

What you see is a web app that runs from this link. When it opens, it loads the packet exactly as it was delivered. Nothing in the packet was edited. I'll show you the proof in a moment.

I'll go through it in this order: the idea, the errors I found, how the design shows them, how the different people use it, and then the filing story.

## 2. The idea (0:40 to 1:30)

*[Show the Overview screen, role: Priya, preparer.]*

My idea is simple. In a normal workpaper, a number is just a number. In mine, every number is a claim, and the claim carries its own proof: where it came from, why it has this value, how it was checked, and what is still open.

I took this from research on data provenance, and from the audit trail papers. A CPA always asks two questions about a number: where did it come from, and why is it this value. So the screen answers both.

*[Point to the Activity tab, event 0.]*

Here, event number zero is the fingerprint of the packet. It is the same file that was delivered.

## 3. The premise: confident mistakes (1:30 to 2:10)

*[Back to Overview.]*

The README of the packet says one sentence I kept coming back to: "The packet contains confident mistakes."

I found 15 of them. Every wrong value had a confidence of 94 to 99 percent, so the confidence score did not help at all. And none of the eleven errors that change the tax were in the software's own warnings. The mistakes were between documents, not inside one.

So my screen does not show confidence. It shows where sources disagree.

## 4. Findings and evidence (2:10 to 3:30)

*[Open Findings. Click "Schedule C gross receipts overstated by the 1099-K".]*

This is one of those errors. The return says the business had 163,700 of income. The books say 151,300. The difference is exactly one 1099-K for 12,400. The books show that money was already inside a client's 1099-NEC, so it was counted twice.

*[Click an evidence chip. The document opens with the field highlighted.]*

Every piece of evidence opens the exact page, with the field highlighted. No searching through 74 documents.

*[Click Propose adjustment.]*

I can propose an adjustment. The original number stays, the new number sits next to it, and the screen shows how much the adjusted gross income moves and an estimate of the tax effect. It is an estimate because I can't rerun the tax engine, so I use the rates the packet gives me and I say so on screen.

*[Click Undo, then Redo.]*

Everything can be undone and redone, because every action is saved in a log.

## 5. Trace a number (3:30 to 4:10)

*[Go to Return, Schedule C, gross receipts.]*

Here I follow a number. This is its derivation: the lines it was built from, the source page with the highlighted field, the verification record, and who signed what. A reviewer, or an examiner years later, can answer "why is this number here" without asking me.

## 6. Reconciliations (4:10 to 4:50)

*[Go to Records, then Reconciliations.]*

This is the list of figures that should agree: the return against the IRS record, one document against another, the client's answers against the documents. There are eleven differences, and each one is tied to a finding.

*[Approve one adjustment.]*

When I approve an adjustment, you can see its difference disappear.

## 7. Roles (4:50 to 6:00)

*[Switch to Daniel, reviewer.]*

The role switcher is not decoration. The rules are enforced. Daniel is a reviewer. He is blocked from approving a 4,464 adjustment, but he can approve a small one.

*[Switch to Helen, partner.]*

Larger ones need Helen, the partner.

*[Switch to Marcus.]*

Marcus has no clearance, so the social security numbers are masked and he can't reveal them.

*[Switch to Priya, reveal one, then open Firm and view the log.]*

When Priya does reveal one, the reveal is written into the log. And each role has its own home screen, because a preparer wants things to fix, a reviewer wants things to approve, and a partner wants to know what blocks the release.

## 8. Sign-offs reopen (6:00 to 6:40)

*[Daniel signs Investments. Switch to Priya, change one line in it. Open People, then Sign-offs.]*

Daniel signs off on Investments. The sign-off remembers the numbers it covered. Now Priya changes one line, and the sign-off reopens by itself and lists the lines that changed. Nobody has to remember to ask again.

## 9. Documents and completeness (6:40 to 7:00)

*[Open Completeness.]*

All 74 documents are accounted for, and every client answer shows where it ended up in the return.

## 10. Filing and after (7:00 to 7:40)

*[Open Filing. Release the return.]*

The partner releases the return, then both spouses sign.

*[Switch to Ngozi and Erik, sign. Transmit.]*

The first e-file is rejected because the son's social security number is wrong. A review note opens by itself. The fix makes the signatures stale, so everything has to be signed again.

*[Fix, re-release, re-sign. Show Accepted and Frozen.]*

After it is accepted, the return is frozen, with a fingerprint. Later changes become an amendment on a separate layer.

*[Show client copy, IRS letter response, roll-forward.]*

After filing, there is a client copy in plain words, a record for answering an IRS letter, and a plan for next year.

## 11. Trade-offs and close (7:40 to 8:20)

*[Show docs/ONE_PAGER.md or the one-pager PDF.]*

Some honest limits. Everything is saved in the browser, so "several people" means several tabs, not several computers. The documents are simulated pages from the packet. And the tax effects are estimates from rates, not a rerun of the engine. With a server, the log would be shared and the roles would be real accounts.

I used Claude Code to help build this. I chose the direction and the scope and I checked every error against the printed text of the documents. The note on how I used it is in the repository.

The blog, the one-pager and the errors list are all linked from the README. Thank you for watching.

---

### Before you record

- Open the app and press the reset button so it starts clean.
- Practice the filing part once, because it has the most steps.
- Keep the video near 8 minutes. If it runs long, shorten sections 6 and 9 first.
- Put the link to the video in the README and in your submission.
