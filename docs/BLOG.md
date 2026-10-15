# How I approached the Tax Workpaper case study

Miraflores sent me a three-page brief and one big JSON file. The brief was short: build a working, web-native tax workpaper for one complicated household, and don't make it a spreadsheet. This is the story of how I got from that PDF to a working app, in the order it actually happened.

Live site: https://abraar64mak.github.io/MiraFlores-AI--Case-study/

## What I was given

The brief explains the setting. At Miraflores, software reads a client's documents and computes the return, and CPAs review it. The workpaper is the place where someone proves the return is right: where every number came from, what was done to it, who checked it, and what is still open. It has to work for preparers, reviewers, partners, the client, the firm's administrator, next year's preparer, and even an IRS examiner years later. The bar is that a 20-year CPA finds it faster and more trustworthy than anything they've used, and a new hire can use it on day one.

Then there is a long list of things it must do: trace numbers to sources, show how they were built, handle change without losing the original, record judgment, run reviews and sign-offs, handle filing and what happens after, and generate the records a CPA expects. I counted about twenty-five separate capabilities, which told me early that I could not build all of them equally well.

The data is the Okafor-Lindqvist household, invented but realistic. They moved from California to Texas mid-year, and the return includes stock compensation, a one-person business, two brokerages and crypto, a Swedish bank account, a rental and a rental that was sold, two K-1s, a backdoor Roth, a college student, and gifts of stock and a car. The packet holds 74 documents, about 3,000 extracted values, three computed versions of the return, client answers, prior years, IRS records, firm staff and a timeline. And one sentence in the README that I underlined: "The packet contains confident mistakes."

## Understanding the data and taking notes

I started by getting to know the file instead of designing anything. I wrote small scripts to print its structure, then compared two things the README says are different: what is actually printed on each page, and what the pipeline says it read. I also diffed the three versions of the return to see what changed between them and why.

My notes from that stage were mostly a list of things that looked wrong. A few examples:

- Schedule C gross receipts were 163,700, but the books said 151,300. The difference was exactly a 1099-K for 12,400, and a note in the books showed that money was already part of one client's 1099-NEC. It was counted twice.
- The mileage log had four pages, but page 3 was a second scan of page 2. The 3,700 miles on it were counted twice.
- The 1098 for the home loan already included the interest paid at payoff, and the return added it again.
- The Halvorsen W-2 showed 111,300 of California wages, because the employer had kept California as the work state by mistake. The paystub showed only 22,469 of California wages before the move.
- Theo's Social Security number was typed wrong in the client's organizer. The card the client later uploaded had a different number, and the return used the wrong one.

I ended up with 15 errors. What struck me is that every one of them had a pipeline confidence between 0.94 and 0.99. Confidence scores were no help at all. The mistakes lived between documents, not inside one. Also, none of the 11 errors that affect tax directly showed up in the engine's own diagnostics list.

## Research

Once I knew the problem, I wanted to know how other people think about it, so I read around. Nothing I found was about tax workpapers specifically, but several areas fit one part of the problem each.

- **Data provenance.** Buneman and colleagues separate "where" a value was copied from and "why" it exists, meaning which inputs decided it. That matched what a CPA needs when they ask about a number. Green and colleagues' provenance semirings explained how a derived value can be traced back through its inputs. The W3C PROV model gave me a common vocabulary of documents, activities and people.
- **Trustworthy audit trails.** A paper on provenance-based audits made the point that an audit result is only as trustworthy as the records behind it, which pushed me toward a tamper-evident log.
- **Rules as code.** The Catala paper found a bug in an official tax implementation. That fit my situation: the engine can be wrong, so it can't be the only checker.
- **Why not spreadsheets.** Spreadsheet-error research, including Panko's field audits, says errors hide in relationships between cells. I only saw summaries of some of this, so I used it for motivation, not for numbers.
- **People trust automation too much.** Parasuraman and Manzey's work on automation bias, and a working paper on auditors being less skeptical of automated output, told me that a reviewer who sees "99% confident" will probably stop checking.
- **Local-first software.** This supported making the app run in the browser and keep its data there.

## Taking the research and turning it into an approach

I tried to turn each idea into one design decision.

1. Every number is a **claim** with a where, a why, how it was verified, and what is open. That came from the provenance work.
2. The checks compare **sources with each other**, not numbers with their own sources. Documents against documents, client answers against documents, the return against the IRS transcript. That came from the engine being fallible and the confidence scores being useless.
3. Everything that happens is an event in an **append-only log**, chained with hashes so history can't be quietly changed. That came from the audit-trail work and from the brief's many "who, when, why" requirements.
4. A sign-off remembers the values it covered. If any of them changes, the sign-off **reopens**. The same idea makes a client's e-signature go stale if the return changes after they signed.
5. The interface shows **disagreement instead of confidence**. That came from the automation-bias research.

I also decided what not to do. I didn't try to rebuild the tax engine, because the README says the engine can't be rerun. Tax effects are estimated as the change times the engine's own per-dollar rate, and the app says so.

## Brainstorming and design

Before I settled on this, I considered a few other shapes.

- **A smarter spreadsheet** with comments and colors. The brief rules this out, and it hides the relationships where the errors are.
- **A document-first viewer**, where you read PDFs and tick things off. Good for evidence, weak for calculation and review.
- **A chat or AI-first assistant**. Appealing, but a CPA needs the same answer every time, and a model that sometimes guesses works against the "more trustworthy" bar.

I chose the claim graph, with documents, calculations and review all attached to the same objects. For the screens, I thought about who actually opens this and why. A preparer wants a work queue. A reviewer wants approvals and sign-offs. A partner wants to know what stands between the file and release. The administrator wants thresholds, access and time against budget. A quality reviewer wants to see what was frozen. The client wants plain language and one clear next step. So I built six different home screens on the same data, with the navigation and top-bar action changing with the role.

Some trade-offs I accepted on purpose:

- A static app that saves in the browser, so it runs from a link. The cost is that "several people at once" means several tabs of one browser, not several computers.
- Source documents are simulated from the printed text, as the brief suggests, and built so real page images could replace them without changing any trace link.
- Roles are enforced in the app, including the rule that nobody can approve or sign off on work they prepared.

## The work

I built it in layers, testing as I went.

First the model: load the packet exactly as delivered, index every document, value and line, and build the derivation graph. Then the checks and reconciliations, which produced 29 findings and 29 "figures that should agree" checks. Then the event log, undo, adjustments that keep the original, and sign-offs that reopen. Then the screens: trace any number to the highlighted field on its source page, findings with evidence and a suggested fix, a ledger of changes, version comparison, people and threads, and the 16 records a CPA expects.

Then the filing story. A partner releases the return, both spouses sign, and the e-file goes out. The first transmission is rejected because of Theo's SSN, a review note opens automatically, the fix makes the release and signatures stale, and everything has to be redone. After acceptance the return freezes with a hash, and later changes become amendments layered on top. From there I added the client's copy, a response record for an IRS letter, and a roll-forward to next year.

I tested it the way a reviewer would use it: a script walks every screen in every role, another runs a whole season, including the rejection, stale signatures, freeze and amendment, and a third checks the phone layout. Publishing it on GitHub Pages took a couple of tries before the settings were right.

## How I used AI

I built this with Claude Code, working with it in conversation. I set the direction and decided the scope. I chose the evidence-graph approach, asked for the redesign, and made calls on what to keep and cut. Claude Code wrote most of the code and drafts of the documents, and it ran the scripts I described above. Every error in my list was checked against the printed text of the documents before I trusted it. The app itself is deterministic: the same packet always gives the same findings. There are optional AI helpers in the code, but they only appear on a hosted version and are not part of the public site. The full account is in `docs/AI_AND_TOOLS.md`.

## What I would do next

- Make it truly multi-user with a shared store and sign-in, so roles come from identity.
- Replace simulated pages with real page images and the packet's coordinates.
- Export the review memo and the client copy as PDF.
- Record the walkthrough video, which is the one required piece still missing, with the outline in `docs/VIDEO_SCRIPT.md`.

If I had to give one lesson from this: the interesting errors weren't in any single document. They were in the gaps between them, and a workpaper that makes those gaps visible is more useful than one that makes each number look confident.
