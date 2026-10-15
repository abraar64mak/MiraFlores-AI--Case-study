# Errors found, and how the design surfaced them

All figures are estimated change in tax (change × the engine's per-dollar rates; positive = more tax). None of the error-level items below is in the packet's own diagnostics. Each is a finding in the app with evidence links, a suggested adjustment, and a matching reconciliation where one applies.

| # | Error | Evidence | How the design caught it | Fed / CA effect |
|---|---|---|---|---|
| 1 | Schedule C gross receipts include the 1099-K on top of books (163,700 vs 151,300) | D15 p3: the 12,400 arrived through Paywell as part of Atlas's 41,200; books = 1099-NEC 142,000 + 9,300 non-1099 | Reconciliation books vs 1099s agrees exactly, so the unmatched 1099-K is already inside | −4,402 / −384 |
| 2 | Bank-sweep interest counted twice (1,840) | D28 (composite) and D29 (1099-INT) both name account ending 7731 | Two interest lines with equal amounts whose documents share an account number | −640 / −127 |
| 3 | Mileage log page 3 is a second scan of page 2; 3,700 miles counted twice | D23 p3 header says so; token overlap over 90% | Duplicate-page detector; miles reconciliation (11,800 vs 8,100) | +919 / +80 |
| 4 | Mortgage payoff interest added on top of the 1098 that includes it (2,150) | D55 box 1 "includes interest paid at payoff"; D56 "reported on the 2025 Form 1098" | Line note cites two sources; payoff statement text says reported elsewhere; mortgage reconciliation | +559 / +103 |
| 5 | Vehicle donation deducted at 6,000; charity sold for 2,900 | D66 1098-C box 4c 2,900, no goods or services | Claimed amount vs gross proceeds on the form; noncash gifts reconciliation | +806 / +149 |
| 6 | HVAC system replacement (11,000) deducted as a repair | D47: removed old furnace and condenser, installed new heat pump, permit; call-01 "replaced the whole system" | Invoice wording vs the owner statement's repairs total | +3,410 / +1,089 |
| 7 | Self-employed health insurance (14,400) although Erik could join an employer plan | qa-25; the 2024 return took no deduction for that reason | Client answer contradicts the deduction; prior-year note | +4,464 / +605 (needs a decision) |
| 8 | Telephone and internet at 100%; personal Spotify deducted | call-01: 70% and 50% business; Spotify is personal | Books-to-tax view: business use from the call note vs full cost | +541 / +47 |
| 9 | California-source wages overstated by 88,831 | Halvorsen W-2 box 16 is 111,300 because the employer kept CA as work state (qa-45); paystub D73 shows 22,469 through 07/15 | Residency facts vs a W-2 box the engine trusted; CA wage reconciliation | 0 / −5,685 |
| 10 | Federal estimated payments 13,000 vs IRS transcript 12,000 | Return used "4,000 I think" (qa-41); transcript and D67 show 3,000 | Payments agreed to agency records (a required step) | balance +1,000 |
| 11 | California estimated payments 14,000 vs 10,500 | D68 and the FTB account: the 09/15 payment is designated to 2024 | Same step, FTB record | balance +3,500 (needs a decision) |
| 12 | Dependent SSN typed wrong in the organizer (Theo, …3309 vs card …3390) | D71, 2024 return, msg-10; e-file rejects with R0000-504-02 | Identity values compared across organizer, card and prior return; replaying the season shows the rejection | none; blocks filing |
| 13 | Austin property tax includes the seller's share (6,912 credited at closing) | D54 seller credit; D57 box 10 13,420 | Closing statement vs escrow bill; SALT cap aware | +1,462 / +332 |
| 14 | Swedish interest converted at the 2024 rate (10.56, not 9.86) | line source cites `fx.SEK.2024_average` | Source key vs tax year | +43 / +9 |
| 15 | Bitcoin lot C6 has no basis; engine used zero basis and a short-term date | msg-07: bought March 2021 for about 3,050; bank line only | Judgment finding with both outcomes priced | −1,312 / −104 if accepted |

Also surfaced (not errors, but traps): the client's "no sales" answer against 295 sale lots (qa-14); Meridian's 1099-B summary 250 higher than its lots because page 32 was never read; the handwritten receipt read at 0.41 confidence, resolved by the client's call and check number; the backdoor Roth answer that contradicts the 2024 Form 8606; S-corporation distributions exceeding basis (21,215 taxed as gain) resting on a client-prepared 2022 basis; the open Form 3520, the FBAR and the unfiled 1099-NECs outside the engagement; California AMT not computed; the duplicate W-2 image (confirmed counted once).

## Why the design finds them

Classic workpapers check each number against its own source. These errors are *between* sources, so the app compares sources with each other (reconciliations and duplicate detection), answers with documents, and the return with agency records, and shows disagreement instead of confidence. The 0.94–0.99 confidence on every wrong value is the reason no check relies on it.
