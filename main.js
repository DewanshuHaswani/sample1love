import './style.css';
import { loadWeddingData, setLanguage, populateFromData, getData, getCurrentLang } from './translations.js';



/* ───── Envelope opening logic ───── */
import { createNoise2D } from 'simplex-noise';

document.addEventListener('DOMContentLoaded', async () => {
  const searchParams = new URLSearchParams(window.location.search);

  // Load wedding data from JSON first
  await loadWeddingData();
  
  // Populate dynamic content from JSON
  populateFromData();
  
  // Initialize default language
  setLanguage(searchParams.get('lang') || getData()?.defaultLanguage || 'en');

  const seal = document.getElementById('wax-seal');
  const envelope = document.getElementById('envelope');
  const wrapper = document.getElementById('envelope-wrapper');
  const invitation = document.getElementById('invitation-content');
  const data = getData();
  let autoScrollFrame = null;
  let autoScrollPaused = false;
  let bgMusic = null;
  let heroVideoReady = false;
  let tiltFrame = null;
  let lastTiltX = 0;
  let lastTiltY = 0;

  const musicSettings = data?.music || {};
  let musicMuted = Boolean(musicSettings.startMuted);
  let currentMusicVolume = Number(musicSettings.volume ?? 0.4);

  function ensureHeroVideoReady() {
    if (!heroVideo || heroVideoReady) return;
    const isMobile = window.innerWidth <= 768;
    heroVideo.src = isMobile ? '/mobile.mov' : '/web.mov';
    heroVideo.load();
    heroVideoReady = true;
  }



  function createFlowerBurst(x, y, count = 14) {
    if (!data?.flowerShower?.enabled) return;

    const layer = document.getElementById('flower-layer') || (() => {
      const el = document.createElement('div');
      el.id = 'flower-layer';
      el.className = 'flower-layer';
      document.body.appendChild(el);
      return el;
    })();

    const flowers = ['🌸', '🌺', '🌼', '🌷'];
    for (let i = 0; i < count; i += 1) {
      const flower = document.createElement('span');
      flower.className = 'flower-petal';
      flower.textContent = flowers[i % flowers.length];
      flower.style.left = `${x + (Math.random() * 28 - 14)}px`;
      flower.style.top = `${y + (Math.random() * 28 - 14)}px`;
      flower.style.setProperty('--drift-x', `${Math.random() * 72 - 36}px`);
      flower.style.setProperty('--drift-y', `${64 + Math.random() * 84}px`);
      flower.style.animationDelay = `${Math.random() * 80}ms`;
      flower.style.fontSize = `${14 + Math.random() * 10}px`;
      layer.appendChild(flower);
      flower.addEventListener('animationend', () => flower.remove(), { once: true });
    }
  }

  function startAutoScroll() {
    const autoScroll = data?.autoScroll;
    if (!autoScroll?.enabled || autoScrollFrame) return;

    const speed = Number(autoScroll.speed || 0.35);
    const start = () => {
      const step = () => {
        if (!autoScrollPaused) {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          if (window.scrollY < maxScroll - 1) {
            window.scrollTo({ top: Math.min(maxScroll, window.scrollY + speed), behavior: 'auto' });
          } else {
            cancelAnimationFrame(autoScrollFrame);
            autoScrollFrame = null;
            return;
          }
        }
        autoScrollFrame = requestAnimationFrame(step);
      };
      autoScrollFrame = requestAnimationFrame(step);
    };

    window.setTimeout(start, Number(autoScroll.startDelayMs || 1800));

    if (autoScroll.pauseOnInteraction) {
      ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((eventName) => {
        window.addEventListener(eventName, () => {
          autoScrollPaused = true;
        }, { passive: true, once: true });
      });
    }
  }

  /* ───── Hero Video Initialization ───── */
  const videoWrapper = document.getElementById('hero-video-wrapper');
  const heroVideo = document.getElementById('hero-background-video');

  /* ───── Typewriter Effect ───── */
  function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';
    const timer = setInterval(() => {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
  }

  // Trigger typewriter when invitation reveals
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && invitation.classList.contains('reveal')) {
        const togetherText = document.querySelector('[data-i18n="together"]');
        if (togetherText) {
          // Get translated text (it might already be set by setLanguage)
          const text = togetherText.textContent;
          typeWriter(togetherText, text, 80);
        }
        observer.disconnect();
      }
    });
  });
  if (invitation) {
    observer.observe(invitation, { attributes: true });
  }

  /* ───── Envelope Parallax Tilt ───── */
  if (wrapper && envelope) {
    wrapper.addEventListener('mousemove', (e) => {
      if (envelope.classList.contains('open') || wrapper.classList.contains('dissolve')) return;

      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      lastTiltX = (y - centerY) / 20;
      lastTiltY = (centerX - x) / 20;

      if (tiltFrame) return;
      tiltFrame = requestAnimationFrame(() => {
        envelope.style.transform = `rotateX(${lastTiltX}deg) rotateY(${lastTiltY}deg)`;
        tiltFrame = null;
      });
    }, { passive: true });

    wrapper.addEventListener('mouseleave', () => {
      if (envelope.classList.contains('open') || wrapper.classList.contains('dissolve')) return;
      envelope.style.transform = `rotateX(0deg) rotateY(0deg)`;
    });
  }

  function openEnvelope() {
    // Prevent double-click
    seal.removeEventListener('click', openEnvelope);
    seal.removeEventListener('keydown', handleKey);



    // 🎵 Start background music with gentle fade-in
    if (!bgMusic) {
      bgMusic = new Audio('/wedding_website_background.mp3');
      bgMusic.preload = 'none';
      bgMusic.loop = data && data.musicLoop !== undefined ? data.musicLoop : true;
      bgMusic.volume = 0;
    }

    if (musicSettings.showToggle !== false) {
      window.dispatchEvent(
        new CustomEvent('wedding-audio-ready', {
          detail: {
            showToggle: true,
            volume: currentMusicVolume,
          },
        })
      );
    }

    if (!musicMuted) {
      bgMusic.play().then(() => {
        const targetVolume = currentMusicVolume;
        const fadeSteps = 24;
        const fadeInterval = 1200 / fadeSteps;
        let currentStep = 0;
        const fadeIn = setInterval(() => {
          currentStep++;
          if (musicMuted) {
            clearInterval(fadeIn);
            bgMusic.volume = 0;
            return;
          }
          bgMusic.volume = Math.min(targetVolume, (currentStep / fadeSteps) * targetVolume);
          if (currentStep >= fadeSteps) clearInterval(fadeIn);
        }, fadeInterval);
      }).catch(err => {
        console.warn('Background music autoplay blocked:', err);
      });
    }

    // 1. Break the wax seal (shatter + glow)
    seal.classList.add('breaking');
    setTimeout(() => seal.classList.add('broken'), 600);

    // 2. Open the top flap (card automatically slides up via CSS delay)
    setTimeout(() => {
      envelope.classList.add('open');
    }, 700);

    // 3. Flap takes 1.2s to open, card takes 1s to rise.
    // At 2300ms total elapsed, cinematic fly-through begins!
    setTimeout(() => {
      wrapper.classList.add('dissolve');
      invitation.classList.add('reveal');
      
      const waveBg = document.getElementById('react-wave-root');
      if (waveBg) waveBg.style.opacity = '1';
      
      if (heroVideo) {
        ensureHeroVideoReady();
        heroVideo.play().catch(err => console.warn('Hero video play blocked:', err));
        if (videoWrapper) videoWrapper.style.opacity = '1';
      }

      startAutoScroll();
    }, 2300);

    // 4. Clean up DOM memory after all massive transitions finish (4.5s total)
    setTimeout(() => {
      wrapper.style.display = 'none';
      wrapper.remove();
    }, 4500);
  }

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ') openEnvelope();
  }

  seal.addEventListener('click', openEnvelope);
  seal.addEventListener('keydown', handleKey);

  window.addEventListener('wedding-audio-set-volume', async (event) => {
    const customEvent = event;
    currentMusicVolume = Math.max(0, Math.min(1, Number(customEvent.detail?.volume ?? currentMusicVolume)));
    musicMuted = currentMusicVolume <= 0.001;

    if (!bgMusic) {
      window.dispatchEvent(
        new CustomEvent('wedding-audio-volume', {
          detail: {
            volume: currentMusicVolume,
          },
        })
      );
      return;
    }

    if (musicMuted) {
      bgMusic.volume = 0;
      bgMusic.pause();
    } else {
      try {
        await bgMusic.play();
        bgMusic.volume = currentMusicVolume;
      } catch (err) {
        console.warn('Background music volume change blocked:', err);
      }
    }

    window.dispatchEvent(
      new CustomEvent('wedding-audio-volume', {
        detail: {
          volume: currentMusicVolume,
        },
      })
    );
  });

  if (searchParams.get('open') === '1') {
    requestAnimationFrame(() => openEnvelope());
  }

  if (data?.flowerShower?.enabled) {
    window.addEventListener('pointerdown', (event) => {
      if (data.flowerShower.onTap) {
        createFlowerBurst(event.clientX, event.clientY, Number(data.flowerShower.flowerCount || 10));
      }
    }, { passive: true });

    let lastTrailAt = 0;
    window.addEventListener('scroll', () => {
      if (!data.flowerShower.onScrollTrail) return;
      const now = Date.now();
      if (now - lastTrailAt < 260) return;
      lastTrailAt = now;
      createFlowerBurst(window.innerWidth * (0.15 + Math.random() * 0.7), -10, Math.min(4, Number(data.flowerShower.scrollFlowerCount || 4)));
    }, { passive: true });
  }

  // Subtle pulsing glow on the seal to invite clicks
  seal.animate([
    { filter: 'drop-shadow(0 0 8px rgba(139,26,26,0.3))' },
    { filter: 'drop-shadow(0 0 20px rgba(139,26,26,0.6))' },
    { filter: 'drop-shadow(0 0 8px rgba(139,26,26,0.3))' },
  ], { duration: 2500, iterations: Infinity });

  /* ───── Aceternity-style scroll-progress line ───── */
  const tlWrapper   = document.getElementById('tl-wrapper');

  if (tlWrapper) {
    function updateProgress() {
      const progressBar = document.getElementById('tl-line-progress');
      if (!progressBar) return;
      const rect = tlWrapper.getBoundingClientRect();
      const windowH = window.innerHeight;

      // When the top of the wrapper hits 10% from top of viewport → 0
      // When the bottom of the wrapper hits 50% of viewport → 1
      const start = windowH * 0.1;
      const end   = windowH * 0.5;

      const totalScrollable = rect.height - (end - start);
      const scrolled = start - rect.top;

      let progress = scrolled / totalScrollable;
      progress = Math.max(0, Math.min(1, progress));

      progressBar.style.transform = `scaleY(${progress})`;
      // Also set opacity so it fades in
      progressBar.style.opacity = progress > 0.02 ? '1' : '0';
    }

    window.addEventListener('scroll', () => requestAnimationFrame(updateProgress), { passive: true });
    window.addEventListener('resize', () => requestAnimationFrame(updateProgress), { passive: true });
  }



  /* ───── Gallery Entrance Observer ───── */
  const galleryContainer = document.getElementById('zoom-parallax-container');
  if (galleryContainer) {
    const galleryObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          galleryContainer.classList.add('visible');
          galleryObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    galleryObserver.observe(galleryContainer);
  }

  /* ───── Zoom Parallax Scroll Logic ───── */
  const parallaxContainer = document.getElementById('zoom-parallax-container');
  let parallaxElements = [];
  let parallaxActive = false;

  if (parallaxContainer) {
    parallaxElements = Array.from(document.querySelectorAll('.parallax-element'));

    function updateParallax() {
      if (!parallaxActive || parallaxElements.length === 0) return;

      const rect = parallaxContainer.getBoundingClientRect();
      const windowH = window.innerHeight;
      const totalScroll = Math.max(rect.height - windowH, 1);
      let progress = -rect.top / totalScroll;
      progress = Math.max(0, Math.min(1, progress));

      parallaxElements.forEach((el) => {
        const targetScale = parseFloat(el.getAttribute('data-scale-end'));
        const currentScale = 1 + (targetScale - 1) * progress;
        el.style.transform = `scale(${currentScale})`;
      });
    }

    const parallaxObserver = new IntersectionObserver((entries) => {
      parallaxActive = entries.some((entry) => entry.isIntersecting);
      if (parallaxActive) {
        parallaxElements = Array.from(document.querySelectorAll('.parallax-element'));
        requestAnimationFrame(updateParallax);
      }
    }, { threshold: 0, rootMargin: '200px 0px' });

    parallaxObserver.observe(parallaxContainer);
    window.addEventListener('scroll', () => requestAnimationFrame(updateParallax), { passive: true });
    window.addEventListener('resize', () => requestAnimationFrame(updateParallax), { passive: true });
  }

  /* ───── Theme Toggle ───── */
  const btnTheme = document.getElementById('btn-theme');

  // Restore saved theme
  const savedTheme = localStorage.getItem('wedding-theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    if (btnTheme) btnTheme.textContent = '☀';
  }

  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      btnTheme.textContent = isLight ? '☀' : '🌙';
      localStorage.setItem('wedding-theme', isLight ? 'light' : 'dark');
    });
  }

  /* ───── Countdown Timer Logic (JSON-driven) ───── */
  const countdownDate = new Date(data.weddingDate).getTime();
  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMinutes = document.getElementById('cd-minutes');
  const cdSeconds = document.getElementById('cd-seconds');

  if (cdDays && cdHours && cdMinutes && cdSeconds) {
    const countdownInterval = setInterval(() => {
      const now = new Date().getTime();
      const distance = countdownDate - now;

      if (distance < 0) {
        clearInterval(countdownInterval);
        cdDays.textContent = "00";
        cdHours.textContent = "00";
        cdMinutes.textContent = "00";
        cdSeconds.textContent = "00";
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      cdDays.textContent = days.toString().padStart(2, '0');
      cdHours.textContent = hours.toString().padStart(2, '0');
      cdMinutes.textContent = minutes.toString().padStart(2, '0');
      cdSeconds.textContent = seconds.toString().padStart(2, '0');
    }, 1000);
  }

  /* ═══════════════════════════════════════════════════
     RSVP WHATSAPP FORM LOGIC (JSON-driven)
     ═══════════════════════════════════════════════════ */
  const rsvpForm = document.getElementById('rsvp-form');
  if (rsvpForm) {
    rsvpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('guest-name').value.trim();
      const count = document.getElementById('guest-count').value;
      if (!name) return;

      // Build message from JSON template
      const template = data.whatsapp.messageTemplate;
      const gName = typeof data.couple.groomName === 'object' ? (data.couple.groomName[getCurrentLang()] || data.couple.groomName.en) : data.couple.groomName;
      const bName = typeof data.couple.brideName === 'object' ? (data.couple.brideName[getCurrentLang()] || data.couple.brideName.en) : data.couple.brideName;
      
      const message = template
        .replace('{{groomName}}', gName)
        .replace('{{brideName}}', bName)
        .replace('{{guestName}}', name)
        .replace('{{guestCount}}', count);

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${data.whatsapp.phone}?text=${encodedMessage}`;
      
      window.open(whatsappUrl, '_blank');
    });
  }

});
