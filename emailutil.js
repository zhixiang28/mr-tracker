/* Company email helpers: people only type the first part, "@spacelogic.com.sg" is added for them. */
(function(w){
  const DOMAIN = "@spacelogic.com.sg";
  w.normEmail = function(v){ v = String(v||"").trim().replace(/\s+/g,""); if(!v) return ""; return v.indexOf("@")>=0 ? v : v + DOMAIN; };
  // makes the given inputs accept just the part before the @ and shows the full address once the person leaves the box
  w.attachEmailFields = function(ids){
    ids.forEach(function(id){
      var el = document.getElementById(id); if(!el) return;
      el.type = "text"; el.setAttribute("inputmode","email"); el.setAttribute("autocapitalize","off"); el.setAttribute("autocorrect","off"); el.setAttribute("spellcheck","false");
      el.placeholder = "Your email (before the @)";
      var note = document.createElement("div");
      note.style.cssText = "font-size:12px;line-height:1.45;color:#6b7280;margin:6px 0 14px";
      note.textContent = "Just type the first part — " + DOMAIN + " is added for you.";
      el.insertAdjacentElement("afterend", note);
      el.addEventListener("blur", function(){ var n = w.normEmail(el.value); if(n) el.value = n; });
    });
  };
})(window);
