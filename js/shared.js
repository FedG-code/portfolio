// Scroll reveal
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 60);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
window.revealObserver = observer;
reveals.forEach(el => observer.observe(el));

// Theme switcher (direct-select via toolbar swatches)
const themes = ['bold', 'brutalist', 'retro', 'cinematic', 'neon'];

function setTheme(name) {
  if (themes.indexOf(name) === -1) return;
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('portfolio-theme', name);
  if (window.Toolbar && window.Toolbar.syncActive) window.Toolbar.syncActive(name);
  if (window.TextDestruction) TextDestruction.onThemeChange();
  if (window._planeOnThemeChange) window._planeOnThemeChange();
  if (window._cardHandOnThemeChange) window._cardHandOnThemeChange();
}
window.setTheme = setTheme;

