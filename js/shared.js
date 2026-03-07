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
reveals.forEach(el => observer.observe(el));

// Expand cards with blur overlay
const overlay = document.getElementById('blurOverlay');
if (overlay) {
  const cards = document.querySelectorAll('.work-card');
  let activeCard = null;

  function closeActive() {
    if (activeCard) {
      activeCard.classList.remove('expanded');
      overlay.classList.remove('active');
      activeCard = null;
    }
  }

  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      closeActive();
      card.classList.add('expanded');
      overlay.classList.add('active');
      activeCard = card;
    });
    card.addEventListener('mouseleave', () => {
      if (card === activeCard) closeActive();
    });
  });
}

// Theme switcher
const themeSwitcher = document.getElementById('themeSwitcher');
const themes = ['coral', 'slate'];
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
});
