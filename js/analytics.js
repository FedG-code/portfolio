// Lightweight GA4 custom event layer.
// Pairs with the gtag(...) loader in each page's <head>.
// All listeners are delegated on `document` so this file never has to touch
// plane.js, shared.js, or page-transition.js.
(function () {
  if (typeof gtag !== 'function') return;

  // 1. Plane mode toggle. The state read is deferred so plane.js's own click
  //    handler runs first and flips the `plane-active` class on <html>.
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.toolbar .plane-btn')) return;
    setTimeout(function () {
      var on = document.documentElement.classList.contains('plane-active');
      gtag('event', 'plane_mode_toggle', { state: on ? 'on' : 'off' });
    }, 0);
  });

  // 2. Theme switch. Same deferral so we read the theme after shared.js sets it.
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.toolbar .swatch-btn')) return;
    setTimeout(function () {
      var theme = document.documentElement.getAttribute('data-theme') || 'unknown';
      gtag('event', 'theme_change', { theme: theme });
    }, 0);
  });

  // 3. Mailto links: "Email me" + "Request Access". Subject param encodes
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

  // 4. Explicit named events for GitHub/LinkedIn (on top of GA4 Enhanced
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

  // 5. SPA navigation. page-transition.js calls history.pushState during
  //    navigateToPage() (card play). Patch pushState so we don't have to edit
  //    that file. Fires a virtual page_view + a card_play event.
  var origPush = history.pushState;
  history.pushState = function (state, title, url) {
    var ret = origPush.apply(this, arguments);
    if (url) {
      gtag('event', 'page_view', {
        page_location: window.location.origin + url,
        page_path: url
      });
      gtag('event', 'card_play', { destination: url });
    }
    return ret;
  };
  window.addEventListener('popstate', function () {
    gtag('event', 'page_view', {
      page_location: window.location.href,
      page_path: window.location.pathname
    });
  });

  // 6. Scroll depth at 25/50/75 (GA4 Enhanced Measurement only fires at 90).
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
