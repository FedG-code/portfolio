// Lightweight GA4 custom event layer.
// Pairs with the gtag(...) loader in each page's <head>.
// All listeners are delegated on `document` so this file never has to touch
// gallery.js or shared.js.
(function () {
  if (typeof gtag !== 'function') return;

  // 1. Gallery: Open case study (bubble button or plain-list preview link).
  document.addEventListener('click', function (e) {
    var link = e.target.closest('.openb, .pv-open');
    if (link) gtag('event', 'case_open', { destination: link.getAttribute('href') });
  });

  // 2. Mailto links: "Email me" + "Request Access". Subject param encodes
  //    which project the request is for, so each one becomes queryable.
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="mailto:"]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    var subjectMatch = href.match(/[?&]subject=([^&]+)/);
    var subject = subjectMatch ? decodeURIComponent(subjectMatch[1]) : '';
    var isRequest = subject.toLowerCase().indexOf('source code request') !== -1;
    gtag('event', 'email_click', {
      type: isRequest ? 'source_request' : 'contact',
      subject: subject || '(none)',
      label: link.textContent.trim()
    });
  });

  // 3. Explicit named events for GitHub/LinkedIn (on top of GA4 Enhanced
  //    Measurement's auto outbound tracking) for cleaner reports.
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    var network = null;
    if (href.indexOf('linkedin.com') !== -1) network = 'linkedin';
    else if (href.indexOf('github.com') !== -1) network = 'github';
    if (network) {
      gtag('event', 'social_click', { network: network, url: href });
    }
  });

  // 4. Scroll depth at 25/50/75 (GA4 Enhanced Measurement only fires at 90).
  var fired = {};
  function onScroll() {
    var h = document.documentElement;
    var pct = (h.scrollTop + window.innerHeight) / h.scrollHeight * 100;
    [25, 50, 75].forEach(function (t) {
      if (!fired[t] && pct >= t) {
        fired[t] = true;
        gtag('event', 'scroll_depth', { percent: t });
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
})();
