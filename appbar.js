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
  /* page heading: title left, actions right — same on every page */
  .pagehead{ display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; margin:0 0 16px; }
  .pagehead h1{ margin:0; font-size:24px; letter-spacing:-.4px; color:inherit; }
  .pagehead .sub{ color:var(--muted,#6b7280); font-size:13px; margin-top:3px; }
  .pagehead .btns{ display:flex; gap:8px; flex-wrap:wrap; }
  .pagehead .btns button, .pagehead .btns a.btn{ padding:10px 16px; }
  /* "what's new" notice */
  .wn-back{ position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; padding:18px; z-index:1000; font-family:inherit; }
  .wn-box{ background:var(--surface,#fff); color:var(--ink,#1f2933); border-radius:16px; max-width:520px; width:100%; max-height:92vh; overflow:auto; padding:24px 26px 20px; box-shadow:0 24px 60px rgba(0,0,0,.3); }
  .wn-box h2{ margin:0 0 4px; font-size:20px; letter-spacing:-.3px; }
  .wn-box .wn-sub{ color:var(--muted,#6b7280); font-size:13px; margin-bottom:14px; }
  .wn-box ul{ list-style:none; margin:0 0 16px; padding:0; }
  .wn-box li{ display:flex; gap:12px; padding:9px 0; border-top:1px solid var(--line,#d7dbe0); font-size:13.5px; line-height:1.45; }
  .wn-box li:first-child{ border-top:0; }
  .wn-box li b{ display:block; font-size:13.5px; }
  .wn-box li span.t{ color:var(--muted,#6b7280); font-size:12.5px; }
  .wn-dot{ flex:none; width:8px; height:8px; border-radius:50%; background:#2f6fed; margin-top:6px; }
  .wn-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .wn-foot label{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink,#1f2933); cursor:pointer; }
  .wn-foot button{ font:inherit; font-size:13px; font-weight:700; padding:10px 22px; border-radius:8px; border:1px solid #2f6fed; background:#2f6fed; color:#fff; cursor:pointer; }
  .wn-foot button:hover{ background:#2050bd; }
  @media print{ .appbar, .pagehead .btns, .wn-back{ display:none !important; } }
  `;
  const NAV = [
    {id:"dashboard", label:"Dashboard",        href:"dashboard.html"},
    {id:"items",     label:"Purchase History", href:"items.html"},
    {id:"analytics", label:"Analytics",        href:"analytics.html"},
    {id:"admin",     label:"Admin Settings",   href:"admin.html", admin:true}
  ];
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  let state = {opts:{}, isAdmin:false, root:null};

  function isAdminCached(){ try{ return sessionStorage.getItem("sl_is_admin")==="1"; }catch(_){ return false; } }
  function logout(){
    ["sl_person_id","sl_person_name","sl_pin","sl_is_admin"].forEach(k=>{ try{ sessionStorage.removeItem(k); }catch(_){} });
    const here = location.pathname.split("/").pop() || "dashboard.html";
    location.href = "login.html?redirect=" + encodeURIComponent(here);
  }
  function go(page, newTab){ if(newTab) window.open(page, "_blank"); else location.href = page; }

  function render(){
    const o = state.opts, name = (function(){ try{ return sessionStorage.getItem("sl_person_name")||""; }catch(_){ return ""; } })();
    const links = NAV.filter(n=>!n.admin || state.isAdmin).map(n=>`<a href="${n.href}" class="${o.active===n.id?"on":""}">${esc(n.label)}</a>`).join("");
    state.root.innerHTML = `<div class="appbar">
      <a class="ab-brand" href="dashboard.html"${o.newTab?' target="_blank" rel="noopener"':""}>SPACE<span>logic</span> — MR Tracker</a>
      <div class="ab-nav">
        ${links}
        ${o.onRefresh ? `<button class="ab-ico" data-act="refresh" title="Reload" aria-label="Reload">↻</button>` : ""}
        <div class="ab-user">
          <button class="ab-userbtn" data-act="menu" aria-haspopup="true"><span class="ab-avatar">${esc((name||"?").trim().charAt(0).toUpperCase())}</span><span>${esc(name)}</span>${state.isAdmin?'<span class="ab-role">Admin</span>':""} ▾</button>
          <div class="ab-menu" id="abMenu">
            <button data-act="profile">My Profile</button>
            <button data-act="reminders">Reminder Settings</button>
            <hr>
            <a href="manual.html" target="_blank" rel="noopener">Manual</a>
            <a href="manual.html#faq" target="_blank" rel="noopener">FAQ</a>
            <hr>
            <button class="ab-out" data-act="logout">Log out</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function mount(id, opts){
    state.opts = opts || {};
    state.root = typeof id==="string" ? document.getElementById(id) : id;
    if(!document.getElementById("appbar-css")){ const st = document.createElement("style"); st.id="appbar-css"; st.textContent = CSS; document.head.appendChild(st); }
    state.isAdmin = isAdminCached();
    render();
    if(state.opts.notice !== false) showNotice();
    state.root.addEventListener("click", e=>{
      const t = e.target.closest("[data-act]"); if(!t) return;
      const act = t.getAttribute("data-act"), o = state.opts;
      if(act==="menu"){ e.stopPropagation(); document.getElementById("abMenu").classList.toggle("open"); return; }
      document.getElementById("abMenu").classList.remove("open");
      if(act==="logout") logout();
      else if(act==="refresh" && o.onRefresh) o.onRefresh();
      else if(act==="profile") (o.onProfile || (()=>go("dashboard.html?open=profile", o.newTab)))();
      else if(act==="reminders") (o.onReminders || (()=>go("dashboard.html?open=reminders", o.newTab)))();
    });
    document.addEventListener("click", ()=>{ const m=document.getElementById("abMenu"); if(m) m.classList.remove("open"); });
    // not known yet on this browser tab: ask once, then remember
    if(!isAdminCached() && sessionStorage.getItem("sl_is_admin")===null && state.opts.client){
      const id = sessionStorage.getItem("sl_person_id"), pin = sessionStorage.getItem("sl_pin");
      if(id && pin) state.opts.client.rpc("verify_admin", {p_person_id:id, p_pin:pin}).then(r=>{ if(r && !r.error) setAdmin(r.data===true); });
    }
  }
  /* ---- one-time "What's new" notice (remembered per browser; bump the id to show a new one) ---- */
  const NOTICE_ID = "upgrade-2026-10";
  const NOTICE = [
    ["Same layout on every page", "One header with Dashboard, Purchase History and Analytics, and your name menu at the top right (profile, reminders, log out)."],
    ["Dashboard: organise it your way", "Group requisitions by status, stage, project, requester or month. The headings stay in view as you scroll, and the blue REQ number opens the full form."],
    ["One link to sign", "PIN Sign and the new PDF Sign each give one link that works for every step. With PDF Sign, people draw their signature on the PDF form, and you can track it on the dashboard."],
    ["Purchase History (new)", "Find items we've bought before with the price, supplier and date, then add them to a new requisition in one click. Similar names are matched automatically."],
    ["Analytics (new)", "Spending, approval speed and price insights. You see your own requisitions; admins see everything."],
    ["Smaller improvements", "Dates now show as dd/mm/yyyy, the form can remember your projects, and CSV exports open correctly in Excel with Chinese text."]
  ];
  function showNotice(){
    try{ if(localStorage.getItem("sl_notice_seen")===NOTICE_ID) return; }catch(_){}
    if(document.getElementById("wnBack")) return;
    const back = document.createElement("div"); back.className="wn-back"; back.id="wnBack";
    back.setAttribute("role","dialog"); back.setAttribute("aria-modal","true"); back.setAttribute("aria-label","What's new");
    back.innerHTML = `<div class="wn-box">
      <h2>The system has been upgraded</h2>
      <div class="wn-sub">Here's what's new for you:</div>
      <ul>${NOTICE.map(n=>`<li><span class="wn-dot"></span><div><b>${esc(n[0])}</b><span class="t">${esc(n[1])}</span></div></li>`).join("")}</ul>
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
    back.querySelector("#wnOk").focus();
  }

  function setAdmin(v){
    try{ sessionStorage.setItem("sl_is_admin", v ? "1" : "0"); }catch(_){}
    if(state.root && state.isAdmin !== !!v){ state.isAdmin = !!v; render(); }
  }
  w.AppBar = {mount, setAdmin};
})(window);
