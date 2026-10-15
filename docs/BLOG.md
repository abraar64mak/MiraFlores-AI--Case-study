# How I did the Miraflores tax workpaper case study

Live site: https://abraar64mak.github.io/MiraFlores-AI--Case-study/
Code: https://github.com/abraar64mak/MiraFlores-AI--Case-study

This is a diary of what I did, in the order I did it. I wrote it so I would remember my own thinking, and so anyone reading my submission can see how I got there.

## Step 1: I got the assessment

On 14 October 2026 I received the test assessment from Miraflores. It was a three-page PDF called "Case Study: Redesign the Tax Workpaper" and one big JSON file. I started working on it the same day.

I read the PDF slowly, twice. Here is what I understood and the notes I wrote down:

- At Miraflores, software reads the client's documents and works out the tax return. CPAs then review it.
- The workpaper is where someone proves the return is right. Where did each number come from, what was done to it, who checked it, what is still open.
- Lots of different people use it: preparers, reviewers, partners, the client, the firm's admin, next year's preparer, even an IRS examiner years later.
- They said clearly: do not build a spreadsheet. Pretend you have never seen a workpaper and invent one from the goals.
- The bar: a CPA with 20 years of experience should find it faster and more trustworthy than what they use now, and a new person should be able to use it on day one.
- The list of things it must do was long. I counted about 25: evidence, calculation, change, judgment, people, filing and after, firm, and a list of records a CPA expects.
- I do not need to know tax law and I do not need to read documents myself. That part is done for me.
- What to hand in: a working web app on a link, one page on my core idea and data model, the errors I found and how my design showed them, a video, and a note on how I used AI.

My first conclusion was simple. I cannot build all 25 things equally well, so I have to choose what matters most and make that really good.

## Step 2: I opened the data

The JSON file is the household of Okafor and Lindqvist (invented). They moved from California to Texas in the middle of the year. They have stock pay from an employer, a one-person business, two brokerages and crypto, a Swedish bank account, a rental and a rental they sold, two K-1s, a backdoor Roth, a college student, and gifts of stock and a car.

Inside the file:

- 74 documents
- about 3,000 values the software read from those documents, each with a confidence score
- three versions of the computed return
- the client's answers and messages
- last year's return, IRS records, the firm's staff, and a timeline

The README had one sentence I noted twice: "The packet contains confident mistakes."

Key notes from the README:

- The printed text on each page is the truth. The extracted values can be wrong. The computed return can be wrong too.
- I cannot rerun the tax engine. To show the effect of a change I have to multiply the change by the rate it gives.
- Version 3 is the current return.

Then I looked for the mistakes. I wrote small scripts to print the structure, compare printed text with extracted values, compare documents with each other, and see what changed between the three versions. These are some of the things I found:

- The business income on Schedule C was 163,700, but the books said 151,300. The gap was exactly one 1099-K for 12,400. The books showed that money was already inside one client's 1099-NEC. It was counted twice.
- The mileage log had four pages. Page 3 was a second scan of page 2, so 3,700 miles were counted twice.
- The home loan form already included the interest paid when the loan was paid off, and the return added that interest again.
- One W-2 showed 111,300 as California wages, because the employer kept California as the work state by mistake. The paystub showed only 22,469 before the move.
- The son's Social Security number was typed wrong in the client's form. The card they uploaded later had a different number.

By the end I had a list of 15 errors. The thing that surprised me most: every wrong number had a confidence of 0.94 to 0.99. The scores did not help at all. And none of the 11 errors that change the tax were in the software's own list of warnings. The errors were between documents, not inside one.

## Step 3: I searched how other people solve this

I did not find anything about tax workpapers specifically. So I searched for the pieces of the problem separately. These are the notes I took:

- **Provenance (where data comes from).** One paper splits it into "where" a value was copied from and "why" it exists, meaning which inputs decided it. A CPA asks exactly these two questions about a number. A second paper, on provenance semirings, shows how a calculated value can be traced back through its inputs. There is also a W3C standard (PROV) that gives names to documents, activities and people.
- **Audit trails.** A paper about audits based on provenance said an audit is only as trustworthy as the records behind it. That made me want a log nobody can quietly change.
- **Tax software that explains itself.** I found some patents that describe a graph of tax calculations where each step carries an explanation. Useful as an idea, but they are patents, not research.
- **Law as code.** The Catala paper found a bug in an official tax program. That made me trust the engine less, which fit what I saw in the data.
- **Spreadsheet errors.** Studies of spreadsheets say mistakes hide in the links between cells. That is why a grid felt wrong for this job. I only saw summaries of some of these studies, so I used them as motivation, not as numbers.
- **People trust automation too much.** Papers on automation bias, and one on auditors, say reviewers become less careful when a tool looks sure. That explained my confidence-score finding.
- **Local-first software.** The idea that an app can keep the user's data in the browser and still work well.

## Step 4: I turned the research into an approach

For each idea I asked what it means for my app. I ended up with five decisions:

1. Every number is a **claim** that carries its own proof: where it came from, why it has this value, how it was checked, and what is still open.
2. The checks compare **sources with each other**, not a number with its own source. Documents against documents, client answers against documents, the return against the IRS record.
3. Every action is saved in a **log** that is chained with hashes, so history cannot be changed without it showing.
4. A sign-off remembers the numbers it covered. If one changes, the sign-off **reopens** by itself. The same idea works for the client's e-signature.
5. The screen shows **disagreement** between sources and not confidence.

I also decided what I would not do. I would not rebuild the tax engine. I would estimate tax effects with the rates the packet gives me and say clearly they are estimates.

## Step 5: I brainstormed

I thought about three shapes before choosing:

- A smarter spreadsheet. The brief already said no, and it hides the links where the errors live.
- A document viewer where you read PDFs and tick things off. Good for evidence, weak for calculation and review.
- A chat assistant that answers questions. It sounded nice, but a CPA needs the same answer every time, and that works against "more trustworthy".

So I went with the claims idea. Then I asked who opens this and what they want:

- A preparer wants a list of things to fix.
- A reviewer wants things to approve and areas to sign.
- A partner wants to know what is blocking the release.
- The firm admin wants settings, access and hours.
- A quality reviewer wants to see what was frozen at filing.
- The client wants plain words and one next step.

That is how I decided on a different home screen for each role, with the same data underneath.

## Step 6: I designed it

I sketched the data model first: documents, values read from them, claims, findings, adjustments, verifications, questions, decisions, sign-offs and events. Then the screens: a panel that opens from any number and shows the source page with the field highlighted, a findings list with evidence and a suggested fix, a change ledger, people and sign-offs, filing, and the 16 records a CPA expects.

The first version of the look worked but I was not happy with it. I wanted it to be attractive and to feel made for each role, so I asked for a redesign. That gave me the role-based menus, the top bar that changes with the role, a search you can open with Ctrl+K, and a simple chart that shows where the tax moves.

## Step 7: I built it

I built it in layers and tested each layer.

1. Load the packet exactly as delivered and build the links between documents, values and return lines.
2. The checks and the "figures that should agree" list. It gave 29 findings and 29 reconciliations.
3. The log, undo, changes that keep the original value, and sign-offs that reopen.
4. The screens.
5. The filing story. A partner releases the return, both spouses sign, and the e-file goes out. The first try is rejected because of the son's number. A review note opens, the fix makes the signatures go stale, and everything has to be signed again. After it is accepted the return is frozen and later changes become amendments.
6. The client's copy, a response record for an IRS letter, and a plan for next year.

For testing I wrote scripts that open every screen as every role, run a whole season from start to filing, and check the phone layout.

Then I put it online with GitHub Pages. The first time I opened the link I saw a 404 page. I checked my settings and the build, waited for the deploy to finish, refreshed, and it worked.

## How I used AI

The assessment says to use any tools I like, including AI, and to say how. I worked with Claude Code the whole time. I decided the direction, the scope and the design, and I checked the results. Claude Code wrote most of the code and the first drafts of the documents, and ran the scripts and tests. Every error in my list was checked against the printed text of the documents. The app itself does not use AI to decide anything. The same data always gives the same findings. More detail is in `docs/AI_AND_TOOLS.md`.

## What I learned

What I learned: the most interesting errors were never inside one document. They were in the gaps between documents. A workpaper that shows those gaps is more useful than one that makes every number look confident.
