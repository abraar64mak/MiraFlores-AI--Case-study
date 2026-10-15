/* Records a CPA expects, generated from the same claims (never typed in a second place). */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;
  const tbl = (heads, rows, o = {}) => `<div class="tablewrap" ${o.h ? `style="max-height:${o.h}"` : ""}><table><thead><tr>${heads.map((h) => (typeof h === "string" ? `<th>${h}</th>` : `<th class="${h.n ? "n" : ""}">${h.t}</th>`)).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${heads.length}" class="muted">Nothing to show.</td></tr>`}</tbody></table></div>`;
  const N = (k) => ui.num(k);
  const L = (k) => { const l = WP.M.line(k); return l ? l.label : k; };
  const money = (x) => (x === undefined || x === null ? "—" : U.money(Math.round(x)));
  const TABS = [["summary", "Summary vs last year"], ["recon", "Reconciliations"], ["complete", "Completeness"], ["tax", "Tax computation"], ["areas", "Area summaries"], ["docs", "Document index"], ["depr", "Depreciation"], ["sales", "Sales detail"], ["books", "Books to tax"], ["rentals", "Rentals and passive"], ["k1", "K-1 lines"], ["retire", "Retirement and foreign"], ["deduct", "Deductions and credits"], ["payments", "Payments"], ["state", "State split"], ["carry", "Carryovers"], ["basis", "Basis by year"], ["prior", "Prior preparer vs us"]];

  ui.views.records = (r) => {
    const tab = r.args[0] || "summary";
    const fn = R[tab] || (ui.recordViews && ui.recordViews[tab]) || R.summary;
    return `<div class="pagehead"><div><h1>Records</h1><div class="sub">Every record below is generated from the same claims. Click any number to trace it.</div></div></div>${ui.tabs("records", TABS, tab)}${fn(r)}`;
  };

  const R = {};
  R.summary = () => {
    const py = WP.M.P.prior_years.return_2024.lines, labels = WP.M.P.prior_years.return_2024.line_labels || {}, ev = WP.live().ev;
    const keys = ["F1040.1a", "F1040.2b", "F1040.3b", "F1040.4a", "F1040.7", "F1040.8", "F1040.9", "F1040.10", "F1040.11", "F1040.12", "F1040.13", "F1040.15", "F1040.16", "F1040.23", "F1040.24", "F1040.25a", "F1040.26", "F1040.33"];
    const rows = keys.filter((k) => WP.M.line(k)).map((k) => {
      const p = py[k], c = ev.get(k), d = typeof p === "number" ? c - p : null;
      const flag = typeof p === "number" && Math.abs(d) > WP.store.state.standards.variance_amount && Math.abs(d) / Math.max(1, Math.abs(p)) * 100 > WP.store.state.standards.variance_percent;
      return `<tr><td class="mono small">${k}</td><td>${esc(L(k))}</td><td class="n">${p === undefined ? "—" : money(p)}</td><td class="n">${N(k)}</td><td class="n ${d > 0 ? "pos" : "neg"}">${d === null ? "" : U.signed(Math.round(d))}</td><td>${flag ? ui.chip("explain", WP.variances().find((v) => v.key === k && v.explained) ? "ok" : "warn") : ""}</td></tr>`;
    });
    const T = WP.live().totals, b = WP.M.P.prior_years.return_2024;
    return tbl(["Line", "Description", { t: "2024 filed", n: 1 }, { t: "2025 (workpaper)", n: 1 }, { t: "Change", n: 1 }, "Variance"], rows) +
      `<div class="grid g2 mt16"><div class="card small"><b>Federal 2025:</b> total tax ${money(T.federal.total_tax)} vs 2024 ${money(py["F1040.24"])}; ${T.federal.balance_due >= 0 ? "balance due " + money(T.federal.balance_due) : "refund " + money(-T.federal.balance_due)}.</div><div class="card small"><b>California 2025:</b> total tax ${money(T.california.total_tax)}; ${T.california.balance_due >= 0 ? "balance due" : "refund"} ${money(Math.abs(T.california.balance_due))}. 2024 residency: ${esc(JSON.stringify(b.residency))}.</div></div>`;
  };
  R.tax = () => {
    const groups = [["Form 1040", "F1040", (l) => /^F1040\.(9|1[0-9]|2[0-9]|3[0-9])$/.test(l.key)], ["Schedule 2 (other taxes)", "Sch2", () => true], ["AMT (Form 6251)", "F6251", () => true], ["Net investment income tax (Form 8960)", "F8960", () => true], ["Additional Medicare (Form 8959)", "F8959", () => true], ["QBI (Form 8995)", "F8995", () => true]];
    return groups.map(([t, f, flt]) => `<h3 class="mt16 mb8">${t}</h3>${tbl(["Line", "Description", { t: "Value", n: 1 }, "Rule"], WP.M.curV().lines.filter((l) => l.form === f && flt(l)).map((l) => `<tr class="click" data-act="trace" data-key="${esc(l.key)}"><td class="mono small">${esc(l.key)}</td><td>${esc(l.label)}</td><td class="n">${N(l.key)}</td><td class="tiny muted">${esc(l.rule)}</td></tr>`))}`).join("");
  };
  R.areas = () => {
    const heads = { wages_and_stock_compensation: ["F1040.1z", "F1040.25a", "F6251.2i", "F6251.11"], investments_and_digital_assets: ["SchB.2", "SchB.6", "SchD.7", "SchD.15", "SchD.16", "F8960.12"], business: ["SchC.1", "SchC.28", "SchC.31", "SchSE.12", "Sch1.16", "Sch1.17"], rentals_and_sale: ["SchE.26", "F8582.4", "F4797.25", "SchD.19"], pass_throughs_and_basis: ["F7203.1", "F7203.7", "F7203.excess", "SchE.28B"], deductions_and_credits: ["SchA.5e", "SchA.8e", "SchA.14", "SchA.17", "F8812.12", "F2441.12"], california: ["F540NR.17", "F540NR.32", "F540NR.34", "F540NR.64", "F540NR.78", "F540NR.97"], partner_review: ["F1040.11", "F1040.15", "F1040.24", "F1040.33", "F1040.37"] };
    return `<div class="grid g2">${Object.entries(heads).map(([a, ks]) => `<div class="card"><h3>${esc(WP.areaLabel(a))}</h3><table class="mt8"><tbody>${ks.filter((k) => WP.M.line(k)).map((k) => `<tr><td class="small">${esc(L(k).slice(0, 56))}</td><td class="n">${N(k)}</td></tr>`).join("")}</tbody></table>${(WP.findings.filter((f) => f.area === a && (f.sev === "error" || f.sev === "warning") && WP.findingState(f.id).status === "open").length) ? `<div class="mt8">${ui.chip(WP.findings.filter((f) => f.area === a && (f.sev === "error" || f.sev === "warning") && WP.findingState(f.id).status === "open").length + " open finding(s)", "err")}</div>` : ""}</div>`).join("")}</div>`;
  };
  R.docs = () => ui.views.documents({ q: {}, args: [] });

  R.depr = () => {
    const M = WP.M, v = M.curV().v;
    const rows = v.assets.map((a) => `<tr class="click" data-act="src" data-ref="asset:${esc(a.asset_id)}"><td><b>${esc(a.asset_id)}</b><div class="tiny muted">${esc(a.description)}</div></td><td class="small">${esc(a.activity.replace(/^Rental: /, "").replace(/^Schedule C: /, "Sch C: "))}</td><td class="n">${money(a.cost)}</td><td class="small mono">${esc(a.placed_in_service)}</td><td class="small">${esc(a.method)} · ${esc(a.life_years)}y</td><td class="n">${money(a.federal.depreciation_2025)}</td><td class="n">${money(a.california.depreciation_2025)}</td><td class="n">${money(a.amt.depreciation_2025)} <span class="tiny muted">(${U.signed(Math.round(a.amt.difference_from_regular || 0))})</span></td><td class="n">${money(a.federal.accumulated_end)}</td><td class="n">${money(a.california.accumulated_end)}</td><td class="small">${esc(a.disposed ? JSON.stringify(a.disposed).slice(0, 70) : a.disposition ? JSON.stringify(a.disposition).slice(0, 70) : "—")}</td></tr>`);
    const prior = M.P.prior_years.asset_records;
    return tbl(["Asset", "Activity", { t: "Cost", n: 1 }, "In service", "Method / life", { t: "Federal 2025", n: 1 }, { t: "California 2025", n: 1 }, { t: "AMT 2025 (diff)", n: 1 }, { t: "Fed accumulated", n: 1 }, { t: "CA accumulated", n: 1 }, "Disposal"], rows) +
      `<div class="callout small mt8">Federal vs California: the 2025 studio equipment (38,000) took 100% special depreciation federally; California does not allow it, so California uses section 179 up to its 25,000 limit and the difference is carried (FTB 3885A). The engine's alternative "elect §179 instead" is in <a href="#/changes/whatif">What-ifs</a>.</div>
      <h3 class="mt16 mb8">Disposal and recapture (Austin condo, sold 2025-10-15)</h3>${tbl(["Line", "Description", { t: "Value", n: 1 }], M.curV().lines.filter((l) => l.form === "F4797" || l.key === "SchD.19").map((l) => `<tr class="click" data-act="trace" data-key="${esc(l.key)}"><td class="mono small">${esc(l.key)}</td><td>${esc(l.label)}</td><td class="n">${N(l.key)}</td></tr>`))}
      <h3 class="mt16 mb8">Prior years (from the prior preparer's schedule)</h3>${tbl(["Asset", "Federal by year", "California by year"], prior.map((a) => `<tr><td>${esc(a.asset_id)} <span class="muted small">${esc(a.description)}</span></td><td class="mono tiny">${esc(Object.entries(a.federal).map(([y, x]) => y + ":" + Math.round(x)).join("  "))}</td><td class="mono tiny">${esc(Object.entries(a.california).map(([y, x]) => y + ":" + Math.round(x)).join("  "))}</td></tr>`))}`;
  };

  R.sales = (r) => {
    const M = WP.M, ev = WP.live().ev;
    const lots = M.curV().lines.filter((l) => l.form === "F8949" && !/total$/.test(l.key));
    const parse = (l) => {
      const m = /^(.*?) \((?:acquired (\S+), sold (\S+)|[^)]*?)(?:; proceeds ([\d,.-]+), basis ([\d,.-]+)(?:, adjustment ([A-Z]) ([\d,.-]+))?)?\)$/.exec(l.label) || [];
      const c = /acquired ([\d-]+), sold ([\d-]+); proceeds ([\d,.-]+), basis ([\d,.-]+)(?:, adjustment (\w) ([-\d,.]+))?/.exec(l.label) || [];
      return { desc: (/^(.*?) \(/.exec(l.label) || [])[1] || l.label, acq: c[1], sold: c[2], proceeds: c[3], basis: c[4], adj: c[6] };
    };
    const box = r.q.box || "", q = (r.q.q || "").toLowerCase(), flag = r.q.flag || "";
    const rows = lots.map((l) => ({ l, p: parse(l), box: l.key.split(".")[1] }));
    const flags = (x) => { const f = []; if (x.p.basis === "0.00" && x.box !== "D" && x.box !== "A") f.push("basis 0"); if (x.p.adj) f.push("adjustment"); if (/RSU|ESPP|ISO/.test(x.l.label)) f.push("stock comp"); if (x.box === "H" || x.box === "K") f.push("digital"); if (/C6/.test(x.l.key)) f.push("no basis"); return f; };
    const shown = rows.filter((x) => (!box || x.box === box) && (!q || x.l.label.toLowerCase().includes(q)) && (!flag || flags(x).includes(flag)));
    const boxes = [...new Set(rows.map((x) => x.box))].sort();
    const bt = M.curV().lines.filter((l) => /^F8949\.[A-Z]\.total$/.test(l.key));
    const lim = r.q.all ? 1e9 : 100;
    const byDoc = {};
    rows.forEach((x) => { const e = M.evById[(x.l.sources || [])[0]]; const d = e ? e.document_id : "other"; const b = (byDoc[d] ||= { n: 0, gain: 0 }); b.n++; b.gain += Number(ev.get(x.l.key)) || 0; });
    const brokerRows = Object.entries(byDoc).map(([d, b]) => `<tr><td>${M.docById[d] ? `<a href="#/doc/${d}">${d}</a> ${esc(M.docById[d].title.slice(0, 50))}` : esc(d)}</td><td class="n">${b.n}</td><td class="n">${U.money(Math.round(b.gain))}</td></tr>`).join("");
    return `<div class="card mb8"><h4>By source document</h4><table class="small mt8"><thead><tr><th>Document</th><th class="n">Lots</th><th class="n">Net gain/(loss)</th></tr></thead><tbody>${brokerRows}</tbody></table></div>
      <div class="row wrap mb8"><span class="small muted">${rows.length} lots across ${boxes.length} boxes. Boxes: </span>${boxes.map((b) => `<a class="chip ${b === box ? "acc" : ""}" style="text-decoration:none" href="#/records/sales?box=${b}">${b}: ${rows.filter((x) => x.box === b).length}</a>`).join("")}${["basis 0", "adjustment", "stock comp", "digital", "no basis"].map((f) => `<a class="chip ${f === flag ? "acc" : ""}" style="text-decoration:none" href="#/records/sales?flag=${encodeURIComponent(f)}">⚑ ${f}</a>`).join("")}<a href="#/records/sales" class="small">clear</a></div>
      <div class="grid g4 mb8">${bt.map((l) => `<div class="card" style="padding:8px 12px"><div class="tiny muted">Box ${l.key.split(".")[1]} total</div><div class="mono">${N(l.key)}</div></div>`).join("")}</div>
      ${tbl(["Box.Lot", "Description", "Acquired", "Sold", { t: "Proceeds", n: 1 }, { t: "Basis", n: 1 }, "Adj", { t: "Gain/(loss)", n: 1 }, "Flags"], shown.slice(0, lim).map((x) => `<tr class="click" data-act="trace" data-key="${esc(x.l.key)}"><td class="mono small">${esc(x.l.key.replace("F8949.", ""))}</td><td class="small">${esc(x.p.desc.slice(0, 44))}</td><td class="mono tiny">${esc(x.p.acq || "")}</td><td class="mono tiny">${esc(x.p.sold || "")}</td><td class="n">${esc(x.p.proceeds || "")}</td><td class="n">${esc(x.p.basis || "")}</td><td class="tiny">${esc(x.p.adj || "")}</td><td class="n">${N(x.l.key)}</td><td>${flags(x).map((f) => ui.chip(f, f === "no basis" ? "err" : "warn")).join(" ")}</td></tr>`), { h: "58vh" })}
      ${shown.length > lim ? `<div class="mt8"><a class="btn" href="#/records/sales?all=1${box ? "&box=" + box : ""}">Show all ${shown.length} lots</a></div>` : ""}`;
  };

  R.books = () => {
    const M = WP.M, b = (f) => (M.evsByDoc.D14.find((e) => e.field === f) || { value: 0, id: "" });
    const map = [["Sales - client projects + print and licensing", ["Sales - client projects", "Sales - print and licensing"], "SchC.1", "Receipts: books plus the 1099-K added on top", "DUP-1099K"], ["Advertising", ["Advertising"], "SchC.8"], ["Bank and merchant fees", ["Bank and merchant fees"], "SchC.27a.2"], ["Car and truck - fuel", ["Car and truck - fuel"], "SchC.9", "Standard mileage replaces actual fuel; miles 11,800 includes a duplicate scan", "DUP-PAGE-D23"], ["Contract labor", ["Contract labor"], "SchC.11", "No 1099-NEC filed for the two contractors", "OUTSIDE-1099NEC"], ["Depreciation (books 5-yr SL)", ["Depreciation"], "SchC.13", "Tax: 100% special depreciation on 38,000"], ["Insurance - business liability", ["Insurance - business liability"], "SchC.15"], ["Insurance - health (Erik)", ["Insurance - health (Erik)"], "Sch1.17", "Moves from the business to an adjustment to income", "SEHI-ELIGIBLE"], ["Internet + Telephone", ["Internet", "Telephone"], "SchC.25", "Booked at 100%; business use is 50% and 70%", "BIZ-USE"], ["Legal and professional", ["Legal and professional"], "SchC.17"], ["Meals (50% limit)", ["Meals"], "SchC.24b", "50% of 3,960"], ["Office expenses", ["Office expenses"], "SchC.18"], ["Software and subscriptions", ["Software and subscriptions"], "SchC.27a.1", "Includes personal Spotify", "BIZ-USE"], ["Supplies", ["Supplies"], "SchC.22"], ["Travel", ["Travel"], "SchC.24a"]];
    const rows = map.map(([name, fs, key, why, fid]) => { const bv = U.sum(fs.map((f) => b(f).value)); const tv = WP.live().ev.get(key); return `<tr class="click" data-act="trace" data-key="${esc(key)}"><td>${esc(name)}</td><td class="n">${money(bv)}</td><td class="mono small">${esc(key)}</td><td class="n">${N(key)}</td><td class="n ${tv - bv ? "adjd" : ""}">${U.signed(Math.round(tv - bv))}</td><td class="small">${esc(why || "")} ${fid ? `<a href="#/findings/${fid}">finding</a>` : ""}</td></tr>`; });
    return `<div class="callout small mb8">Books (QuickBooks, cash basis, D14) to Schedule C. The reconciling items are explained or flagged; nothing is a plug.</div>` + tbl(["Books account", { t: "Books", n: 1 }, "Sch C line", { t: "Tax return", n: 1 }, { t: "Difference", n: 1 }, "Why"], rows) +
      `<div class="grid g3 mt16"><div class="card">${ui.kpi("Net income per books (D14)", money(89834))}</div><div class="card">${ui.kpi("Net profit, Schedule C (SchC.31)", N("SchC.31"))}</div><div class="card">${ui.kpi("Home office (not in books)", N("SchC.30"), "simplified: avg 240 sq ft × $5 (D24)")}</div></div>
      <h3 class="mt16 mb8">From the business to taxable income</h3>${tbl(["Step", "Line", { t: "Amount", n: 1 }], [["Net profit, Schedule C", "SchC.31"], ["Self-employment tax (Schedule SE)", "SchSE.12"], ["Deductible half of SE tax", "Sch1.15"], ["SEP-IRA deduction", "Sch1.16"], ["Self-employed health insurance", "Sch1.17"], ["Total adjustments to income", "F1040.10"], ["Adjusted gross income", "F1040.11"], ["Qualified business income deduction", "F1040.13"], ["Taxable income", "F1040.15"]].map(([t, k]) => `<tr class="click" data-act="trace" data-key="${k}"><td>${t}</td><td class="mono small">${k}</td><td class="n">${N(k)}</td></tr>`))}`;
  };

  R.rentals = () => {
    const M = WP.M, V = M.curV(), lines = V.lines.filter((l) => l.form === "SchE" && /[AB]$/.test(l.key) && !/^SchE\.(28|2[89]|3[0-9])/.test(l.key));
    const nums = [...new Set(lines.map((l) => l.key.replace(/^SchE\./, "").replace(/[AB]$/, "")))];
    const lab = (n) => (lines.find((l) => l.key === `SchE.${n}A`) || {}).label || n;
    const rows = nums.map((n) => `<tr><td class="mono small">${n}</td><td class="small">${esc(lab(n).replace(/ - property A/i, "").slice(0, 52))}</td><td class="n">${V.idx[`SchE.${n}A`] ? N(`SchE.${n}A`) : ""}</td><td class="n">${V.idx[`SchE.${n}B`] ? N(`SchE.${n}B`) : ""}</td></tr>`);
    return `<div class="grid g2 mb8"><div class="card small"><b>A</b> 1450 Fremont Way, Sacramento (rented 365 days, managed by Capitol Keys)</div><div class="card small"><b>B</b> 1200 Barton Hills Dr #4C, Austin (rented to 09/30, sold 10/15)</div></div>${tbl(["Line", "Description", { t: "A: Fremont Way", n: 1 }, { t: "B: Austin condo", n: 1 }], rows)}
      <h3 class="mt16 mb8">Passive activity limits (Form 8582) and suspended losses</h3>${tbl(["Line", "Description", { t: "Value", n: 1 }], V.lines.filter((l) => l.form === "F8582").map((l) => `<tr class="click" data-act="trace" data-key="${esc(l.key)}"><td class="mono small">${esc(l.key)}</td><td>${esc(l.label)}</td><td class="n">${N(l.key)}</td></tr>`))}
      <div class="callout small mt8">Suspended losses in from 2024: Fremont Way ${money(M.P.prior_years.carryovers_into_2025.passive_1450_fremont)}, Austin condo ${money(M.P.prior_years.carryovers_into_2025.passive_1200_barton_hills)}. The sale of the condo (fully disposed) releases its suspended loss. The HVAC finding changes the Fremont Way result, so check Form 8582 after approving it.</div>`;
  };

  R.k1 = () => {
    const M = WP.M, rv = M.reverse();
    const docs = [["D37", "Ridgeline Real Estate Fund III LP (1065), received 2026-06-22, late"], ["D38", "Ridgeline state apportionment"], ["D39", "Lindqvist Family Woodworks (1120-S), 2025"], ["D40", "Lindqvist Family Woodworks (1120-S), 2023, received 2026-06-05 (basis roll-forward)"]];
    return docs.map(([d, t]) => `<h3 class="mt16 mb8">${d} · ${esc(t)}</h3>${tbl(["Field", "Label", { t: "Value", n: 1 }, "Conf", "Landed in"], (M.evsByDoc[d] || []).map((e) => `<tr class="click" data-act="src" data-ref="${e.id}"><td class="mono small">${esc(e.field)}</td><td class="small">${esc(e.label)}</td><td class="n">${esc(String(e.value))}</td><td class="mono tiny">${e.confidence}</td><td>${(rv.evToClaims[e.id] || []).map((k) => `<a class="num tiny" data-act="trace" data-key="${esc(k)}">${esc(k)}</a>`).join(" ") || '<span class="muted tiny">—</span>'}</td></tr>`))}`).join("") +
      `<h3 class="mt16 mb8">Form 7203 (S-corporation stock basis)</h3>${tbl(["Line", "Description", { t: "Value", n: 1 }], M.curV().lines.filter((l) => l.form === "F7203").map((l) => `<tr class="click" data-act="trace" data-key="${esc(l.key)}"><td class="mono small">${esc(l.key)}</td><td>${esc(l.label)}</td><td class="n">${N(l.key)}</td></tr>`))}`;
  };

  R.retire = () => {
    const list = (title, flt) => `<h3 class="mt16 mb8">${title}</h3>${tbl(["Line", "Description", { t: "Value", n: 1 }], WP.M.curV().lines.filter(flt).map((l) => `<tr class="click" data-act="trace" data-key="${esc(l.key)}"><td class="mono small">${esc(l.key)}</td><td>${esc(l.label)}</td><td class="n">${N(l.key)}</td></tr>`))}`;
    return list("Backdoor Roth (Form 8606), Ngozi", (l) => l.form === "F8606") + `<div class="callout small mt8">Contributions: 2024 made 02/12/2025 (basis 7,000 on the 2024 Form 8606, agreed to D42); 2025 7,000 (D43). Both converted: 14,026 (D41 code 2). The client's own recollection (qa-31) disagrees with the filed record: see finding ROTH-BASIS.</div>` +
      list("HSA (Form 8889)", (l) => l.form === "F8889") + list("SEP-IRA and self-employed health insurance", (l) => /^Sch1\.(15|16|17)$/.test(l.key)) +
      list("Foreign: Swedish account (Form 8938, Schedule B Part III)", (l) => l.form === "F8938" || /^SchB\.(1\.6|7a|7b)$/.test(l.key)) +
      `<div class="callout small mt8">FX: SEK 1,452,300 high balance ÷ 9.71 (2025 year-end Treasury rate) = USD 149,567. The 2024 return reported 151,880. Interest SEK 18,450 should use the 2025 average rate (finding FX-YEAR). FBAR (FinCEN 114) and the open Form 3520 are outside this engagement: see the outside-filings register.</div>` + outsideReg();
  };
  const outsideReg = () => `<h3 class="mt16 mb8">Outside-filings register</h3>${tbl(["Filing", "Who", "Due", "Scope", "Note"], WP.outsideFilings().map((o) => `<tr><td><b>${esc(o.name)}</b></td><td class="small">${esc(o.who)}</td><td class="mono small">${esc(o.due)}</td><td class="small">${esc(o.scope)}</td><td class="small">${esc(o.note)}</td></tr>`))}`;
  ui.outsideReg = outsideReg;

  R.deduct = () => {
    const P = WP.M.params, ev = WP.live().ev;
    const lim = [["State and local taxes (SALT)", `Cap ${money(P.salt_cap)}, reduced 30% of MAGI over ${money(P.salt_cap_phase_start)}, floor ${money(P.salt_cap_floor)}`, ev.get("SchA.5d"), ev.get("SchA.5e")], ["Mortgage interest", "Acquisition debt up to 750,000 (purchase 685,000 new loan 548,000)", ev.get("SchA.8a"), ev.get("SchA.8e")], ["Charitable (cash and noncash)", "Cash 60% of AGI; long-term appreciated stock 30%", ev.get("SchA.14"), ev.get("SchA.14")], ["Dependent care (Form 2441)", `Limit ${money(P.dep_care_limit_one)} one child; employer benefits excluded up to ${money(P.dep_care_exclusion_max)}`, ev.get("F2441.2"), ev.get("F2441.3")], ["HSA (Form 8889)", `Family limit ${money(P.hsa_family_limit)}`, ev.get("F8889.2"), ev.get("F8889.3")], ["Child tax credit", `${money(P.ctc_per_child)} per child, phase-out over ${money(P.ctc_phaseout_start)}`, ev.get("F8812.11"), ev.get("F8812.12")]];
    const list = (title, flt) => `<h3 class="mt16 mb8">${title}</h3>${tbl(["Line", "Description", { t: "Value", n: 1 }], WP.M.curV().lines.filter(flt).map((l) => `<tr class="click" data-act="trace" data-key="${esc(l.key)}"><td class="mono small">${esc(l.key)}</td><td>${esc(l.label)}</td><td class="n">${N(l.key)}</td></tr>`))}`;
    return tbl(["Item", "Limit", { t: "Before limit", n: 1 }, { t: "Allowed", n: 1 }], lim.map((x) => `<tr><td><b>${x[0]}</b></td><td class="small">${esc(x[1])}</td><td class="n">${money(x[2])}</td><td class="n">${money(x[3])}</td></tr>`)) + list("Schedule A (itemized)", (l) => l.form === "SchA") + list("Child tax credit and other dependents (Form 8812) · due diligence Form 8867", (l) => l.form === "F8812" || l.form === "F8867") + list("Education credit (Form 8863)", (l) => l.form === "F8863") + list("Dependent care (Form 2441)", (l) => l.form === "F2441") + list("Noncash gifts (Form 8283)", (l) => l.form === "F8283");
  };

  R.payments = () => {
    const M = WP.M, tr = M.P.tax_agency_records.irs_account_transcript_2025.slice(-1)[0].transactions, ftb = M.P.tax_agency_records.ftb_account;
    const line = (k) => ui.num(k);
    const fed = [["2025-04-15", 3000], ["2025-06-16", 3000], ["2025-09-15", 3000], ["2026-01-14", 4000]];
    return `<div class="grid g2"><div class="card"><h3>Federal</h3><table class="mt8 small"><tbody><tr><td>Withholding (W-2 box 2)</td><td class="n">${line("F1040.25a")}</td></tr><tr><td>Estimated payments</td><td class="n">${line("F1040.26")}</td></tr><tr><td>Extension payment (Sch 3 line 10)</td><td class="n">${line("Sch3.10")}</td></tr><tr class="total"><td>Total payments</td><td class="n">${line("F1040.33")}</td></tr><tr><td>Total tax</td><td class="n">${line("F1040.24")}</td></tr><tr class="total"><td>Balance due</td><td class="n">${line("F1040.37")}</td></tr></tbody></table></div>
      <div class="card"><h3>California</h3><table class="mt8 small"><tbody><tr><td>Withholding</td><td class="n">${line("F540NR.71")}</td></tr><tr><td>Estimated payments</td><td class="n">${line("F540NR.72")}</td></tr><tr><td>Extension</td><td class="n">${line("F540NR.73")}</td></tr><tr class="total"><td>Total payments</td><td class="n">${line("F540NR.78")}</td></tr><tr><td>Total tax</td><td class="n">${line("F540NR.64")}</td></tr></tbody></table></div></div>
      <h3 class="mt16 mb8">Estimated payments: return vs agency records</h3>${tbl(["Date", { t: "Per return", n: 1 }, { t: "IRS transcript", n: 1 }, "Status"], fed.map(([d, a]) => { const t = tr.find((x) => x.code === "670" && /Estimated/.test(x.description) && Math.abs(new Date(x.date) - new Date(d)) < 3 * 86400000); const ok = t && t.amount === a; return `<tr><td class="mono">${d}</td><td class="n">${money(a)}</td><td class="n">${t ? money(t.amount) + ' <span class="tiny muted">' + t.date + "</span>" : "—"}</td><td>${ok ? ui.chip("agrees", "ok") : ui.chip("differs", "err")}</td></tr>`; }))}
      ${tbl(["Date", { t: "Per return (CA)", n: 1 }, { t: "FTB record (2025)", n: 1 }, "Status"], [["2025-04-15", 3500], ["2025-06-16", 3500], ["2025-09-15", 3500], ["2026-01-15", 3500]].map(([d, a]) => { const t = ftb.tax_year_2025_payments.find((x) => x.date === d); return `<tr><td class="mono">${d}</td><td class="n">${money(a)}</td><td class="n">${t ? money(t.amount) : "—"}</td><td>${t ? ui.chip("agrees", "ok") : ui.chip("held as 2024 credit", "err")}</td></tr>`; }))}`;
  };

  R.state = () => {
    const M = WP.M, V = M.curV();
    const lines = V.lines.filter((l) => l.form === "SchCA540NR");
    const nums = [...new Set(lines.map((l) => l.key.split(".")[1]))];
    const lab = (n) => (lines.find((l) => l.key.startsWith(`SchCA540NR.${n}.`)) || {}).label || "";
    const rows = nums.map((n) => `<tr><td class="mono small">${n}</td><td class="small">${esc(lab(n).replace(/ - .*$/, "").slice(0, 44))}</td>${["A", "C", "D", "E"].map((c) => `<td class="n">${V.idx[`SchCA540NR.${n}.${c}`] ? N(`SchCA540NR.${n}.${c}`) : ""}</td>`).join("")}<td class="n small muted">${V.idx[`SchCA540NR.${n}.D`] && V.idx[`SchCA540NR.${n}.E`] && V.idx[`SchCA540NR.${n}.D`].value > 0 ? U.pct(V.idx[`SchCA540NR.${n}.E`].value / V.idx[`SchCA540NR.${n}.D`].value, 0) : ""}</td></tr>`);
    return `<div class="callout small mb8">Residency: California 2025-01-01 to 07-14 (195 of 365 days), Texas from 07-15. Column A = federal amount · C = California additions/subtractions · D = total using California law · E = California-source amount.</div>
      ${tbl(["Line", "Item", { t: "A federal", n: 1 }, { t: "C CA adj", n: 1 }, { t: "D CA law", n: 1 }, { t: "E CA source", n: 1 }, { t: "CA share", n: 1 }], rows)}
      <h3 class="mt16 mb8">Pass-through income by state (K-1 supplements)</h3>${tbl(["Source", "California", "Texas", "Arizona", "Nevada", "Oregon"], [`<tr><td>Ridgeline box 2 (D38): rental income ${N("SchE.28B")}</td>${[0.22, 0.31, 0.27, 0.2].map((x) => `<td class="n">${U.pct(x, 0)}</td>`).join("")}<td class="n">—</td></tr>`, `<tr><td>Woodworks ordinary income 18,400 (D39)</td><td class="n">by days</td><td class="n">by days</td><td class="n">—</td><td class="n">—</td><td class="n">source: OR composite tax 1,580 paid for Erik</td></tr>`])}
      <h3 class="mt16 mb8">Form 540NR</h3>${tbl(["Line", "Description", { t: "Value", n: 1 }], V.lines.filter((l) => l.form === "F540NR").map((l) => `<tr class="click" data-act="trace" data-key="${esc(l.key)}"><td class="mono small">${esc(l.key)}</td><td>${esc(l.label)}</td><td class="n">${N(l.key)}</td></tr>`))}`;
  };

  R.carry = () => {
    const M = WP.M, cin = M.P.prior_years.carryovers_into_2025, cout = M.curV().v.carryovers_out, S = WP.store.state;
    const ver = (k) => ((S.verifs[k] || []).some((v) => v.vtype === "agreed_to_prior_year") ? ui.chip("agreed to prior year", "ok") : ui.chip("not yet agreed", "warn"));
    const inRows = Object.entries(cin).filter(([k, v]) => typeof v === "number").map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td class="n">${money(v)}</td><td class="small muted">${esc(cin.sources)}</td><td>${ver("py:/carryovers_into_2025/" + k)} <button class="btn sm" data-act="verify" data-key="F8582.unallowed.A" data-type="agreed_to_prior_year">Verify</button></td></tr>`);
    return `<h3 class="mb8">Into 2025 (from the 2024 return and the prior preparer)</h3>${tbl(["Item", { t: "Amount", n: 1 }, "Source", "Agreement"], inRows)}<div class="small muted mt8">The step "Carryovers agreed to prior year" completes when each carryover line used in the return has an "agreed to prior year" verification.</div>
      <h3 class="mt16 mb8">Out of 2025 (to next year)</h3>${tbl(["Item", { t: "Federal", n: 1 }], Object.entries(cout.federal).map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td class="n">${money(v)}</td></tr>`))}`;
  };

  R.basis = () => {
    const M = WP.M, b = M.P.prior_years.basis_records;
    return `<h3 class="mb8">S corporation stock basis: Lindqvist Family Woodworks (20%)</h3>${tbl(["Year", { t: "K-1 income", n: 1 }, { t: "Distributions", n: 1 }, { t: "Ending basis", n: 1 }, "Source"], [
      `<tr><td>2022</td><td class="n">—</td><td class="n">—</td><td class="n">21,300</td><td class="small">client worksheet (no K-1) ${ui.chip("unsupported", "warn")}</td></tr>`,
      `<tr><td>2023</td><td class="n">14,100</td><td class="n">20,000</td><td class="n">15,400</td><td class="small">K-1 D40 received 2026-06-05 ${ui.chip("gap closed", "ok")}</td></tr>`,
      `<tr><td>2024</td><td class="n">16,900</td><td class="n">30,000</td><td class="n">2,300</td><td class="small">2024 K-1 (prior return)</td></tr>`,
      `<tr><td>2025</td><td class="n">${N("F7203.3a")}</td><td class="n">${N("F7203.6")}</td><td class="n">${N("F7203.15")}</td><td class="small">excess distribution ${N("F7203.excess")} taxed as capital gain</td></tr>`])}
      <h3 class="mt16 mb8">Other basis records</h3>${tbl(["Item", "Year", { t: "Amount", n: 1 }, "Source"], [
        `<tr><td>Ridgeline capital account</td><td>2024 end</td><td class="n">${money(b.partnership_ridgeline[0].ending_capital_account)}</td><td class="small">K-1; outside basis never computed ${ui.chip("gap", "warn")}</td></tr>`,
        `<tr><td>Ridgeline capital account</td><td>2025 end</td><td class="n">${N("ev-0970") === "—" ? money(63660) : money(63660)}</td><td class="small">D37 capital account (tax basis not computed)</td></tr>`,
        `<tr><td>Ngozi nondeductible IRA basis</td><td>2024 → 2025</td><td class="n">${money(7000)} → ${N("F8606.14")}</td><td class="small">Form 8606 line 14</td></tr>`,
        `<tr><td>Austin home (7709 Barton Ridge)</td><td>2025</td><td class="n">${money(685000)}</td><td class="small">cost basis, purchase 2025-07-08 (D54)</td></tr>`,
        `<tr><td>Austin condo (sold 2025-10-15)</td><td>sold</td><td class="n">${N("F4797.22")}</td><td class="small">310,000 cost + 6,600 flooring + selling costs; depreciation ${N("F4797.23")}</td></tr>`])}`;
  };

  R.prior = () => {
    const P = WP.M.P.prior_years.prior_preparer_workpaper;
    const rows = [
      ["2023 Woodworks K-1 missing; basis not rolled forward", "Obtained from the client (D40, 2026-06-05); beginning basis restated from 8,200 to 2,300", "Resolved: changes the 2025 capital gain (v2→v3)", "F7203.1"],
      ["2024 distributions 30,000 vs income 16,900: \"assumed basis sufficient\"", "Basis rolled forward: 2022 21,300 + 14,100 − 20,000 + 16,900 − 30,000 = 2,300; 2025 distributions exceed it", "Changed: finding SCORP-BASIS", "F7203.excess"],
      ["2024 Form 5498 not obtained; IRA basis 7,000 \"per client\"", "D42 (5498 for 2024) and D43 obtained; basis agreed. Client's recollection disagrees: ROTH-BASIS", "Resolved with a note", "F8606.2"],
      ["Home office 300 sq ft (\"2 rooms combined?\")", "D24 measurements: 220 sq ft until mid-July, 260 from 07/16; average 240", "Changed: 1,500 → 1,200", "SchC.30"],
      ["Form 3520 for the 2023 foreign inheritance: no resolution noted", "Not resolved; outside this engagement; flagged for advice", "Open: OUTSIDE-3520", null],
      ["Sparbanken: FBAR filed by client; Form 8938 max 151,880", "Form 8938 maximum 149,567 at the 2025 year-end rate; FBAR due 2026-10-15 confirmed outside scope", "Updated", "F8938.1.max"],
      ["Fremont Way appliances 2021: federal 100% bonus; CA 5-year 200DB", "Carried: California basis difference 241.92 continues (SAC-APPL)", "Carried forward", null],
      ["No self-employed health insurance deduction in 2024 (Erik on Ngozi's plan)", "The 2025 engine run deducted 14,400; the same eligibility fact applies (qa-25)", "Changed from the prior position: finding SEHI-ELIGIBLE", "Sch1.17"],
    ];
    return `<div class="card small mb8"><b>Prior preparer's memo (D07):</b> ${esc(P.summary_memo)}</div>${tbl(["What the prior preparer did or left open", "What we did", "Result", "Line"], rows.map(([a, b, c, k]) => `<tr><td class="small">${esc(a)}</td><td class="small">${esc(b)}</td><td class="small">${esc(c)}</td><td>${k ? `<a class="num" data-act="trace" data-key="${esc(k)}">${esc(k)}</a>` : ""}</td></tr>`))}
      <div class="small muted mt8">The 2024 return as filed is document D06; the unextracted workpaper export is D07 (not extracted by the pipeline, shown as text).</div>`;
  };
})();
