/* ============================================================
   CAFÉ BỐNG · V4 — main.js  («Le Comptoir» motion layer)
   Stack: Lenis + GSAP + ScrollTrigger (CDN globals).

   Contract kept from the shell:
     · reduced-motion gate (reduce → NOTHING is wired: native scroll,
       all content visible via showAll()).
     · .js flag on <html> so no-JS keeps content visible.
     · reveals fail-safe to opacity:1 (any error → showAll()).
     · menu focus-trap / Escape / aria-expanded stay functional.
   ============================================================ */

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;

document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {

  /* year ------------------------------------------------------ */
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* fail-safe: make everything visible. Motion below overrides
     the initial states only when !reduce and libs are present. */
  const showAll = () => {
    document.querySelectorAll('[data-reveal]').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    document.querySelectorAll('[data-reveal-lines]').forEach(el => {
      el.style.opacity = '1';
    });
  };

  /* ----------------------------------------------------------
     MENU OVERLAY — open/close, focus trap, Escape, aria.
     The clip-path/stagger timeline is wired separately (motion);
     this block guarantees the menu WORKS even if GSAP failed.
     ---------------------------------------------------------- */
  const burger   = document.getElementById('burger');
  const overlay  = document.getElementById('menu-overlay');
  const closeBtn = document.getElementById('menu-close');
  let lastFocus  = null;
  let menuTl     = null;   // set later if GSAP present
  let menuOpen   = false;

  const focusables = () =>
    overlay.querySelectorAll('a[href], button:not([disabled])');

  function openMenu() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    menuOpen = true;
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (window.lenis) window.lenis.stop();
    // move focus to the first link only AFTER the panel is on screen
    // (avoids focusing an element still at opacity:0 / yPercent:120).
    const focusFirst = () => { const f = focusables(); if (f.length) f[0].focus(); };
    if (menuTl) {
      menuTl.eventCallback('onComplete', null);   // clear any reverse callback
      menuTl.timeScale(1).play();
    } else {
      requestAnimationFrame(() => overlay.classList.add('open'));
    }
    // Reliably trap focus inside the panel once it's substantially open.
    // (the open timeline's onComplete proved unreliable — a timed focus
    // always lands; mid-animation focus is acceptable for a11y.)
    setTimeout(focusFirst, reduce ? 0 : 260);
  }

  // returnFocus: send focus back to the burger (Escape / close button).
  // false when closing via a nav-link click that scrolls to an anchor —
  // returning focus to the top burger would be disorienting.
  function closeMenu(returnFocus = true) {
    menuOpen = false;
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (window.lenis) window.lenis.start();
    if (menuTl) {
      menuTl.eventCallback('onComplete', null);   // drop the open-focus callback
      menuTl.timeScale(1.35).reverse();
      menuTl.eventCallback('onReverseComplete', () => { overlay.hidden = true; });
    } else {
      overlay.classList.remove('open');
      const finish = () => { overlay.hidden = true; };
      if (reduce) finish();
      else overlay.addEventListener('transitionend', finish, { once: true });
    }
    if (returnFocus) {
      // Return focus to the trigger, but only if it is actually focusable
      // (the burger is display:none on desktop, where the overlay isn't
      // reachable anyway). Otherwise fall back to whatever was focused.
      const focusable = burger && document.contains(burger)
        && burger.offsetParent !== null;          // not display:none
      (focusable ? burger : lastFocus)?.focus?.();
    }
  }

  if (burger && overlay) {
    burger.addEventListener('click', () =>
      burger.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu());
    closeBtn?.addEventListener('click', () => closeMenu(true));
    // nav-link click navigates to an anchor → do NOT yank focus back to burger
    overlay.querySelectorAll('.menu-nav a').forEach(a =>
      a.addEventListener('click', () => closeMenu(false)));

    document.addEventListener('keydown', (e) => {
      if (overlay.hidden) return;
      if (e.key === 'Escape') closeMenu(true);
      if (e.key === 'Tab') {
        const f = Array.from(focusables());
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    /* menu hover preview crossfade */
    const previewImg = overlay.querySelector('.menu-preview-img');
    if (previewImg) {
      overlay.querySelectorAll('.menu-nav a[data-preview]').forEach(a => {
        a.addEventListener('mouseenter', () => {
          if (typeof gsap !== 'undefined' && !reduce) {
            gsap.to(previewImg, { opacity: 0, duration: .18, onComplete: () => {
              previewImg.src = a.dataset.preview;
              gsap.to(previewImg, { opacity: 1, duration: .35, ease: 'power2.out' });
            }});
          } else {
            previewImg.src = a.dataset.preview;
            previewImg.style.opacity = '1';
          }
        });
      });
    }
  }

  /* ----------------------------------------------------------
     Product GRID + family filter. Tabs filter the grid; the page
     scrolls vertically as normal — NO horizontal scroll / wheel
     hijack / pin. Works with or without JS-motion.
     ---------------------------------------------------------- */
  const tabs  = document.querySelectorAll('.rail-tab');
  const grid  = document.querySelector('[data-grid]');
  const cards = grid ? Array.from(grid.querySelectorAll('.rail-card')) : [];

  const railLive = document.getElementById('rail-live');
  function activateTab(tab) {
    tabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-pressed', 'false'); });
    tab.classList.add('is-active');
    tab.setAttribute('aria-pressed', 'true');
  }
  function filterGrid(fam) {
    let n = 0;
    cards.forEach(c => {
      const f = c.dataset.filter;
      const show = fam === 'tout' || f === fam || f === 'all';   // end-cap (all) always shows
      c.classList.toggle('is-hidden', !show);
      if (show && f !== 'all') {
        n++;
        c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';  // replay cardIn entrance
      }
    });
    if (railLive) railLive.textContent = n + (n > 1 ? ' produits affichés' : ' produit affiché');
  }
  tabs.forEach(tab => {
    tab.addEventListener('click', () => { activateTab(tab); filterGrid(tab.dataset.filter); });
  });

  /* ---------- "Voir la carte en images" dialog (native <dialog>) ----------
     Native dialog gives Escape + focus-trap + inert background for free.
     Wired here (always), so it works even with reduced-motion / no GSAP. */
  const cartesModal = document.getElementById('cartes-modal');
  const cartesLink  = document.querySelector('.cartes-link');
  if (cartesModal && cartesLink && typeof cartesModal.showModal === 'function') {
    // open: pause Lenis (else it eats the wheel) + lock page scroll behind the modal
    cartesLink.addEventListener('click', () => {
      cartesModal.showModal();
      if (window.lenis) window.lenis.stop();
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    });
    cartesModal.addEventListener('close', () => {
      if (window.lenis) window.lenis.start();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    });
    cartesModal.querySelector('[data-close]')?.addEventListener('click', () => cartesModal.close());
    // click on the backdrop (outside the dialog box) closes it
    cartesModal.addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG') return;   // image clicks zoom, don't close
      const r = cartesModal.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) cartesModal.close();
    });
    // click a menu photo to zoom in/out for readability
    cartesModal.querySelectorAll('.cartes-scroll img').forEach((img) => {
      img.addEventListener('click', () => img.classList.toggle('zoomed'));
    });
  }

  /* ---------- scroll reveals via IntersectionObserver ----------
     Independent of GSAP/Lenis, so content NEVER stays stuck hidden
     (the GSAP/ScrollTrigger version was unreliable on mobile → empty
     sections). Adds `.in`; CSS does the fade. Runs on every device. */
  {
    const revealEls = document.querySelectorAll('[data-reveal]');
    if (reduce || !('IntersectionObserver' in window)) {
      revealEls.forEach(el => el.classList.add('in'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      revealEls.forEach(el => io.observe(el));
    }
  }

  /* ==========================================================
     ========  MOTION LAYER (only when !reduce + libs)  =======
     ========================================================== */
  if (reduce || typeof gsap === 'undefined' || typeof Lenis === 'undefined') {
    showAll();
    return;
  }

  // window.lenis so menu open/close (declared above) can stop/start it
  window.lenis = null;

  try {
    gsap.registerPlugin(ScrollTrigger);
    // Mobile = native scroll + lighter motion. Lenis smooth-scroll and
    // scrubbed parallax/scale stutter on phones → desktop-only.
    const isMobile = matchMedia('(max-width: 768px)').matches || matchMedia('(pointer: coarse)').matches;

    let lenisVel = 0;
    /* ---------- 1 · Lenis (desktop only — single RAF) ---------- */
    if (!isMobile) {
      const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
      window.lenis = lenis;
      lenis.on('scroll', (e) => { lenisVel = e.velocity || 0; ScrollTrigger.update(); });
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    // DPR cap hint (cheap; helps GPU on hi-dpi laptops)
    // (no canvas here, but keep parallax/scale layers crisp-but-cheap)

    /* ---------- 2a · line/word reveal (hero) ----------
       Split by WORD only — never by char (viet diacritics). */
    document.querySelectorAll('[data-reveal-lines] .line').forEach(line => {
      const isEm = !!line.querySelector('em');     // preserve emphasis (gold) colour
      const words = line.textContent.split(/(\s+)/);
      line.innerHTML = '';
      words.forEach(tok => {
        if (/^\s+$/.test(tok)) { line.appendChild(document.createTextNode(tok)); return; }
        const span = document.createElement('span');
        span.className = 'w';
        if (isEm) { const em = document.createElement('em'); em.textContent = tok; span.appendChild(em); }
        else span.textContent = tok;
        line.appendChild(span);
      });
    });

    /* Reveal the whole title by opacity (block element — reliably tweenable)
       plus a soft per-line lift. Title is hidden via .js opacity:0 in CSS;
       this fades it in. End state guaranteed visible. */
    const heroTitles = gsap.utils.toArray('[data-reveal-lines]');
    if (heroTitles.length) {
      gsap.to(heroTitles, { opacity: 1, duration: 1, ease: 'power2.out', delay: 0.2 });
      gsap.from('[data-reveal-lines] .line', {
        y: 36, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.2,
      });
    }

    /* (generic [data-reveal] reveals now run via IntersectionObserver above —
       not GSAP/ScrollTrigger — so they never stay stuck hidden on mobile.) */

    /* ---------- 6 · parallax + scale-on-scroll (desktop only) ---------- */
    if (!isMobile) {
      document.querySelectorAll('.hero-bg[data-parallax]').forEach(bg => {
        gsap.to(bg, {
          yPercent: 14, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });
      });
      gsap.utils.toArray('[data-scale]').forEach(el => {
        const img = el.querySelector('img') || el;
        gsap.fromTo(img, { scale: 1 }, {
          scale: 1.08, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
    }

    /* ---------- 4 · menu clip-path + stagger timeline ---------- */
    if (overlay) {
      const links = overlay.querySelectorAll('.menu-nav a');
      const foot  = overlay.querySelector('.menu-foot');
      menuTl = gsap.timeline({ paused: true })
        .set(overlay, { clearProps: 'clipPath' })
        .fromTo(overlay,
          { clipPath: 'inset(0 0 100% 0)' },
          { clipPath: 'inset(0 0 0% 0)', duration: 0.7, ease: 'expo.inOut' })
        .fromTo(links,
          { yPercent: 120, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, '-=0.32')
        .fromTo(foot, { opacity: 0 }, { opacity: 1, duration: 0.4 }, '-=0.3');
      // make menuTl available to the (already-defined) open/close closures
      // they reference the outer `menuTl` variable, so this assignment wires them.
    }

    /* ---------- 5 · magnetic buttons ---------- */
    if (!isTouch) {
      document.querySelectorAll('[data-magnetic]').forEach(el => {
        const strength = 0.35, radius = 90;
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          const mx = e.clientX - (r.left + r.width / 2);
          const my = e.clientY - (r.top + r.height / 2);
          const dist = Math.hypot(mx, my);
          const k = dist > radius ? radius / dist : 1;
          gsap.to(el, { x: mx * strength * k, y: my * strength * k, duration: 0.4, ease: 'power3.out' });
        });
        el.addEventListener('pointerleave', () => {
          gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' });
        });
      });
    }

    /* (horizontal rail replaced by a filterable vertical grid — no
       scroll-jacking. Cards fade in via the CSS `cardIn` animation,
       which needs no JS and can't get stuck if GSAP fails.) */

    /* ---------- 7 · velocity-reactive marquee (desktop) ----------
       On mobile the plain CSS @keyframes marquee runs instead (cheaper). */
    const track = document.querySelector('.marquee-track');
    if (track && !isMobile) {
      track.style.animation = 'none';  // take over from CSS keyframes
      let mx = 0;
      const halfW = () => track.scrollWidth / 2; // track duplicates content once
      gsap.ticker.add(() => {
        const speed = 0.6 + Math.min(6, Math.abs(lenisVel) * 0.35);
        mx -= speed;
        const w = halfW();
        if (w && mx <= -w) mx += w;
        track.style.transform = 'translate3d(' + mx + 'px,0,0)';
      });
    }

    /* ---------- refresh after fonts + images settle ---------- */
    window.addEventListener('load', () => ScrollTrigger.refresh());
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    // images can change layout (rail width!) — refresh as they decode
    let imgPending = 0;
    document.querySelectorAll('img').forEach(img => {
      if (img.complete) return;
      imgPending++;
      const done = () => { if (--imgPending <= 0) ScrollTrigger.refresh(); };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });

  } catch (err) {
    // any failure in the motion layer → guarantee readable content
    console.error('[bong motion] failed, falling back to static:', err);
    showAll();
    if (overlay) menuTl = null;
  }
});
