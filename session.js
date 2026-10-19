/* "Keep me signed in on this device": the sign-in lives in sessionStorage (one tab). If the person chose to be remembered,
   a copy is kept in localStorage for 30 days and restored into any new tab (for example when a link is opened from a chat app).
   Logging out clears both. */
(function(w){
  var KEY = "sl_remember", DAYS = 30;
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY) || "null"); }catch(_){ return null; } }
  function restore(){
    try{
      if(sessionStorage.getItem("sl_person_id")) return;
      var r = read(); if(!r) return;
      if(!r.exp || r.exp < Date.now()){ localStorage.removeItem(KEY); return; }
      sessionStorage.setItem("sl_person_id", r.id); sessionStorage.setItem("sl_person_name", r.name); sessionStorage.setItem("sl_pin", r.pin);
      if(r.admin != null) sessionStorage.setItem("sl_is_admin", r.admin ? "1" : "0");
    }catch(_){}
  }
  restore();
  w.Session = {
    remember: function(id, name, pin, admin){ try{ localStorage.setItem(KEY, JSON.stringify({id:id, name:name, pin:pin, admin:!!admin, exp: Date.now() + DAYS*86400000})); }catch(_){} },
    forget: function(){ try{ localStorage.removeItem(KEY); }catch(_){} },
    // keep the remembered copy in step with changes made while signed in (new PIN, new name, admin flag)
    sync: function(){
      try{
        var r = read(); if(!r) return;
        r.id = sessionStorage.getItem("sl_person_id") || r.id; r.name = sessionStorage.getItem("sl_person_name") || r.name; r.pin = sessionStorage.getItem("sl_pin") || r.pin;
        var a = sessionStorage.getItem("sl_is_admin"); if(a !== null) r.admin = a === "1";
        localStorage.setItem(KEY, JSON.stringify(r));
      }catch(_){}
    }
  };
})(window);

/* Simple phone view: on a phone (screen 720px or narrower) only the everyday features show — anything marked
   data-full is hidden, and desktop-only pages offer "Use full version". The choice is kept per device. */
(function(w, d){
  var KEY = "sl_ui_mode";
  function isPhone(){ return !!(w.matchMedia && w.matchMedia("(max-width:720px)").matches); }
  function wantsFull(){ try{ return localStorage.getItem(KEY) === "full"; }catch(_){ return false; } }
  function simple(){ return isPhone() && !wantsFull(); }
  function apply(){ d.documentElement.classList.toggle("ui-simple", simple()); }
  var st = d.createElement("style");
  st.textContent = "html.ui-simple [data-full]{display:none !important}";
  (d.head || d.documentElement).appendChild(st);
  apply();
  try{ w.matchMedia("(max-width:720px)").addEventListener("change", apply); }catch(_){}
  w.UIMode = {
    isPhone: isPhone, simple: simple, wantsFull: wantsFull,
    set: function(mode){ try{ if(mode === "full") localStorage.setItem(KEY, "full"); else localStorage.removeItem(KEY); }catch(_){} apply(); }
  };
})(window, document);

/* Appearance: "auto" follows the device, or the person picks light / dark (kept per device).
   Pages that opt in with <html data-theme-ok> get a dark look; the paper-style forms stay light.
   Theme.mode() -> "auto" | "light" | "dark";  Theme.set(mode);  html.dark is set while dark is showing. */
(function(w, d){
  var KEY = "sl_theme", mq = w.matchMedia ? w.matchMedia("(prefers-color-scheme: dark)") : null;
  function mode(){ try{ var m = localStorage.getItem(KEY); return m === "light" || m === "dark" ? m : "auto"; }catch(_){ return "auto"; } }
  function isDark(){ var m = mode(); return m === "dark" || (m === "auto" && !!(mq && mq.matches)); }
  function apply(){ d.documentElement.classList.toggle("dark", isDark()); }
  var st = d.createElement("style");
  // dark = invert the page and turn the hues back, then put pictures right again (works for every colour on the page)
  st.textContent = "html.dark[data-theme-ok]{filter:invert(1) hue-rotate(180deg) brightness(.94) contrast(.92);background:#eef1f6}" +
    "@media print{html.dark[data-theme-ok]{filter:none !important;background:#fff !important}html.dark[data-theme-ok] img,html.dark[data-theme-ok] canvas{filter:none !important}}" +
    "html.dark[data-theme-ok] img, html.dark[data-theme-ok] video, html.dark[data-theme-ok] canvas, html.dark[data-theme-ok] .keep-colors{filter:invert(1) hue-rotate(180deg)}";
  (d.head || d.documentElement).appendChild(st);
  apply();
  try{ mq && mq.addEventListener("change", apply); }catch(_){}
  w.Theme = { mode: mode, isDark: isDark, set: function(m){ try{ if(m === "light" || m === "dark") localStorage.setItem(KEY, m); else localStorage.removeItem(KEY); }catch(_){} apply(); } };
})(window, document);

/* Export option: include the "Received by" line in the PDF / CSV? (a checkbox next to the export buttons; kept per device) */
(function(w, d){
  var KEY = "sl_export_recv";
  function show(){ try{ return localStorage.getItem(KEY) !== "0"; }catch(_){ return true; } }
  function paint(){ var l = d.querySelectorAll(".inc-recv"); for(var i=0;i<l.length;i++) l[i].checked = show(); }
  d.addEventListener("change", function(e){ var t = e.target; if(t && t.classList && t.classList.contains("inc-recv")){ try{ localStorage.setItem(KEY, t.checked ? "1" : "0"); }catch(_){} paint(); } });
  d.addEventListener("DOMContentLoaded", paint);
  w.ExportOpts = { showReceived: show, paint: paint };
})(window, document);
