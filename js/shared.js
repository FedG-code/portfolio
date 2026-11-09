// Project pages (casino_games.html, eve_of_destruction.html, my_games.html).
// One identity now: the theme switcher is retired and every page is fixed to data-theme="bold".
(function () {
  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry, i) {
      if (entry.isIntersecting) {
        setTimeout(function () { entry.target.classList.add('visible'); }, i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  window.revealObserver = observer;
  reveals.forEach(function (el) { observer.observe(el); });

  // Arriving from the gallery's Open (js/gallery.js sets 'dolly-return'): focus moves to the case title.
  var from = null;
  try { from = sessionStorage.getItem('dolly-return'); } catch (e) {}
  var title = document.querySelector('.project-hero-title');
  if (from && title) {
    title.classList.add('visible');
    title.focus({ preventScroll: true });
  }

  // Clips: muted mp4 loops (converted from the old GIFs). Each loads only when it nears the viewport,
  // plays while visible and pauses when it leaves. With reduced motion they stay on the poster frame
  // and get controls, so playing one is the visitor's choice.
  var vids = [].slice.call(document.querySelectorAll('video[data-src]'));
  function load(v) {
    if (v.getAttribute('src')) return;
    v.src = v.getAttribute('data-src');
    v.preload = 'auto';
  }
  if (RM) {
    vids.forEach(function (v) {
      v.controls = true;
      // preload stays 'none': nothing downloads until the visitor presses play.
      v.src = v.getAttribute('data-src');
    });
    return;
  }
  var vo = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        load(v);
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { rootMargin: '200px 0px' });
  vids.forEach(function (v) { vo.observe(v); });
})();
