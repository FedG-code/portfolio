/* ═══════════════════════════════════════════════
   PAGE TRANSITION — Dynamic fetch, play animation,
   clone+fly, page fade-in, hand rebuild
   ═══════════════════════════════════════════════ */

var DECOMPOSE_DURATION = 0.1;
var FLY_DURATION = 0.5;

/* ═══════════════════════════════════════════════
   DYNAMIC FETCH + CACHE
   ═══════════════════════════════════════════════ */
var pageCache = {};

function prefetchPage(url) {
  if (!url || pageCache[url]) return;
  pageCache[url] = fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('Fetch failed: ' + r.status);
      return r.text();
    })
    .then(function(html) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      return extractPageContent(doc);
    })
    .catch(function(err) {
      console.error('Page fetch error:', err);
      delete pageCache[url];
      return null;
    });
}
window.prefetchPage = prefetchPage;

function extractPageContent(doc) {
  var body = doc.body;
  var clone = body.cloneNode(true);

  var removeSelectors = [
    'nav', '.theme-switcher', 'footer', 'script',
    '#plane-canvas', '.blur-overlay', '.project-nav',
    '#handContainer', '#dragBlurOverlay', '#pageContainer',
    '#perspectiveContainer', '#flyOverlay'
  ];
  removeSelectors.forEach(function(sel) {
    clone.querySelectorAll(sel).forEach(function(el) { el.remove(); });
  });

  return clone.innerHTML;
}

/* ═══════════════════════════════════════════════
   SPA BOOTSTRAP — project page reload support
   ═══════════════════════════════════════════════ */
var spaBootstrapReady = null; // null = not needed, Promise = pending/done

function bootstrapFromProjectPage() {
  if (document.getElementById('page-home')) return; // already on index.html

  var pageContainer = document.getElementById('pageContainer');
  if (!pageContainer) return;

  // Snapshot current project content for the page cache before rearranging DOM
  var currentUrl = location.pathname.split('/').pop();
  if (currentUrl) {
    var tempDoc = document.cloneNode(true);
    var cachedContent = extractPageContent(tempDoc);
    pageCache[currentUrl] = Promise.resolve(cachedContent);
  }

  // Collect project content nodes (everything that isn't SPA infrastructure)
  var infraIds = ['plane-canvas', 'dragBlurOverlay', 'pageContainer',
                  'handContainer', 'perspectiveContainer', 'flyOverlay',
                  'themeSwitcher', 'statusBar'];
  var body = document.body;
  var nodesToMove = [];

  for (var i = 0; i < body.children.length; i++) {
    var child = body.children[i];
    if (child.tagName === 'SCRIPT') continue;
    if (child.id && infraIds.indexOf(child.id) !== -1) continue;
    if (child.tagName === 'BUTTON' && (child.classList.contains('theme-switcher') || child.classList.contains('plane-toggle'))) continue;
    nodesToMove.push(child);
  }

  // Wrap project content and move into pageContainer
  var wrapper = document.createElement('div');
  wrapper.className = 'spa-page active';
  nodesToMove.forEach(function(node) { wrapper.appendChild(node); });

  pageContainer.innerHTML = '';
  pageContainer.appendChild(wrapper);
  pageContainer.style.opacity = '1';
  pageContainer.style.pointerEvents = 'auto';

  // Fetch index.html to get #page-home
  spaBootstrapReady = fetch('index.html')
    .then(function(r) {
      if (!r.ok) throw new Error('Fetch failed: ' + r.status);
      return r.text();
    })
    .then(function(html) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      // Extract and inject #page-home (hidden)
      var homePage = doc.getElementById('page-home');
      if (!homePage) throw new Error('No #page-home in index.html');
      homePage.classList.remove('active');
      body.insertBefore(homePage, pageContainer);

      // Grab status bar if present
      var statusBar = doc.getElementById('statusBar');
      if (statusBar && !document.getElementById('statusBar')) {
        body.insertBefore(statusBar, homePage);
      }

      // Re-init text destruction for newly-injected home content
      if (window.TextDestruction && TextDestruction.onThemeChange) {
        TextDestruction.onThemeChange();
      }

      // Prefetch other project pages
      CARDS.forEach(function(c) {
        if (c.pageUrl && c.pageUrl !== currentUrl) {
          prefetchPage(c.pageUrl);
        }
      });

      return true;
    })
    .catch(function(err) {
      console.error('SPA bootstrap failed:', err);
      spaBootstrapReady = null;
      return false;
    });
}

/* ═══════════════════════════════════════════════
   PLAY CARD ANIMATION (center -> wriggle -> expand)
   ═══════════════════════════════════════════════ */
function playCard(cardEl, cardId) {
  var cardData = CARDS[cardId];
  var cardRect = cardEl.getBoundingClientRect();

  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var expandScale = Math.min(vw / CARD_W, vh / CARD_H);

  var currentProximity = calcProximity(cardEl);
  var startBlur = currentProximity * MAX_BLUR;
  var startOverlay = currentProximity * MAX_OVERLAY_OPACITY;
  var startGlow = currentProximity * MAX_GLOW_SIZE;
  var endBlur = MAX_BLUR + 8;
  var endOverlay = MAX_OVERLAY_OPACITY + 0.25;
  var endGlow = MAX_GLOW_SIZE + 40;

  dragBlurOverlay.style.transition = 'none';
  handContainer.style.pointerEvents = 'none';

  // Reparent card to perspective container (fixed positioning)
  var cardLeft = cardRect.left;
  var cardTop = cardRect.top;
  perspectiveContainer.appendChild(cardEl);
  gsap.set(cardEl, { clearProps: 'transform' });
  cardEl.style.transformOrigin = 'center center';
  gsap.set(cardEl, { x: cardLeft, y: cardTop, rotation: 0, scale: 1 });
  cardEl.style.transition = 'none';
  cardEl.style.zIndex = 200;

  var inner = cardEl.querySelector('.card-inner');

  // Center position (viewport-relative since using fixed positioning)
  var centerX = (vw - CARD_W) / 2;
  var centerY = (vh - CARD_H) / 2;

  // Slide other cards down
  handContainer.querySelectorAll('.card').forEach(function(c) {
    if (c === cardEl) return;
    gsap.to(c, { y: '+=200', opacity: 0, duration: 0.4, ease: 'power2.out' });
  });

  // Fade out current page
  var currentPage = document.querySelector('.spa-page.active');
  if (currentPage) {
    gsap.to(currentPage, { opacity: 0, duration: 0.3, ease: 'power2.out' });
  }
  // Also fade out page container content
  var pageContainer = document.getElementById('pageContainer');
  if (pageContainer.innerHTML) {
    gsap.to(pageContainer, { opacity: 0, duration: 0.3, ease: 'power2.out' });
  }

  var tl = gsap.timeline();

  // Phase 1: Center (0->500ms)
  tl.to(cardEl, {
    x: centerX, y: centerY, rotation: 0,
    duration: 0.5, ease: 'power3.out',
  });

  // Phase 2: Wriggle (500ms->1500ms)
  var WRIGGLE_DURATION = 1.0;
  var wriggleState = { progress: 0 };
  tl.to(wriggleState, {
    progress: 1, duration: WRIGGLE_DURATION, ease: 'power2.in',
    onUpdate: function() {
      var p = wriggleState.progress;
      var amplitude = p * 8;
      var frequency = 3 + p * 7;
      var time = this.time();
      var wobble = Math.sin(time * frequency) * amplitude;
      var jitterY = Math.sin(time * frequency * 1.3) * p * 2.5;
      var jitterX = Math.cos(time * frequency * 0.9) * p * 1.2;
      gsap.set(cardEl, { x: centerX + jitterX, y: centerY + jitterY, rotation: wobble });
      var blurVal = startBlur + p * (endBlur - startBlur);
      var overlayVal = startOverlay + p * (endOverlay - startOverlay);
      dragBlurOverlay.style.backdropFilter = 'blur(' + blurVal + 'px)';
      dragBlurOverlay.style.webkitBackdropFilter = 'blur(' + blurVal + 'px)';
      dragBlurOverlay.style.background = 'rgba(0,0,0,' + overlayVal + ')';
      var glowSize = startGlow + p * (endGlow - startGlow);
      var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      inner.style.boxShadow = '0 0 ' + glowSize + 'px ' + accent;
      inner.style.borderColor = accent;
    }
  });

  // Phase 3: Expand to fill viewport (1500ms->2000ms)
  tl.to(cardEl, {
    scale: expandScale, rotation: 0, x: centerX, y: centerY,
    duration: 0.5, ease: 'power3.out',
  });
  tl.to(inner, { boxShadow: '0 0 0px transparent', duration: 0.15 }, '-=0.3');
  tl.to(dragBlurOverlay, {
    backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)', background: 'rgba(0,0,0,0)', duration: 0.2,
  }, '-=0.25');

  // Phase 4: Decompose — fade decorative elements (guarded for Home card)
  var decomposeEls = [
    cardEl.querySelector('.type-bar'),
    cardEl.querySelector('.card-textbox'),
    cardEl.querySelector('.accent-strip'),
  ].filter(Boolean);

  if (decomposeEls.length) {
    tl.to(decomposeEls, { opacity: 0, duration: 0.15, ease: 'power1.out' });
    tl.to(inner, { borderColor: 'transparent', duration: 0.15, ease: 'power1.out' }, '<');
  } else {
    tl.to(inner, { borderColor: 'transparent', duration: 0.15, ease: 'power1.out' });
  }

  // Phase 5: Brief pause
  tl.to({}, { duration: 0.2 });

  // Phase 6: Begin page transition
  tl.call(function() {
    beginPageTransition(cardEl, cardId, cardData);
  });
}

/* ═══════════════════════════════════════════════
   PAGE TRANSITION (fly title/art -> page fade-in)
   ═══════════════════════════════════════════════ */
function beginPageTransition(cardEl, cardId, cardData) {
  animState = 'TRANSITIONING';

  var isHome = cardData.pageUrl === null;
  var pageContainer = document.getElementById('pageContainer');

  // On standalone project pages (no #page-home), wait for bootstrap or fall back
  if (!document.getElementById('page-home')) {
    if (spaBootstrapReady) {
      spaBootstrapReady.then(function(ok) {
        if (ok && document.getElementById('page-home')) {
          beginPageTransition(cardEl, cardId, cardData);
        } else {
          window.location.href = isHome ? 'index.html' : cardData.pageUrl;
        }
      });
      return;
    }
    window.location.href = isHome ? 'index.html' : cardData.pageUrl;
    return;
  }

  // Step 1: Measure card element positions at current scale
  var titleEl = cardEl.querySelector('.card-title h3') || cardEl.querySelector('.card-art-title');
  var artEl = cardEl.querySelector('.card-art-inner');
  var titleRect = titleEl ? titleEl.getBoundingClientRect() : null;
  var artRect = artEl.getBoundingClientRect();

  // Compute scale factor for title (visual size / natural size)
  var titleScale = 1;
  if (titleEl) {
    var naturalH = titleEl.offsetHeight;
    titleScale = naturalH > 0 ? titleRect.height / naturalH : 1;
  }

  // Step 2: Reparent real elements into fly overlay (no clones)
  // Reparent artEl first (for Home card, titleEl is a child of artEl)
  artEl.parentNode.removeChild(artEl);
  applyArtCloneStyles(artEl, artRect);
  flyOverlay.appendChild(artEl);

  // Pull titleEl out of artEl if nested (Home card), otherwise reparent independently
  if (titleEl) {
    // Capture computed font BEFORE reparenting — the h3 inside .card-title loses
    // ancestor-dependent CSS rules (e.g. `.card-title h3`, `[data-theme] .card-title h3`)
    // once removed from its parent.
    var titleCS = getComputedStyle(titleEl);
    var titleFont = {
      fontFamily:    titleCS.fontFamily,
      fontWeight:    titleCS.fontWeight,
      fontStyle:     titleCS.fontStyle,
      fontSize:      titleCS.fontSize,
      letterSpacing: titleCS.letterSpacing,
      textTransform: titleCS.textTransform,
      color:         titleCS.color,
      lineHeight:    titleCS.lineHeight,
      textAlign:     titleCS.textAlign,
    };

    titleEl.parentNode.removeChild(titleEl);
    titleEl.style.position = 'fixed';
    titleEl.style.left = titleRect.left + 'px';
    titleEl.style.top = titleRect.top + 'px';
    titleEl.style.width = (titleRect.width / titleScale) + 'px';
    titleEl.style.margin = '0';
    titleEl.style.transformOrigin = 'top left';
    titleEl.style.transform = 'scale(' + titleScale + ')';
    titleEl.style.zIndex = '501';
    titleEl.style.pointerEvents = 'none';
    titleEl.style.fontFamily    = titleFont.fontFamily;
    titleEl.style.fontWeight    = titleFont.fontWeight;
    titleEl.style.fontStyle     = titleFont.fontStyle;
    titleEl.style.letterSpacing = titleFont.letterSpacing;
    titleEl.style.textTransform = titleFont.textTransform;
    titleEl.style.color         = titleFont.color;
    titleEl.style.lineHeight    = titleFont.lineHeight;
    titleEl.style.fontSize      = titleFont.fontSize;
    titleEl.style.textAlign     = titleFont.textAlign;
    flyOverlay.appendChild(titleEl);
  }

  // Hide card shell (now empty of title + art)
  cardEl.style.opacity = '0';
  requestAnimationFrame(function() {
    cardEl.remove();
    perspectiveContainer.innerHTML = '';
  });

  if (isHome) {
    transitionToHome(cardEl, cardId, cardData, titleEl, artEl, titleRect, artRect, pageContainer, titleScale);
  } else {
    transitionToProject(cardEl, cardId, cardData, titleEl, artEl, titleRect, artRect, pageContainer, titleScale);
  }
}

function transitionToHome(cardEl, cardId, cardData, titleEl, artEl, titleRect, artRect, pageContainer, titleScale) {
  var targetPage = document.getElementById('page-home');

  // Make target page measurable
  targetPage.classList.add('measuring');
  targetPage.scrollTop = 0;

  // Find the visible hero h1 — themes use alternate layouts (.hero-default vs
  // .hero-brutalist) so querySelector('.hero h1') may return a hidden element.
  var heroH1s = targetPage.querySelectorAll('.hero h1');
  var targetTitle = null;
  for (var i = 0; i < heroH1s.length; i++) {
    if (heroH1s[i].offsetHeight > 0) { targetTitle = heroH1s[i]; break; }
  }
  if (!targetTitle && heroH1s.length) targetTitle = heroH1s[0];

  // Pin all hero animated elements: disable fadeUp animations so they sit at
  // final positions (otherwise they replay opacity:0 + translateY(24px) → visible)
  var heroAnimated = targetPage.querySelectorAll('.hero h1, .hero-badge, .hero-body');
  heroAnimated.forEach(function(el) {
    el.style.animation = 'none';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  // Remove .reveal so measurement isn't offset by translateY(24px)
  if (targetTitle) targetTitle.classList.remove('reveal');

  var targetTitleRect = targetTitle ? targetTitle.getBoundingClientRect() : null;
  var targetTypo = targetTitle ? getTargetTypography(targetTitle) : null;

  // titleEl and artEl are already reparented in flyOverlay (from beginPageTransition)

  // Clear project page content
  pageContainer.innerHTML = '';
  pageContainer.style.opacity = '';
  pageContainer.style.pointerEvents = '';

  // Revert destruction split on title so TextRearrange gets clean text
  if (window.TextDestruction && titleEl) {
    TextDestruction.revertElement(titleEl);
  }

  // Remove title's scale transform — set font-size to visual size instead
  // so chars measure at correct screen coordinates
  if (titleEl) {
    var cs = getComputedStyle(titleEl);
    var computedFS = parseFloat(cs.fontSize);
    var computedLH = parseFloat(cs.lineHeight) || computedFS * 1.2;
    titleEl.style.transform = '';
    titleEl.style.fontSize = (computedFS * titleScale) + 'px';
    titleEl.style.lineHeight = (computedLH * titleScale) + 'px';
    titleEl.style.width = titleRect.width + 'px';
  }

  var rearrangeResult = null;
  if (titleEl && targetTitle) {
    try {
      rearrangeResult = TextRearrange.fly({
        sourceEl: titleEl,
        targetEl: targetTitle,
        overlay: flyOverlay,
      });
    } catch (e) {
      console.warn('TextRearrange failed:', e);
    }
  }

  // Remove .measuring AFTER fly() has measured the target — removing it
  // earlier causes .spa-page { display:none }, zeroing all getBoundingClientRect calls.
  targetPage.classList.remove('measuring');

  var flyTl = gsap.timeline();

  if (rearrangeResult) {
    flyTl.add(rearrangeResult.timeline, 0);
  } else if (titleEl && targetTitleRect && targetTypo) {
    // Fallback: tween whole titleEl to target
    titleEl.style.fontFamily    = targetTypo.fontFamily;
    titleEl.style.fontStyle     = targetTypo.fontStyle;
    titleEl.style.textTransform = targetTypo.textTransform;

    flyTl.to(titleEl, {
      left:          targetTitleRect.left,
      top:           targetTitleRect.top,
      width:         targetTitleRect.width,
      height:        targetTitleRect.height,
      fontSize:      targetTypo.fontSize,
      lineHeight:    targetTypo.lineHeight || undefined,
      fontWeight:    targetTypo.fontWeight,
      letterSpacing: targetTypo.letterSpacing,
      color:         targetTypo.color,
      duration:      FLY_DURATION,
      ease:          'power3.out',
    });
  }

  // Fade out art (no image target on home)
  flyTl.to(artEl, {
    opacity: 0, duration: 0.3, ease: 'power2.out',
  }, titleEl ? '<' : '>');

  // Page fade-in
  flyTl.call(function() {
    document.querySelectorAll('.spa-page.active').forEach(function(p) {
      p.classList.remove('active');
      p.classList.remove('transitioning');
    });
    targetPage.style.opacity = '0';
    targetPage.classList.add('active');
    targetPage.classList.add('transitioning');
    if (targetTitle) targetTitle.style.opacity = '0';
  }, [], '-=0.35');

  flyTl.to(targetPage, {
    opacity: 1, duration: 0.4, ease: 'power2.out',
  }, '-=0.25');

  // Cleanup + rebuild hand
  flyTl.call(function() {
    // Re-init text destruction BEFORE revealing the title — splits the
    // target h1 into destruct-char spans so positions match the fly targets.
    // Moving this after opacity='1' caused a visible 15px jump on the fullstop.
    if (window.TextDestruction) {
      TextDestruction.onThemeChange();
    }

    if (targetTitle) targetTitle.style.opacity = '1';
    if (rearrangeResult) rearrangeResult.destroy();
    flyOverlay.innerHTML = '';
    targetPage.classList.remove('transitioning');
    window.scrollTo(0, 0);

    // Re-observe reveals (don't reset already-visible ones — avoids snap-to-invisible)
    var newReveals = targetPage.querySelectorAll('.reveal');
    newReveals.forEach(function(el) {
      if (!el.classList.contains('visible')) {
        if (window.revealObserver) window.revealObserver.observe(el);
      }
    });

    rebuildHand(cardId);
    history.pushState({ cardId: cardId }, '', 'index.html');
  });
}

function transitionToProject(cardEl, cardId, cardData, titleEl, artEl, titleRect, artRect, pageContainer, titleScale) {

  // Ensure fetch is started
  if (!pageCache[cardData.pageUrl]) {
    prefetchPage(cardData.pageUrl);
  }

  // Wait for content
  pageCache[cardData.pageUrl].then(function(content) {
    if (!content) {
      // Fetch failed — restore UI so the user isn't stuck
      console.error('Failed to load page:', cardData.pageUrl);
      flyOverlay.innerHTML = '';
      dragBlurOverlay.style.backdropFilter = '';
      dragBlurOverlay.style.webkitBackdropFilter = '';
      dragBlurOverlay.style.background = '';
      // Re-show the home page if it was faded
      var homePage = document.getElementById('page-home');
      if (homePage) {
        homePage.classList.add('active');
        homePage.style.opacity = '';
      }
      pageContainer.style.opacity = '';
      rebuildHand(null);
      return;
    }

    // Inject content into wrapper directly (avoid double innerHTML round-trip)
    var wrapper = document.createElement('div');
    wrapper.className = 'spa-page measuring';
    wrapper.innerHTML = content;
    pageContainer.className = 'page-container';
    pageContainer.style.opacity = '0';
    pageContainer.innerHTML = '';
    pageContainer.appendChild(wrapper);
    pageContainer.style.pointerEvents = 'auto';

    // Wait one frame for layout, then wait for fonts (injecting content may trigger new loads)
    requestAnimationFrame(function() {
      var fontWait = document.fonts ? document.fonts.ready : Promise.resolve();
      fontWait.then(function() {
      var targetTitle = wrapper.querySelector('.project-hero-title');
      var targetImage = wrapper.querySelector('.work-image');

      // Remove .reveal so measurement isn't offset by translateY(24px)
      // and title stays pinned after clone lands (no slide-up re-animation)
      if (targetTitle) targetTitle.classList.remove('reveal');

      // Also neutralize .reveal on the image's ancestor so the image is
      // instantly visible at handoff — prevents the ~0.6s gap where the
      // clone is gone but the .reveal parent is still opacity:0.
      if (targetImage) {
        var imgRevealParent = targetImage.closest('.reveal');
        if (imgRevealParent) imgRevealParent.classList.remove('reveal');
      }

      // Reset both window and container scroll before measuring so
      // getBoundingClientRect returns coordinates at the top of the page.
      // Safe because the home page is already faded to opacity 0 by now.
      window.scrollTo(0, 0);
      pageContainer.scrollTop = 0;

      var targetTitleRect = targetTitle ? targetTitle.getBoundingClientRect() : null;
      var targetImageRect = targetImage ? targetImage.getBoundingClientRect() : null;
      var targetTypo = targetTitle ? getTargetTypography(targetTitle) : null;

      // Hide real title so it doesn't show through when wrapper fades in
      if (targetTitle) targetTitle.style.opacity = '0';

      // titleEl and artEl are already reparented in flyOverlay (from beginPageTransition)

      // Revert destruction split on title so TextRearrange gets clean text
      if (window.TextDestruction && titleEl) {
        TextDestruction.revertElement(titleEl);
      }

      // Remove title's scale transform — set font-size to visual size instead
      if (titleEl) {
        var cs = getComputedStyle(titleEl);
        var computedFS = parseFloat(cs.fontSize);
        var computedLH = parseFloat(cs.lineHeight) || computedFS * 1.2;
        titleEl.style.transform = '';
        titleEl.style.fontSize = (computedFS * titleScale) + 'px';
        titleEl.style.lineHeight = (computedLH * titleScale) + 'px';
        titleEl.style.width = titleRect.width + 'px';
      }

      var rearrangeResult = null;
      if (titleEl && targetTitle) {
        try {
          rearrangeResult = TextRearrange.fly({
            sourceEl: titleEl,
            targetEl: targetTitle,
            overlay: flyOverlay,
          });
        } catch (e) {
          console.warn('TextRearrange failed:', e);
        }
      }

      // Remove .measuring AFTER fly() has measured the target — removing it
      // earlier causes .spa-page { display:none }, zeroing all getBoundingClientRect calls.
      wrapper.classList.remove('measuring');

      var flyTl = gsap.timeline();

      // Fly title
      if (rearrangeResult) {
        flyTl.add(rearrangeResult.timeline, 0);
      } else if (titleEl && targetTitleRect && targetTypo) {
        // Fallback: tween whole titleEl to target
        titleEl.style.fontFamily    = targetTypo.fontFamily;
        titleEl.style.fontStyle     = targetTypo.fontStyle;
        titleEl.style.textTransform = targetTypo.textTransform;

        flyTl.to(titleEl, {
          left:          targetTitleRect.left,
          top:           targetTitleRect.top,
          width:         targetTitleRect.width,
          height:        targetTitleRect.height,
          fontSize:      targetTypo.fontSize,
          lineHeight:    targetTypo.lineHeight || undefined,
          fontWeight:    targetTypo.fontWeight,
          letterSpacing: targetTypo.letterSpacing,
          color:         targetTypo.color,
          duration:      FLY_DURATION,
          ease:          'power3.out',
        });
      }

      // Fly art to first image
      if (targetImageRect) {
        flyTl.to(artEl, {
          left: targetImageRect.left,
          top: targetImageRect.top,
          width: targetImageRect.width,
          height: targetImageRect.height,
          duration: FLY_DURATION,
          ease: 'power3.out',
        }, '<');
      } else {
        flyTl.to(artEl, {
          opacity: 0, duration: 0.3, ease: 'power2.out',
        }, '<');
      }

      // Page fade-in
      flyTl.call(function() {
        // Hide home page
        var homePage = document.getElementById('page-home');
        if (homePage) {
          homePage.classList.remove('active');
          homePage.classList.remove('transitioning');
          homePage.style.opacity = '';
        }

        wrapper.style.opacity = '0';
        wrapper.classList.add('active');
        wrapper.classList.add('transitioning');
        pageContainer.style.opacity = '1';

        // Re-init text destruction while wrapper is still opacity 0 so the
        // heavy DOM mutations (SplitText char/word re-wrapping) are invisible.
        if (window.TextDestruction) {
          TextDestruction.onThemeChange();
        }
      }, [], '-=0.35');

      flyTl.to(wrapper, {
        opacity: 1, duration: 0.4, ease: 'power2.out',
      }, '-=0.25');

      // Cleanup + rebuild hand
      flyTl.call(function() {
        if (targetTitle) targetTitle.style.opacity = '';
        if (rearrangeResult) rearrangeResult.destroy();
        flyOverlay.innerHTML = '';
        wrapper.classList.remove('transitioning');

        // Re-observe reveals on fetched content
        var newReveals = wrapper.querySelectorAll('.reveal');
        newReveals.forEach(function(el) {
          if (window.revealObserver) window.revealObserver.observe(el);
        });

        rebuildHand(cardId);
        history.pushState({ cardId: cardId }, '', cardData.pageUrl);
      });
    }); // end fontWait.then
    }); // end rAF
  }); // end pageCache.then
}

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */
function getTargetTypography(el) {
  var cs = getComputedStyle(el);
  return {
    fontSize:      parseFloat(cs.fontSize),
    lineHeight:    cs.lineHeight,
    fontFamily:    cs.fontFamily,
    fontWeight:    cs.fontWeight,
    fontStyle:     cs.fontStyle,
    textTransform: cs.textTransform,
    letterSpacing: cs.letterSpacing,
    color:         cs.color
  };
}

function applyArtCloneStyles(artClone, artRect) {
  artClone.style.position = 'fixed';
  artClone.style.left = artRect.left + 'px';
  artClone.style.top = artRect.top + 'px';
  artClone.style.width = artRect.width + 'px';
  artClone.style.height = artRect.height + 'px';
  artClone.style.borderRadius = '8px';
  artClone.style.zIndex = '501';
  artClone.style.pointerEvents = 'none';
}

/* ═══════════════════════════════════════════════
   HAND REBUILD
   ═══════════════════════════════════════════════ */
function rebuildHand(activeCardIdNew) {
  activePageCardId = activeCardIdNew;
  handContainer.innerHTML = '';
  cardOrder = CARDS.filter(function(c) { return c.id !== activePageCardId; }).map(function(c) { return c.id; });
  buildCards();
  handContainer.style.pointerEvents = '';

  var cardEls = handContainer.querySelectorAll('.card');
  var total = cardOrder.length;

  // Position cards below viewport, then animate up
  cardOrder.forEach(function(cid, slot) {
    var el = null;
    cardEls.forEach(function(e) { if (parseInt(e.dataset.cardId) === cid) el = e; });
    if (!el) return;
    var pos = getRestPosition(slot, total);
    el.style.transition = 'none';
    el.style.transformOrigin = 'center bottom';
    gsap.set(el, { x: pos.px, y: pos.py + 300, rotation: pos.angle, opacity: 0 });
  });

  requestAnimationFrame(function() {
    cardOrder.forEach(function(cid, slot) {
      var el = null;
      cardEls.forEach(function(e) { if (parseInt(e.dataset.cardId) === cid) el = e; });
      if (!el) return;
      var pos = getRestPosition(slot, total);
      gsap.to(el, {
        x: pos.px, y: pos.py, rotation: pos.angle, opacity: 1,
        duration: 0.55, delay: slot * 0.12, ease: 'power2.out',
        onComplete: function() { el.style.transition = ''; }
      });
    });
  });

  _liftedCardId = -1;
  _activePointerId = null;
  animState = 'IDLE';
}

/* ═══════════════════════════════════════════════
   HISTORY API — BACK / FORWARD NAVIGATION
   ═══════════════════════════════════════════════ */

function navigateToPage(cardId) {
  if (cardId === activePageCardId) return;

  // On standalone project pages, wait for bootstrap or fall back
  if (!document.getElementById('page-home')) {
    if (spaBootstrapReady) {
      spaBootstrapReady.then(function(ok) {
        if (ok && document.getElementById('page-home')) {
          navigateToPage(cardId);
        } else {
          var cd = CARDS.filter(function(c) { return c.id === cardId; })[0];
          window.location.href = (!cd || !cd.pageUrl) ? 'index.html' : cd.pageUrl;
        }
      });
      return;
    }
    var cd = CARDS.filter(function(c) { return c.id === cardId; })[0];
    window.location.href = (!cd || !cd.pageUrl) ? 'index.html' : cd.pageUrl;
    return;
  }

  // Kill any in-flight animations
  gsap.globalTimeline.clear();

  // Clean up overlay elements
  if (flyOverlay) flyOverlay.innerHTML = '';
  if (perspectiveContainer) perspectiveContainer.innerHTML = '';
  if (dragBlurOverlay) {
    dragBlurOverlay.style.backdropFilter = '';
    dragBlurOverlay.style.webkitBackdropFilter = '';
    dragBlurOverlay.style.background = '';
  }

  var homePage = document.getElementById('page-home');
  var pageContainer = document.getElementById('pageContainer');
  var cardData = CARDS.filter(function(c) { return c.id === cardId; })[0];

  if (!cardData || !cardData.pageUrl) {
    // Navigating to Home
    pageContainer.innerHTML = '';
    pageContainer.style.opacity = '';
    pageContainer.style.pointerEvents = '';
    if (homePage) {
      homePage.style.opacity = '';
      homePage.classList.add('active');
      homePage.classList.remove('transitioning');
    }
    // Re-observe reveals
    if (homePage) {
      homePage.querySelectorAll('.reveal').forEach(function(el) {
        if (!el.classList.contains('visible') && window.revealObserver) {
          window.revealObserver.observe(el);
        }
      });
    }
    // Re-init text destruction for home page content
    if (window.TextDestruction) {
      TextDestruction.onThemeChange();
    }
  } else {
    // Navigating to a project page
    if (homePage) {
      homePage.classList.remove('active');
      homePage.classList.remove('transitioning');
    }

    if (!pageCache[cardData.pageUrl]) {
      prefetchPage(cardData.pageUrl);
    }

    pageCache[cardData.pageUrl].then(function(content) {
      if (!content) return;
      var wrapper = document.createElement('div');
      wrapper.className = 'spa-page active';
      wrapper.innerHTML = content;
      pageContainer.className = 'page-container';
      pageContainer.style.opacity = '1';
      pageContainer.innerHTML = '';
      pageContainer.appendChild(wrapper);
      pageContainer.style.pointerEvents = 'auto';

      // Re-init text destruction for new content
      if (window.TextDestruction) {
        TextDestruction.onThemeChange();
      }

      // Re-observe reveals
      wrapper.querySelectorAll('.reveal').forEach(function(el) {
        if (window.revealObserver) window.revealObserver.observe(el);
      });
    });
  }

  window.scrollTo(0, 0);
  rebuildHand(cardId);
  animState = 'IDLE';
}

// Bootstrap SPA infrastructure on standalone project pages
bootstrapFromProjectPage();

// Replace initial history entry so first page has state
history.replaceState({ cardId: activePageCardId }, '', location.pathname);

// Handle browser back/forward
window.addEventListener('popstate', function(e) {
  if (!e.state || typeof e.state.cardId === 'undefined') return;
  if (animState !== 'IDLE') {
    gsap.globalTimeline.clear();
    if (flyOverlay) flyOverlay.innerHTML = '';
    if (perspectiveContainer) perspectiveContainer.innerHTML = '';
    if (dragBlurOverlay) {
      dragBlurOverlay.style.backdropFilter = '';
      dragBlurOverlay.style.webkitBackdropFilter = '';
      dragBlurOverlay.style.background = '';
    }
    animState = 'IDLE';
  }
  navigateToPage(e.state.cardId);
});
