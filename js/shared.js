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

// Theme switcher
const themeSwitcher = document.getElementById('themeSwitcher');
const themes = ['coral', 'slate', 'neon'];
let currentIndex = themes.indexOf(document.documentElement.getAttribute('data-theme') || 'coral');
if (currentIndex === -1) currentIndex = 0;

// Update button label to show the *other* theme
const updateLabel = () => {
  const next = themes[(currentIndex + 1) % themes.length];
  themeSwitcher.textContent = next.charAt(0).toUpperCase() + next.slice(1);
};
updateLabel();

themeSwitcher.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % themes.length;
  document.documentElement.setAttribute('data-theme', themes[currentIndex]);
  localStorage.setItem('portfolio-theme', themes[currentIndex]);
  updateLabel();
  if (window.TextDestruction) TextDestruction.onThemeChange();
  if (window._planeOnThemeChange) window._planeOnThemeChange();
  if (window._cardHandOnThemeChange) window._cardHandOnThemeChange();
});

// Mobile auto-hide nav & theme switcher on scroll
(function () {
  var nav = document.querySelector('nav');
  var switcher = document.getElementById('themeSwitcher');
  if (!nav || !switcher) return;

  var lastY = window.scrollY;
  var ticking = false;

  function getPlaneToggle() {
    return document.querySelector('.plane-toggle');
  }

  function onScroll() {
    var planeToggle = getPlaneToggle();
    if (window.innerWidth > 600) {
      nav.classList.remove('scroll-hidden');
      switcher.classList.remove('scroll-hidden');
      if (planeToggle) planeToggle.classList.remove('scroll-hidden');
      lastY = window.scrollY;
      ticking = false;
      return;
    }

    var y = window.scrollY;
    var threshold = document.documentElement.scrollHeight * 0.1;

    if (y > lastY && y > threshold) {
      nav.classList.add('scroll-hidden');
      switcher.classList.add('scroll-hidden');
      if (planeToggle && !document.documentElement.classList.contains('plane-active')) {
        planeToggle.classList.add('scroll-hidden');
      }
    } else if (y < lastY) {
      nav.classList.remove('scroll-hidden');
      switcher.classList.remove('scroll-hidden');
      if (planeToggle) planeToggle.classList.remove('scroll-hidden');
    }

    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
})();
