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
const themes = ['bold', 'cinematic', 'brutalist', 'retro', 'neon'];
let currentIndex = themes.indexOf(document.documentElement.getAttribute('data-theme') || 'bold');
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

