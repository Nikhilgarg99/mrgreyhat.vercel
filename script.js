/* ═══════════════════════════════════════════════════════════
   MrGreyHat — Portfolio interactions
   Vanilla JS, no dependencies.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  // Opt into JS-driven reveal animations only once JS is confirmed running.
  docEl.classList.add('js-ready');

  /* ─────────────────────────────────────────────────────────
     1. Mobile navigation
     ───────────────────────────────────────────────────────── */
  var navToggle = $('#navToggle');
  var nav = $('#nav');
  var navBackdrop = $('#navBackdrop');

  function setNav(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    if (navBackdrop) navBackdrop.hidden = !open;
    docEl.style.overflow = open ? 'hidden' : '';
    // Swap the hamburger icon for a close icon
    var use = $('use', navToggle);
    if (use) use.setAttribute('href', open ? '#i-close' : '#i-menu');
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setNav(!nav.classList.contains('open'));
    });
  }

  if (navBackdrop) {
    navBackdrop.addEventListener('click', function () { setNav(false); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav && nav.classList.contains('open')) setNav(false);
  });

  // Close the drawer if we resize up to desktop
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900 && nav && nav.classList.contains('open')) setNav(false);
  });

  /* ─────────────────────────────────────────────────────────
     2. Smooth anchor scrolling (nav, footer, hero CTAs)
     ───────────────────────────────────────────────────────── */
  $$('a[data-nav]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var id = this.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      setNav(false);

      var navH = parseInt(getComputedStyle(docEl).getPropertyValue('--nav-h'), 10) || 68;
      var top = target.getBoundingClientRect().top + window.pageYOffset - navH - 12;

      window.scrollTo({
        top: Math.max(top, 0),
        behavior: reduceMotion ? 'auto' : 'smooth'
      });

      // Keep the URL tidy without triggering a jump
      if (history.replaceState) history.replaceState(null, '', id);
    });
  });

  /* ─────────────────────────────────────────────────────────
     3. Scroll effects: navbar state, progress bar, back-to-top
     ───────────────────────────────────────────────────────── */
  var topbar = $('#topbar');
  var progressBar = $('#progressBar');
  var toTop = $('#toTop');
  var cursorGlow = $('#cursorGlow');

  var lastScroll = -1;

  function onScroll() {
    var y = window.pageYOffset || docEl.scrollTop;
    if (y === lastScroll) return;
    lastScroll = y;

    // Sticky navbar backdrop
    if (topbar) topbar.classList.toggle('stuck', y > 40);

    // Reading progress
    var docH = docEl.scrollHeight - window.innerHeight;
    var pct = docH > 0 ? (y / docH) * 100 : 0;
    if (progressBar) progressBar.style.width = pct.toFixed(2) + '%';

    // Back-to-top visibility
    if (toTop) toTop.classList.toggle('show', y > 600);

    // Guarantee anything scrolled into view gets revealed
    sweepReveals();
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      onScroll();
      ticking = false;
    });
  }, { passive: true });

  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ─────────────────────────────────────────────────────────
     4. Scroll-spy — highlight the active section in the nav
     ───────────────────────────────────────────────────────── */
  var spyLinks = $$('#nav a[data-nav]');
  var spySections = spyLinks
    .map(function (a) {
      return { link: a, el: document.querySelector(a.getAttribute('href')) };
    })
    .filter(function (s) { return s.el; });

  function updateSpy() {
    var probe = window.innerHeight * 0.32;
    var currentId = null;

    spySections.forEach(function (s) {
      var top = s.el.getBoundingClientRect().top;
      if (top <= probe) currentId = s.el.id;
    });

    // If we're at the very bottom, light up the last section
    if (window.innerHeight + window.pageYOffset >= docEl.scrollHeight - 4) {
      currentId = spySections[spySections.length - 1].el.id;
    }

    spyLinks.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + currentId);
    });
  }

  window.addEventListener('scroll', updateSpy, { passive: true });
  window.addEventListener('resize', updateSpy);
  updateSpy();

  /* ─────────────────────────────────────────────────────────
     5. Reveal on scroll (IntersectionObserver + safety sweep)
     ───────────────────────────────────────────────────────── */
  var revealEls = $$('.reveal');
  var pendingReveals = [];
  var revealObs = null;

  function show(el) {
    el.classList.add('in');
    var i = pendingReveals.indexOf(el);
    if (i !== -1) pendingReveals.splice(i, 1);
  }

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealEls.forEach(show);
  } else {
    pendingReveals = revealEls.slice();

    revealObs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px 6% 0px' });

    revealEls.forEach(function (el) { revealObs.observe(el); });
  }

  /* Safety net: IntersectionObserver can miss elements that sit inside the
     root's bottom margin and are then skipped by a fast scroll/jump.
     Sweep anything actually inside the viewport and reveal it. */
  function sweepReveals() {
    if (!pendingReveals || !pendingReveals.length) return;
    var vh = window.innerHeight;
    for (var i = pendingReveals.length - 1; i >= 0; i--) {
      var el = pendingReveals[i];
      var r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        show(el);
        if (revealObs) revealObs.unobserve(el);
      }
    }
  }

  sweepReveals();
  window.addEventListener('load', sweepReveals);
  window.addEventListener('resize', sweepReveals);

  // Hero entrance
  window.requestAnimationFrame(function () {
    window.setTimeout(function () { docEl.classList.add('hero-loaded'); }, 60);
  });

  /* ─────────────────────────────────────────────────────────
     6. Typewriter role text
     ───────────────────────────────────────────────────────── */
  var typed = $('#typed');
  var ROLES = ['Penetration Tester', 'Bug Hunter', 'Security Researcher', 'VAPT Specialist'];

  if (typed) {
    if (reduceMotion) {
      typed.textContent = ROLES.join(' / ');
    } else {
      var r = 0;
      var c = 0;
      var deleting = false;

      var typeLoop = function () {
        var word = ROLES[r];

        if (!deleting) {
          c++;
          typed.textContent = word.slice(0, c);
          if (c === word.length) {
            deleting = true;
            return window.setTimeout(typeLoop, 1900);
          }
          return window.setTimeout(typeLoop, 78);
        }

        c--;
        typed.textContent = word.slice(0, c);
        if (c === 0) {
          deleting = false;
          r = (r + 1) % ROLES.length;
          return window.setTimeout(typeLoop, 320);
        }
        return window.setTimeout(typeLoop, 38);
      };

      typeLoop();
    }
  }

  /* ─────────────────────────────────────────────────────────
     7. Animated stat counters
     ───────────────────────────────────────────────────────── */
  var counters = $$('.stat-num');

  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    if (reduceMotion) { el.textContent = String(target); return; }

    var dur = 1400;
    var start = null;

    var tick = function (ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      // easeOutExpo
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = String(Math.round(eased * target));
      if (p < 1) window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  }

  if (counters.length) {
    if (!('IntersectionObserver' in window)) {
      counters.forEach(runCounter);
    } else {
      var countObs = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { countObs.observe(el); });
    }
  }

  /* ─────────────────────────────────────────────────────────
     8. Pointer spotlight (desktop only)
     ───────────────────────────────────────────────────────── */
  if (cursorGlow && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
    var gx = window.innerWidth / 2;
    var gy = window.innerHeight / 2;
    var tx = gx;
    var ty = gy;

    window.addEventListener('mousemove', function (e) {
      tx = e.clientX;
      ty = e.clientY;
      cursorGlow.classList.add('on');
    }, { passive: true });

    (function follow() {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      cursorGlow.style.transform = 'translate(-50%, -50%) translate(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px)';
      window.requestAnimationFrame(follow);
    })();
  }

  /* ─────────────────────────────────────────────────────────
     9. 3D tilt on cards
     ───────────────────────────────────────────────────────── */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
    $$('.card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'translateY(-7px) perspective(900px) rotateX(' + (-py * 5).toFixed(2) +
          'deg) rotateY(' + (px * 6).toFixed(2) + 'deg)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
     11. Misc
     ───────────────────────────────────────────────────────── */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
