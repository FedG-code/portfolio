// Paper plane: off by default, switched on and off with the P key (user, 2026-11-09: "pressing p for now").
// Nothing loads until P is pressed: then GSAP + SplitText + Physics2DPlugin, destruction.js and plane.js
// are fetched in order and PaperPlane.toggle() turns it on. While it's on, moving to another page keeps it
// on (plane.js keeps sessionStorage 'portfolio-plane'); a reload turns it off.
// Note: plane.js draws in its own WebGL canvas, so with the plane on the homepage runs two contexts.
(function () {
  var KEY = 'portfolio-plane';
  var SRC = [
    'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js',
    'https://cdn.jsdelivr.net/npm/gsap@3/dist/SplitText.min.js',
    'https://cdn.jsdelivr.net/npm/gsap@3/dist/Physics2DPlugin.min.js',
    'js/destruction.js',
    'js/plane.js'
  ];
  var loading = null;

  function load() {
    if (loading) return loading;
    if (!document.getElementById('plane-canvas')) {
      var c = document.createElement('div');
      c.id = 'plane-canvas';
      c.setAttribute('aria-hidden', 'true');
      document.body.appendChild(c);
    }
    loading = SRC.reduce(function (chain, src) {
      return chain.then(function () {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = src; s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
    loading.catch(function (e) { loading = null; if (window.console) console.warn('Paper plane failed to load', e); });
    return loading;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'p' && e.key !== 'P') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    load().then(function () { if (window.PaperPlane) window.PaperPlane.toggle(); });
  });

  // Carried over from the previous page (not on reload: plane.js clears it then)
  var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  var on = null;
  try { on = sessionStorage.getItem(KEY); } catch (_) {}
  if (on === 'on' && !(nav && nav.type === 'reload')) load();
})();
