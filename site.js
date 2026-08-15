/* ============================================================
   HOLDEN HEALTH | site behavior
   Scroll-reveal on enter · FAQ accordion
   ============================================================ */
(function () {
  'use strict';

  // ---------- Scroll reveal ----------
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  // ---------- FAQ accordion ----------
  function initFaq() {
    document.querySelectorAll('.faq-q').forEach(function (q) {
      q.setAttribute('aria-expanded', 'false');
      q.addEventListener('click', function () {
        var item = q.parentElement;
        var a = item.querySelector('.faq-a');
        var open = item.classList.toggle('open');
        q.setAttribute('aria-expanded', open ? 'true' : 'false');
        a.style.maxHeight = open ? a.scrollHeight + 'px' : '0px';
      });
    });
  }

  // ---------- Member login ----------
  function initMemberLogin() {
    var links = document.querySelector('.nav .nav-links');
    if (!links || links.querySelector('.member-login')) return;

    var memberLogin = document.createElement('a');
    memberLogin.className = 'member-login';
    memberLogin.href = 'https://portal.holden.health/login';
    memberLogin.textContent = 'Member Login';
    links.appendChild(memberLogin);
  }

  // ---------- Mobile nav ----------
  // Builds a hamburger + slide-down menu from the existing .nav-links so every
  // page gets a working mobile menu without per-page markup.
  function initMobileNav() {
    var inner = document.querySelector('.nav .nav-inner');
    if (!inner || inner.querySelector('.nav-burger')) return;
    var links = inner.querySelector('.nav-links');
    if (!links) return;

    var burger = document.createElement('button');
    burger.className = 'nav-burger';
    burger.setAttribute('aria-label', 'Open menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span></span><span></span><span></span>';
    inner.appendChild(burger);

    var menu = document.createElement('div');
    menu.className = 'mobile-menu';
    menu.id = 'mobile-menu';
    burger.setAttribute('aria-controls', menu.id);
    var nav = document.createElement('nav');
    links.querySelectorAll('a').forEach(function (a) { nav.appendChild(a.cloneNode(true)); });
    var reset = document.createElement('a');
    reset.className = 'btn btn-ghost';
    reset.href = 'wednesday-reset.html';
    reset.textContent = 'Free Wednesday Reset';
    nav.appendChild(reset);
    var cta = document.createElement('a');
    cta.className = 'btn btn-primary';
    cta.href = 'book.html';
    cta.textContent = 'Book a free call';
    nav.appendChild(cta);
    menu.appendChild(nav);
    document.querySelector('.nav').appendChild(menu);

    function close() {
      menu.classList.remove('open');
      burger.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open menu');
      document.body.style.overflow = '';
    }
    function toggle() {
      var open = menu.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    burger.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('click', function (e) {
      if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== burger) close();
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 920) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function initPageA11y() {
    var main = document.querySelector('main, body > section');
    if (main && !main.id) main.id = 'main-content';
    if (main && !document.querySelector('.skip-link')) {
      var skip = document.createElement('a');
      skip.className = 'skip-link';
      skip.href = '#main-content';
      skip.textContent = 'Skip to content';
      document.body.insertBefore(skip, document.body.firstChild);
    }
  }

  function encodeForm(data) {
    return new URLSearchParams(data).toString();
  }

  function initGuideForms() {
    document.querySelectorAll('.guide-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var button = form.querySelector('button');
        var note = form.parentElement.querySelector('.note');
        button.disabled = true;
        button.textContent = 'Sending…';
        fetch('https://portal.holden.health/api/forms', {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: encodeForm(new FormData(form))
        }).then(function (response) {
          if (!response.ok) throw new Error('Submission failed');
          form.reset();
          note.textContent = 'Thanks! Kelsey will email the guide to you shortly.';
          button.textContent = 'Request received ✓';
        }).catch(function () {
          note.innerHTML = 'Something went wrong. Please email <a href="mailto:HoldenHealth.Coaching@gmail.com">HoldenHealth.Coaching@gmail.com</a>.';
          button.disabled = false;
          button.textContent = 'Try again';
        });
      });
    });
  }

  function initNoteForms() {
    document.querySelectorAll('.note-signup').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var button = form.querySelector('button');
        var status = form.parentElement.querySelector('.note-status');
        var originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Joining…';
        fetch('https://portal.holden.health/api/forms', {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: encodeForm(new FormData(form))
        }).then(function (response) {
          if (!response.ok) throw new Error('Submission failed');
          form.reset();
          form.hidden = true;
          status.textContent = "You're on the list. Kelsey will be in touch when the next Note goes out.";
        }).catch(function () {
          status.innerHTML = 'That did not go through. Email <a href="mailto:HoldenHealth.Coaching@gmail.com">Kelsey directly</a> and she’ll add you.';
          button.disabled = false;
          button.textContent = originalText;
        });
      });
    });
  }

  function init() { initPageA11y(); initReveal(); initFaq(); initMemberLogin(); initMobileNav(); initGuideForms(); initNoteForms(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
