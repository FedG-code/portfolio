// js/toolbar.js — right-edge toolbar with theme swatches + plane button slot
(function () {
  'use strict';

  // Desktop default is brutalist, mobile default is bold — default theme sits first in the bar.
  var IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;
  var THEMES = IS_MOBILE
    ? ['bold', 'brutalist', 'retro', 'cinematic', 'neon']
    : ['brutalist', 'bold', 'retro', 'cinematic', 'neon'];
  var LABELS = {
    bold: 'Bold',
    brutalist: 'Brutalist',
    retro: 'Retro',
    cinematic: 'Cinematic',
    neon: 'Neon'
  };

  // Preview panel content (uses the cross-theme accent constants declared in :root).
  // Hex values mirror the CSS vars; kept in JS purely for the preview chips since we
  // render them inline for speed. NOTE: if you change a --theme-*-accent in shared.css,
  // update the matching entry here.
  var PREVIEW = {
    bold:      { accent: '#ff3d00', bg: '#f4f4f4', text: '#111',    sub: '#555',    chips: ['#ff3d00', '#111',    '#f4f4f4'] },
    brutalist: { accent: '#0000ff', bg: '#fff',    text: '#000',    sub: '#333',    chips: ['#0000ff', '#ff0000', '#000',    '#fff']    },
    retro:     { accent: '#1A5C52', bg: '#FDF6EC', text: '#1A1A16', sub: '#6D6A5E', chips: ['#1A5C52', '#D94230', '#1A1A16', '#FDF6EC'] },
    cinematic: { accent: '#D6001C', bg: '#0A0A0A', text: '#E8E6E1', sub: '#9A9590', chips: ['#D6001C', '#E8E6E1', '#9A9590', '#0A0A0A'] },
    neon:      { accent: '#c9f059', bg: '#0a0a0c', text: '#e8e6e3', sub: '#8a8a99', chips: ['#c9f059', '#e8e6e3', '#0a0a0c'] }
  };

  function buildToolbar() {
    var current = document.documentElement.getAttribute('data-theme') || 'bold';

    var toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.id = 'toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Site controls');

    var swatches = document.createElement('div');
    swatches.className = 'swatches';
    toolbar.appendChild(swatches);

    THEMES.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch-btn' + (t === current ? ' active' : '');
      btn.setAttribute('data-theme-id', t);
      btn.setAttribute('aria-label', 'Switch to ' + LABELS[t] + ' theme');
      btn.setAttribute('aria-pressed', t === current ? 'true' : 'false');
      var dot = document.createElement('span');
      dot.className = 'swatch-dot';
      btn.appendChild(dot);
      swatches.appendChild(btn);
    });

    var divider = document.createElement('div');
    divider.className = 'divider';
    toolbar.appendChild(divider);

    // Plane button is injected here by plane.js — leave a marker slot.
    var slot = document.createElement('div');
    slot.id = 'toolbar-plane-slot';
    toolbar.appendChild(slot);

    // Preview panel (hover, desktop only)
    var preview = document.createElement('div');
    preview.className = 'preview-panel';
    preview.id = 'toolbar-preview';
    preview.innerHTML =
      '<div class="preview-stripe"></div>' +
      '<div class="preview-name"></div>' +
      '<div class="preview-sub">Theme preview</div>' +
      '<div class="preview-chips"></div>';
    toolbar.appendChild(preview);

    document.body.appendChild(toolbar);

    wireSwatchClicks(swatches);
    wireHoverPreview(toolbar, swatches, preview);

    return toolbar;
  }

  function wireSwatchClicks(swatches) {
    swatches.addEventListener('click', function (e) {
      var btn = e.target.closest('.swatch-btn');
      if (!btn) return;
      var t = btn.getAttribute('data-theme-id');
      if (!t) return;
      if (typeof window.setTheme === 'function') {
        window.setTheme(t);
      }
    });
  }

  function wireHoverPreview(toolbar, swatches, preview) {
    // Only run hover wiring on devices with true hover + fine pointer
    var mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!mq.matches) return;

    swatches.addEventListener('mouseover', function (e) {
      var btn = e.target.closest('.swatch-btn');
      if (!btn) return;
      if (btn.classList.contains('active')) {
        preview.classList.remove('visible');
        return;
      }
      var t = btn.getAttribute('data-theme-id');
      var p = PREVIEW[t];
      if (!p) return;
      preview.querySelector('.preview-stripe').style.background = p.accent;
      var nameEl = preview.querySelector('.preview-name');
      nameEl.textContent = LABELS[t];
      nameEl.style.color = p.text;
      preview.querySelector('.preview-sub').style.color = p.sub;
      preview.style.background = p.bg;
      preview.querySelector('.preview-chips').innerHTML =
        p.chips.map(function (c) {
          return '<span class="preview-chip" style="background:' + c + '"></span>';
        }).join('');
      var tr = toolbar.getBoundingClientRect();
      var br = btn.getBoundingClientRect();
      preview.style.top = Math.max(4, br.top - tr.top + btn.offsetHeight / 2 - 40) + 'px';
      preview.classList.add('visible');
    });

    swatches.addEventListener('mouseleave', function () {
      preview.classList.remove('visible');
    });
  }

  // Called by shared.js after it changes data-theme
  function syncActive(themeName) {
    document.querySelectorAll('#toolbar .swatch-btn').forEach(function (b) {
      var on = b.getAttribute('data-theme-id') === themeName;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // Hide preview if it was showing the now-active theme
    var preview = document.getElementById('toolbar-preview');
    if (preview) preview.classList.remove('visible');
  }

  // Build immediately if body exists, else wait
  if (document.body) {
    buildToolbar();
  } else {
    document.addEventListener('DOMContentLoaded', buildToolbar);
  }

  window.Toolbar = { syncActive: syncActive };
})();