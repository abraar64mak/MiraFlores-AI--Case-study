/* Independent checks. These do NOT trust the engine's numbers or the extraction confidence:
   each one compares documents with documents, answers with documents, or the return with outside records. */
window.WP = window.WP || {};
(function () {
  const U = WP.U;

  WP.runChecks = function () {
    const M = WP.M, P = M.P, V = M.curV();
    const out = [];
    WP.docFlags = {};
    const txt = (id) => (M.docById[id] ? M.docById[id].pages.map((p) => p.printed_content).join(" ") : "");
    const ev = (doc, field) => (M.evsByDoc[doc] || []).find((e) => e.field === field);
    const val = (doc, field) => { const e = ev(doc, field); return e ? e.value : undefined; };
    const line = (k) => V.idx[k];
    const num = (s) => Number(String(s).replace(/,/g, ""));
    const qa = (id) => P.client.questionnaire.find((q) => q.id === id);
    const add = (f) => out.push({ source: "check", needs: null, keys: [], refs: [], suggest: [], ...f });
    const rate = (k) => M.params[k];

    /* 1. Same bank-sweep interest reported on two documents that share an account number */
    (function () {
      const il = V.lines.filter((l) => /^SchB\.1\.\d+$/.test(l.key) && l.rule === "R-INTEREST-PAYER");
      const accts = (l) => {
        const set = new Set();
        (l.sources || []).forEach((s) => {
          const e = M.evById[s];
          if (e) (txt(e.document_id).match(/ending (\d{4})/g) || []).forEach((x) => set.add(x));
        });
        return set;
      };
      for (let i = 0; i < il.length; i++)
        for (let j = i + 1; j < il.length; j++) {
          const a = il[i], b = il[j];
          if (a.value !== b.value || !a.value) continue;
          const sa = accts(a), sb = accts(b);
          const shared = [...sa].filter((x) => sb.has(x));
          if (!shared.length) continue;
          const da = M.evById[a.sources[0]].document_id, db = M.evById[b.sources[0]].document_id;
          add({
            id: "DUP-INTEREST", sev: "error", kind: "duplicate", area: "investments_and_digital_assets",
            title: `Bank-sweep interest counted twice (${U.money(b.value)})`,
            summary: `${da} (composite 1099, bank sweep) and ${db} (stand-alone 1099-INT) both describe the same Northlake sweep, ${shared[0]}. The engine entered one interest line for each (${a.key} and ${b.key}).`,
            why: "Two interest lines have the same amount and their documents name the same account.",
            keys: [a.key, b.key], refs: [a.sources[0], b.sources[0], `${db}p1`],
            suggest: [{ sid: "dup-int", target: b.key, mode: "set", amount: 0, category: "interest", sign: 1, label: `Remove the duplicate interest line ${b.key}`, note: `${db} reports the same sweep interest as ${da}; counted once.` }],
          });
          WP.docFlags[db] = { kind: "duplicate", reason: `Same interest as ${da} (same account ${shared[0]})`, of: da };
        }
    })();

    /* 2. 1099-K receipts already inside a 1099-NEC deposit */
    (function () {
      const gr = line("SchC.1");
      const k = val("D21", "box1a"), books = (val("D14", "Sales - client projects") || 0) + (val("D14", "Sales - print and licensing") || 0);
      const m = /of which ([\d,]+\.\d\d) arrived through Paywell/.exec(txt("D15"));
      if (gr && k && m && num(m[1]) === k && Math.abs(gr.value - books - k) < 1) {
        const necs = M.docs.filter((d) => d.document_type === "1099-NEC").reduce((s, d) => s + (val(d.id, "box1") || 0), 0);
        const non = (/Deposits from clients who issued no Form 1099: ([\d,]+\.\d\d)/.exec(txt("D15")) || [])[1];
        add({
          id: "DUP-1099K", sev: "error", kind: "overstated", area: "business",
          title: `Schedule C gross receipts overstated by the 1099-K (${U.money(k)})`,
          summary: `Gross receipts are ${U.money(gr.value)} = books ${U.money(books)} + 1099-K ${U.money(k)}. But D15 shows the 1099-K money is part of Atlas Outdoor Gear's 1099-NEC (${U.money(41200)}): it arrived through Paywell. Books ${U.money(books)} already equal the five 1099-NECs ${U.money(necs)} plus ${U.money(num(non || 0))} of non-1099 deposits.`,
          why: "Receipts per books reconcile exactly to 1099-NEC + non-1099 deposits, so any unmatched 1099-K amount is already inside.",
          keys: ["SchC.1"], refs: ["ev-0127", "D15p3", "D14p1", "D17p1"],
          suggest: [{ sid: "dup-k", target: "SchC.1", mode: "delta", amount: -k, category: "schc_profit", sign: 1, label: "Remove the 1099-K amount counted on top of books", note: "1099-K is the card-processed part of the Atlas 1099-NEC (D15 p3)." }],
        });
      }
    })();

    /* 3. Duplicate pages inside a document (scanned twice) */
    (function () {
      M.docs.forEach((d) => {
        if (d.pages.length < 2) return;
        const tok = (s) => new Set(s.replace(/\(.*?\)/g, " ").toLowerCase().match(/[a-z0-9\/.-]+/g) || []);
        for (let i = 0; i < d.pages.length; i++)
          for (let j = i + 1; j < d.pages.length; j++) {
            const a = tok(d.pages[i].printed_content), b = tok(d.pages[j].printed_content);
            const inter = [...a].filter((x) => b.has(x)).length;
            if (a.size > 20 && inter / Math.max(a.size, b.size) > 0.9) {
              const tot = (M.evsByDoc[d.id] || []).find((e) => e.page === d.pages[j].page && e.field === "page_total");
              const miles = tot ? tot.value : 0;
              add({
                id: `DUP-PAGE-${d.id}`, sev: "error", kind: "duplicate", area: "business",
                title: `${d.id} page ${d.pages[j].page} is a second scan of page ${d.pages[i].page}`,
                summary: `The pages carry the same entries (${d.pages[j].printed_content.slice(0, 60)}…). The engine summed every page total, so ${U.money(miles)} miles were counted twice (business miles ${U.money(line("SchC.44a").value)}).`,
                why: "Token overlap between two pages of one document exceeds 90%.",
                keys: ["SchC.44a", "SchC.9"], refs: [`${d.id}p${d.pages[i].page}`, `${d.id}p${d.pages[j].page}`, tot && tot.id].filter(Boolean),
                suggest: [
                  { sid: "dup-miles", target: "SchC.44a", mode: "delta", amount: -miles, category: "none", sign: 1, label: `Business miles −${U.money(miles)}`, note: "Duplicate scan removed." },
                  { sid: "dup-miles-ded", target: "SchC.9", mode: "delta", amount: -miles * rate("mileage_rate"), category: "schc_profit", sign: -1, label: `Mileage deduction −${U.money(miles * rate("mileage_rate"))} (${rate("mileage_rate")}/mi)`, note: "Standard mileage on the duplicate page." },
                ],
              });
              WP.docFlags[d.id + "#" + d.pages[j].page] = { kind: "duplicate_page" };
            }
          }
      });
    })();

    /* 4. Second image of the same document (counted once: confirm) */
    (function () {
      const sig = (d) => (d.pages.map((p) => p.printed_content).join(" ").match(/\d[\d,]*\.\d\d/g) || []).sort().join("|");
      const seen = {};
      M.docs.forEach((d) => {
        if (d.document_type !== "W-2") return;
        const s = sig(d);
        if (seen[s] && s.length > 20) {
          const o = seen[s];
          WP.docFlags[d.id] = { kind: "duplicate", reason: `Second image of ${o} (identical boxes)`, of: o };
          add({
            id: "DUP-W2", sev: "ok", kind: "verified", area: "wages_and_stock_compensation",
            title: `${d.id} is a second image of ${o}: counted once`,
            summary: `Every dollar box on ${d.id} (phone photo) equals ${o}. The engine counted the Halvorsen W-2 once, as it should. Recorded so the document is accounted for.`,
            why: "Same document type with identical monetary boxes.", keys: ["F1040.1a"], refs: [`${o}p1`, `${d.id}p1`],
          });
        } else seen[s] = d.id;
      });
    })();

    /* 5. Self-employed health insurance when the spouse was eligible for an employer plan */
    (function () {
      const l = line("Sch1.17"), q = qa("qa-25");
      if (l && l.value > 0 && q && /^yes/i.test(q.answer)) {
        add({
          id: "SEHI-ELIGIBLE", sev: "error", kind: "overstated", area: "business", needs: "decision",
          title: `Self-employed health insurance deducted (${U.money(l.value)}) though Erik could join an employer plan`,
          summary: `qa-25: both of Ngozi's employers offered family coverage and Erik chose to keep his own plan. The deduction is not allowed for any month he was eligible for an employer-subsidized plan. The 2024 return took no such deduction for that reason (py Sch1.17 note). This is a judgment: confirm whether and when the offers were subsidized.`,
          why: "Questionnaire answer contradicts the deduction; prior-year return took the opposite position.",
          keys: ["Sch1.17"], refs: ["qa-25", "qa-27", "D25p1", "py:/return_2024/notes/Sch1.17"],
          suggest: [{ sid: "sehi", target: "Sch1.17", mode: "set", amount: 0, category: "adjustment", sign: 1, label: "Disallow the deduction (eligible for employer plan)", note: "qa-25; 2024 return took no deduction for the same reason. QBI interaction not captured by the rate." }],
        });
      }
    })();

    /* 6. Business-use percentages from the call versus the full-cost deductions */
    (function () {
      const call = txt("call-01") || P.client.call_notes[0].notes.join(" ");
      const mob = /Mobile plan[^.]*?(\d+)%/.exec(call), net = /Home internet[^.]*?(\d+)%/.exec(call);
      const phone = (/Telephone [\d,.]+: family mobile plan[^]*?/.exec(txt("D15")) ? val("D14", "Telephone") : 0);
      const web = val("D14", "Internet");
      const util = line("SchC.25");
      if (mob && net && util && phone && web && util.value === phone + web) {
        const ded = Math.round(phone * mob[1] / 100 + web * net[1] / 100);
        const spot = /Spotify Family[^0-9]*([\d,]+\.\d\d)/.exec(txt("D15"));
        const s = spot ? num(spot[1]) : 216;
        add({
          id: "BIZ-USE", sev: "error", kind: "overstated", area: "business",
          title: `Telephone/internet deducted at 100%; personal Spotify deducted`,
          summary: `Call note: mobile plan ${mob[1]}% business, internet ${net[1]}% business, Spotify Family is personal. SchC.25 carries ${U.money(util.value)} (all of it); it should be about ${U.money(ded)}. Spotify ${U.money(s)} is inside software and subscriptions.`,
          why: "Books amounts in the return equal the full books lines; the call note gives business percentages.",
          keys: ["SchC.25", "SchC.27a.1"], refs: ["call-01", "D15p2", "D15p1", "ev-0101", "ev-0095"],
          suggest: [
            { sid: "biz-util", target: "SchC.25", mode: "delta", amount: ded - util.value, category: "schc_profit", sign: -1, label: `Utilities to ${U.money(ded)} (70% mobile, 50% internet)`, note: "Business percentages per call-01." },
            { sid: "biz-spot", target: "SchC.27a.1", mode: "delta", amount: -s, category: "schc_profit", sign: -1, label: `Remove personal Spotify ${U.money(s)}`, note: "call-01: booked by mistake." },
          ],
        });
      }
    })();

    /* 7. Wrong-year exchange rate */
    (function () {
      const l = line("SchB.1.6");
      if (l && (l.sources || []).some((s) => /2024_average/.test(s))) {
        const sek = num((/SEK ([\d,]+\.\d\d)/.exec(l.label) || [])[1] || 18450);
        const right = Math.round(sek / M.params.fx.SEK["2025_average"]);
        add({
          id: "FX-YEAR", sev: "warning", kind: "overstated", area: "investments_and_digital_assets",
          title: `Swedish interest converted at the 2024 average rate`,
          summary: `SEK ${U.money(sek)} was converted at ${M.params.fx.SEK["2024_average"]} (2024 average). The 2025 average is ${M.params.fx.SEK["2025_average"]}, giving ${U.money(right)} instead of ${U.money(l.value)}.`,
          why: "Line source cites ref:fx.SEK.2024_average for a 2025 amount.",
          keys: ["SchB.1.6"], refs: ["ev-0960", "ref:fx.SEK.2024_average", "ref:fx.SEK.2025_average", "D36p1"],
          suggest: [{ sid: "fx", target: "SchB.1.6", mode: "set", amount: right, category: "interest", sign: 1, label: `Interest to ${U.money(right)} at the 2025 average rate`, note: "Use the rate for the year of the income." }],
        });
      }
    })();

    /* 8. Federal estimated payments vs the IRS transcript */
    (function () {
      const l = line("F1040.26");
      const tr = P.tax_agency_records.irs_account_transcript_2025.slice(-1)[0];
      const t = tr.transactions.filter((x) => x.code === "670" && /Estimated/.test(x.description)).reduce((s, x) => s + x.amount, 0);
      if (l && t && t !== l.value) {
        add({
          id: "PAYMENTS-IRS", sev: "error", kind: "contradiction", area: "partner_review",
          title: `Federal estimated payments ${U.money(l.value)} vs IRS transcript ${U.money(t)}`,
          summary: `The return uses the client's recollection for the fourth payment ("4,000 I think", qa-41). The IRS transcript shows 3,000 on 2026-01-15 and D67 has only three EFTPS confirmations. Payments are overstated by ${U.money(l.value - t)}.`,
          why: "Required step: payments agreed to agency records.",
          keys: ["F1040.26"], refs: ["qa-41", "ev-1056", "agency:/irs_account_transcript_2025", "D67p1", "D69p1"],
          suggest: [{ sid: "pay-irs", target: "F1040.26", mode: "set", amount: t, category: "payment", sign: 1, label: `Federal estimated payments to ${U.money(t)}`, note: "Agreed to IRS transcript (D69)." }],
        });
      } else if (l) add({ id: "PAYMENTS-IRS", sev: "ok", kind: "verified", area: "partner_review", title: "Federal estimated payments agree to IRS transcript", summary: "", keys: ["F1040.26"], refs: ["D69p1"] });
    })();

    /* 9. California payments vs FTB account (a payment designated to 2024) */
    (function () {
      const l = line("F540NR.72");
      const f = P.tax_agency_records.ftb_account.tax_year_2025_payments.reduce((s, x) => s + x.amount, 0);
      if (l && l.value !== f) {
        add({
          id: "PAYMENTS-FTB", sev: "warning", kind: "contradiction", area: "california", needs: "decision",
          title: `California estimated payments ${U.money(l.value)} vs FTB record ${U.money(f)} for 2025`,
          summary: `The return counts the 2025-09-15 payment of 3,500, but D68 and the FTB account designate it to tax year 2024 and hold it as a 2024 credit. Either request redesignation (judgment, with the FTB) or reduce 2025 payments by ${U.money(l.value - f)}.`,
          why: "Required step: payments agreed to agency records.",
          keys: ["F540NR.72"], refs: ["D68p1", "ev-1074", "agency:/ftb_account"],
          suggest: [{ sid: "pay-ftb", target: "F540NR.72", mode: "set", amount: f, category: "payment", sign: 1, label: `California estimated payments to ${U.money(f)}`, note: "Agreed to FTB account; 9/15 payment designated to 2024." }],
        });
      }
    })();

    /* 10. California wage sourcing from a W-2 box 16 that the employer got wrong */
    (function () {
      const l = line("SchCA540NR.1.E"), b16 = txt("D09").match(/Box 16 ([\d,]+\.\d\d)/), ytd = val("D73", "ytd_ca_wages");
      if (l && b16 && ytd) {
        const over = num(b16[1]) - ytd;
        add({
          id: "CA-WAGE-SOURCE", sev: "error", kind: "overstated", area: "california",
          title: `California-source wages overstated by about ${U.money(over)}`,
          summary: `The engine takes California wages from W-2 box 16 (${U.money(num(b16[1]))} for Halvorsen). But the employer kept California as the work state through 09/30 by mistake (qa-45); Ngozi moved to Texas on 07/15. The paystub (D73) shows California wages of ${U.money(ytd)} through 07/15. Only that amount is California-source; the CA withholding on the rest may be refundable.`,
          why: "Residency and work-location facts contradict a W-2 box the engine trusted.",
          keys: ["SchCA540NR.1.E"], refs: ["D09p1", "D73p1", "ev-1081", "qa-45", "qa-02", "household:ngozi"],
          suggest: [{ sid: "ca-wage", target: "SchCA540NR.1.E", mode: "delta", amount: -over, category: "ca_source_income", sign: 1, label: `California-source wages −${U.money(over)}`, note: "Halvorsen wages after the move are Texas-source. California only; no federal effect." }],
        });
      }
    })();

    /* 11. Dependent SSN typed wrong in the organizer (the e-file rejection waiting to happen) */
    (function () {
      P.household.people.filter((p) => p.role === "dependent" || p.role === "taxpayer" || p.role === "spouse").forEach((p) => {
        const cardEv = (P.extracted_values || []).filter((e) => e.field === "ssn" && e.value && /^D(71|03|04|05)$/.test(e.document_id) && M.docById[e.document_id].belongs_to === (p.role === "dependent" ? "dependent:" + p.id : p.role));
        const card = cardEv[0];
        const pyDep = (P.prior_years.return_2024.dependents || []).find((d) => d.name === p.name);
        const ref = card ? card.value : pyDep ? pyDep.ssn : null;
        if (ref && p.ssn && ref !== p.ssn) {
          add({
            id: `SSN-MISMATCH-${p.id.toUpperCase()}`, sev: "error", kind: "contradiction", area: "intake_and_engagement", sensitive: true,
            title: `${p.name}: SSN typed in the organizer differs from the card`,
            summary: `The organizer (household) has ${U.maskSsn(p.ssn)}; the Social Security card (${card ? card.document_id : "prior-year return"}) and the 2024 return have ${U.maskSsn(ref)}. msg-10: "I must have typed his number wrong." The engine used the organizer value (D71 is not in v3), and e-file will reject (error R0000-504-02).`,
            why: "Identity values compared across the organizer, the card, and the prior return.",
            keys: [], refs: [card && card.id, "msg-10", `household:${p.id}`, "py:/return_2024/dependents"].filter(Boolean),
            suggest: [{ sid: "ssn", target: `household:${p.id}.ssn`, mode: "set", amount: ref, category: "none", sign: 1, label: `Correct ${p.name}'s SSN to the card value`, note: "Agreed to Social Security card D71 and 2024 return." }],
          });
        }
      });
    })();

    /* 12. Vehicle donation above gross proceeds */
    (function () {
      const l = line("F8283.A1.vehicle"), gp = val("D66", "box4c");
      if (l && gp && l.value > gp) {
        add({
          id: "VEHICLE-FMV", sev: "error", kind: "overstated", area: "deductions_and_credits",
          title: `Vehicle gift deducted at ${U.money(l.value)}; charity sold it for ${U.money(gp)}`,
          summary: `The deduction uses the client's Blue Book guess (qa-39, call-01). Form 1098-C (D66) shows the charity sold the car at arm's length for ${U.money(gp)} and gave no goods or services. For a gift over 500 sold by the charity, the deduction is limited to those gross proceeds.`,
          why: "Claimed amount exceeds the gross proceeds on the 1098-C.",
          keys: ["F8283.A1.vehicle", "SchA.12"], refs: ["ev-1054", "D66p1", "qa-39", "call-01"],
          suggest: [{ sid: "veh", target: "F8283.A1.vehicle", mode: "set", amount: gp, category: "itemized", sign: 1, label: `Vehicle gift to ${U.money(gp)}`, note: "Limited to gross proceeds on Form 1098-C box 4c." }],
        });
      }
    })();

    /* 13. HVAC replacement deducted as a repair */
    (function () {
      const l = line("SchE.14A"), hv = val("D46", "hvac");
      if (l && hv && /Installed new/i.test(txt("D47")) && hv >= 2500) {
        add({
          id: "HVAC-CAPITAL", sev: "error", kind: "overstated", area: "rentals_and_sale",
          title: `HVAC system replacement (${U.money(hv)}) deducted as a repair`,
          summary: `D47 shows the old furnace and condenser were removed and a new heat-pump system, air handler and line set installed, with a permit. That is an improvement (a restoration of the whole system), capitalized and depreciated over 27.5 years, not a repair. Repairs (SchE.14A) include it in full. Estimate shown before the small first-year depreciation (about ${U.money(Math.round(hv / 27.5 * 4.5 / 12))}) and passive-loss limits.`,
          why: "Owner statement includes the HVAC invoice in repairs; the invoice describes a replacement.",
          keys: ["SchE.14A"], refs: ["ev-1001", "D46p1", "D47p1", "call-01", "qa-37"],
          suggest: [{ sid: "hvac", target: "SchE.14A", mode: "delta", amount: -hv, category: "ordinary_income", sign: -1, label: `Remove ${U.money(hv)} from repairs; capitalize and depreciate`, note: "Add a 27.5-year asset placed in service 08/2025 (about 150 first-year depreciation)." }],
        });
      }
    })();

    /* 14. Mortgage interest at payoff counted on top of the 1098 that already includes it */
    (function () {
      const l = line("SchA.8a");
      if (l && /payoff statement - interest ([\d,]+\.\d\d)/.test(l.note || "") && /reported on the 2025 Form 1098/.test(txt("D56"))) {
        const p = num(/payoff statement - interest ([\d,]+\.\d\d)/.exec(l.note)[1]);
        add({
          id: "MORT-DOUBLE", sev: "error", kind: "duplicate", area: "deductions_and_credits",
          title: `Payoff interest (${U.money(p)}) counted on top of the 1098 that includes it`,
          summary: `SchA.8a adds the payoff statement's interest to the Lonestar Form 1098. D55 box 1 states it "includes interest paid at payoff 11/20/2025" and D56 says "Interest is reported on the 2025 Form 1098".`,
          why: "Line note lists both a 1098 and a payoff statement whose interest the statement says is already on the 1098.",
          keys: ["SchA.8a"], refs: ["D55p1", "D56p1", "ev-1029"],
          suggest: [{ sid: "mort", target: "SchA.8a", mode: "delta", amount: -p, category: "itemized", sign: 1, label: `Mortgage interest −${U.money(p)}`, note: "Payoff interest is already in Lonestar 1098 box 1." }],
        });
      }
    })();

    /* 15. Real estate tax the seller owed, reimbursed to the buyer by a closing credit */
    (function () {
      const l = line("SchA.5b"), cr = val("D54", "tax_credit");
      if (l && cr) {
        const cap = M.params.salt_cap, tot = line("SchA.5d").value, newTot = tot - cr, newLimited = Math.min(cap, newTot), oldLimited = line("SchA.5e").value;
        add({
          id: "RE-TAX-CREDIT", sev: "warning", kind: "overstated", area: "deductions_and_credits",
          title: `Austin property tax includes the part the seller owed (${U.money(cr)})`,
          summary: `Real estate tax 13,420 was paid from escrow for the whole year, but the buyer closed 07/08 and received a ${U.money(cr)} seller credit for 01/01–07/07 (D54). Taxes for the seller's period are not the buyer's deduction. Net: ${U.money(l.value - cr)}. State and local taxes are then ${U.money(newTot)}, so the capped deduction falls by ${U.money(oldLimited - newLimited)}.`,
          why: "Closing statement credit compared with the tax bill paid from escrow.",
          keys: ["SchA.5b", "SchA.5e"], refs: ["ev-1027", "D54p1", "D57p1", "D58p1"],
          suggest: [
            { sid: "ret-ca", target: "SchA.5b", mode: "delta", amount: -cr, category: "salt", sign: 1, label: `Real estate taxes −${U.money(cr)} (California effect)`, note: "Seller's share reimbursed at closing." },
            { sid: "ret-fed", target: "SchA.5e", mode: "delta", amount: newLimited - oldLimited, category: "fed_itemized", sign: 1, label: `Federal SALT deduction ${U.money(newLimited - oldLimited)} (cap-aware)`, note: `SALT ${U.money(newTot)} is under the ${U.money(cap)} cap, so the federal deduction falls by less.` },
          ],
        });
      }
    })();

    /* 16. Questionnaire says no sales; documents show hundreds */
    (function () {
      const q = qa("qa-14"), q15 = qa("qa-15");
      const lots = V.lines.filter((l) => l.form === "F8949" && !/total$/.test(l.key));
      if (q && /^no/i.test(q.answer) && lots.length) {
        add({
          id: "QA-SALES", sev: "warning", kind: "contradiction", area: "investments_and_digital_assets", needs: "client",
          title: `Client answered "No" to selling investments; the return has ${lots.length} sale lots`,
          summary: `qa-14: "No". qa-15: "We didn't really sell, just moved things around." The documents show 282 brokerage sales (Northlake, Meridian, Brightpath) and 12 digital-asset dispositions on Coinhaven (Form 1099-DA). The documents win; the answer should be corrected on the organizer and the client told why the return looks different from their expectation.`,
          why: "Organizer answers compared with the count of Form 8949 lots.",
          keys: ["SchD.16"], refs: ["qa-14", "qa-15", "D34p1", "D28p3", "D74p1"],
        });
      }
    })();

    /* 17. Broker summary vs sum of detail lots; unread pages */
    (function () {
      M.docs.filter((d) => /1099-composite/.test(d.document_type)).forEach((d) => {
        const evs = M.evsByDoc[d.id] || [];
        let summary = 0, detail = 0;
        const s1 = evs.find((e) => e.field === "b_summary_proceeds");
        if (s1) summary = s1.value;
        else {
          const st = evs.find((e) => e.field === "st_proceeds"), lt = evs.find((e) => e.field === "lt_proceeds");
          if (st && lt) summary = st.value + lt.value;
        }
        detail = U.sum(evs.filter((e) => /^[A-Z]+\d+_proceeds$/.test(e.field)).map((e) => e.value));
        if (summary && Math.abs(summary - detail) > 1 && !WP.docFlags[d.id]) {
          const partial = d.extraction.status === "partial";
          if (d.id === "D30") return; // superseded by the corrected D31; reported once below
          add({
            id: `BROKER-${d.id}`, sev: "warning", kind: "gap", area: "investments_and_digital_assets", needs: "client",
            title: `${d.title.split(" - ")[0].slice(0, 40)}: summary proceeds ${U.money(summary, { dec: 2 })} ≠ detail ${U.money(detail, { dec: 2 })}`,
            summary: `The 1099-B summary and the sum of extracted lots differ by ${U.money(summary - detail, { dec: 2 })}.` + (partial ? ` Page ${d.page_count} ("Additional transactions") was never read by the pipeline: ${d.extraction.reason}` : "") + ` Ask the broker/client for the missing page; until then the gain or loss on the missing lots is unknown.`,
            why: "Summary total compared with the sum of detail lots.",
            keys: ["SchD.16"], refs: [(s1 || evs[0]).id, `${d.id}p1`, `${d.id}p${d.page_count}`].filter(Boolean),
          });
        }
      });
    })();

    /* 18. Crypto lot with no basis; the client has a bank line only */
    (function () {
      const l = line("F8949.H.C6"), q = P.client.messages.find((m) => m.id === "msg-07");
      if (l && q) {
        const proceeds = 5325, basis = 3050;
        add({
          id: "CRYPTO-C6", sev: "warning", kind: "gap", area: "investments_and_digital_assets", needs: "decision",
          title: `Bitcoin lot C6: no cost basis, and the holding period depends on a bank line`,
          summary: `Coinhaven shows the 0.05 BTC as a transfer in on 2025-06-01 with unknown basis, so the engine used zero basis and a short-term holding period (gain ${U.money(proceeds)}). Erik says he bought it in March 2021 for about ${U.money(basis)} on an exchange that has closed; the only evidence is a bank line to "CryptoNorth" on 2021-03-15 (msg-07). If accepted: gain ${U.money(proceeds - basis)}, long-term. This needs a documented judgment (adequate identification) before the return changes.`,
          why: "Engine diagnostic DIGITAL_ASSET_BASIS_MISSING plus a later client message that offers an explanation.",
          keys: ["F8949.H.C6"], refs: ["ev-0919", "ev-0879", "D35p1", "msg-07"],
          suggest: [
            { sid: "c6-st", target: "SchD.3", mode: "delta", amount: -proceeds, category: "stcg", sign: 1, label: `Remove ${U.money(proceeds)} from short-term digital assets`, note: "Lot reclassified long-term (acquired 2021-03-15 per client bank line)." },
            { sid: "c6-lt", target: "SchD.10", mode: "delta", amount: proceeds - basis, category: "ltcg", sign: 1, label: `Add long-term gain ${U.money(proceeds - basis)} (basis ${U.money(basis)})`, note: `Basis ${U.money(basis)} per bank statement line; document the identification.` },
          ],
        });
      }
    })();

    /* 19. The handwritten receipt read at low confidence (and how it was resolved) */
    (function () {
      const low = P.extracted_values.filter((e) => e.confidence < 0.7 && e.id !== "ev-0919");
      low.forEach((e) =>
        add({
          id: `LOWCONF-${e.id}`, sev: "warning", kind: "gap", area: "deductions_and_credits",
          title: `Handwritten receipt amount read at confidence ${e.confidence}`,
          summary: `${M.docById[e.document_id].title}: the first digit is ambiguous (1 or 7). The pipeline read ${U.money(e.value)}. The client confirmed 1,500 after calling the parish and matched check #2207 on 12/21/2025 (msg-08), which is evidence outside the document. Record the verification.`,
          why: "Extracted value with confidence below 0.7.", keys: ["SchA.11"], refs: [e.id, `${e.document_id}p1`, "msg-08"],
        })
      );
    })();

    /* 20. S-corporation distributions above basis */
    (function () {
      const ex = line("F7203.excess"), b = line("F7203.1");
      if (ex && ex.value > 0) {
        add({
          id: "SCORP-BASIS", sev: "warning", kind: "judgment", area: "pass_throughs_and_basis", needs: "decision",
          title: `Distributions exceed S-corporation basis: ${U.money(ex.value)} taxed as capital gain`,
          summary: `Beginning basis is ${U.money(b.value)} (2022 ending basis 21,300 from the client's worksheet, rolled through the 2023 K-1 received 2026-06-05 and the 2024 K-1). 2025 distributions are ${U.money(42000)}; box 16D includes ${U.money(1580)} of Oregon composite tax paid on Erik's behalf (D39 p2). The 2022 basis is client-prepared, not from a K-1: if it is understated, the gain falls by the same amount (about ${U.money(Math.round(ex.value * 0.238))} of tax at 23.8%). Record the basis support and the treatment of the composite tax.`,
          why: "Form 7203 produces an excess-distribution gain; basis roll-forward has unsupported years.",
          keys: ["F7203.1", "F7203.excess"], refs: ["ev-0975", "ev-0977", "ev-0983", "ev-0985", "D40p1", "D39p2", "py:/basis_records/scorp_lindqvist_family_woodworks"],
        });
      }
    })();

    /* 21. Backdoor Roth: questionnaire contradicts the prior-year form */
    (function () {
      const q = qa("qa-31"), b = P.prior_years.basis_records.ira_nondeductible_basis_ngozi[0];
      if (q && b && /none|started doing this in 2025/i.test(q.answer)) {
        add({
          id: "ROTH-BASIS", sev: "info", kind: "contradiction", area: "deductions_and_credits", needs: "client",
          title: "Backdoor Roth: the client says no prior basis; the 2024 Form 8606 shows 7,000",
          summary: `qa-31: "none that I know of - we started doing this in 2025". The 2024 return carried Form 8606 line 14 = ${U.money(b.form_8606_line_14)} (contribution made 02/12/2025 for 2024, D42). The engine followed the record, so only ${U.money(26)} of the 14,026 conversion is taxable. Confirm with the client and keep the record: this is the number most likely to be questioned.`,
          why: "Questionnaire answer compared with the filed prior-year form and the 5498.",
          keys: ["F8606.2", "F8606.18"], refs: ["qa-31", "D42p1", "D43p1", "py:/basis_records/ira_nondeductible_basis_ngozi"],
        });
      }
    })();

    /* 22. Outside filings the engagement does not cover but the facts require */
    add({
      id: "OUTSIDE-FBAR", sev: "warning", kind: "outside_filing", area: "deductions_and_credits", needs: "client",
      title: "FinCEN 114 (FBAR) due 2026-10-15; Sparbanken balance peaked at SEK 1,452,300",
      summary: "The foreign account exceeded USD 10,000 (about USD 149,567 at year-end rate). The FBAR is outside this engagement and the prior preparer says the client filed it separately. Confirm and record who is filing.",
      why: "Engine diagnostic FBAR_OUTSIDE_RETURN.", keys: ["F8938.1.max"], refs: ["D36p1", "py:/prior_preparer_workpaper/notes"],
    });
    add({
      id: "OUTSIDE-3520", sev: "warning", kind: "outside_filing", area: "deductions_and_credits", needs: "client",
      title: "Form 3520 for the 2023 foreign inheritance was never resolved",
      summary: "Erik inherited the Swedish account from his mother in 2023 (over USD 100,000). The prior preparer left 'Form 3520 - discussed? (no note of resolution)' open. A late 3520 carries penalties. Decide whether to advise the client now; it is not in this engagement.",
      why: "Prior preparer's open items list.", keys: [], refs: ["D07p3", "D36p1", "qa-07", "qa-08"],
    });
    add({
      id: "OUTSIDE-1099NEC", sev: "warning", kind: "outside_filing", area: "business", needs: "decision",
      title: "Two contractors paid 600+ with no Forms 1099-NEC filed (due 2026-02-02)",
      summary: "qa-22/qa-23 and call-01: a retoucher and a web developer were paid by ACH; no 1099s were filed. Late filing and furnishing penalties may apply; reasonable cause is thin (the client says they did not know). Record the advice given and the penalty decision. The deduction itself is not affected.",
      why: "Engine diagnostic FORM_1099_FILING.", keys: ["SchC.11"], refs: ["qa-22", "qa-23", "call-01", "D27p1"],
    });
    add({
      id: "CA-AMT", sev: "warning", kind: "gap", area: "california", needs: "decision",
      title: "California AMT was not computed (incentive stock options exercised 07/30/2025)",
      summary: "The engine does not compute California AMT. Ngozi exercised 1,000 ISOs at 12.00 with FMV 52.00 (bargain element 40,000). She lived in California until 07/14 and worked there for Corvane until 05/16. Decide the California-source allocation and compute or document why no CA AMT applies.",
      why: "Engine diagnostic CA_AMT_NOT_COMPUTED.", keys: ["F6251.11"], refs: ["D12p1", "D11p2", "qa-06"],
    });

    /* Engine diagnostics we have not turned into a specific finding */
    const covered = new Set(["DIGITAL_ASSET_BASIS_MISSING", "FORM_1099_FILING", "FBAR_OUTSIDE_RETURN", "CA_AMT_NOT_COMPUTED", "QUESTIONNAIRE_SALES_CONFLICT", "LOW_CONFIDENCE_READ", "BROKER_SUMMARY_DETAIL_MISMATCH", "SCORP_BASIS_INCOMPLETE", "K1_EXPECTED_NOT_RECEIVED"]);
    V.v.diagnostics.forEach((g) => {
      if (covered.has(g.code)) return;
      const info = {
        AMT_CREDIT_CARRYFORWARD: { title: "AMT credit carryforward to 2026 (Form 8801)", note: "Carry forward with history; the minimum tax credit of 3,871 is in the roll-forward." },
        AOTC_PHASED_OUT: { title: "American opportunity credit phased out", note: "Due diligence for AOTC must still be documented even though the credit is zero." },
        DUE_DILIGENCE_REQUIRED: { title: "Form 8867 due diligence required (CTC / ODC)", note: "Document knowledge questions and documents relied on for Ada and Theo." },
        HOME_OFFICE_AREA_CHANGE: { title: "Home office area differs from 2024 (240 vs 300 sq ft)", note: "Client measurements D24: Sacramento 220 sq ft until mid-July, Austin 260 sq ft from 07/16. Time-weighted average is about 240. Answers the prior preparer's open item." },
      }[g.code] || { title: g.code, note: "" };
      add({
        id: "DIAG-" + g.code, sev: g.severity === "warning" ? "warning" : "info", kind: "engine", area: WP.areaOfKey(g.refs[0]) || "partner_review", source: "engine",
        title: info.title, summary: g.message + (info.note ? " " + info.note : ""), why: "Engine diagnostic.", keys: [], refs: g.refs,
      });
    });

    /* Rank: errors by tax effect */
    const sevRank = { error: 0, warning: 1, info: 2, ok: 3 };
    out.forEach((f) => {
      f.effect = { fed: 0, ca: 0 };
      (f.suggest || []).forEach((s) => {
        const e = M.effectOf({ target: s.target, mode: s.mode, amount: s.amount, category: s.category, sign: s.sign });
        s.effect = e;
        f.effect.fed += e.taxFed; f.effect.ca += e.taxCA;
      });
    });
    out.sort((a, b) => sevRank[a.sev] - sevRank[b.sev] || Math.abs(b.effect.fed) + Math.abs(b.effect.ca) - Math.abs(a.effect.fed) - Math.abs(a.effect.ca));
    WP.findings = out;
    WP.findingById = Object.fromEntries(out.map((f) => [f.id, f]));
    return out;
  };

  /* Outside filings register: every filing that touches this household, in or out of scope. */
  WP.outsideFilings = () => [
    { id: "OUTSIDE-FBAR", name: "FinCEN 114 (FBAR) 2025", who: "Erik / client", due: "2026-10-15", scope: "Outside engagement", note: "Account max SEK 1,452,300" },
    { id: "OUTSIDE-3520", name: "Form 3520 (2023 foreign inheritance)", who: "Erik / client", due: "past due", scope: "Outside engagement; unresolved prior open item", note: "Over USD 100,000" },
    { id: "OUTSIDE-1099NEC", name: "Forms 1099-NEC ×2 (contractors)", who: "Lindqvist Studio", due: "2026-02-02", scope: "Outside engagement; late", note: "Penalty decision needed" },
    { id: "ADA-RETURN", name: "Ada's own 2025 Form 1040", who: "Ada (consumer software)", due: "2026-04-15", scope: "Related return, not in packet", note: "Must check 'someone can claim you as a dependent'; her W-2 4,100" },
    { id: "WOODWORKS-1120S", name: "Form 1120-S and Oregon composite (Woodworks)", who: "Willamette CPA Group", due: "—", scope: "Other preparer; K-1s in packet", note: "Oregon tax 1,580 paid on Erik's behalf" },
    { id: "RIDGELINE-1065", name: "Form 1065 and Arizona composite (Ridgeline)", who: "Fund administrator", due: "—", scope: "Other preparer; K-1 received 2026-06-22", note: "No Arizona filing for the partner" },
    { id: "F4868", name: "Form 4868 and FTB 3519 (extensions)", who: "This firm", due: "2026-04-15", scope: "In scope; filed 2026-04-14 with 36,000", note: "Extended to 2026-10-15" },
    { id: "F8801-2026", name: "Form 8801 (minimum tax credit) with 2026 return", who: "Next year's preparer", due: "2027-04-15", scope: "Roll-forward", note: "Credit of 3,871 carries forward" },
  ];
})();
