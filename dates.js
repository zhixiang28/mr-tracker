// Shared date helpers: every date shown or typed in the tracker uses dd/mm/yyyy.
// Dates are still stored and sent to the database as ISO (yyyy-mm-dd).
(function(w){
  const p2 = n => String(n).padStart(2,"0");
  // "2026-07-10" or a timestamp -> "10/07/2026"
  w.fmtDMY = function(v){
    if(!v) return "";
    const s = String(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(s);
    if(isNaN(d)) return s;
    return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}`;
  };
  // timestamp -> "10/07/2026 14:05" (24-hour, local time)
  w.fmtDateTime = function(v){
    if(!v) return "";
    const d = new Date(v);
    if(isNaN(d)) return "";
    return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };
  // "10/07/2026" (or 10-07-2026, 10.07.2026) -> "2026-07-10"; "" for blank; null if it isn't a real date
  w.parseDMY = function(str){
    const t = String(str||"").trim();
    if(!t) return "";
    const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if(!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3];
    const dt = new Date(y, mo-1, d);
    if(dt.getFullYear()!==y || dt.getMonth()!==mo-1 || dt.getDate()!==d) return null;
    return `${y}-${p2(mo)}-${p2(d)}`;
  };
})(window);
