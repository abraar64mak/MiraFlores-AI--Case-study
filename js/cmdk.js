/* Command palette (Ctrl/Cmd K or /): jump to any screen, number, document, finding or conversation, and run role-aware actions. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;
  const box = () => document.getElementById("cmdk");
  let items = [], sel = 0;

  const RECORD_TABS = [["summary", "Summary vs last year"], ["recon", "Reconciliations"], ["complete", "Completeness"], ["tax", "Tax computation"], ["areas", "Area summaries"], ["docs", "Document index"], ["depr", "Depreciation by asset"], ["sales", "Sales detail"], ["books", "Books to tax"], ["rentals", "Rentals and passive"], ["k1", "K-1 lines"], ["retire", "Retirement and foreign"], ["deduct", "Deductions and credits"], ["payments", "Payments"], ["state", "State split"], ["carry", "Carryovers"], ["basis", "Basis by year"], ["prior", "Prior preparer vs us"]];
  const go = (h) => () => ui.go(h);
  const staff = () => WP.me().role !== "client";

  function actions() {
    const a = [];
    if (WP.can("propose").ok) a.push(["+", "New adjustment", "Change a line; the original is kept", () => ui.acts["adj-new"]({ dataset: {} })]);
    if (WP.can("thread").ok || WP.can("answer").ok) a.push(["✉", WP.me().role === "client" ? "Ask your preparer a question" : "New question or review note", "Attach to a number or document", () => ui.acts["thread-new"]({ dataset: { kind: WP.me().role === "client" ? "client_question" : "colleague_question" } })]);
    if (WP.can("time").ok) a.push(["◷", "Log time", "Against the engagement budget", () => ui.acts["time-add"]({ dataset: {} })]);
    if (staff()) { a.push(["↶", "Undo my last change", "", () => ui.acts.undo()]); a.push(["↷", "Redo", "", () => ui.acts.redo()]); }
    if (staff()) a.push(["✦", "Load demo activity", "Seed realistic proposals, notes and questions", () => ui.acts["demo-seed"]()]);
    a.push(["?", "Open the guide for my role", "", () => ui.acts.guide()]);
    a.push(["◐", "Switch light / dark", "", () => ui.acts.theme()]);
    a.push(["✓", "Mark everything seen", "", () => ui.acts["seen-mark"]()]);
    if (WP.can("viewlog").ok) a.push(["⟲", "Reset workpaper to the packet", "Erases all adjustments, notes and sign-offs", () => ui.acts.reset()]);
    WP.users.forEach((u) => { if (u.id !== WP.me().id) a.push(["⇄", `Act as ${u.name}`, WP.roleLabel(u.role), () => { WP.store.setUser(u.id); ui.go("#/overview"); }]); });
    return a;
  }
  function pages() {
    const p = [];
    ui.navFor().forEach(([route, label, icon, , tab]) => p.push([ui.icon(icon, 15), label, "Go to", go(tab ? `#/${route}/${tab}` : `#/${route}`)]));
    if (staff()) {
      RECORD_TABS.forEach(([t, l]) => p.push(["▦", `Records: ${l}`, "Records", go(`#/records/${t}`)]));
      [["variances", "Prior-year variances"]].forEach(([t, l]) => p.push(["⚑", l, "Findings", go(`#/findings/${t}`)]));
      [["compare", "Compare versions"], ["whatif", "What-ifs"], ["since", "Since I last looked"]].forEach(([t, l]) => p.push(["±", `Changes: ${l}`, "Changes", go(`#/changes/${t}`)]));
      p.push(["⏵", "Season replay", "Go to", go("#/replay")], ["◫", "Roll forward to 2026", "Go to", go("#/rollforward")], ["◫", "IRS notice response record", "Go to", go("#/notice")], ["⌕", "Search everything", "Go to", go("#/firm/search")]);
    }
    p.push(["▤", "Client copy of the return", "Go to", go("#/clientcopy")]);
    return p;
  }
  function build(q) {
    const ql = q.trim().toLowerCase(), toks = ql.split(/\s+/).filter(Boolean);
    const hit = (s) => toks.every((t) => s.toLowerCase().includes(t));
    const rank = (s) => (s.toLowerCase().startsWith(ql) ? 0 : 1);
    const out = [];
    const grp = (title, list, max) => { const l = list.slice(0, max); if (l.length) out.push({ title }, ...l.map((x) => ({ it: x }))); };
    const acts = actions().filter((x) => !ql || hit(x[1] + " " + x[2])), pg = pages().filter((x) => !ql || hit(x[1])).sort((a, b) => rank(a[1]) - rank(b[1]));
    if (!ql) { grp("Suggested", acts.slice(0, 5), 5); grp("Go to", pg.slice(0, 8), 8); return out; }
    grp("Actions", acts, 6); grp("Go to", pg, 7);
    if (staff()) {
      const M = WP.M;
      grp("Findings", WP.findings.filter((f) => hit(f.title + " " + f.id)).map((f) => [f.sev === "error" ? "!" : "?", f.title, f.id, go(`#/findings/${f.id}`)]), 5);
      grp("Return lines", M.curV().lines.filter((l) => hit(l.key + " " + l.label)).sort((a, b) => rank(a.key) - rank(b.key)).map((l) => ["§", `${l.key} · ${l.label.slice(0, 60)}`, ui.fmtVal(WP.live().ev.get(l.key)), () => ui.openTrace(l.key)]), 6);
    }
    const M = WP.M;
    grp("Documents", M.docs.filter((d) => hit(d.id + " " + d.title)).map((d) => ["▤", `${d.id} · ${d.title.slice(0, 64)}`, d.belongs_to, go(`#/doc/${d.id}`)]), 5);
    if (ql.length >= 3 && staff()) {
      const t = [];
      M.docs.forEach((d) => d.pages.forEach((p) => { if (t.length > 5) return; const txt = ui.maskText(p.printed_content, d.id), i = txt.toLowerCase().indexOf(ql); if (i >= 0) t.push(["⌕", `${d.id} p${p.page}: …${txt.slice(Math.max(0, i - 22), i + ql.length + 36).replace(/\s+/g, " ")}…`, "in document text", go(`#/doc/${d.id}?p=${p.page}`)]); }));
      grp("In document text", t, 5);
    }
    const S = WP.store.state;
    grp("Conversations", S.threadOrder.map((id) => S.threads[id]).filter((t) => (WP.me().role !== "client" || t.visibility === "client") && hit(t.title)).map((t) => ["✉", t.title, t.status, go(`#/people/threads/${t.id}`)]), 4);
    grp("Client answers", M.P.client.questionnaire.filter((x) => hit(x.question + " " + x.answer)).map((x) => ["?", `${x.id}: ${x.question.slice(0, 62)}`, String(x.answer).slice(0, 36), () => ui.acts.src({ dataset: { ref: x.id } })]), 3);
    return out;
  }
  function paint(q) {
    const rows = build(q);
    items = rows.filter((r) => r.it).map((r) => r.it);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    let i = -1;
    box().innerHTML = `<div class="cmdk-box" role="dialog" aria-label="Command palette"><input class="cmdk-in" id="cmdk-in" placeholder="Search numbers, documents, findings, or type an action…" value="${esc(q)}" autocomplete="off" aria-label="Search">
      <div class="cmdk-list">${rows.map((r) => r.title ? `<div class="cmdk-grp">${esc(r.title)}</div>` : (i++, `<div class="cmdk-it ${i === sel ? "on" : ""}" data-i="${i}"><span class="ic">${r.it[0].startsWith("<svg") ? r.it[0] : esc(r.it[0])}</span><span class="t">${esc(r.it[1])}</span><span class="h">${esc(r.it[2])}</span></div>`)).join("") || '<div class="muted" style="padding:18px 14px">No results. Try a line number, a document id, a dollar amount or a word like "mileage".</div>'}</div>
      <div class="cmdk-foot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> move</span><span><span class="kbd">Enter</span> open</span><span><span class="kbd">Esc</span> close</span><span class="grow"></span><span>${esc(WP.roleLabel(WP.me().role))} view</span></div></div>`;
    const inp = document.getElementById("cmdk-in");
    inp.focus(); inp.setSelectionRange(q.length, q.length);
  }
  ui.cmdkOpen = () => { box().classList.add("on"); box().setAttribute("aria-hidden", "false"); sel = 0; paint(""); };
  ui.cmdkClose = () => { box().classList.remove("on"); box().setAttribute("aria-hidden", "true"); };
  const run = (i) => { const it = items[i]; if (!it) return; ui.cmdkClose(); setTimeout(() => it[3](), 20); };
  ui.acts.cmdk = ui.cmdkOpen;
  box().addEventListener("input", (e) => { if (e.target.id === "cmdk-in") { sel = 0; paint(e.target.value); } });
  box().addEventListener("click", (e) => { const it = e.target.closest(".cmdk-it"); if (it) return run(+it.dataset.i); if (e.target === box()) ui.cmdkClose(); });
  document.addEventListener("keydown", (e) => {
    const open = box().classList.contains("on");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open ? ui.cmdkClose() : ui.cmdkOpen(); return; }
    if (!open && e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ""))) { e.preventDefault(); ui.cmdkOpen(); return; }
    if (!open) return;
    if (e.key === "Escape") { e.stopPropagation(); ui.cmdkClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(document.getElementById("cmdk-in").value); const on = box().querySelector(".cmdk-it.on"); on && on.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); paint(document.getElementById("cmdk-in").value); const on = box().querySelector(".cmdk-it.on"); on && on.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") { e.preventDefault(); run(sel); }
  }, true);
})();
