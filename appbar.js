// Shared header for every signed-in page, so the brand, links and your-name menu sit in the same place everywhere.
//   <div id="appbar"></div>  ...  AppBar.mount("appbar", {active:"items", client: supabaseClient})
// Also provides the matching "page heading" styles (.pagehead: title on the left, actions on the right).
(function(w){
  const CSS = `
  .appbar{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin:0 0 22px; font-family:inherit; }
  .appbar *{ box-sizing:border-box; }
  .appbar .ab-brand{ font-weight:800; font-size:20px; letter-spacing:-.3px; color:var(--ink,#1f2933); text-decoration:none; }
  .appbar .ab-brand span{ font-weight:400; color:var(--muted,#6b7280); }
  .appbar .ab-nav{ display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
  .appbar .ab-nav a, .appbar .ab-nav button.ab-ico{ font:inherit; font-size:13px; font-weight:600; color:var(--muted,#6b7280); text-decoration:none; padding:8px 12px; border-radius:8px; border:0; background:none; cursor:pointer; }
  .appbar .ab-nav a:hover, .appbar .ab-nav button.ab-ico:hover{ background:var(--hover,#e6eaf1); color:var(--ink,#1f2933); }
  .appbar .ab-nav a.on{ color:#2050bd; background:#e3ecfd; }
  .appbar .ab-user{ position:relative; }
  .appbar .ab-userbtn{ display:flex; align-items:center; gap:8px; padding:6px 10px 6px 6px; border:1px solid var(--line,#d7dbe0); background:var(--surface,#fff); border-radius:999px; font:inherit; font-size:13px; font-weight:600; color:var(--ink,#1f2933); cursor:pointer; }
  .appbar .ab-userbtn:hover{ background:var(--hover,#f4f6fa); }
  .appbar .ab-avatar{ width:26px; height:26px; border-radius:50%; background:#2f6fed; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; }
  .appbar .ab-role{ font-size:10.5px; font-weight:800; color:#fff; background:#ea580c; border-radius:999px; padding:1px 7px; }
  .appbar .ab-menu{ position:absolute; right:0; top:calc(100% + 6px); min-width:200px; background:var(--surface,#fff); border:1px solid var(--line,#d7dbe0); border-radius:12px; box-shadow:0 12px 30px rgba(15,23,42,.14); padding:6px; display:none; z-index:100; }
  .appbar .ab-menu.open{ display:block; }
  .appbar .ab-menu button, .appbar .ab-menu a{ display:block; width:100%; text-align:left; border:0; background:none; padding:9px 12px; border-radius:8px; font:inherit; font-size:13px; font-weight:600; color:var(--ink,#1f2933); text-decoration:none; cursor:pointer; }
  .appbar .ab-menu button:hover, .appbar .ab-menu a:hover{ background:var(--hover,#f4f6fa); }
  .appbar .ab-menu hr{ border:0; border-top:1px solid var(--line,#d7dbe0); margin:6px 4px; }
  .appbar .ab-menu .ab-out{ color:#dc2626; }
  .appbar .ab-menu .ab-ver{ display:block; width:100%; border-width:1px 0 0; border-radius:0; text-align:center; font-size:11px; color:var(--muted,#6b7280); padding:7px 12px 3px; border-top:1px solid var(--line,#d7dbe0); margin-top:4px; background:none; }
  .appbar .ab-menu .ab-ver:hover{ color:var(--ink,#1f2933); background:none; }
  /* page heading: title left, actions right — same on every page */
  .pagehead{ display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; margin:0 0 16px; }
  .pagehead h1{ margin:0; font-size:24px; letter-spacing:-.4px; color:inherit; }
  .pagehead .sub{ color:var(--muted,#6b7280); font-size:13px; margin-top:3px; }
  .pagehead .btns{ display:flex; gap:8px; flex-wrap:wrap; }
  .pagehead .btns button, .pagehead .btns a.btn{ padding:10px 16px; }
  /* "what's new" notice */
  .wn-back{ position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; padding:18px; z-index:1000; font-family:inherit; }
  .wn-box{ background:var(--surface,#fff); color:var(--ink,#1f2933); border-radius:16px; max-width:520px; width:100%; max-height:92vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.3); }
  .wn-head{ flex:none; padding:22px 26px 12px; border-bottom:1px solid var(--line,#d7dbe0); background:var(--surface,#fff); }
  .wn-ver{ font-size:11px; font-weight:700; color:var(--muted,#6b7280); border:1px solid var(--line,#d7dbe0); border-radius:999px; padding:2px 8px; vertical-align:middle; margin-left:6px; }
  .wn-body{ overflow:auto; padding:6px 26px 6px; }
  .wn-box h2{ margin:0 0 4px; font-size:20px; letter-spacing:-.3px; }
  .wn-box .wn-sub{ color:var(--muted,#6b7280); font-size:13px; }
  .wn-box ul{ list-style:none; margin:0 0 16px; padding:0; }
  .wn-box li{ display:flex; gap:12px; padding:9px 0; border-top:1px solid var(--line,#d7dbe0); font-size:13.5px; line-height:1.45; }
  .wn-box li:first-child{ border-top:0; }
  .wn-box li b{ display:block; font-size:13.5px; }
  .wn-box li span.t{ color:var(--muted,#6b7280); font-size:12.5px; }
  .wn-dot{ flex:none; width:8px; height:8px; border-radius:50%; background:#2f6fed; margin-top:6px; }
  .wn-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:14px 26px 18px; border-top:1px solid var(--line,#d7dbe0); }
  .wn-foot label{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink,#1f2933); cursor:pointer; }
  .wn-foot button{ font:inherit; font-size:13px; font-weight:700; padding:10px 22px; border-radius:8px; border:1px solid #2f6fed; background:#2f6fed; color:#fff; cursor:pointer; }
  .wn-foot button:hover{ background:#2050bd; }
  /* phones: brand + avatar on one line, menu links in one swipeable row */
  @media (max-width:720px){
    .appbar{ position:relative; display:block; margin:0 0 14px; }
    .appbar .ab-brand{ display:block; font-size:17px; line-height:38px; padding-right:64px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .appbar .ab-nav{ flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; margin:6px -4px 0; padding:0 0 2px; gap:2px; }
    .appbar .ab-nav::-webkit-scrollbar{ display:none; }
    .appbar .ab-nav a, .appbar .ab-nav button.ab-ico{ flex:none; white-space:nowrap; padding:8px 11px; }
    .appbar .ab-user{ position:absolute; top:0; right:0; }
    .appbar .ab-userbtn{ padding:5px 8px 5px 5px; gap:5px; }
    .appbar .ab-userbtn > span:nth-child(2), .appbar .ab-role{ display:none; }
    .appbar .ab-menu{ min-width:220px; }
    .pagehead{ align-items:flex-start; gap:10px; margin-bottom:12px; }
    .pagehead h1{ font-size:21px; }
    .pagehead .btns{ width:100%; }
    .pagehead .btns button, .pagehead .btns a.btn{ padding:9px 13px; }
    .wn-head, .wn-body, .wn-foot{ padding-left:18px; padding-right:18px; }
  }
  @media print{ .appbar, .pagehead .btns, .wn-back{ display:none !important; } }
  `;
  const NAV = [
    {id:"dashboard", label:"Dashboard",        href:"dashboard.html"},
    {id:"items",     label:"Purchase History", href:"items.html",     perm:"view_purchase_history"},
    {id:"analytics", label:"Analytics",        href:"analytics.html", perm:"view_analytics", full:true},
    {id:"projects",  label:"Projects",         href:"projects.html", full:true},
    {id:"admin",     label:"Admin Settings",   href:"admin.html", admin:true, full:true}
  ];
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  let state = {opts:{}, isAdmin:false, root:null, access:null};

  /* what this person's roles allow (get_my_access); cached for the tab so the menu does not flicker */
  function cachedAccess(){ try{ return JSON.parse(sessionStorage.getItem("sl_access") || "null"); }catch(_){ return null; } }
  const can = perm => { const a = state.access || cachedAccess(); return !a || a.is_admin || (a.permissions||[]).includes(perm); };   // unknown = allowed (the server still decides)
  let accessP = null;
  function loadAccess(){
    const c = state.opts.client, id = sessionStorage.getItem("sl_person_id"), pin = sessionStorage.getItem("sl_pin");
    if(!c || !id || !pin) return Promise.resolve(cachedAccess());
    if(accessP) return accessP;
    accessP = c.rpc("get_my_access", {p_person_id:id, p_pin:pin}).then(r=>{
      const d = r && r.data;
      if(d && d.success){ try{ sessionStorage.setItem("sl_access", JSON.stringify(d)); }catch(_){} const changed = JSON.stringify(state.access) !== JSON.stringify(d); state.access = d; if(changed && state.root) render(); return d; }
      return cachedAccess();
    }).catch(()=>cachedAccess());
    return accessP;
  }
  // pages call this to show a clear message when the person's roles do not include the page
  function guard(perm){
    return loadAccess().then(a=>{
      if(!a || a.is_admin || (a.permissions||[]).includes(perm)) return true;
      if(document.getElementById("abDenied")) return false;
      const d = document.createElement("div"); d.id = "abDenied";
      d.style.cssText = "position:fixed;inset:78px 0 0 0;background:var(--bg,#eef1f6);z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:60px 18px;";
      d.innerHTML = '<div style="background:#fff;border:1px solid #d7dbe0;border-radius:16px;padding:30px 28px;max-width:440px;text-align:center;font-family:inherit"><div style="font-size:34px">🔒</div><h2 style="margin:8px 0 6px">You do not have access to this page</h2><p style="color:#6b7280;font-size:14px;line-height:1.5;margin:0 0 16px">Your role does not include it. If you need it, ask an admin to change your role in Admin Settings.</p><a href="dashboard.html" style="display:inline-block;background:#2f6fed;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:9px">Back to the Dashboard</a></div>';
      document.body.appendChild(d); return false;
    });
  }

  /* "Get the phone app": QR code + the steps to add it to a phone's Home Screen (it installs from the browser, no app store) */
  function showApp(){
    if(document.getElementById("abApp")) return;
    const url = new URL("dashboard.html", location.href).href;
    const back = document.createElement("div"); back.id = "abApp"; back.className = "wn-back";
    back.setAttribute("role","dialog"); back.setAttribute("aria-modal","true"); back.setAttribute("aria-label","Get the phone app");
    back.innerHTML = `<div class="wn-box" style="max-width:560px">
      <div class="wn-head"><h2>Use MR Tracker on your phone</h2><div class="wn-sub">It installs like an app — no app store. Sign, approve and get alerts on the go.</div></div>
      <div class="wn-body" style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;padding-top:14px;padding-bottom:10px">
        <div style="text-align:center"><div id="abQr" class="keep-colors" style="width:170px;height:170px;background:#fff;padding:8px;border:1px solid var(--line,#d7dbe0);border-radius:12px"></div><div style="font-size:11.5px;color:var(--muted,#6b7280);margin-top:6px">Scan with your phone camera</div></div>
        <div style="flex:1;min-width:220px;font-size:13px;line-height:1.55">
          <b>iPhone</b> — open the link in <b>Safari</b> → Share → <b>Add to Home Screen</b>. (Alerts on iPhone only work from the Home Screen app.)<br><br>
          <b>Android</b> — open it in <b>Chrome</b> → ⋮ menu → <b>Install app</b> / Add to Home screen.<br><br>
          Then sign in and turn on alerts in Settings → Notifications.
          <div style="display:flex;gap:6px;margin-top:12px"><input id="abUrl" readonly value="${esc(url)}" style="flex:1;min-width:0;font:inherit;font-size:12px;padding:8px 10px;border:1px solid var(--line,#d7dbe0);border-radius:8px;background:var(--surface,#fff);color:inherit"><button type="button" id="abCopy" style="font:inherit;font-size:12.5px;font-weight:700;padding:8px 12px;border:1px solid var(--line,#d7dbe0);border-radius:8px;background:var(--surface,#fff);color:inherit;cursor:pointer">Copy</button></div>
        </div>
      </div>
      <div class="wn-foot" style="justify-content:flex-end"><button type="button" id="abAppOk">Close</button></div></div>`;
    const close = ()=>{ back.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e=>{ if(e.key==="Escape") close(); };
    back.addEventListener("click", e=>{ if(e.target===back || e.target.id==="abAppOk") close(); });
    back.querySelector("#abCopy").addEventListener("click", ()=>{ const i=back.querySelector("#abUrl"); i.select(); try{ navigator.clipboard.writeText(url); }catch(_){ document.execCommand("copy"); } back.querySelector("#abCopy").textContent="Copied"; });
    document.addEventListener("keydown", onKey); document.body.appendChild(back);
    const draw = ()=>{ try{ const q = qrcode(0,"M"); q.addData(url); q.make(); back.querySelector("#abQr").innerHTML = q.createSvgTag({cellSize:4, margin:0, scalable:true}); const s=back.querySelector("#abQr svg"); if(s){ s.style.width="100%"; s.style.height="100%"; } }catch(_){ back.querySelector("#abQr").textContent = "Open the link below on your phone."; } };
    if(window.qrcode) draw(); else { const sc=document.createElement("script"); sc.src="qrcode.js"; sc.onload=draw; sc.onerror=draw; document.head.appendChild(sc); }
  }

  /* desktop-only pages (Analytics, Projects, Admin) in the simple phone view: offer the full version instead */
  function desktopOnly(){
    if(!(window.UIMode && UIMode.simple()) || document.getElementById("abDesk")) return;
    const d = document.createElement("div"); d.id = "abDesk";
    d.style.cssText = "position:fixed;inset:0;background:var(--bg,#eef1f6);z-index:1300;display:flex;align-items:center;justify-content:center;padding:24px 18px;";
    d.innerHTML = '<div style="background:#fff;border:1px solid #d7dbe0;border-radius:16px;padding:28px 22px;max-width:400px;width:100%;text-align:center;font-family:inherit"><div style="font-size:34px">🖥️</div><h2 style="margin:8px 0 6px;font-size:19px">This page works best on a computer</h2><p style="color:#6b7280;font-size:14px;line-height:1.5;margin:0 0 18px">The phone view keeps only the everyday features. Open this on a computer, or switch this phone to the full version.</p><button type="button" id="abDeskFull" style="display:block;width:100%;font:inherit;font-weight:700;background:#2f6fed;color:#fff;border:0;padding:12px;border-radius:10px;cursor:pointer;margin-bottom:8px">Use full version</button><a href="dashboard.html" style="display:block;color:#1f2933;text-decoration:none;font-weight:700;padding:11px;border:1px solid #d7dbe0;border-radius:10px">Back to the Dashboard</a></div>';
    document.body.appendChild(d); document.body.style.overflow = "hidden";
    d.querySelector("#abDeskFull").addEventListener("click", ()=>{ UIMode.set("full"); location.reload(); });
  }

  function isAdminCached(){ try{ return sessionStorage.getItem("sl_is_admin")==="1"; }catch(_){ return false; } }
  function logout(){
    ["sl_person_id","sl_person_name","sl_pin","sl_is_admin","sl_access"].forEach(k=>{ try{ sessionStorage.removeItem(k); }catch(_){} });
    try{ window.Session && Session.forget(); }catch(_){}
    const here = location.pathname.split("/").pop() || "dashboard.html";
    location.href = "login.html?redirect=" + encodeURIComponent(here);
  }
  function go(page, newTab){ if(newTab) window.open(page, "_blank"); else location.href = page; }

  function render(){
    const phone = !!(window.UIMode && UIMode.isPhone()), simple = !!(window.UIMode && UIMode.simple());
    const o = state.opts, name = (function(){ try{ return sessionStorage.getItem("sl_person_name")||""; }catch(_){ return ""; } })();
    const links = NAV.filter(n=>(!n.admin || state.isAdmin) && (!n.perm || can(n.perm))).map(n=>`<a href="${n.href}" class="${o.active===n.id?"on":""}"${n.full?" data-full":""}>${esc(n.label)}</a>`).join("");
    state.root.innerHTML = `<div class="appbar">
      <a class="ab-brand" href="dashboard.html"${o.newTab?' target="_blank" rel="noopener"':""}>SPACE<span>logic</span> — MR Tracker</a>
      <div class="ab-nav">
        ${links}
        ${o.onRefresh ? `<button class="ab-ico" data-act="refresh" title="Reload" aria-label="Reload">↻</button>` : ""}
        <div class="ab-user">
          <button class="ab-userbtn" data-act="menu" aria-haspopup="true"><span class="ab-avatar">${esc((name||"?").trim().charAt(0).toUpperCase())}</span><span>${esc(name)}</span>${state.isAdmin?'<span class="ab-role">Admin</span>':""} ▾</button>
          <div class="ab-menu" id="abMenu">
            <button data-act="settings">Settings</button>
            ${!phone ? `<button data-act="getapp">Get the phone app</button>` : ""}
            ${phone ? `<button data-act="uimode">${simple ? "Switch to full version" : "Switch to simple phone view"}</button>` : ""}
            <hr>
            <button data-act="tour">Quick tour</button>
            <a href="manual.html" target="_blank" rel="noopener">Manual</a>
            <a href="manual.html#faq" target="_blank" rel="noopener">FAQ</a>
            <hr>
            <button class="ab-out" data-act="logout">Log out</button>
            <button class="ab-ver" data-act="whatsnew" title="See what's new">Version ${esc(VERSION)}</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  // lets the site be installed as an app (needed for phone alerts on iPhone) and names it
  function pwaTags(){
    if(document.querySelector('link[rel="manifest"]')) return;
    [["manifest","manifest.webmanifest"],["apple-touch-icon","icon-192.png"]].forEach(([rel,href])=>{ const l=document.createElement("link"); l.rel=rel; l.href=href; document.head.appendChild(l); });
    const m=document.createElement("meta"); m.name="theme-color"; m.content="#2f6fed"; document.head.appendChild(m);
  }
  function mount(id, opts){
    state.opts = opts || {};
    pwaTags();
    state.root = typeof id==="string" ? document.getElementById(id) : id;
    if(!document.getElementById("appbar-css")){ const st = document.createElement("style"); st.id="appbar-css"; st.textContent = CSS; document.head.appendChild(st); }
    state.isAdmin = isAdminCached();
    state.access = cachedAccess();
    render();
    loadAccess();
    if(state.opts.fullOnly) desktopOnly();
    if(state.opts.notice !== false){ firstRun(); if(isAdminCached()) setTimeout(checkVerifications, 900); }
    if(state.opts.client && state.opts.assistant !== false){
      const boot = ()=>{ try{ window.Assistant && window.Assistant.mount(state.opts.client); }catch(_){} };
      if(window.Assistant) boot();
      else { const sc = document.createElement("script"); sc.src = "assistant.js"; sc.onload = boot; document.head.appendChild(sc); }
    }
    state.root.addEventListener("click", e=>{
      const t = e.target.closest("[data-act]"); if(!t) return;
      const act = t.getAttribute("data-act"), o = state.opts;
      if(act==="menu"){ e.stopPropagation(); document.getElementById("abMenu").classList.toggle("open"); return; }
      document.getElementById("abMenu").classList.remove("open");
      if(act==="logout") logout();
      else if(act==="whatsnew") showNotice(true);
      else if(act==="tour") runTour();
      else if(act==="refresh" && o.onRefresh) o.onRefresh();
      else if(act==="settings") go("settings.html", o.newTab);
      else if(act==="getapp") showApp();
      else if(act==="uimode"){ UIMode.set(UIMode.simple() ? "full" : "simple"); location.reload(); }
    });
    document.addEventListener("click", ()=>{ const m=document.getElementById("abMenu"); if(m) m.classList.remove("open"); });
    // not known yet on this browser tab: ask once, then remember
    if(!isAdminCached() && sessionStorage.getItem("sl_is_admin")===null && state.opts.client){
      const id = sessionStorage.getItem("sl_person_id"), pin = sessionStorage.getItem("sl_pin");
      if(id && pin) state.opts.client.rpc("verify_admin", {p_person_id:id, p_pin:pin}).then(r=>{ if(r && !r.error) setAdmin(r.data===true); });
    }
  }
  /* ---- one-time "What's new" notice (remembered per browser; bump the id to show a new one) ---- */
  const VERSION = "2026.10.17";
  const NOTICE_ID = "upgrade-2026-10i";
  const NOTICE = [
    ["Phone app", "Install MR Tracker on your phone — open your name menu → Get the phone app and scan the code. The phone view keeps the everyday features and has a Full version switch. There is also a light / dark setting in Settings."],
    ["Just one signature", "Only the manager’s verification is signed. Procurement and the person who receives the items now just press a button — “Mark as ordered” and “Mark as received” — on the dashboard or the signing page. No drawing, no PIN to type."],
    ["Who has to sign, by amount", "The form shows who must verify your total and lets you pick them; the Approval rules button shows the full table. Orders of $50,000+ ask for the vendor quotation and PO number (LOA from $150,000), and you are warned if the supply date is under 3 working days away."],
    ["Notifications", "Get messages on Telegram, by email or as a phone alert — and choose what you hear about. Open your name menu → Settings → Notifications."],
    ["Everything in Settings", "Your profile, PIN, saved signature, notifications and reminder limits are all in one place: name menu → Settings."],
    ["Roles & access (admins)", "Admins can give people roles (such as Procurement), choose what each role can see, and decide who is notified about each step — all in Admin Settings."],
    ["Ask MR Tracker", "The blue Ask button now also answers “who must approve $450?”, “where is REQ-00031?” and “any update?”."]
  ];
  function showNotice(force){
    if(!force){ try{ if(localStorage.getItem("sl_notice_seen")===NOTICE_ID) return; }catch(_){} }
    if(document.getElementById("wnBack")) return;
    const back = document.createElement("div"); back.className="wn-back"; back.id="wnBack";
    back.setAttribute("role","dialog"); back.setAttribute("aria-modal","true"); back.setAttribute("aria-label","What's new");
    back.innerHTML = `<div class="wn-box">
      <div class="wn-head"><h2>The system has been upgraded <span class="wn-ver">${esc(VERSION)}</span></h2><div class="wn-sub">Here's what's new for you:</div></div>
      <div class="wn-body">
        <ul>${NOTICE.map(n=>`<li><span class="wn-dot"></span><div><b>${esc(n[0])}</b><span class="t">${esc(n[1])}</span></div></li>`).join("")}</ul>
      </div>
      <div class="wn-foot"><label><input type="checkbox" id="wnDont" checked> Don't show this again</label><button type="button" id="wnOk">Got it</button></div>
    </div>`;
    const close = ()=>{
      try{ if(document.getElementById("wnDont").checked) localStorage.setItem("sl_notice_seen", NOTICE_ID); }catch(_){}
      back.remove(); document.removeEventListener("keydown", onKey);
    };
    const onKey = e=>{ if(e.key==="Escape") close(); };
    back.addEventListener("click", e=>{ if(e.target===back) close(); });
    back.querySelector("#wnOk").addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
    back.querySelector("#wnOk").focus({preventScroll:true});
  }

  /* ---- quick tour: shown once to a brand-new account (flag set at sign-up), or any time from the name menu ---- */
  function runTour(){
    // the tour points at Dashboard controls, so run it there
    if(state.opts.active !== "dashboard"){ location.href = "dashboard.html?tour=1"; return; }
    const go = ()=>{ setTimeout(()=>{ try{ window.Tour && window.Tour.start({onClose: markTourSeen}); }catch(_){} }, 700); };
    if(window.Tour) go(); else { const sc = document.createElement("script"); sc.src = "tour.js"; sc.onload = go; document.head.appendChild(sc); }
  }
  // the tour is remembered on the account, so everyone gets it once the first time they reach the Dashboard (on any device)
  function markTourSeen(){
    try{
      const id = sessionStorage.getItem("sl_person_id"), pin = sessionStorage.getItem("sl_pin");
      if(id && pin && state.opts.client) state.opts.client.rpc("mark_tour_seen", {p_person_id:id, p_pin:pin}).then(()=>{});
    }catch(_){}
  }
  async function firstRun(){
    try{
      if(state.opts.active === "dashboard" && new URLSearchParams(location.search).get("tour") === "1"){
        history.replaceState(null, "", location.pathname); runTour(); return;
      }
      const pid = sessionStorage.getItem("sl_person_id");
      if(pid && state.opts.active === "dashboard" && state.opts.client){
        const {data} = await state.opts.client.rpc("has_seen_tour", {p_person_id: pid});
        if(data === false){
          try{ localStorage.setItem("sl_notice_seen", NOTICE_ID); }catch(_){}   // a first-time visitor doesn't need the "what's new" list
          runTour(); return;
        }
      }
    }catch(_){}
    showNotice();
  }

  function setAdmin(v){
    try{ sessionStorage.setItem("sl_is_admin", v ? "1" : "0"); window.Session && Session.sync(); }catch(_){}
    if(state.root && state.isAdmin !== !!v){ state.isAdmin = !!v; render(); if(v && state.opts.notice !== false) setTimeout(checkVerifications, 900); }
  }

  /* ---- admins: people who could not get their sign-up code ask to be verified; shown when an admin signs in ---- */
  let verifBusy = false;
  async function checkVerifications(force){
    if(verifBusy || !state.opts.client) return;
    const id = sessionStorage.getItem("sl_person_id"), pin = sessionStorage.getItem("sl_pin");
    if(!id || !pin) return;
    verifBusy = true;
    try{
      const {data} = await state.opts.client.rpc("admin_list_pending_verifications", {p_admin_id:id, p_admin_pin:pin});
      const list = (data && data.success) ? data.requests : [];
      const key = list.map(r=>r.email).join("|");
      if(!list.length){ if(document.getElementById("ivBack") && force) document.getElementById("ivBack").remove(); return; }
      if(!force && sessionStorage.getItem("sl_verif_seen") === key) return;
      try{ sessionStorage.setItem("sl_verif_seen", key); }catch(_){}
      await loadNotify();
      const rows = list.map(r=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #e5e7eb"><div style="flex:1;min-width:0"><b>${esc(r.name)}</b><div style="font-size:11.5px;color:#6b7280;overflow:hidden;text-overflow:ellipsis">${esc(r.email)}</div></div>
        <button type="button" data-rv="1" data-email="${esc(r.email)}">Verify</button><button type="button" data-rv="0" data-email="${esc(r.email)}" style="color:#dc2626">Reject</button></div>`).join("");
      const card = window.Notify.show({tone:"warn", icon:"key", title:"People waiting for verification", sub:`${list.length} sign-up${list.length>1?"s":""} could not get the email code.`,
        html:`<p>Only verify people you know. They sign in with the email and PIN they chose.</p><div id="rvList">${rows}</div>`, primary:{label:"Close"}});
      const box = document.getElementById("rvList");
      if(box) box.addEventListener("click", async e=>{
        const b = e.target.closest("[data-rv]"); if(!b) return;
        b.disabled = true;
        const {data:r} = await state.opts.client.rpc("admin_review_registration", {p_admin_id:id, p_admin_pin:pin, p_email:b.getAttribute("data-email"), p_approve:b.getAttribute("data-rv")==="1"});
        if(!r || !r.success){ alert((r&&r.error)||"Could not update."); b.disabled = false; return; }
        verifBusy = false; if(card) card.close(); sessionStorage.removeItem("sl_verif_seen"); checkVerifications(true);
      });
    }catch(_){} finally{ verifBusy = false; }
  }
  function loadNotify(){
    return new Promise(res=>{ if(window.Notify) return res(); const sc = document.createElement("script"); sc.src = "notify.js"; sc.onload = ()=>res(); sc.onerror = ()=>res(); document.head.appendChild(sc); });
  }
  /* ---- two-step confirmation for risky actions: resolves true only after both steps ---- */
  function confirmTwice(o){
    return new Promise(resolve=>{
      if(!document.getElementById("cfCss")){ const st=document.createElement("style"); st.id="cfCss"; st.textContent=`
        .cf-back{ position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; padding:18px; z-index:1100; font-family:inherit; }
        .cf-box{ background:#fff; color:#1f2933; border-radius:14px; max-width:440px; width:100%; padding:22px 24px; box-shadow:0 24px 60px rgba(0,0,0,.3); }
        .cf-box h3{ margin:0 0 8px; font-size:17px; }
        .cf-box p{ margin:0 0 6px; font-size:13.5px; line-height:1.5; color:#475569; }
        .cf-box .cf-step{ font-size:11px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; color:#6b7280; margin-bottom:6px; }
        .cf-box.cf-last{ border-top:4px solid #dc2626; }
        .cf-foot{ display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
        .cf-foot button{ font:inherit; font-size:13px; font-weight:700; padding:9px 16px; border-radius:8px; border:1px solid #d7dbe0; background:#fff; color:#1f2933; cursor:pointer; }
        .cf-foot button.go{ background:#2f6fed; border-color:#2f6fed; color:#fff; }
        .cf-foot button.danger{ background:#dc2626; border-color:#dc2626; color:#fff; }`; document.head.appendChild(st); }
      const back = document.createElement("div"); back.className="cf-back"; back.setAttribute("role","alertdialog"); back.setAttribute("aria-modal","true");
      const done = v=>{ document.removeEventListener("keydown", onKey); back.remove(); resolve(v); };
      const onKey = e=>{ if(e.key==="Escape") done(false); };
      const step1 = ()=>{
        back.innerHTML = `<div class="cf-box"><div class="cf-step">Step 1 of 2</div><h3>${esc(o.title)}</h3>${(o.lines||[]).map(l=>`<p>${esc(l)}</p>`).join("")}
          <div class="cf-foot"><button type="button" data-a="no">Cancel</button><button type="button" class="go" data-a="next">Continue</button></div></div>`;
        back.querySelector('[data-a="no"]').focus();
      };
      const step2 = ()=>{
        back.innerHTML = `<div class="cf-box cf-last"><div class="cf-step">Step 2 of 2 — last check</div><h3>${esc(o.finalTitle||"Are you sure?")}</h3><p>${esc(o.finalText||"This cannot be undone.")}</p>
          <div class="cf-foot"><button type="button" data-a="no">No, keep it</button><button type="button" class="danger" data-a="yes">${esc(o.confirmLabel||"Yes, do it")}</button></div></div>`;
        back.querySelector('[data-a="no"]').focus();
      };
      back.addEventListener("click", e=>{
        const a = e.target.getAttribute && e.target.getAttribute("data-a");
        if(e.target===back || a==="no") done(false);
        else if(a==="next") step2();
        else if(a==="yes") done(true);
      });
      document.addEventListener("keydown", onKey);
      step1(); document.body.appendChild(back);
      back.querySelector('[data-a="no"]').focus();
    });
  }
  const CONFIRM = {
    regen:{title:"Replace this signing link?", lines:["The link you already sent will stop working straight away.","Anyone using the old link will see an error until you send them the new one."], finalTitle:"Really replace the link?", finalText:"The original link will be disabled and cannot be brought back. Only continue if the old link was lost or sent to the wrong person.", confirmLabel:"Yes, replace the link"},
    withdraw:{title:"Withdraw this requisition?", lines:["This stops the approval chain. Nobody will be able to sign it any more.","Withdrawing is not the same as rejecting: the requester cannot fix and resubmit it."], finalTitle:"Really withdraw it?", finalText:"This cannot be undone.", confirmLabel:"Yes, withdraw it"},
    reject:{title:"Reject this requisition?", lines:["It goes back to the requester with your reason, and the approval chain stops.","The requester can then fix it and resubmit."], finalTitle:"Really reject it?", finalText:"The requester will be told and the signing links will stop working until they resubmit.", confirmLabel:"Yes, reject it"},
    del:{title:"Delete this requisition?", lines:["The requisition and all its items and signatures will be permanently removed.","Nobody will be able to open it again."], finalTitle:"Really delete it for good?", finalText:"This is permanent and cannot be undone. If you only want to stop it, use Withdraw instead.", confirmLabel:"Yes, delete it"}
  };
  w.AppBar = {mount, setAdmin, confirmTwice, CONFIRM, guard, can};
})(window);
