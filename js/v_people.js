/* People: questions that become evidence, review notes that block filing, sign-offs that reopen, enforced roles. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, ui = WP.ui, esc = U.esc;
  WP.today = () => new Date().toISOString().slice(0, 10);

  ui.views.people = (r) => {
    const tab = r.args[0] || "threads";
    const me = WP.me();
    const tabs = me.role === "client" ? [["threads", "My questions"]] : [["threads", "Questions and notes"], ["signoffs", "Sign-offs"], ["team", "Team and roles"], ["inbox", "Inbox"]];
    return `<div class="pagehead"><div><h1>People</h1><div class="sub">${me.role === "client" ? "Questions from your preparer, and your answers." : "Questions, review notes, sign-offs and who may do what."}</div></div><div class="grow"></div>${me.role === "client" ? `<button class="btn primary" data-act="thread-new" data-kind="client_question">Ask your preparer</button>` : `<button class="btn primary" data-act="thread-new">+ New thread</button>`}</div>${ui.tabs("people", tabs, tab)}${{ threads, signoffs, team, inbox }[tab](r)}`;
  };

  const kindChip = (k) => ui.chip(k.replace(/_/g, " "), { review_note: "err", client_question: "info", colleague_question: "acc", task: "warn" }[k]);
  function visible(t) {
    const me = WP.me();
    return me.role !== "client" || t.visibility === "client";
  }

  function threads(r) {
    const S = WP.store.state, me = WP.me();
    const f = r.q.f || "open";
    let list = S.threadOrder.map((id) => S.threads[id]).filter(visible);
    const f2 = { open: (t) => t.status !== "resolved" && t.status !== "closed", mine: (t) => t.assignee === me.id && t.status !== "resolved", blocking: (t) => t.blocking && t.status !== "resolved", all: () => true }[f] || (() => true);
    list = list.filter(f2).reverse();
    const sel = r.args[1] || (list[0] && list[0].id);
    const t = S.threads[sel];
    const flt = me.role === "client" ? "" : `<div class="row wrap mb8">${[["open", "Open"], ["mine", "Assigned to me"], ["blocking", "Blocking filing"], ["all", "All"]].map(([k, l]) => `<a class="chip ${f === k ? "acc" : ""}" href="#/people/threads?f=${k}" style="text-decoration:none">${l}</a>`).join("")}</div>`;
    return `${flt}<div class="grid" style="grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr)">
      <div class="col gap4">${list.map((x) => `<a href="#/people/threads/${x.id}?f=${f}" class="card" style="padding:10px 12px;text-decoration:none;color:inherit;${x.id === sel ? "border-color:var(--accent)" : ""}"><div class="row wrap">${kindChip(x.kind)}${x.blocking && x.status !== "resolved" ? ui.chip("blocks filing", "err") : ""}${ui.chip(x.status, x.status === "resolved" ? "ok" : "")}<span class="grow"></span><span class="tiny muted">${U.date(x.ts)}</span></div><div class="mt8"><b>${esc(x.title)}</b></div><div class="tiny muted">${esc(x.target || "")}${x.assignee ? " · → " + esc(ui.userName(x.assignee)) : ""}${x.due ? " · due " + esc(x.due) + (x.due < WP.today() && x.status !== "resolved" ? " (overdue)" : "") : ""}</div></a>`).join("") || ui.empty("No threads.")}</div>
      <div>${t && visible(t) ? threadDetail(t) : ui.empty("Select a thread.")}</div></div>`;
  }
  function threadDetail(t) {
    const me = WP.me();
    const l = WP.M.line(t.target);
    const isDoc = WP.M.docById[t.target];
    return `<div class="card"><div class="row wrap">${kindChip(t.kind)}${t.blocking && t.status !== "resolved" ? ui.chip("blocks filing", "err") : ""}${ui.chip(t.status, t.status === "resolved" ? "ok" : "")}<span class="grow"></span>${t.assignee ? `<span class="small">→ ${ui.userChip(t.assignee)}</span>` : ""}${t.due ? `<span class="small muted">due ${esc(t.due)}</span>` : ""}</div>
      <h2 class="mt8">${esc(t.title)}</h2>
      ${t.target ? `<div class="small mt8">About: ${l ? `<a class="num" data-act="trace" data-key="${esc(t.target)}">${esc(t.target)} — ${esc(l.label)}</a>` : isDoc ? `<a href="#/doc/${esc(t.target)}">${esc(t.target)}</a>` : WP.findingById[t.target] ? `<a href="#/findings/${esc(t.target)}">${esc(WP.findingById[t.target].title)}</a>` : esc(t.target)}</div>` : ""}
      <div class="mt8">${t.messages.map((m) => `<div class="msg"><div class="row"><b>${esc(m.name)}</b><span class="muted small">${esc(WP.roleLabel(m.role))} · ${U.dt(m.ts)}</span></div><div style="white-space:pre-wrap">${esc(m.text)}</div>${(m.attachments || []).map((a) => `<div class="small">📎 ${esc(a.name)}</div>`).join("")}</div>`).join("")}</div>
      ${ui.aiThread ? ui.aiThread(t) : ""}
      <div class="row wrap mt16"><button class="btn primary" data-act="thread-reply" data-id="${t.id}">Reply</button>
        ${me.role !== "client" ? (t.status === "resolved" ? `<button class="btn" data-act="thread-status" data-id="${t.id}" data-st="open">Reopen</button>` : `<button class="btn" data-act="thread-status" data-id="${t.id}" data-st="resolved">Resolve</button>`) + `<button class="btn" data-act="thread-assign" data-id="${t.id}">Assign</button>` : ""}
        ${t.kind === "client_question" && t.status === "answered" && me.role !== "client" ? `<span class="chip ok">answered: resolve to record as evidence</span>` : ""}</div></div>`;
  }

  function signoffs() {
    const S = WP.store.state, M = WP.M;
    const stChip = (s, level, area) => {
      const st = WP.signoffStatus(s);
      if (st.state === "none") return `<span class="chip">not signed</span>`;
      if (st.state === "valid") return `<span class="chip ok">signed · ${esc(s.name)} · ${U.date(s.ts)}</span>`;
      if (st.state === "reopened") return `<span class="chip err" title="${esc(st.changed.slice(0, 12).join(", "))}">REOPENED · ${st.changed.length} line(s) changed since ${esc(s.name)} signed</span>`;
      return `<span class="chip">revoked</span>`;
    };
    return `<div class="callout small mb8">A sign-off stores the value of every line in its area at the moment of signing. If any of those values changes (an adjustment, a reverted adjustment, a new document), it reopens by itself. A person cannot sign off on an area they worked on, and a partner signs only after a current reviewer sign-off.</div>
      <div class="tablewrap"><table><thead><tr><th>Area</th><th class="n">Lines</th><th>Worked on by</th><th>Reviewer</th><th>Partner</th></tr></thead><tbody>
      ${WP.SIGN_AREAS.map((a) => {
        const rv = WP.currentSignoff(a.key, "reviewer"), pt = WP.currentSignoff(a.key, "partner");
        const worked = [...(S.workedBy[a.key] || [])].map(ui.userName).join(", ") || "—";
        const rs = WP.signoffStatus(rv), ps = WP.signoffStatus(pt);
        return `<tr><td><b>${esc(a.label)}</b></td><td class="n">${WP.areaKeys(a.key).length}</td><td class="small">${esc(worked)}</td>
          <td>${stChip(rv)} <button class="btn sm" data-act="signoff" data-area="${a.key}" data-level="reviewer">${rs.state === "valid" ? "Re-sign" : "Sign"}</button></td>
          <td>${stChip(pt)} <button class="btn sm" data-act="signoff" data-area="${a.key}" data-level="partner">${ps.state === "valid" ? "Re-sign" : "Sign"}</button></td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  function team() {
    const S = WP.store.state;
    const today = WP.today();
    const capLabels = { preparer: "prepare, propose adjustments, verify, ask questions", reviewer: "everything a preparer can, plus approve adjustments up to the threshold, reviewer sign-off, blocking review notes", partner: "everything, plus approve any adjustment, partner sign-off, release for client approval, view logs", firm_administrator: "standards, assignments, time, view logs (no tax judgments)", quality_reviewer: "after filing only: notes and review of the frozen return", client: "answer questions, approve and e-sign, see the client copy" };
    const open = S.threadOrder.map((id) => S.threads[id]).filter((t) => t.status !== "resolved");
    return `<div class="tablewrap"><table><thead><tr><th>Person</th><th>Role</th><th>Credential</th><th>Sensitive data</th><th>Active from</th><th>Open items</th><th>Online</th></tr></thead><tbody>
      ${WP.users.map((u) => `<tr><td><b>${esc(u.name)}</b>${u.note ? `<div class="tiny muted">${esc(u.note)}</div>` : ""}</td><td>${esc(WP.roleLabel(u.role))}</td><td>${esc(u.credential || "—")}</td><td>${u.clearance ? ui.chip("cleared (views logged)", "ok") : ui.chip("masked", "warn")}</td><td class="mono small">${esc(u.active_from || "—")}</td><td>${open.filter((t) => t.assignee === u.id).length || ""}</td><td>${Object.values(WP.presence || {}).some((p) => p.user === u.id) ? '<span class="pres"></span>' : ""}</td></tr>`).join("")}</tbody></table></div>
      <h3 class="mt16 mb8">What each role may do (enforced)</h3><div class="grid g2">${Object.entries(capLabels).map(([k, v]) => `<div class="card small"><b>${esc(WP.roleLabel(k))}</b><div class="muted">${esc(v)}</div></div>`).join("")}</div>
      <h3 class="mt16 mb8">Assignments and deadlines</h3><div class="tablewrap"><table><thead><tr><th>Item</th><th>Assigned to</th><th>Due</th><th>Status</th></tr></thead><tbody>
      ${open.filter((t) => t.assignee).map((t) => `<tr><td><a href="#/people/threads/${t.id}">${esc(t.title)}</a></td><td>${esc(ui.userName(t.assignee))}</td><td class="mono small">${esc(t.due || "—")}${t.due && t.due < today ? ' <span class="chip err">overdue</span>' : ""}</td><td>${ui.chip(t.status)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No assignments yet. Create a thread and assign it; findings can be assigned from the Findings page.</td></tr>`}
      ${WP.M.P.firm.deadlines.map((d) => `<tr class="sub"><td>${esc(d.what)}</td><td>—</td><td class="mono small">${d.date}</td><td>${d.date < today ? ui.chip("passed") : ui.chip("scheduled", "acc")}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function inbox() {
    const items = ui.inbox();
    return `<div class="card">${items.map((i) => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><a href="${i.link}" class="grow">${esc(i.text)}</a>${i.due ? `<span class="muted small">due ${esc(i.due)}</span>` : ""}</div>`).join("") || ui.empty("Nothing waiting on you.")}</div>`;
  }
})();
