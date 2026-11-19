/* =========================================================================
   boot.js: runs before the page paints.
   Marks scripts as available and applies saved reading-comfort settings, so
   the theme never flashes the wrong way. Kept tiny on purpose; the rest of
   the toolkit lives in app.js.
   ========================================================================= */
(function () {
  var d = document.documentElement;
  d.className = d.className.replace("no-js", "js");
  var s = {};
  try { s = JSON.parse(localStorage.getItem("aice:settings") || "{}") || {}; } catch (e) { s = {}; }
  if (s.theme === "light" || s.theme === "dark") d.setAttribute("data-theme", s.theme);
  var dark = s.theme === "dark" || (s.theme !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  d.setAttribute("data-resolved-theme", dark ? "dark" : "light");
  if (s.text) d.setAttribute("data-text", s.text);
  if (s.space) d.setAttribute("data-space", s.space);
  if (s.motion) d.setAttribute("data-motion", "reduce");
  if (s.transparency) d.setAttribute("data-transparency", "reduce");
  if (s.simple) d.setAttribute("data-simple", "on");
  d.setAttribute("data-over-hero", "");
})();
