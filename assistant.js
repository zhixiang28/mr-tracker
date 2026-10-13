/* MR Tracker help assistant.
   1) Rules first: requisition look-ups, "what needs me", summaries, spend, and a built-in FAQ. Free, instant, always exact.
   2) Only if no rule can answer: a small AI model through the "assistant-ai" function, with hard daily/monthly limits
      enforced on the server (see supabase/functions/assistant-ai and the ai_settings table). */
(function(w){
  "use strict";
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const money = n => "$ " + Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const dmy = d => { if(!d) return ""; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d); };
  const ss = { get(k){ try{ return sessionStorage.getItem(k); }catch(_){ return null; } } };

  /* ---------------- built-in answers (keep short; same facts as the Manual & FAQ) ---------------- */
  const FAQ = [
    {k:"withdraw cancel stop requisition remove", go:["Open your requisitions","dashboard.html"], a:"Open the requisition (click it on the dashboard) and press <b>Withdraw</b>. The requester or an admin can do this until it has been <b>Purchased</b>. You will be asked to confirm twice."},
    {k:"declined rejected fix resubmit revise edit again", go:["Your requisitions (use Needs action)","dashboard.html"], a:"A declined requisition shows the reason on the dashboard. Open it and press <b>Fix &amp; Resubmit in form</b>, change what was flagged and resubmit. Approval restarts from the Team Manager."},
    {k:"edit change modify submitted after", go:["Your requisitions","dashboard.html"], a:"A submitted requisition can't be edited by the requester unless it is declined. Ask an approver to decline it with a reason, then use <b>Fix &amp; Resubmit in form</b>. Admins can use <b>Edit in form</b>."},
    {k:"sign approve link send forward next approver", go:["Your requisitions","dashboard.html"], a:"After you press <b>Submit for approval</b> you get <b>one link</b> that works for every step. Send it to the Team Manager first; after each signature it opens on the next person's turn, so keep forwarding the same link."},
    {k:"lost link regenerate new link old link", go:["Your requisitions","dashboard.html"], a:"Open the requisition and press <b>Regenerate link</b>. The old link stops working straight away, so the app asks you to confirm twice."},
    {k:"pin sign pdf sign difference which how to sign approve decline signature", a:"There is one way to sign: open the link, tap the box next to your role, then <b>Approve &amp; sign</b> (draw your signature — plus your PIN if you are signed in) or <b>Decline</b> with a reason."},
    {k:"forgot pin reset password", go:["Read more in the Manual","manual.html#faq"], a:"PINs can't be looked up. Ask an admin to delete your account in <b>Admin Settings</b> and sign you up again with a new PIN. You keep your name on past requisitions."},
    {k:"change pin profile account email name rename", a:"Click your name at the top right, then <b>My Profile</b> to change your name, position or department, or <b>Change PIN</b>. Your company email is your sign-in ID, so it can't be changed there — ask an admin to correct it."},
    {k:"project add save new list shared", a:"Anyone can add a project: use the <b>Projects</b> page, or press <b>Save this project for everyone</b> under PM Incharge on the form. Admins can edit or archive projects."},
    {k:"item history bought before price supplier purchase history cheapest", a:"Open <b>Purchase History</b> to search what we bought, from which supplier and at what price. On the form, click the Item box to pick a past item and its price fills in."},
    {k:"currency convert exchange rate foreign usd", a:"On the form press <b>Currency converter</b> above the materials table. It fetches a live rate; if it can't, type a rate yourself."},
    {k:"draft save later unfinished", a:"Press <b>Save Draft</b> on the form. Open your drafts with <b>My Drafts</b> from any device."},
    {k:"export pdf csv print download", go:["Open the form","index.html"], a:"Open the requisition's full form, then use <b>Print</b> or <b>Export PDF</b>. The form page also has Export PDF and Export CSV."},
    {k:"cards list layout view change dashboard group", go:["Open the dashboard","dashboard.html"], a:"On the dashboard use the <b>List / Cards</b> buttons. In List you can group by status, stage, project, requester or month. In Cards, click a stage title to fold the column."},
    {k:"reminder overdue notification email remind", a:"Click your name, then <b>Reminder Settings</b> to set how long a stage may sit before it is flagged as overdue."},
    {k:"admin become make access", go:["Read more in the Manual","manual.html#admin"], a:"An existing admin can grant admin access in <b>Admin Settings</b>. There must always be at least one admin."},
    {k:"stages stage workflow flow order approval process", go:["Read how it works in the Manual","manual.html#workflow"], a:"Every requisition goes <b>Submitted → Manager Approved → Procurement Approved → Purchased → Received</b>. It can also end as Declined or Withdrawn."},
    {k:"reject delete admin", go:["Your requisitions","dashboard.html"], a:"Admins can open a requisition and press <b>Reject</b> (with a reason; the requester can fix and resubmit), <b>Withdraw</b>, or <b>Delete</b> (permanent). Each asks you to confirm twice."},
    {k:"analytics chart spending report", a:"Open <b>Analytics</b> for spending, approval speed and price insights. You see your own requisitions; admins see everyone's."},
    {k:"duplicate copy requisition again similar new form", a:"On the form press <b>Duplicate</b> to start a fresh, unsaved copy with everything filled in. To buy something again, open <b>Purchase History</b>, tick the item and press <b>Add to a new requisition</b>."},
    {k:"combine separate same item merge names aliases similar", a:"In <b>Purchase History</b>, tick the items that are really the same and press <b>Combine as one item</b> (everyone then sees them as one). Use <b>Possible duplicates</b> to find look-alikes; you can separate them again."},
    {k:"locked attempts wrong pin too many sign in login", go:["Read more in the Manual","manual.html#faq"], a:"Sign in with your company email and PIN. After 5 wrong PIN attempts your account is locked for 15 minutes — wait and try again with the right PIN. If you forgot it, ask an admin."},
    {k:"share email send form pdf", go:["Open the form","index.html"], a:"On the form press <b>Share</b> to send the PDF through your device's share menu, or <b>Export PDF</b> to download it."},
    {k:"search find filter requisition dashboard stage", go:["Open the dashboard","dashboard.html"], a:"On the dashboard use the search box (REQ number, project or requester), the stage boxes, the <b>All stages</b> filter or the <b>Needs action</b> button."},
    {k:"hover preview point mouse", go:["Open the dashboard","dashboard.html"], a:"Rest your mouse on a row or card to preview its items and who has signed. Click it to open the full form."},
    {k:"date format ddmmyyyy dd/mm/yyyy", go:["Open the form","index.html"], a:"Dates are shown and typed as dd/mm/yyyy, for example 25/08/2026."},
    {k:"chinese csv excel garbled characters", go:["Read more in the Manual","manual.html#faq"], a:"Export CSV opens correctly in Excel with Chinese text. If you still see odd characters, open it from Excel with <b>Data → From Text/CSV</b> and choose UTF-8."},
    {k:"people add person delete user admin settings account", a:"Admins open <b>Admin Settings</b> to add a person, delete an account, or make or remove an admin. There must always be one admin."},
    {k:"project archive edit import excel admin", a:"Admins can edit or archive a project on the <b>Projects</b> page, or paste a whole list with <b>Import from Excel</b>. Archiving hides it from the form without deleting it."},
    {k:"supply date meaning required", go:["Open the form","index.html"], a:"The supply date is when the materials are needed on site. It is filled in on the form and shown on the requisition."},
    {k:"verification code email sign up register not receive junk spam", a:"Check your <b>junk / spam</b> folder for the 6-digit code. If it is not there, ask an admin for the code and type it in the same box."},
    {k:"sign pdf link account signed in pin drawn signature already have account", a:"Sign in first, then open the signing link. It asks for your PIN plus your drawn signature, so the signature is linked to your account and shows on your Dashboard. Without an account you can still sign by typing your name."},
    {k:"tour guide tutorial new user start onboarding walkthrough", a:"Open your name menu and choose <b>Quick tour</b> for a step-by-step guide. The <b>Manual</b> in the same menu has the details."},
    {k:"email domain spacelogic type sign in login username", a:"Sign in with your company email and PIN. Just type the first part (for example alex.tan) — @spacelogic.com.sg is added for you."},
    {k:"version update new what's whatsnew", a:"The version is shown under <b>Log out</b> in the name menu. Click it to read what's new."}
  ];
  const STOP = new Set("the a an is are to of in on for my me i how do does can what when where why who which it this that and or with be have has was were will would should please tell show about there their your you our we many much too more some like".split(" "));
  const toks = s => String(s||"").toLowerCase().replace(/[^a-z0-9一-鿿\s'-]/g," ").split(/\s+/).filter(t=>t && !STOP.has(t) && (t.length>2 || /[一-鿿]/.test(t)));

  function lev(a,b){
    if(a===b) return 0; if(Math.abs(a.length-b.length)>2) return 3;
    const dp = Array.from({length:a.length+1},(_,i)=>[i]); for(let j=1;j<=b.length;j++) dp[0][j]=j;
    for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    return dp[a.length][b.length];
  }
  const near = (t,w)=>{ if(t===w) return true; const n = Math.max(t.length,w.length); const d = n>=8 ? 2 : n>=5 ? 1 : 0; return d>0 && lev(t,w)<=d; };
  const WORDS = t => String(t||"").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff\s'-]/g," ").split(/\s+/).filter(Boolean);
  const hasWord = (low, list) => { const ws = WORDS(low); return list.some(w=>ws.some(t=>near(t,w))); };

  function faqAnswer(q){
    const qt = new Set(toks(q)); if(!qt.size) return null;
    let best = null, bestScore = 0;
    FAQ.forEach(f=>{
      const kt = toks(f.k); let sc = 0;
      kt.forEach(t=>{ if(qt.has(t)) sc += 2; else { for(const x of qt){ if((x.length>3 && (t.startsWith(x)||x.startsWith(t))) || (x.length>=5 && near(x,t))) { sc += 1.5; break; } } } });
      if(sc > bestScore){ bestScore = sc; best = f; }
    });
    return bestScore >= 2 ? linkify(best.a) + (best.go && !/<a /.test(linkify(best.a)) ? `<br><a href="${best.go[1]}">${best.go[0]} →</a>` : "") : null;
  }

  /* ---------------- live data (the signed-in person's own requisitions) ---------------- */
  let cache = {at:0, data:null};
  async function loadReqs(client){
    if(cache.data && Date.now()-cache.at < 45000) return cache.data;
    const id = ss.get("sl_person_id"), pin = ss.get("sl_pin");
    if(!id || !pin) return null;
    const {data, error} = await client.rpc("list_my_requisitions", {p_person_id:id, p_pin:pin});
    if(error || !data || !data.success) return null;
    cache = {at:Date.now(), data:data}; return data;
  }
  const link = r => `<a href="view.html?id=${esc(r.id)}">${esc(r.tracking_no||"-")}</a>`;
  const stepsOf = r => (r.approval_steps||[]).slice().sort((a,b)=>a.step_order-b.step_order);
  const nextStep = r => stepsOf(r).find(s=>s.status!=="Signed");
  function describe(r){
    const bits = [`${link(r)} — <b>${esc(r.project_name||"-")}</b>${r.project_location?" ("+esc(r.project_location)+")":""}`, `Status: <b>${esc(r.status)}</b> · ${money(r.grand_total)} · ${esc(r.request_by||"")} · ${dmy(r.form_date)}`];
    if(r.status==="Declined"){
      const st = stepsOf(r).find(s=>s.status==="Declined");
      bits.push(`Declined${r.declined_by?" by "+esc(r.declined_by):""}: “${esc(r.decline_reason||st?.decline_reason||"no reason given")}”`);
    } else if(r.status==="Withdrawn"){ bits.push("This requisition was withdrawn."); }
    else {
      const n = nextStep(r);
      if(!n) bits.push("All sign-offs are done.");
      else bits.push(`Waiting for: <b>${esc(n.stage_name)}</b>${n.assigned_person_name?" — "+esc(n.assigned_person_name):""}`);
      const done = stepsOf(r).filter(s=>s.status==="Signed").length;
      bits.push(`${done} of ${stepsOf(r).length} sign-offs done.`);
    }
    return bits.join("<br>");
  }
  const listOf = (rs, max) => rs.slice(0,max||6).map(r=>`• ${link(r)} ${esc(r.project_name||"-")} — ${esc(r.status)}, ${money(r.grand_total)}`).join("<br>") + (rs.length>(max||6) ? `<br>…and ${rs.length-(max||6)} more on the dashboard.` : "");
  const byDateDesc = rs => rs.slice().sort((a,b)=>String(b.form_date||"").localeCompare(String(a.form_date||"")) || String(b.tracking_no).localeCompare(String(a.tracking_no)));

  /* ---------------- intent words (typo-tolerant) ---------------- */
  const W = {
    arrive:["arrive","arrived","arrival","delivered","delivery","deliver","received","receive","shipped","shipping","reached","come","came","coming"],
    supplier:["supplier","vendor","seller","shop","store","bought","buy","buying","purchased","purchase"],
    price:["price","prices","cost","costs","paid","pay","cheapest","cheap","expensive"],
    who:["who","signed","signs","approved","approve","approver","approval","next","sign"],
    items:["items","item","materials","material","inside","contain","contains"],
    overdue:["overdue","stuck","slow","delay","delayed","oldest","longest","late"],
    need:["need","needs","waiting","wait","pending","action","turn"],
    decl:["declined","decline","rejected","reject"],
    sum:["summary","overview","breakdown","count","many"],
    spend:["spent","spend","total","worth","much"],
    last:["latest","recent","last","newest"],
    projects:["project","projects"]
  };
  const GENERIC = ["status","order","orders","ordered","requisition","requisitions","list","show","give","tell","find","check","use","used","using","did","does","done","still","yet","any","anything","month","week","today","everything","all"];
  const ALLW = [].concat(...Object.values(W), GENERIC);
  const keywordsOf = text => toks(text).filter(t=>!ALLW.some(w=>near(t,w))).map(t=>t.replace(/(es|s)$/,m=> t.length>4?"":m)).filter(t=>t.length>=3 || /[一-鿿]/.test(t));
  const supplierName = link => (w.supplierOf ? w.supplierOf(link).name : "(no link)");
  // supplier name that opens the product page entered on the requisition (http/https only)
  const supplierLink = url => {
    const name = esc(supplierName(url)); let u = String(url||"").trim();
    if(!u) return name;
    if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = "https://"+u;
    return /^https?:\/\//i.test(u) ? `<a href="${esc(u)}">${name}</a>` : name;
  };
  const daysSince = d => { const t = Date.parse(String(d||"").slice(0,10)); return isNaN(t) ? null : Math.max(0, Math.floor((Date.now()-t)/86400000)); };
  const OPEN = r => !["Received","Declined","Withdrawn"].includes(r.status);

  // every line item (with its requisition) whose name/description contains all the keywords
  function itemHits(reqs, kw){
    const out = [];
    reqs.forEach(r=>(r.requisition_items||[]).forEach(it=>{
      const hay = (String(it.name||"")+" "+String(it.description||"")).toLowerCase();
      if(kw.every(k=>hay.includes(k))) out.push({r, it});
    }));
    return out;
  }
  const arrivalLine = r=>{
    const n = nextStep(r), who = n && n.assigned_person_name ? " ("+esc(n.assigned_person_name)+")" : "";
    if(r.status==="Received") { const st = stepsOf(r).find(x=>x.step_order===4 && x.signed_at); return `<b>Yes</b> — ${link(r)} is marked <b>Received</b>${st?" on "+dmy(st.signed_at):""}.`; }
    if(r.status==="Purchased") return `<b>Ordered, not marked received yet</b> — ${link(r)} is <b>Purchased</b>; waiting for ${n?esc(n.stage_name)+who:"someone"} to mark it received.`;
    if(r.status==="Declined") return `<b>No</b> — ${link(r)} was declined, so nothing was ordered.`;
    if(r.status==="Withdrawn") return `<b>No</b> — ${link(r)} was withdrawn.`;
    return `<b>Not yet</b> — ${link(r)} is still <b>${esc(r.status)}</b>, not purchased. Waiting for ${n?esc(n.stage_name)+who:"approval"}.`;
  };
  const chain = r => `${link(r)} — ${esc(r.project_name||"-")}<br>` + stepsOf(r).map(s=>{
    const mark = s.status==="Signed" ? "✓" : s.status==="Declined" ? "✕" : "○";
    return `${mark} ${esc(s.stage_name)}: ${esc(s.assigned_person_name||"not assigned")}${s.signed_at?" — signed "+dmy(s.signed_at):s.status==="Declined"?" — declined":""}`;
  }).join("<br>");
  const PAGES = [
    {w:["analytics","chart","charts","graph","graphs"], t:"Analytics", h:"analytics.html", d:"spending, approval speed and price insights"},
    {w:["history","purchased"], t:"Purchase History", h:"items.html", d:"what we bought, supplier, price and date"},
    {w:["projects","project"], t:"Projects", h:"projects.html", d:"the shared project list (anyone can add)"},
    {w:["dashboard","home"], t:"Dashboard", h:"dashboard.html", d:"all your requisitions"},
    {w:["admin","settings"], t:"Admin Settings", h:"admin.html", d:"people and admin access (admins only)"},
    {w:["manual","faq","help","guide"], t:"Manual &amp; FAQ", h:"manual.html", d:"step-by-step help"}
  ];

  // turns the bold button/page names in help text into links to the right page
  const GO = {"Purchase History":"items.html","Possible duplicates":"items.html","Combine as one item":"items.html","Add to a new requisition":"items.html",
    "Projects":"projects.html","Analytics":"analytics.html","Admin Settings":"admin.html","Import from Excel":"projects.html",
    "Reminder Settings":"dashboard.html?open=reminders","My Profile":"dashboard.html?open=profile","Change PIN":"dashboard.html?open=pin",
    "Save Draft":"index.html","My Drafts":"index.html","Duplicate":"index.html","Currency converter":"index.html","Save this project for everyone":"index.html","Export PDF":"index.html","Export CSV":"index.html","Share":"index.html","Submit for approval":"index.html"};
  const linkify = html => html.replace(/<b>([^<]+)<\/b>/g,(all,t)=>{ const h = GO[t.replace(/&amp;/g,"&")]; return h ? `<a href="${h}"><b>${t}</b></a>` : all; });
  async function rules(q, client){
    const text = q.trim(), low = text.toLowerCase();
    const isHow = /^(how|what happens|can i|can we|where do|where can|why can|is it possible|who can|what is|what are)\b/.test(low);
    const isAsk = hasWord(low,["where","open","go","show","link","find"]) && /\b(page|link|open|go to|where (is|are|do i find|can i find))\b/.test(low);

    const m = low.match(/req[-\s#]*0*(\d{1,6})/) || low.match(/(?:number|no\.?|#)\s*0*(\d{1,6})\b/);
    const data = await loadReqs(client);
    const reqs = data ? byDateDesc(data.requisitions||[]) : null;

    // a REQ number: items / sign-off chain / arrival / full summary
    if(m && reqs){
      const n = parseInt(m[1],10);
      const r = reqs.find(x=>parseInt(String(x.tracking_no||"").replace(/\D/g,""),10)===n);
      if(!r) return `I can't find REQ-${String(n).padStart(5,"0")} among the requisitions you can see.`;
      if(hasWord(low,W.items) && !hasWord(low,W.who)){
        const its = (r.requisition_items||[]).slice().sort((a,b)=>(a.sn||0)-(b.sn||0));
        return `${link(r)} has ${its.length} item${its.length===1?"":"s"}:<br>` + its.slice(0,8).map(i=>`• ${esc(i.name||"-")} — ${i.qty} × ${money(i.unit_price)}${i.link?" ("+supplierLink(i.link)+")":""}`).join("<br>") + (its.length>8?`<br>…and ${its.length-8} more.`:"") + `<br>Total ${money(r.grand_total)}.`;
      }
      if(hasWord(low,W.who)) return chain(r);
      if(hasWord(low,W.arrive)) return arrivalLine(r);
      return describe(r);
    }

    if(isHow){ const f = faqAnswer(text); if(f) return f; }

    // pages
    if(isAsk || /\b(page|menu|tab)\b/.test(low)){
      const pg = PAGES.find(p=>p.w.some(x=>WORDS(low).some(t=>near(t,x))));
      if(pg && !(pg.h==="admin.html" && reqs && data && !data.is_admin)) return `<a href="${pg.h}"><b>${pg.t}</b></a> — ${pg.d}. It is in the menu at the top of every page.`;
    }

    if(reqs){
      const me = (ss.get("sl_person_name")||"").toLowerCase();
      const kw = keywordsOf(text);

      // arrived / delivered?
      if(hasWord(low,W.arrive)){
        if(kw.length){
          const hits = itemHits(reqs, kw), rs = [...new Map(hits.map(h=>[h.r.id,h.r])).values()];
          if(rs.length) return rs.slice(0,4).map(arrivalLine).join("<br>") + (rs.length>4?`<br>…and ${rs.length-4} more.`:"");
          return `I can't find an item like “${esc(kw.join(" "))}” on the requisitions you can see. Try <a href="items.html">Purchase History</a>, or give me the REQ number.`;
        }
        const ordered = reqs.filter(r=>r.status==="Purchased"), got = reqs.filter(r=>r.status==="Received").slice(0,3);
        return (ordered.length ? `Purchased and waiting to be marked received:<br>${listOf(ordered)}` : "Nothing is waiting to be received.") + (got.length ? `<br><br>Recently received:<br>${listOf(got,3)}` : "");
      }

      // supplier / price history of an item
      if(hasWord(low,W.supplier.concat(W.price)) || /where (did|do|can) (we|i)/.test(low)){
        if(!kw.length) return "Which item? For example “which supplier for screws?” or “how much did we pay for cable?”. <a href=\"items.html\">Purchase History</a> also searches everything we bought.";
        const hits = itemHits(reqs, kw).filter(h=>!["Declined","Withdrawn"].includes(h.r.status)).sort((a,b)=>String(b.r.form_date).localeCompare(String(a.r.form_date)));
        if(!hits.length) return `I can't find an item like “${esc(kw.join(" "))}” on the requisitions you can see. Try <a href="items.html">Purchase History</a>.`;
        const lines = hits.slice(0,5).map(h=>`• ${esc(h.it.name)} — <b>${supplierLink(h.it.link)}</b>, ${money(h.it.unit_price)} each, ${dmy(h.r.form_date)} (${link(h.r)}, ${esc(h.r.status)})`).join("<br>");
        const priced = hits.filter(h=>Number(h.it.unit_price)>0).sort((a,b)=>a.it.unit_price-b.it.unit_price)[0];
        return `Found ${hits.length} purchase${hits.length>1?"s":""}:<br>${lines}` + (priced && hits.length>1 ? `<br>Cheapest so far: ${money(priced.it.unit_price)} at ${supplierLink(priced.it.link)}.` : "") + (hits.some(h=>!h.it.link) ? "<br>“(no link)” means no product link was entered, so the supplier is unknown." : "");
      }

      // who signed / who is next (by keyword)
      if(hasWord(low,W.who) && kw.length){
        const rs = [...new Map(itemHits(reqs, kw).concat(reqs.filter(r=>[r.project_name,r.project_location].join(" ").toLowerCase().includes(kw[0])).map(r=>({r}))).map(h=>[h.r.id,h.r])).values()];
        if(rs.length) return rs.slice(0,3).map(chain).join("<br><br>");
      }

      // overdue / stuck
      if(hasWord(low,W.overdue)){
        const o = reqs.filter(OPEN).sort((a,b)=>String(a.form_date).localeCompare(String(b.form_date)));
        return o.length ? "Open requisitions, oldest first:<br>" + o.slice(0,5).map(r=>{ const n = nextStep(r), d = daysSince(r.form_date); return `• ${link(r)} ${esc(r.project_name||"-")} — ${esc(r.status)}${d!=null?", "+d+" days old":""}${n?", waiting for "+esc(n.assigned_person_name||n.stage_name):""}`; }).join("<br>") : "Nothing is open right now.";
      }

      if(hasWord(low,W.need) && /(me|my|i |sign|action|need)/.test(low) && !hasWord(low,W.decl)){
        const mine = reqs.filter(r=>{
          if(["Declined","Withdrawn","Received"].includes(r.status)) return r.status==="Declined" && r.requester_person_id===ss.get("sl_person_id");
          const n = nextStep(r); return n && (n.assigned_person_name||"").toLowerCase()===me;
        });
        return mine.length ? `These need your attention:<br>${listOf(mine)}` : "Nothing is waiting on you right now.";
      }
      if(hasWord(low,W.decl) && !isHow){
        const d = reqs.filter(r=>r.status==="Declined");
        return d.length ? `Declined requisitions:<br>${d.slice(0,6).map(r=>`• ${link(r)} ${esc(r.project_name||"-")} — “${esc(r.decline_reason||"no reason given")}”`).join("<br>")}<br>Open one and press <b>Fix &amp; Resubmit in form</b>.` : "You have no declined requisitions.";
      }
      if(hasWord(low,W.projects) && /(how many|which|list|my projects|all projects)/.test(low) && !kw.length){
        const c = new Map(); reqs.forEach(r=>c.set(r.project_name||"(none)",(c.get(r.project_name||"(none)")||0)+1));
        return `Your requisitions cover ${c.size} project${c.size===1?"":"s"}:<br>` + [...c.entries()].slice(0,8).map(([k,v])=>`• ${esc(k)} (${v})`).join("<br>") + `<br>The shared list is on the <a href="projects.html">Projects</a> page.`;
      }
      if(hasWord(low,W.sum) || /status of (all|my|everything)/.test(low)){
        const c = {}; reqs.forEach(r=>c[r.status]=(c[r.status]||0)+1);
        return `You can see <b>${reqs.length}</b> requisitions:<br>` + Object.keys(c).map(k=>`• ${esc(k)}: ${c[k]}`).join("<br>");
      }
      if(hasWord(low,W.spend) && !kw.length){
        let pool = reqs, label = "";
        const now = new Date(), ym = d=>String(d||"").slice(0,7);
        const thisM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
        const lm = new Date(now.getFullYear(), now.getMonth()-1, 1), lastM = `${lm.getFullYear()}-${String(lm.getMonth()+1).padStart(2,"0")}`;
        if(/this month/.test(low)){ pool = reqs.filter(r=>ym(r.form_date)===thisM); label = " this month"; }
        else if(/last month/.test(low)){ pool = reqs.filter(r=>ym(r.form_date)===lastM); label = " last month"; }
        const sum = f => pool.filter(f).reduce((a,r)=>a+Number(r.grand_total||0),0);
        return `Requisitions${label}: ${pool.length}<br>Purchased or received: <b>${money(sum(r=>["Purchased","Received"].includes(r.status)))}</b><br>Still in approval: ${money(sum(OPEN_NOT_PURCHASED))}<br>Declined or withdrawn: ${money(sum(r=>["Declined","Withdrawn"].includes(r.status)))}`;
      }
      if(hasWord(low,W.last) && !isHow){
        return reqs.length ? `Most recent:<br>${listOf(reqs,5)}` : "There are no requisitions yet.";
      }
      // keyword search over project / location / requester / items
      const qt = toks(text);
      if(qt.length){
        const scored = reqs.map(r=>{
          const hay = [r.project_name, r.project_location, r.request_by, r.tracking_no, ...(r.requisition_items||[]).map(i=>i.name)].join(" ").toLowerCase();
          let sc = 0; (kw.length?kw:qt).forEach(t=>{ if(hay.includes(t)) sc++; });
          return {r, sc};
        }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc);
        const base = kw.length?kw:qt, need = Math.max(1, Math.ceil(base.length/2));
        const hits = scored.filter(x=>x.sc>=need).map(x=>x.r);
        if(hits.length === 1 && !faqAnswer(text)) return describe(hits[0]);
        if(hits.length && !faqAnswer(text)) return `I found ${hits.length} match${hits.length>1?"es":""}:<br>${listOf(hits)}`;
      }
    }
    const f = faqAnswer(text); if(f) return f;
    return null;
  }
  const OPEN_NOT_PURCHASED = r => ["Submitted","Manager Approved","Procurement Approved"].includes(r.status);

  // REQ numbers in an AI answer become links when we know that requisition
  const linkReqs = html => html.replace(/REQ-0*(\d{1,6})/g,(all,n)=>{
    const r = cache.data && (cache.data.requisitions||[]).find(x=>parseInt(String(x.tracking_no||"").replace(/\D/g,""),10)===parseInt(n,10));
    return r ? `<a href="view.html?id=${esc(r.id)}">${all}</a>` : all;
  });

  /* ---------------- AI fallback ---------------- */
  async function askAI(q, client){
    const id = ss.get("sl_person_id"), pin = ss.get("sl_pin");
    try{
      const {data, error} = await client.functions.invoke("assistant-ai", {body:{person_id:id, pin:pin, question:q}});
      if(error || !data) return {text:"I couldn't reach the AI helper just now. Try rephrasing with a REQ number or a keyword, or ask an admin."};
      if(data.ok) return {text:esc(data.answer).replace(/\n/g,"<br>"), ai:true, left:data.questions_left};
      const msg = {
        not_configured:"I couldn't find that in the system or the Manual. Try a REQ number (for example REQ-00031), a project name, or ask an admin.",
        off:"I couldn't find that in the system or the Manual. Try a REQ number or a project name, or ask an admin.",
        budget:"The AI helper has reached its monthly limit, so I can only answer from the built-in help and your requisitions. Try a REQ number or a project name.",
        daily:`You've used today's ${data.limit||""} AI questions. I can still answer from your requisitions and the built-in help.`,
        busy:"The AI helper is busy right now (the free service is sometimes overloaded). I can still answer from your requisitions and the built-in help — try a REQ number or a project name, or try again in a minute.",
        auth:"Please sign in again to use the assistant."
      }[data.reason];
      return {text: msg || "I'm not sure about that. Try a REQ number or ask an admin."};
    }catch(_){ return {text:"I couldn't reach the AI helper just now. Try a REQ number or ask an admin."}; }
  }

  /* ---------------- chat window ---------------- */
  const CSS = `
  .as-fab{ position:fixed; right:18px; bottom:18px; z-index:900; border:0; border-radius:999px; background:#2f6fed; color:#fff; font:inherit; font-size:13px; font-weight:700; padding:11px 18px; box-shadow:0 8px 24px rgba(15,23,42,.3); cursor:pointer; }
  .as-fab:hover{ background:#2050bd; }
  .as-panel{ position:fixed; right:18px; bottom:18px; z-index:901; width:360px; max-width:calc(100vw - 24px); height:520px; max-height:calc(100vh - 36px); background:var(--surface,#fff); color:var(--ink,#1f2933); border:1px solid var(--line,#d7dbe0); border-radius:16px; box-shadow:0 20px 60px rgba(15,23,42,.35); display:none; flex-direction:column; overflow:hidden; font-family:inherit; }
  .as-panel.open{ display:flex; }
  .as-head{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--line,#d7dbe0); }
  .as-head b{ font-size:14px; } .as-head span{ display:block; font-size:11px; color:var(--muted,#6b7280); font-weight:500; }
  .as-x{ border:0; background:none; font-size:20px; line-height:1; cursor:pointer; color:var(--muted,#6b7280); }
  .as-log{ flex:1; overflow-y:auto; padding:12px 14px; display:flex; flex-direction:column; gap:10px; }
  .as-m{ max-width:92%; padding:9px 12px; border-radius:12px; font-size:13px; line-height:1.5; word-wrap:break-word; }
  .as-m.bot{ background:#f1f4f9; align-self:flex-start; } .as-m.me{ background:#2f6fed; color:#fff; align-self:flex-end; }
  .as-m a{ color:#2050bd; font-weight:700; } .as-m.me a{ color:#fff; }
  .as-tag{ display:block; font-size:10.5px; color:var(--muted,#6b7280); margin-top:5px; }
  .as-chips{ display:flex; flex-wrap:wrap; gap:6px; padding:0 14px 8px; }
  .as-chips button{ font:inherit; font-size:12px; border:1px solid var(--line,#d7dbe0); background:var(--surface,#fff); color:var(--ink,#1f2933); border-radius:999px; padding:5px 11px; cursor:pointer; }
  .as-chips button:hover{ background:#eaf0fb; }
  .as-form{ display:flex; gap:8px; padding:10px 12px; border-top:1px solid var(--line,#d7dbe0); }
  .as-form input{ flex:1; border:1px solid var(--line,#d7dbe0); border-radius:10px; padding:9px 12px; font:inherit; font-size:13px; background:var(--surface,#fff); color:var(--ink,#1f2933); }
  .as-form button{ border:0; background:#2f6fed; color:#fff; border-radius:10px; font:inherit; font-weight:700; font-size:13px; padding:0 14px; cursor:pointer; }
  .as-form button:disabled{ opacity:.5; cursor:default; }
  @media print{ .as-fab,.as-panel{ display:none!important; } }`;

  function mount(client){
    if(document.getElementById("asFab") || !client) return;
    if(!w.supplierOf){ const sc=document.createElement("script"); sc.src="supplier.js"; document.head.appendChild(sc); }
    if(!ss.get("sl_person_id") || !ss.get("sl_pin")) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const fab = document.createElement("button"); fab.id="asFab"; fab.className="as-fab"; fab.type="button"; fab.textContent="Ask"; fab.title="Ask about the system or your requisitions";
    const panel = document.createElement("div"); panel.className="as-panel"; panel.id="asPanel"; panel.setAttribute("role","dialog"); panel.setAttribute("aria-label","Assistant");
    panel.innerHTML = `<div class="as-head"><div><b>Ask MR Tracker</b><span>Answers about the system and your requisitions</span></div><button class="as-x" type="button" aria-label="Close">×</button></div>
      <div class="as-log" id="asLog"></div>
      <div class="as-chips" id="asChips"></div>
      <form class="as-form" id="asForm"><input id="asIn" maxlength="300" autocomplete="off" placeholder="e.g. where is REQ-00031?"><button type="submit" id="asGo">Send</button></form>`;
    document.body.appendChild(fab); document.body.appendChild(panel);
    const log = panel.querySelector("#asLog"), input = panel.querySelector("#asIn"), go = panel.querySelector("#asGo");
    const tab = h=>String(h).replace(/<a href=/g,'<a target="_blank" rel="noopener" href=');
    const add = (html, who, tag)=>{ const d=document.createElement("div"); d.className="as-m "+who; d.innerHTML = tab(html) + (tag?`<span class="as-tag">${esc(tag)}</span>`:""); log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    let started = false;
    const open = ()=>{
      panel.classList.add("open"); fab.style.display="none";
      if(!started){ started = true;
        add("Hi! Ask me where a requisition is, what needs your signature, or how to do something in the system.", "bot");
        const chips = panel.querySelector("#asChips");
        ["What needs my action?","Show my declined requisitions","Give me a summary","How do I withdraw a requisition?"].forEach(t=>{
          const b=document.createElement("button"); b.type="button"; b.textContent=t; b.onclick=()=>send(t); chips.appendChild(b); });
      }
      setTimeout(()=>input.focus(),50);
    };
    const close = ()=>{ panel.classList.remove("open"); fab.style.display=""; };
    fab.onclick = open; panel.querySelector(".as-x").onclick = close;
    panel.addEventListener("keydown", e=>{ if(e.key==="Escape") close(); });
    async function send(q){
      q = (q||"").trim(); if(!q) return;
      panel.querySelector("#asChips").style.display = "none";
      add(esc(q), "me"); input.value = ""; go.disabled = true;
      const wait = add("…", "bot");
      try{
        let ans = await rules(q, client);
        if(ans){ wait.innerHTML = tab(ans); }
        else { wait.innerHTML = "Let me think…"; const r = await askAI(q, client); wait.innerHTML = tab(r.ai ? linkReqs(r.text) : r.text) + (r.ai?`<span class="as-tag">AI answer — double-check important details${typeof r.left==="number"?" · "+r.left+" AI questions left today":""}</span>`:""); }
      }catch(_){ wait.innerHTML = "Sorry, something went wrong. Please try again."; }
      go.disabled = false; log.scrollTop = log.scrollHeight; input.focus();
    }
    panel.querySelector("#asForm").addEventListener("submit", e=>{ e.preventDefault(); send(input.value); });
  }
  w.Assistant = {mount, _rules:rules, _faq:faqAnswer};
})(window);
