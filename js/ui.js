/* UI shell: router, drawer, dialogs, shared components, global actions. */
window.WP = window.WP || {};
(function () {
  const U = WP.U, esc = U.esc;
  const ui = (WP.ui = { views: {}, acts: {}, route: { name: "overview", args: [], q: {} }, drawerFn: null, revealedDocs: new Set(), revealedVals: new Set(), tokens: {} });

  /* icons: small stroke set, drawn to match the rail */
  const IC = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>', sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.5a3 3 0 0 1 0 5.8M18 14.3c2 .8 3.5 2.7 3.5 5.7"/>', check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    building: '<path d="M4 21V5l8-2v18M12 9h8v12M4 21h16M8 8h1M8 12h1M8 16h1M15 13h2M15 17h2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', play: '<path d="M8 5l11 7-11 7z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>', bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>', pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
    book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  };
  ui.icon = (n, sz = 18) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;

  /* One navigation per role: each person sees the workspace built for their job. */
  const pendingApprovals = () => WP.adjList().filter((a) => a.status === "proposed" && a.author !== WP.store.userId && WP.can("approve", { adj: a }).ok).length;
  const signoffsDue = () => {
    const lv = WP.me().role === "partner" ? "partner" : "reviewer";
    return WP.SIGN_AREAS.filter((a) => WP.can("signoff", { area: a.key, level: lv }).ok && WP.signoffStatus(WP.currentSignoff(a.key, lv)).state !== "valid" && !WP.findings.some((f) => f.area === a.key && f.sev === "error" && WP.findingState(f.id).status === "open")).length;
  };
  const openF = () => WP.findingsBlocking().length;
  ui.NAVS = {
    preparer: [["Work", [["overview", "Home", "home"], ["findings", "Findings", "flag", openF], ["return", "Return", "layers"], ["changes", "Changes", "sliders", () => WP.adjList().filter((a) => a.status === "proposed" && a.author === WP.store.userId).length], ["documents", "Documents", "file"]]], ["Together", [["people", "People", "users", () => ui.inbox().length], ["records", "Records", "grid"], ["filing", "Filing", "check"]]]],
    reviewer: [["Review", [["overview", "Review desk", "home"], ["changes", "Approvals", "sliders", pendingApprovals, "ledger"], ["people", "Sign-offs", "pen", signoffsDue, "signoffs"], ["findings", "Findings", "flag", openF]]], ["Look closer", [["return", "Return", "layers"], ["records", "Records", "grid"], ["documents", "Documents", "file"], ["filing", "Filing", "check"]]]],
    partner: [["Decide", [["overview", "Partner desk", "home"], ["filing", "Release & filing", "check"], ["people", "Sign-offs", "pen", signoffsDue, "signoffs"], ["changes", "Approvals", "sliders", pendingApprovals, "ledger"]]], ["Oversee", [["findings", "Findings", "flag", openF], ["records", "Records", "grid"], ["firm", "Firm", "building"], ["activity", "Audit log", "clock"]]]],
    firm_administrator: [["Run the firm", [["overview", "Firm desk", "home"], ["firm", "Standards & time", "building", null, "standards"], ["people", "Team & roles", "users", null, "team"], ["activity", "Audit log", "clock"]]], ["Reference", [["documents", "Documents", "file"], ["records", "Records", "grid"]]]],
    quality_reviewer: [["Quality", [["overview", "QA desk", "home"], ["filing", "Frozen return", "check"], ["findings", "Findings", "flag"], ["notice", "Notice response", "shield"]]], ["Evidence", [["records", "Records", "grid"], ["activity", "Audit log", "clock"], ["documents", "Documents", "file"]]]],
    client: [["Your return", [["overview", "Home", "home"], ["people", "My questions", "chat", () => ui.inbox().length], ["documents", "My documents", "file"], ["filing", "Approve & sign", "pen"], ["clientcopy", "My copy", "book"]]]],
  };
  ui.navFor = () => (ui.NAVS[WP.me().role] || ui.NAVS.preparer).flatMap(([, items]) => items);
  ui.allowedRoutes = () => (WP.me().role === "client" ? ["overview", "people", "documents", "doc", "filing", "clientcopy"] : ["overview", "findings", "return", "documents", "doc", "changes", "people", "filing", "records", "firm", "activity", "replay", "notice", "rollforward", "clientcopy"]);

  /* ---------- tiny components ---------- */
  ui.chip = (t, cls = "") => `<span class="chip ${cls}">${esc(t)}</span>`;
  ui.sev = (s) => ({ error: ui.chip("error", "err"), warning: ui.chip("warning", "warn"), info: ui.chip("info", "info"), ok: ui.chip("verified", "ok") }[s] || ui.chip(s));
  ui.userName = (id) => (WP.userById[id] ? WP.userById[id].name : id || "—");
  ui.userChip = (id) => { const u = WP.userById[id]; return u ? `<span class="pill-user"><b>${esc(u.name)}</b> <span class="muted">${esc(WP.roleLabel(u.role))}</span></span>` : esc(id || "—"); };
  ui.fmtVal = (v) => {
    if (v === undefined || v === null) return "—";
    if (typeof v === "number") return Number.isInteger(v) ? U.money(v) : Math.abs(v) < 10 ? v.toFixed(4) : U.money(v, { dec: 2 });
    return String(v);
  };
  ui.num = (key, o = {}) => {
    const live = WP.live().ev, l = WP.M.line(key);
    if (!l) return "—";
    const v = live.get(key), orig = l.value;
    const changed = live.changed(key), stale = live.stale(key);
    const body = changed ? `<span class="orig">${esc(ui.fmtVal(orig))}</span>${esc(ui.fmtVal(v))}` : esc(ui.fmtVal(v));
    const tip = changed ? "Adjusted from the original engine value" : stale ? "Upstream changed; the engine would recompute this line" : "Trace this number";
    return `<a class="num ${changed ? "adjd" : ""} ${stale ? "stale" : ""}" data-act="trace" data-key="${esc(key)}" title="${tip}">${body}${stale ? " ~" : ""}</a>`;
  };
  ui.short = (ref) => {
    let m;
    if ((m = /^(D\d+)p(\d+)$/.exec(ref))) return `${m[1]} p${m[2]}`;
    if (/^ev-\d+$/.test(ref)) { const e = WP.M.evById[ref]; return e ? `${e.document_id} p${e.page} · ${e.field}` : ref; }
    if (/^py:/.test(ref)) return "prior yr · " + ref.slice(ref.lastIndexOf("/") + 1);
    if (/^agency:/.test(ref)) return "agency · " + ref.slice(8);
    if (/^ref:/.test(ref)) return ref.slice(4);
    return ref;
  };
  ui.refChip = (ref) => `<button class="ref" data-act="src" data-ref="${esc(ref)}" title="Open source">${esc(ui.short(ref))}</button>`;
  ui.refs = (arr) => `<div class="refs">${(arr || []).map(ui.refChip).join("")}</div>`;
  ui.empty = (t) => `<div class="muted" style="padding:14px 0">${esc(t)}</div>`;
  ui.kpi = (l, v, d, cls = "") => `<div class="kpi"><div class="l">${esc(l)}</div><div class="v">${v}</div>${d ? `<div class="d ${cls}">${d}</div>` : ""}</div>`;
  ui.tabs = (base, tabs, cur) => `<div class="tabs">${tabs.map(([id, lbl]) => `<a href="#/${base}/${id}" class="${id === cur ? "on" : ""}">${esc(lbl)}</a>`).join("")}</div>`;

  /* ---------- sensitive data ---------- */
  ui.maskText = (s, docId) => {
    if (ui.revealedDocs.has(docId) && WP.canSeeSensitive()) return s;
    return String(s)
      .replace(/\b666-(\d\d)-(\d{4})\b/g, "•••-••-$2")
      .replace(/\b([A-Z]{2}\d{2}(?: ?\d{4}){4,6})\b/g, (m) => "••••" + m.slice(-4))
      .replace(/(account|routing|PIN)( number)?\s*[:#]?\s*(\d{6,12})/gi, (m, a, b, d) => `${a}${b || ""} ••••${d.slice(-3)}`);
  };
  ui.sens = (value, kind = "ssn") => {
    if (value === null || value === undefined || value === "") return "—";
    const t = U.uid("t");
    ui.tokens[t] = { value, kind };
    const open = ui.revealedVals.has(String(value)) && WP.canSeeSensitive();
    const masked = kind === "ssn" ? U.maskSsn(value) : U.maskAcct(value);
    if (open) return `<span class="sens mono">${esc(value)}</span>`;
    return `<span class="sens mono" data-act="reveal-val" data-t="${t}" title="${WP.canSeeSensitive() ? "Click to reveal (logged)" : "Masked: no sensitive-data clearance"}">${esc(masked)}${WP.canSeeSensitive() ? "" : " 🔒"}</span>`;
  };
  ui.acts["reveal-val"] = (el) => {
    const t = ui.tokens[el.dataset.t];
    if (!t) return;
    if (!WP.canSeeSensitive()) return ui.toast("Masked: your role has no sensitive-data clearance (background check pending).", "err");
    WP.store.append("view.log", { what: `Unmasked ${t.kind.toUpperCase()} ending ${String(t.value).slice(-4)}`, kind: "reveal", target: "value" });
    ui.revealedVals.add(String(t.value));
    ui.render();
  };
  ui.acts["reveal-doc"] = (el) => {
    const id = el.dataset.id;
    if (!WP.canSeeSensitive()) return ui.toast("Masked: no sensitive-data clearance.", "err");
    WP.store.append("view.log", { what: `Unmasked sensitive values in ${id}`, kind: "reveal", target: id });
    ui.revealedDocs.add(id);
    ui.render();
  };

  /* ---------- simulated source document page ---------- */
  ui.confCls = (c) => (c >= 0.9 ? "" : c >= 0.7 ? "mid" : "lo");
  ui.paper = (docId, pageNo, focusEv) => {
    const M = WP.M, d = M.docById[docId];
    const { segs, unlocated } = M.pageSegments(docId, pageNo);
    const shown = ui.revealedDocs.has(docId) && WP.canSeeSensitive();
    const body = segs
      .map((s) => {
        const t = shown ? esc(s.text) : esc(ui.maskText(s.text, docId));
        if (!s.ev) return t;
        const e = s.ev;
        const mask = !shown && (e.value_type === "ssn" || e.value_type === "account_number");
        return `<mark class="hl ${ui.confCls(e.confidence)} ${focusEv === e.id ? "focus" : ""}" id="hl-${e.id}" data-act="src" data-ref="${e.id}" title="${esc(e.field)} · ${esc(e.label)} · confidence ${e.confidence}">${mask ? esc(ui.maskText(s.text, docId)) : t}</mark>`;
      })
      .join("");
    return `<div class="paper"><div class="pgno">page ${pageNo} of ${d.page_count}</div><div class="head">${esc(d.issuer || "")} · ${esc(d.title)}</div>${body}</div>` +
      (unlocated.length ? `<div class="tiny muted mt8">${unlocated.length} extracted value(s) on this page are not located in the text (checkbox or reformatted): ${unlocated.map((e) => `<button class="ref" data-act="src" data-ref="${e.id}">${esc(e.field)}</button>`).join(" ")}</div>` : "");
  };

  /* ---------- drawer ---------- */
  ui.drawer = (title, fn, o = {}) => {
    ui.drawerFn = { title, fn, scroll: !!o.scroll };
    ui.refreshDrawer(true);
  };
  ui.refreshDrawer = (open) => {
    const d = document.getElementById("drawer");
    if (!ui.drawerFn) return;
    const keepTop = d.scrollTop;
    const res = ui.drawerFn.fn();
    d.innerHTML = `<div class="dhead"><h3 class="grow">${esc(typeof ui.drawerFn.title === "function" ? ui.drawerFn.title() : ui.drawerFn.title)}</h3><button class="btn sm" data-act="close-drawer" aria-label="Close">Close ✕</button></div><div class="dbody">${res}</div>`;
    d.classList.add("open");
    document.getElementById("scrim").classList.add("on");
    if (!open) d.scrollTop = keepTop;
    const f = d.querySelector("mark.focus");
    if (f && open && ui.drawerFn.scroll) f.scrollIntoView({ block: "center" });
  };
  ui.closeDrawer = () => {
    ui.drawerFn = null;
    document.getElementById("drawer").classList.remove("open");
    document.getElementById("scrim").classList.remove("on");
  };
  ui.acts["close-drawer"] = ui.closeDrawer;

  /* ---------- toasts, dialogs ---------- */
  ui.toast = (msg, kind = "") => {
    const box = document.getElementById("toasts");
    const t = document.createElement("div");
    t.className = "toast " + kind;
    t.textContent = msg;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.remove(), kind === "err" ? 6000 : 3200);
  };
  ui.guard = (cap, ctx) => {
    const r = WP.can(cap, ctx);
    if (!r.ok) ui.toast(r.why, "err");
    return r.ok;
  };
  ui.form = ({ title, intro, fields, submit = "Save", danger }) =>
    new Promise((resolve) => {
      const dlg = document.createElement("dialog");
      const fh = fields
        .map((f) => {
          const id = "f_" + f.name, req = f.required ? "required" : "";
          const hint = f.hint ? `<span class="tiny muted" style="font-weight:400">${esc(f.hint)}</span>` : "";
          if (f.type === "textarea") return `<label>${esc(f.label)}<textarea id="${id}" name="${f.name}" ${req} placeholder="${esc(f.placeholder || "")}">${esc(f.value ?? "")}</textarea>${hint}</label>`;
          if (f.type === "select") return `<label>${esc(f.label)}<select id="${id}" name="${f.name}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(f.value) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>${hint}</label>`;
          if (f.type === "checkbox") return `<label class="chk"><input type="checkbox" id="${id}" name="${f.name}" ${f.value ? "checked" : ""}> ${esc(f.label)}</label>`;
          if (f.type === "file") return `<label>${esc(f.label)}<input type="file" id="${id}" name="${f.name}">${hint}</label>`;
          return `<label>${esc(f.label)}<input id="${id}" name="${f.name}" type="${f.type || "text"}" value="${esc(f.value ?? "")}" ${req} ${f.step ? `step="${f.step}"` : ""} placeholder="${esc(f.placeholder || "")}">${hint}</label>`;
        })
        .join("");
      dlg.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${intro ? `<div class="small muted">${intro}</div>` : ""}${fh}<div class="row" style="justify-content:flex-end"><button class="btn" value="cancel" formnovalidate>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" value="ok">${esc(submit)}</button></div></form>`;
      document.body.appendChild(dlg);
      dlg.addEventListener("close", async () => {
        if (dlg.returnValue !== "ok") { dlg.remove(); return resolve(null); }
        const out = {};
        for (const f of fields) {
          const el = dlg.querySelector("#f_" + f.name);
          if (f.type === "checkbox") out[f.name] = el.checked;
          else if (f.type === "number") out[f.name] = el.value === "" ? null : Number(el.value);
          else if (f.type === "file") {
            const file = el.files[0];
            out[f.name] = file ? await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r({ name: file.name, size: file.size, dataUrl: file.size < 400000 ? fr.result : null }); fr.readAsDataURL(file); }) : null;
          } else out[f.name] = el.value;
        }
        dlg.remove();
        resolve(out);
      });
      dlg.addEventListener("cancel", () => { dlg.returnValue = "cancel"; });
      dlg.showModal();
      const first = dlg.querySelector("input,textarea,select");
      if (first) first.focus();
    });
  ui.confirm = (title, text, submit = "Confirm") => ui.form({ title, intro: text, fields: [], submit }).then((r) => !!r);

  /* ---------- undo / redo (batches) ---------- */
  ui.batch = () => U.uid("b");
  ui.lastUndoable = () => {
    const S = WP.store.state, me = WP.store.userId;
    const evs = WP.store.events.filter((e) => e.actor.id === me && e.batch && e.type !== "undo" && e.type !== "redo");
    for (let i = evs.length - 1; i >= 0; i--) if (!S.undone.has(evs[i].batch)) return evs[i].batch;
    return null;
  };
  ui.lastRedoable = () => {
    const S = WP.store.state, me = WP.store.userId;
    const evs = WP.store.events.filter((e) => e.actor.id === me && e.type === "undo");
    for (let i = evs.length - 1; i >= 0; i--) if (S.undone.has(evs[i].payload.batch)) return evs[i].payload.batch;
    return null;
  };
  ui.acts.undo = () => {
    const b = ui.lastUndoable();
    if (!b) return ui.toast("Nothing of yours to undo.");
    const n = WP.store.events.filter((e) => e.batch === b).length;
    WP.store.append("undo", { batch: b, count: n });
    ui.toast(`Undid ${n} change(s). The log keeps both the change and the undo.`);
  };
  ui.acts.redo = () => {
    const b = ui.lastRedoable();
    if (!b) return ui.toast("Nothing to redo.");
    WP.store.append("redo", { batch: b });
    ui.toast("Redone.");
  };

  /* ---------- inbox ---------- */
  ui.inbox = () => {
    const S = WP.store.state, me = WP.me(), out = [];
    S.threadOrder.forEach((id) => {
      const t = S.threads[id];
      if (t.status === "resolved" || t.status === "closed") return;
      if (me.role === "client" && t.visibility !== "client") return;
      if (t.assignee === me.id) out.push({ text: `${t.kind === "review_note" ? "Review note" : "Question"} assigned to you: ${t.title}`, link: `#/people/threads/${id}`, due: t.due });
      else if (me.role === "client" && t.visibility === "client" && !t.messages.some((m) => m.role === "client")) out.push({ text: `Question for you: ${t.title}`, link: `#/people/threads/${id}`, due: t.due });
    });
    if (me.role !== "client") {
      WP.adjList().filter((a) => a.status === "proposed" && a.author !== me.id && WP.can("approve", { adj: a }).ok).forEach((a) => out.push({ text: `Adjustment awaiting your approval: ${a.target} (${a.reason || a.note || ""})`.slice(0, 120), link: "#/changes/ledger" }));
      S.signoffOrder.map((id) => S.signoffs[id]).filter((s) => s.by === me.id && WP.signoffStatus(s).state === "reopened").forEach((s) => out.push({ text: `Your ${s.level} sign-off on ${WP.areaLabel(s.area)} reopened (${WP.signoffStatus(s).changed.length} lines changed)`, link: "#/people/signoffs" }));
      WP.adjList().filter((a) => a.author === me.id && (a.status === "approved" || a.status === "rejected") && a.at > (S.seen[me.id] || 0)).forEach((a) => out.push({ text: `Your adjustment to ${a.target} was ${a.status}`, link: "#/changes/ledger" }));
    }
    return out;
  };

  /* ---------- router and render ---------- */
  ui.parse = () => {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const q = Object.fromEntries(new URLSearchParams(qs || ""));
    ui.route = { name: parts[0] || "overview", args: parts.slice(1), q };
  };
  ui.go = (hash) => { location.hash = hash; };

  const initials = (n) => n.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  ui.quick = () => {
    const me = WP.me(), r = me.role;
    if (r === "preparer") return `<button class="btn primary hide-m" data-act="adj-new">${ui.icon("plus", 15)} Adjustment</button>`;
    if (r === "reviewer") return `<button class="btn primary hide-m" data-act="nav" data-to="#/changes/ledger">Approvals${pendingApprovals() ? " · " + pendingApprovals() : ""}</button>`;
    if (r === "partner") return `<button class="btn primary hide-m" data-act="nav" data-to="#/filing">Release &amp; filing</button>`;
    if (r === "firm_administrator") return `<button class="btn primary hide-m" data-act="time-add">Log time</button>`;
    if (r === "quality_reviewer") return `<button class="btn primary hide-m" data-act="nav" data-to="#/filing">Frozen return</button>`;
    return `<button class="btn primary hide-m" data-act="nav" data-to="#/filing">Approve &amp; sign</button>`;
  };
  ui.top = () => {
    const me = WP.me(), S = WP.store.state;
    const online = Object.values(WP.presence || {}).filter((p) => p.user);
    const fs = S.filing.status, fsLabel = { preparation: "In preparation", filed: "Filed · frozen" }[fs] || fs;
    const nIn = ui.inbox().length;
    return `<div class="ctx"><b>${esc(WP.M.P.packet.name.replace(" household - tax year", " · "))}</b><span>${esc(WP.M.P.packet.client_id)} · MFJ · ${esc(WP.M.cur)} engine output · ${esc(fsLabel)}</span></div>
      <div class="sp"></div>
      <button class="searchbtn" data-act="cmdk" aria-label="Search and commands">${ui.icon("search", 16)}<span class="lbl">Search, jump or act</span><span class="kbd">Ctrl K</span></button>
      ${ui.quick()}
      <button class="iconbtn" data-act="bell" aria-label="Notifications" title="Notifications">${ui.icon("bell", 18)}${nIn ? `<span class="dot2">${nIn}</span>` : ""}</button>
      ${me.role !== "client" ? `<button class="iconbtn hide-m" data-act="undo" title="Undo your last change" aria-label="Undo">↶</button><button class="iconbtn hide-m" data-act="redo" title="Redo" aria-label="Redo">↷</button>` : ""}
      <button class="iconbtn hide-m" data-act="guide" title="Guide for your role" aria-label="Guide">${ui.icon("help", 18)}</button>
      <button class="iconbtn hide-m" data-act="theme" title="Light or dark" aria-label="Toggle theme">${ui.icon("moon", 17)}</button>
      <div class="userpill" title="Switch role"><span class="avatar">${esc(initials(me.name))}</span>
        <select data-change="user" aria-label="Switch role">${WP.users.map((u) => `<option value="${u.id}" ${u.id === me.id ? "selected" : ""}>${esc(u.name)} · ${esc(WP.roleLabel(u.role))}</option>`).join("")}</select><span class="rolebadge">${esc(WP.roleLabel(me.role).replace(" (CPA)", ""))}</span></div>`;
  };
  ui.navHtml = () => {
    const me = WP.me();
    const chain = WP.store.verifyChain(), online = Object.values(WP.presence || {}).filter((p) => p.user).length;
    const groups = (ui.NAVS[me.role] || ui.NAVS.preparer).map(([g, items]) =>
      `<div class="rail-label">${esc(g)}</div>` + items.map(([route, label, icon, badge, tab]) => {
        const b = badge ? badge() : 0;
        const on = ui.route.name === route && (!tab || (ui.route.args[0] || "") === tab || (tab === "ledger" && !ui.route.args[0]) || (tab === "standards" && !ui.route.args[0]));
        const href = tab ? `#/${route}/${tab}` : `#/${route}`;
        return `<a href="${href}" class="${on ? "on" : ""}"><span class="ic">${ui.icon(icon, 18)}</span><span class="lbl">${esc(label)}</span>${b ? `<span class="badge">${b}</span>` : ""}</a>`;
      }).join("")).join("");
    return `<div class="rail-brand"><div class="logo">M</div><div><b>Workpaper</b><span>Miraflores · tax year 2025</span></div></div>${groups}
      ${me.role === "client" ? "" : `<div class="sep"></div><a href="#/replay" class="${ui.route.name === "replay" ? "on" : ""}"><span class="ic">${ui.icon("play", 18)}</span><span class="lbl">Season replay</span></a>`}
      <div class="rail-foot">${chain.ok ? "⛓ log intact" : "⚠ log broken"} · ${WP.store.events.length} events${online > 1 ? ` · <span class="pres"></span> ${online} open` : ""}<br>Hash-chained: every change is recorded and can be replayed.</div>`;
  };

  let lastKey = "";
  ui.render = () => {
    ui.parse();
    ui.tokens = {};
    const main = document.getElementById("main");
    const rk = location.hash;
    const top = rk === lastKey ? main.scrollTop : 0;
    document.documentElement.dataset.role = WP.me().role;
    if (!ui.allowedRoutes().includes(ui.route.name)) { ui.route = { name: "overview", args: [], q: {} }; }
    const view = ui.views[ui.route.name] || ui.views.overview;
    let html = "";
    try { html = view(ui.route); } catch (e) { console.error(e); html = `<div class="callout err">View error: ${esc(e.message)}</div>`; }
    const act = document.activeElement, actId = act && act.id;
    const sel = act && act.selectionStart;
    document.getElementById("top").innerHTML = ui.top();
    document.getElementById("nav").innerHTML = ui.navHtml();
    main.innerHTML = `<div class="page">${html}</div>`;
    main.scrollTop = top;
    const fm = main.querySelector("mark.focus");
    if (fm && rk !== lastKey) fm.scrollIntoView({ block: "center" });
    lastKey = rk;
    if (actId === "gsearch") { const g = document.getElementById("gsearch"); g.focus(); }
    if (ui.post) { const p = ui.post; ui.post = null; p(main); }
    if (ui.drawerFn) ui.refreshDrawer(false);
  };
  ui.rerender = U.debounce(() => ui.render(), 30);

  ui.acts.nav = (el) => ui.go(el.dataset.to);
  ui.acts.theme = () => {
    const r = document.documentElement;
    const next = r.dataset.theme === "dark" ? "light" : "dark";
    r.dataset.theme = next;
    try { localStorage.setItem("wp.theme", next); } catch (e) {}
  };
  ui.acts.reset = async () => {
    if (!(await ui.confirm("Reset the workpaper?", "This erases every adjustment, note, sign-off and log entry and reloads the packet as delivered.", "Reset"))) return;
    WP.store.reset();
    ui.revealedDocs.clear(); ui.revealedVals.clear();
    ui.toast("Workpaper reset to the packet as delivered.");
  };

  /* delegated events */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = ui.acts[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-change]");
    if (!el) return;
    if (el.dataset.change === "user") { WP.store.setUser(el.value); ui.toast(`Now acting as ${ui.userName(el.value)}`); return; }
    const fn = ui.acts[el.dataset.change];
    if (fn) fn(el, e);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "gsearch" && e.target.value.trim()) ui.go("#/firm/search?q=" + encodeURIComponent(e.target.value.trim()));
    if (e.key === "Escape" && ui.drawerFn) ui.closeDrawer();
  });
  window.addEventListener("hashchange", () => { ui.closeDrawer(); ui.render(); });
})();
