/* Onboarding for MR Tracker:
   Tour.start()      spotlight tour on the Dashboard: dims the page, highlights one control at a time and
                     puts a short tip right beside it (name menu -> "Quick tour", or once for a new account)
   Tour.afterSign()  short, visual invite shown to someone who just signed a PDF without an account */
(function(w){
  "use strict";
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  const CSS = `
  .tr-layer{ position:fixed; inset:0; z-index:1200; font-family:inherit; }
  .tr-layer.center{ background:rgba(15,23,42,.6); }
  .tr-hole{ position:fixed; border-radius:12px; box-shadow:0 0 0 9999px rgba(15,23,42,.6), 0 0 0 3px #60a5fa; transition:all .28s ease; pointer-events:none; }
  .tr-pop{ position:fixed; width:320px; max-width:calc(100vw - 16px); background:#fff; color:#1f2933; border-radius:14px; box-shadow:0 18px 48px rgba(0,0,0,.35); padding:16px 18px 14px; transition:top .28s ease, left .28s ease; }
  .tr-pop.mid{ left:50%!important; top:50%!important; transform:translate(-50%,-50%); width:400px; }
  .tr-arrow{ position:absolute; width:14px; height:14px; background:#fff; transform:rotate(45deg); }
  .tr-step{ font-size:11px; font-weight:800; letter-spacing:.5px; text-transform:uppercase; color:#2f6fed; }
  .tr-pop h3{ margin:4px 0 6px; font-size:16.5px; letter-spacing:-.2px; }
  .tr-pop p{ margin:0; font-size:13.5px; line-height:1.55; color:#4b5563; }
  .tr-pop p b{ color:#111827; }
  .tr-bar{ height:4px; background:#e5e7eb; border-radius:99px; margin:14px 0 12px; overflow:hidden; } .tr-bar i{ display:block; height:100%; background:#2f6fed; border-radius:99px; transition:width .28s; }
  .tr-nav{ display:flex; align-items:center; gap:8px; }
  .tr-nav .sp{ flex:1; }
  .tr-nav button{ font:inherit; font-size:13px; font-weight:700; padding:8px 14px; border-radius:8px; border:1px solid #d7dbe0; background:#fff; color:#1f2933; cursor:pointer; }
  .tr-nav .go{ background:#2f6fed; border-color:#2f6fed; color:#fff; } .tr-nav .go:hover{ background:#2050bd; }
  .tr-nav .skip{ border:0; background:none; color:#6b7280; font-weight:600; padding-left:0; }

  @media print{ .tr-layer{ display:none!important; } }`;
  function css(){ if(document.getElementById("trCss")) return; const st=document.createElement("style"); st.id="trCss"; st.textContent=CSS; document.head.appendChild(st); }

  /* ---------------- spotlight tour (Dashboard) ---------------- */
  const STEPS = [
    {t:"Welcome to MR Tracker", h:"This is where we <b>request, approve and track</b> materials purchases. Let me show you around — it takes 1 minute."},
    {sel:'a[href="index.html"] button.primary', t:"Start a requisition", h:"Press here to open the form. Pick your <b>project</b>, add items and prices, then press <b>Submit for approval</b> — you get <b>one link</b> to send to your approvers."},
    {sel:"#pipeline", t:"Every stage at a glance", h:"Each box counts requisitions at one stage: <b>Manager → Procurement → Purchase → Received</b>. Click a box to show only that stage."},
    {sel:"#needsChip", t:"What needs you", h:"Things waiting for <b>your</b> signature, or a declined request you need to fix. Check here first."},
    {sel:".view-toggle", t:"List or Cards", h:"Switch the layout. <b>Point</b> at a requisition to preview it, <b>click</b> it to open the full form (with Withdraw, Regenerate link and more)."},
    {sel:'.ab-nav a[href="items.html"]', t:"Purchase History", h:"What we bought before — <b>supplier, price and date</b>. Tick an item to reorder it."},
    {sel:'.ab-nav a[href="projects.html"]', t:"Projects", h:"The shared project list. Anyone can add one; it fills the project details on the form for you."},
    {sel:"#asFab", t:"Ask anything", h:"Try “<b>where is REQ-00031?</b>”, “<b>did my screws arrive?</b>” or “<b>how do I withdraw?</b>”."},
    {sel:".ab-userbtn", t:"Your menu", h:"<b>My Profile</b>, <b>Change PIN</b>, reminders, the <b>Manual</b> — and this <b>Quick tour</b> if you want it again."},
    {t:"You're all set", h:"Press <b>+ New requisition</b> whenever you need to buy something. Have a good one!"}
  ];

  function start(){
    css();
    if(document.getElementById("trLayer")) return;
    let i = 0, target = null;
    const layer = document.createElement("div"); layer.className = "tr-layer"; layer.id = "trLayer";
    layer.setAttribute("role","dialog"); layer.setAttribute("aria-modal","true"); layer.setAttribute("aria-label","Quick tour");
    layer.innerHTML = `<div class="tr-hole" id="trHole"></div><div class="tr-pop" id="trPop"><span class="tr-arrow" id="trArrow"></span><div id="trIn"></div></div>`;
    document.body.appendChild(layer);
    const hole = layer.querySelector("#trHole"), pop = layer.querySelector("#trPop"), inner = layer.querySelector("#trIn"), arrow = layer.querySelector("#trArrow");

    const visible = el => { if(!el) return false; const r = el.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(el).visibility!=="hidden"; };
    function place(){
      if(!target){
        layer.classList.add("center"); hole.style.display="none"; arrow.style.display="none"; pop.classList.add("mid"); return;
      }
      layer.classList.remove("center"); hole.style.display=""; arrow.style.display=""; pop.classList.remove("mid");
      const r = target.getBoundingClientRect(), pad = 6, W = innerWidth, H = innerHeight;
      hole.style.left = (r.left-pad)+"px"; hole.style.top = (r.top-pad)+"px"; hole.style.width = (r.width+pad*2)+"px"; hole.style.height = (r.height+pad*2)+"px";
      const pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 16;
      let top, left, side;
      if(r.bottom + gap + ph <= H - 8){ top = r.bottom + gap; side = "top"; }            // tip below, arrow on its top edge
      else if(r.top - gap - ph >= 8){ top = r.top - gap - ph; side = "bottom"; }          // tip above
      else { top = Math.max(8, Math.min(H-ph-8, r.top)); side = r.left > W/2 ? "right" : "left"; }
      if(side==="top" || side==="bottom"){ left = Math.max(8, Math.min(W-pw-8, r.left + r.width/2 - pw/2)); }
      else if(side==="right"){ left = Math.max(8, r.left - gap - pw); } else { left = Math.min(W-pw-8, r.right + gap); }
      pop.style.top = top+"px"; pop.style.left = left+"px";
      const ax = Math.max(16, Math.min(pw-30, r.left + r.width/2 - left - 7)), ay = Math.max(16, Math.min(ph-30, r.top + r.height/2 - top - 7));
      arrow.style.left = arrow.style.top = arrow.style.right = arrow.style.bottom = "auto";
      if(side==="top"){ arrow.style.top="-7px"; arrow.style.left=ax+"px"; }
      else if(side==="bottom"){ arrow.style.bottom="-7px"; arrow.style.left=ax+"px"; }
      else if(side==="right"){ arrow.style.right="-7px"; arrow.style.top=ay+"px"; }
      else { arrow.style.left="-7px"; arrow.style.top=ay+"px"; }
    }
    function draw(){
      const s = STEPS[i], last = i===STEPS.length-1;
      inner.innerHTML = `<div class="tr-step">${i===0?"Quick tour":"Step "+i+" of "+(STEPS.length-2)}</div><h3>${esc(s.t)}</h3><p>${s.h}</p>
        <div class="tr-bar"><i style="width:${Math.round((i)/(STEPS.length-1)*100)}%"></i></div>
        <div class="tr-nav">${last?"":'<button type="button" class="skip" data-a="skip">Skip</button>'}<span class="sp"></span>${i>0&&!last?'<button type="button" data-a="back">Back</button>':""}<button type="button" class="go" data-a="${last?"done":"next"}">${i===0?"Show me":last?"Get started":"Next"}</button></div>`;
      target = null;
      const show = ()=>{ place(); const g = pop.querySelector(".go"); if(g) g.focus({preventScroll:true}); };
      if(!s.sel){ show(); return; }
      let tries = 0;
      (function find(){
        const el = document.querySelector(s.sel);
        if(visible(el)){
          target = el;
          const r = el.getBoundingClientRect();
          if(r.top < 70 || r.bottom > innerHeight - 200){ el.scrollIntoView({block:"center", behavior:"smooth"}); setTimeout(show, 380); } else show();
        } else if(tries++ < 10){ setTimeout(find, 120); }       // e.g. the Ask button loads a moment later
        else show();                                              // not on this page: show the tip in the middle
      })();
    }
    function go(d){ const n = i + d; if(n < 0) return; if(n >= STEPS.length){ close(); return; } i = n; draw(); }
    function close(){ removeEventListener("resize", place); removeEventListener("scroll", place, true); document.removeEventListener("keydown", onKey); layer.remove(); }
    const onKey = e=>{ if(e.key==="Escape") close(); else if(e.key==="ArrowRight") go(1); else if(e.key==="ArrowLeft") go(-1); };
    layer.addEventListener("click", e=>{
      const a = e.target.getAttribute && e.target.getAttribute("data-a");
      if(a==="next") go(1); else if(a==="back") go(-1); else if(a==="skip"||a==="done") close();
    });
    addEventListener("resize", place); addEventListener("scroll", place, true); document.addEventListener("keydown", onKey);
    draw();
  }

  /* ---------------- invite after a PDF signature (no account) — uses the shared result card in notify.js ---------------- */
  function afterSign(opts){
    opts = opts || {};
    try{ if(sessionStorage.getItem("sl_person_id")) return; }catch(_){}
    if(!w.Notify) return;
    w.Notify.show({
      tone:"success", title:"You're signed!", sub:"Your signature is saved on this requisition.",
      track:{done: Math.max(1, Math.min(4, opts.signedSteps || 1))},
      html:(opts.nextHtml || "") + '<div style="text-align:center;font-size:15px;font-weight:800;color:#111827;margin-top:6px">Want to follow it all the way?</div>',
      tiles:[{icon:"track",label:"Track every step"},{icon:"form",label:"Raise requests in minutes"},{icon:"price",label:"Reuse past prices"}],
      primary:{label:"Create my free account", href:"login.html?signup=1&redirect=dashboard.html"},
      secondary:{label:"Not now"},
      small:"Company email + 4-digit PIN · takes 1 minute",
      hideKey:"sl_aftersign_hide"
    });
  }

  w.Tour = {start, afterSign};
})(window);
