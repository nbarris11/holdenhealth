/* ============================================================
   HOLDEN HEALTH | site behavior
   Scroll-reveal on enter · FAQ accordion
   ============================================================ */
(function () {
  'use strict';

  // ---------- Vercel Web Analytics ----------
  // The public website is plain HTML, so load Vercel's tracking script once
  // through this shared file instead of adding it to every page by hand.
  function initVercelAnalytics() {
    if (document.querySelector('script[data-vercel-analytics]')) return;

    window.va = window.va || function () {
      (window.vaq = window.vaq || []).push(arguments);
    };

    var analytics = document.createElement('script');
    analytics.defer = true;
    analytics.src = '/_vercel/insights/script.js';
    analytics.setAttribute('data-vercel-analytics', 'true');
    document.head.appendChild(analytics);
  }

  initVercelAnalytics();

  // Shared by all public pages, including managed custom pages.
  if (!document.querySelector('script[data-holden-posthog]')) {
    var replay = document.createElement('script');
    replay.async = true;
    replay.src = '/posthog-public.js';
    replay.setAttribute('data-holden-posthog', 'true');
    document.head.appendChild(replay);
  }

  var managedPagePaths = {
    '/': 'homepage', '/index.html': 'homepage', '/coaching.html': 'coaching', '/fitness-coaching.html': 'training',
    '/about.html': 'about', '/resources.html': 'resources', '/contact.html': 'contact', '/nutrition-coaching.html': 'nutrition',
    '/404.html': 'not-found', '/personal-training.html': 'personal-training', '/backup-plan.html': 'backup-plan', '/book.html': 'booking', '/wednesday-reset.html': 'wednesday-reset', '/quiz.html': 'quiz', '/recipes.html': 'recipes',
    '/first-personal-training-session.html': 'first-training-session', '/online-personal-trainer-vs-workout-app.html': 'online-trainer-vs-app',
    '/20-minute-strength-workout.html': 'strength-workout', '/beginners-guide-to-lifting.html': 'lifting-guide',
    '/get-back-on-track.html': 'back-on-track', '/protein-habit.html': 'protein-habit',
    '/eating-out-with-your-goals.html': 'eating-out', '/blog-all-or-nothing.html': 'all-or-nothing',
    '/wednesday-note.html': 'wednesday-note', '/privacy.html': 'privacy', '/terms.html': 'terms', '/disclaimer.html': 'disclaimer'
  };

  function pageKeyFromPath(pathname) {
    if (managedPagePaths[pathname]) return managedPagePaths[pathname];
    var custom = pathname.match(/^\/pages\/([a-z0-9][a-z0-9-]{1,62})\/?$/);
    return custom ? 'custom:' + custom[1] : '';
  }

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

  // Keep readable links in the HTML, then respect published page visibility.
  function initSiteNavigation() {
    var links = document.querySelector('.nav .nav-links');
    if (!links) return Promise.resolve();
    return fetch('https://portal.holden.health/api/site-content?navigation=1')
      .then(function (response) { if (!response.ok) throw new Error('Navigation unavailable'); return response.json(); })
      .then(function (result) {
        editorNavigationPages = result.pages;
        if (editorDraftHeader) result.header = editorDraftHeader;
        applySiteNavigation(result);
      })
      .catch(function () { /* Built-in links remain usable without the content service. */ });
  }

  var editorNavigationPages;
  var editorDraftHeader;
  function applySiteNavigation(result) {
    var links = document.querySelector('.nav .nav-links');
    if (!links) return;
        if (!Array.isArray(result.pages) || !result.pages.length) return;
        var pages = result.pages.filter(function (page) {
          return page && typeof page.key === 'string' && typeof page.label === 'string' && typeof page.href === 'string' && /^\/[a-z0-9/-]+(?:\.html)?$/i.test(page.href);
        });
        var header = result.header || {};
        if (!pages.some(function(p){ return p.key === 'personal-training'; })) pages.push({key:'personal-training',label:'Personal Training',href:'/personal-training.html'});
        document.querySelectorAll('.nav .brand').forEach(function (brand) {
          if (header.brand_url) brand.href = safeManagedLink(header.brand_url) || '/index.html';
          var logo = brand.querySelector('img');
          if (logo && header.logo_url) logo.src = safeManagedImage(header.logo_url) || '/assets/logo.png';
          var name = brand.querySelector('span:not(.mark)');
          if (name && (header.brand_name || header.brand_tagline)) {
            name.replaceChildren(document.createTextNode(header.brand_name || 'Holden Health'));
            var tagline = document.createElement('small'); tagline.textContent = header.brand_tagline || 'Train · Nourish · Thrive'; name.appendChild(tagline);
          }
        });
        var currentKey = pageKeyFromPath(window.location.pathname);
        function link(page, label) {
          var a = document.createElement('a'); var destinationKey = page.key === 'coaching' ? 'group_url' : page.key + '_url'; a.href = safeManagedLink(header[destinationKey]) || page.href; a.textContent = label || page.label;
          if (page.key === currentKey) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
          return a;
        }
        function group(label, entries) {
          var details = document.createElement('details'); details.className = 'nav-group';
          var summary = document.createElement('summary'); summary.textContent = label;
          var dropdown = document.createElement('div'); dropdown.className = 'nav-dropdown';
          entries.forEach(function (entry) { dropdown.appendChild(link(entry.page, entry.label)); });
          if (entries.some(function (entry) { return entry.page.key === currentKey; })) summary.classList.add('active');
          details.append(summary, dropdown); return details;
        }
        var fragment = document.createDocumentFragment();
        var coaching = pages.filter(function (p) { return ['coaching', 'training', 'personal-training'].includes(p.key); });
        var coachingEntries = coaching.map(function (p) { return {page:p, label:p.key === 'coaching' ? (header.group_label || 'Group Classes') : p.key === 'training' ? (header.training_label || 'Online Training') : (header['personal-training_label'] || 'Personal Training')}; });
        coachingEntries.push({page:{key:'challenge', label:'Free 14-Day Challenge', href:'https://portal.holden.health/challenge'}});
        fragment.appendChild(group(header.coaching_label || 'Coaching', coachingEntries));
        var about = pages.find(function (p) { return p.key === 'about'; });
        if (about) fragment.appendChild(link(about, header.about_label || 'About'));
        var resources = pages.find(function (p) { return p.key === 'resources'; });
        var extras = pages.filter(function (p) { return !['homepage','coaching','training','nutrition','personal-training','about','resources','contact'].includes(p.key); });
        if (extras.length) fragment.appendChild(group(header.resources_label || 'Resources', (resources ? [{page:resources,label:header.resources_all_label || 'All resources'}] : []).concat(extras.map(function (p) { return {page:p}; }))));
        else if (resources) fragment.appendChild(link(resources, header.resources_label || 'Resources'));
        var app = document.createElement('a'); app.href = safeManagedLink(header.app_url) || '/index.html#the-app'; app.textContent = header.app_label || 'The App'; if (header.app_visible !== false) fragment.appendChild(app);
        links.replaceChildren(fragment);
        var cta = document.querySelector('.nav-cta');
        if (cta) {
          cta.replaceChildren();
          [{key:'login',label:'Log in',url:'https://portal.holden.health/login',className:'member-login'}, {key:'call',label:'Free call',url:'/book.html',className:'btn btn-ghost'}, {key:'join',label:'Join group classes',url:'https://portal.holden.health/register',className:'btn btn-primary'}].forEach(function (item) {
            if (header[item.key + '_visible'] === false) return;
            var a = document.createElement('a'); a.className=item.className; a.textContent=header[item.key + '_label'] || item.label; a.href=safeManagedLink(header[item.key + '_url']) || item.url; if (item.key === 'join' && ['training','personal-training'].includes(currentKey)) { a.textContent=header.consult_label || 'Free consultation'; a.href=safeManagedLink(header.consult_url) || '/book.html'; } cta.appendChild(a);
          });
        }
        refreshMobileLinks();
  }

  function refreshMobileLinks() {
    var mobile = document.querySelector('.mobile-menu nav');
    var desktop = document.querySelector('.nav-links');
    if (!mobile || !desktop) return;
    mobile.replaceChildren();
    Array.from(desktop.children).forEach(function (child) { mobile.appendChild(child.cloneNode(true)); });
    document.querySelectorAll('.nav-cta a').forEach(function (a) { mobile.appendChild(a.cloneNode(true)); });
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
    nav.setAttribute('aria-label', 'Mobile navigation');
    menu.appendChild(nav);
    document.querySelector('.nav').appendChild(menu);
    refreshMobileLinks();

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
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    document.addEventListener('click', function (e) {
      if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== burger) close();
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 920) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.nav-group[open]').forEach(function (group) { group.open = false; });
      if (menu.classList.contains('open')) { close(); burger.focus(); }
    });
    document.addEventListener('click', function (e) {
      document.querySelectorAll('.nav-group[open]').forEach(function (group) { if (!group.contains(e.target)) group.open = false; });
    });
  }

  // Drop-in promotion can be paused between sessions without deleting the
  // booking page or its history. It starts hidden to avoid a flash of stale CTAs.
  function applyDropInVisibility(visible) {
    document.querySelectorAll('a[href*="portal.holden.health/drop-in"]').forEach(function (link) {
      var promotion = link.closest('[data-drop-in-promotion]') || link.closest('li') || link;
      promotion.hidden = !visible;
      promotion.style.display = visible ? '' : 'none';
    });
    if (!visible) {
      document.querySelectorAll('[data-drop-in-fallback]').forEach(function (element) {
        element.textContent = element.getAttribute('data-drop-in-fallback') || '';
      });
    }
  }

  function initDropInVisibility() {
    applyDropInVisibility(false);
    fetch('https://portal.holden.health/api/site-content?page=homepage')
      .then(function (response) { if (!response.ok) throw new Error('Setting unavailable'); return response.json(); })
      .then(function (content) { applyDropInVisibility(content.drop_in_visible === true); })
      .catch(function () { /* Keep promotions hidden when the setting cannot be checked. */ });
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
          note.innerHTML = 'Your guide is on its way. Check your inbox, or <a href="assets/holden-health-5-habits-guide.pdf" download>download it now</a>.';
          button.textContent = 'Guide sent ✓';
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
          button.textContent = "You’re on the list ✓";
          status.innerHTML = 'You\'re on the list. Your copy is also on its way by email.<br><a class="note-download" href="backup-plan.html">Read The Backup Plan Still Works</a>';
        }).catch(function () {
          status.innerHTML = 'That did not go through. Email <a href="mailto:HoldenHealth.Coaching@gmail.com">Kelsey directly</a> and she’ll add you.';
          button.disabled = false;
          button.textContent = originalText;
        });
      });
    });
  }

  function safeManagedLink(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    var link = value.trim();
    if (/^https?:\/\//i.test(link) || /^(\/|#|[a-z0-9][a-z0-9._/-]*$)/i.test(link)) return link;
    return '';
  }

  function safeManagedImage(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    var image = value.trim();
    if (/^https:\/\//i.test(image) || /^(\/|assets\/)/i.test(image)) return image;
    return '';
  }

  var appliedVisualOriginals = [];
  var activeEditorSectionId = '';
  var managedTextStyleClasses = [
    'holden-managed-text-breaks', 'holden-edit-font-display', 'holden-edit-font-clean',
    'holden-edit-size-small', 'holden-edit-size-large', 'holden-edit-color-purple',
    'holden-edit-color-aqua', 'holden-edit-align-center', 'holden-edit-bold', 'holden-edit-italic'
  ];

  function resetAppliedVisualOverrides() {
    appliedVisualOriginals.forEach(function (original) {
      var element;
      element = original.element;
      if (!element || !element.isConnected || !element.matches(original.selector)) return;
      if (!element) return;
      if (original.text !== undefined) element.textContent = original.text;
      if (original.text !== undefined) {
        managedTextStyleClasses.forEach(function (className) { element.classList.remove(className); });
        (original.managedClasses || []).forEach(function (className) { element.classList.add(className); });
      }
      if (original.placeholder === null) element.removeAttribute('placeholder');
      else if (original.placeholder !== undefined) element.setAttribute('placeholder', original.placeholder);
      if (original.href !== undefined) element.setAttribute('href', original.href);
      if (original.src !== undefined) element.setAttribute('src', original.src);
      if (original.alt !== undefined) element.setAttribute('alt', original.alt);
      if (original.display !== undefined) element.style.display = original.display;
    });
    appliedVisualOriginals = [];
  }

  function applyVisualOverrides(rawOverrides) {
    var overrides = rawOverrides;
    if (typeof overrides === 'string') {
      try { overrides = JSON.parse(overrides); } catch (_) { return; }
    }
    if (!Array.isArray(overrides)) return;
    appliedVisualOriginals = appliedVisualOriginals.filter(function (original) { return original.element && original.element.isConnected; });
    overrides.slice(0, 1000).forEach(function (change) {
      if (!change || typeof change.selector !== 'string') return;
      var element;
      try { element = document.querySelector(change.selector); } catch (_) { return; }
      if (!element || element.closest('script,style,noscript,svg,.nav,[data-featured-program]')) return;
      if (!appliedVisualOriginals.some(function (original) { return original.element === element; })) appliedVisualOriginals.push({
        element: element,
        selector: change.selector,
        placeholder: typeof change.placeholder === 'string' ? element.getAttribute('placeholder') : undefined,
        text: typeof change.text === 'string' ? element.textContent : undefined,
        managedClasses: typeof change.text === 'string' ? managedTextStyleClasses.filter(function (className) { return element.classList.contains(className); }) : undefined,
        href: typeof change.href === 'string' && element.matches('a') ? element.getAttribute('href') || '' : undefined,
        src: typeof change.src === 'string' && element.matches('img') ? element.getAttribute('src') || '' : undefined,
        alt: typeof change.alt === 'string' && element.matches('img') ? element.getAttribute('alt') || '' : undefined,
        display: change.hidden === true ? element.style.display : undefined
      });
      if (typeof change.placeholder === 'string' && element.matches('input,textarea')) element.setAttribute('placeholder', change.placeholder);
      if (change.hidden === true) element.style.display = 'none';
      if (typeof change.text === 'string') {
        if (element.textContent !== change.text) element.textContent = change.text;
        managedTextStyleClasses.forEach(function (className) { element.classList.remove(className); });
        element.classList.add('holden-managed-text-breaks');
        if (change.font === 'display') element.classList.add('holden-edit-font-display');
        if (change.font === 'clean') element.classList.add('holden-edit-font-clean');
        if (change.size === 'small') element.classList.add('holden-edit-size-small');
        if (change.size === 'large') element.classList.add('holden-edit-size-large');
        if (change.color === 'purple') element.classList.add('holden-edit-color-purple');
        if (change.color === 'aqua') element.classList.add('holden-edit-color-aqua');
        if (change.align === 'center') element.classList.add('holden-edit-align-center');
        if (change.bold === true) element.classList.add('holden-edit-bold');
        if (change.italic === true) element.classList.add('holden-edit-italic');
      }
      if (typeof change.href === 'string' && element.matches('a')) {
        var link = safeManagedLink(change.href);
        if (link || /^mailto:|^tel:/i.test(change.href)) element.setAttribute('href', link || change.href);
      }
      if (typeof change.src === 'string' && element.matches('img')) {
        var image = safeManagedImage(change.src);
        if (image) element.setAttribute('src', image);
      }
      if (typeof change.alt === 'string' && element.matches('img')) element.setAttribute('alt', change.alt);
    });
  }

  function customText(tag, className, field, value) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (field) element.setAttribute('data-custom-field', field);
    element.textContent = typeof value === 'string' ? value : '';
    return element;
  }

  function renderCustomSections(rawSections) {
    var existing = document.querySelector('[data-holden-custom-sections]');
    if (existing) existing.remove();
    var sections = rawSections;
    if (typeof sections === 'string') {
      try { sections = JSON.parse(sections); } catch (_) { return; }
    }
    if (!Array.isArray(sections) || !sections.length) return;
    prepareEditableText();
    initEditableContentObserver();
    var editorPreview = new URLSearchParams(window.location.search).get('holden-editor') === '1' && window.parent !== window;
    var container = document.createElement('div');
    container.setAttribute('data-holden-custom-sections', '');
    sections.slice(0, 20).forEach(function (item) {
      if (!item || typeof item.id !== 'string' || typeof item.template !== 'string') return;
      if (item.hidden && !editorPreview) return;
      var section = document.createElement('section');
      section.className = 'section holden-custom-section holden-custom-' + item.template + ' holden-theme-' + (item.theme || 'light') + (item.hidden ? ' holden-section-hidden-editor' : '');
      section.setAttribute('data-holden-section-id', item.id);
      var wrap = document.createElement('div');
      wrap.className = 'wrap holden-custom-wrap';
      if (item.hidden) wrap.appendChild(customText('span', 'holden-hidden-note', '', 'Hidden when published'));
      var eyebrow = customText('span', 'eyebrow', 'eyebrow', item.eyebrow);
      var heading = customText('h2', '', 'heading', item.heading);
      var body = customText(item.template === 'testimonial' ? 'blockquote' : 'p', 'holden-custom-body holden-managed-text-breaks', 'body', item.body);

      if (item.template === 'text-photo') {
        var grid = document.createElement('div');
        grid.className = 'holden-custom-split';
        var copy = document.createElement('div');
        copy.className = 'holden-custom-copy';
        copy.appendChild(eyebrow); copy.appendChild(heading); copy.appendChild(body);
        var photo = document.createElement('div');
        photo.className = 'holden-custom-photo';
        var image = document.createElement('img');
        image.setAttribute('data-custom-field', 'image');
        image.src = safeManagedImage(item.imageSrc) || 'assets/photos/kelsey-holden-portrait.jpg';
        image.alt = typeof item.imageAlt === 'string' ? item.imageAlt : '';
        photo.appendChild(image); grid.appendChild(copy); grid.appendChild(photo); wrap.appendChild(grid);
      } else if (item.template === 'faq') {
        wrap.appendChild(eyebrow); wrap.appendChild(heading);
        var list = document.createElement('div');
        list.className = 'holden-custom-faq-list';
        (Array.isArray(item.items) ? item.items : []).slice(0, 12).forEach(function (faq, index) {
          var details = document.createElement('details');
          var summary = customText('summary', '', 'faq-question-' + index, faq && faq.question);
          var answer = customText('p', 'holden-managed-text-breaks', 'faq-answer-' + index, faq && faq.answer);
          details.appendChild(summary); details.appendChild(answer); list.appendChild(details);
        });
        wrap.appendChild(list);
      } else {
        wrap.appendChild(eyebrow); wrap.appendChild(heading); wrap.appendChild(body);
        if (item.template === 'testimonial') wrap.appendChild(customText('cite', '', 'attribution', item.attribution));
        if (item.template === 'call-to-action' && item.buttonLabel) {
          var link = safeManagedLink(item.buttonUrl);
          if (link || /^mailto:|^tel:/i.test(item.buttonUrl || '')) {
            var button = customText('a', 'btn btn-light', 'buttonLabel', item.buttonLabel);
            button.href = link || item.buttonUrl;
            wrap.appendChild(button);
          }
        }
      }
      section.appendChild(wrap); container.appendChild(section);
    });
    var footer = document.querySelector('footer');
    if (footer && footer.parentNode) footer.parentNode.insertBefore(container, footer);
    else document.body.appendChild(container);
    if (activeEditorSectionId) {
      var activeSection = container.querySelector('[data-holden-section-id="' + activeEditorSectionId.replace(/"/g, '\\"') + '"]');
      if (activeSection) activeSection.classList.add('holden-editor-selected');
    }
  }

  function applyManagedSiteContent(content) {
    if (content && typeof content.seo_title === 'string' && content.seo_title.trim()) {
      document.title = content.seo_title;
      document.querySelectorAll('meta[property="og:title"]').forEach(function (el) { el.content=content.seo_title; });
    }
    if (content && typeof content.seo_description === 'string' && content.seo_description.trim()) {
      document.querySelectorAll('meta[name="description"], meta[property="og:description"]').forEach(function (el) { el.content=content.seo_description; });
    }
    if (!content || typeof content !== 'object') return;
    if (editorContentObserver) editorContentObserver.disconnect();
    resetAppliedVisualOverrides();
    document.querySelectorAll('[data-site-content]').forEach(function (element) {
      var key = element.getAttribute('data-site-content');
      if (typeof content[key] === 'string' && content[key]) element.textContent = content[key];
    });
    document.querySelectorAll('[data-site-link]').forEach(function (element) {
      var key = element.getAttribute('data-site-link');
      var link = safeManagedLink(content[key]);
      if (link) element.setAttribute('href', link);
    });
    if (/^\/pages\//.test(window.location.pathname) && typeof content.hero_heading === 'string' && content.hero_heading) document.title = content.hero_heading + ' | Holden Health';
    var schedule = document.querySelector('[data-class-schedule]');
    if (schedule && Array.isArray(content.class_schedule) && content.class_schedule.length && !schedule.dataset.managedScheduleLoaded) {
      schedule.dataset.managedScheduleLoaded = 'true';
      schedule.querySelectorAll('[data-schedule-fallback]').forEach(function (element) { element.remove(); });
      var persistentCard = schedule.querySelector('.step:last-child');
      content.class_schedule.forEach(function (slot) {
        var card = document.createElement('div');
        card.className = 'step reveal in';
        var day = document.createElement('div');
        day.className = 'num';
        day.textContent = String(slot.weekday || 'Class').slice(0, 3).toUpperCase();
        var time = document.createElement('h4');
        time.textContent = slot.time || '';
        var note = document.createElement('p');
        note.textContent = 'One focused hour of coached total-body conditioning.';
        card.appendChild(day);
        card.appendChild(time);
        card.appendChild(note);
        schedule.insertBefore(card, persistentCard);
      });
    }
    renderCustomSections(content.custom_sections);
    prepareEditableText();
    latestVisualOverrides = content.visual_overrides || [];
    applyVisualOverrides(latestVisualOverrides);
    if (Object.prototype.hasOwnProperty.call(content, 'featured_program')) applyFeaturedProgram(content.featured_program);
    applyDropInVisibility(content.drop_in_visible === true);
    sendEditorInventory();
    observeEditableContent();
  }

  function applyFeaturedProgram(program) {
    var blocks = document.querySelectorAll('[data-featured-program]');
    if (!blocks.length) return;
    if (!program || !program.id) { blocks.forEach(function (block) { block.hidden = true; }); return; }
    var url = 'https://portal.holden.health/register?session=' + encodeURIComponent(program.id);
    function dateLabel(value, year) {
      var date = new Date(value + 'T12:00:00Z');
      return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: year ? 'numeric' : undefined, timeZone: 'UTC' }).format(date);
    }
    var dates = dateLabel(program.starts_on, false) + '–' + dateLabel(program.ends_on, true);
    var times = Array.isArray(program.class_times) ? program.class_times.map(function (slot) { return slot.weekday + ' ' + slot.time; }).join(' · ') : '';
    var price = program.format === 'weekly'
      ? '$' + (program.first_price_cents / 100).toFixed(0) + ' for 2 days/week · $' + (program.second_price_cents / 100).toFixed(0) + ' for 3 days/week'
      : '$' + (program.first_price_cents / 100).toFixed(0) + ' new · $' + (program.second_price_cents / 100).toFixed(0) + ' returning';
    blocks.forEach(function (block) {
      block.hidden = false;
      if (block.classList.contains('mini-alert')) {
        var summary = block.querySelector('p');
        var detail = block.querySelector('a');
        if (summary) summary.textContent = program.name + ' is open: ' + dates + ' · ' + price + '.';
        if (detail) { detail.href = '/coaching.html#next-session'; detail.textContent = 'See details →'; }
        return;
      }
      var title = block.querySelector('[data-site-content="mini_heading"]');
      var eyebrow = block.querySelector('[data-site-content="mini_eyebrow"]');
      var body = block.querySelector('[data-site-content="mini_body"]');
      var button = block.querySelector('[data-site-content="mini_cta_label"]');
      var link = block.querySelector('[data-site-link="mini_cta_url"]');
      var facts = block.querySelector('.mini-offer-facts');
      if (eyebrow) eyebrow.textContent = 'Now enrolling · ' + dates;
      if (title) title.textContent = program.headline || 'Join ' + program.name + '.';
      if (body) body.textContent = program.body || program.description || 'Join Kelsey for coached group fitness in Plymouth.';
      if (button) button.textContent = program.button || 'See dates and sign up';
      if (link) link.href = url;
      if (facts) {
        var rows = facts.querySelectorAll('strong,span');
        if (rows[0]) rows[0].textContent = dates + ' · Plymouth';
        if (rows[1]) rows[1].textContent = times || 'Class times will be posted soon.';
        if (rows[2]) rows[2].textContent = price;
        if (rows[3]) rows[3].textContent = program.format === 'weekly' ? 'Choose your weekly plan. View the schedule and reserve your place.' : 'One package covers every class. View the schedule and reserve your place.';
      }
    });
  }

  function initLegacyProgramVisibility() {
    var today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    document.querySelectorAll('[data-legacy-program-end]').forEach(function (section) {
      if (section.getAttribute('data-legacy-program-end') < today) section.hidden = true;
    });
  }

  function stableElementSelector(element) {
    var key = element.getAttribute("data-holden-edit-key");
    var selector = structuralElementSelector(element);
    return key ? selector + '[data-holden-edit-key="' + key + '"]' : selector;
  }

  function structuralElementSelector(element) {
    var contentKey = element.getAttribute('data-site-content');
    if (contentKey) return '[data-site-content="' + contentKey.replace(/"/g, '\\"') + '"]';
    var linkKey = element.getAttribute('data-site-link');
    if (linkKey) return '[data-site-link="' + linkKey.replace(/"/g, '\\"') + '"]';
    if (element.id && window.CSS && CSS.escape) return '#' + CSS.escape(element.id);
    var parts = [];
    var current = element;
    while (current && current !== document.body) {
      var tag = current.tagName.toLowerCase();
      var siblings = current.parentElement ? Array.prototype.filter.call(current.parentElement.children, function (child) { return child.tagName === current.tagName; }) : [];
      if (siblings.length > 1) tag += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
      parts.unshift(tag);
      current = current.parentElement;
    }
    return 'body > ' + parts.join(' > ');
  }

  function visualEditorLabel(element, image, link) {
    if (image) return image.getAttribute('alt') || 'Photo';
    if (link) return element.matches('.btn') || element.closest('.btn') ? 'Button' : 'Link';
    var labels = { H1: 'Main heading', H2: 'Heading', H3: 'Heading', H4: 'Heading', H5: 'Heading', P: 'Paragraph', LI: 'List item', SMALL: 'Small text', FIGCAPTION: 'Photo caption' };
    return labels[element.tagName] || 'Text';
  }

  var editorExcluded = 'script,style,noscript,svg,textarea,select,option,[data-holden-section-id],[data-featured-program],.nav,.mobile-menu,.skip-link';
  var editorContentObserver;
  var editorPageKey = '';
  var latestVisualOverrides = [];
  var editorBrowseMode = false;
  var editorReviewMode = false;

  function editableContentKey(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(36);
  }

  function prepareEditableText() {
    document.body.querySelectorAll('*').forEach(function (element) {
      if (element.closest(editorExcluded) || !element.children.length) return;
      // Preserve the original inline elements and their listeners. Only give otherwise
      // unreachable text nodes a selectable surface. Whitespace stays outside it.
      Array.from(element.childNodes).forEach(function (node) {
        if (node.nodeType !== 3 || !node.textContent.trim()) return;
        var parts = node.textContent.match(/^(\s*)([\s\S]*?)(\s*)$/);
        var text = document.createElement('holden-edit-text');
        text.textContent = parts[2];
        node.replaceWith(document.createTextNode(parts[1]), text, document.createTextNode(parts[3]));
      });
    });
    document.body.querySelectorAll('*').forEach(function (element) {
      if (element.hasAttribute('data-holden-edit-key') || element.closest('.nav,.mobile-menu,[data-holden-section-id],script,style,svg')) return;
      var original = element.matches('img') ? element.getAttribute('src') : element.matches('input,textarea') ? element.getAttribute('placeholder') : element.textContent;
      element.setAttribute('data-holden-edit-key', editableContentKey(element.tagName + ':' + (original || '')));
    });
  }

  function editableSelection(element) {
    if (!element || (element.closest(editorExcluded) && !element.matches('textarea,option'))) return null;
    var image = element.matches('img');
    var link = element.matches('a[href]');
    var input = element.matches('input:not([type="hidden"]),textarea');
    var text = !image && !input && !element.children.length && element.textContent.trim();
    if (!image && !link && !input && !text) return null;
    var selection = { selector: stableElementSelector(element), kind: image ? 'image' : link ? 'link' : input ? 'input' : 'text', label: input ? 'Form placeholder' : visualEditorLabel(element, image ? element : null, link ? element : null) };
    if (text) selection.text = element.textContent.trim();
    if (link) {
      selection.href = element.getAttribute('href') || '';
      try { var destination = new URL(selection.href, window.location.href); if (destination.searchParams.has('holden-editor')) { destination.searchParams.delete('holden-editor'); selection.href = destination.origin === window.location.origin ? destination.pathname + destination.search + destination.hash : destination.href; } } catch (_) {}
    }
    if (image) { selection.src = element.getAttribute('src') || ''; selection.alt = element.getAttribute('alt') || ''; }
    if (input) selection.placeholder = element.getAttribute('placeholder') || '';
    selection.legacySelector = structuralElementSelector(element);
    selection.summary = (selection.text || selection.alt || selection.placeholder || element.textContent || selection.href || selection.label).trim().slice(0, 160);
    selection.offscreen = !element.getClientRects().length;
    return selection;
  }

  function sendEditorInventory() {
    if (!editorPageKey) return;
    var items = [];
    document.body.querySelectorAll('*').forEach(function (element) {
      var item = editableSelection(element);
      if (item) items.push(item);
    });
    window.parent.postMessage({ type: 'holden-health-editor-inventory', pageKey: editorPageKey, items: items }, 'https://portal.holden.health');
  }

  function observeEditableContent() {
    if (!editorContentObserver) return;
    editorContentObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function initEditableContentObserver() {
    if (editorContentObserver) return;
    editorContentObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        var target = mutation.target.nodeType === 3 ? mutation.target.parentElement : mutation.target;
        if (target instanceof Element) target.removeAttribute('data-holden-edit-key');
      });
      editorContentObserver.disconnect();
      prepareEditableText();
      // Newly rendered cards, quiz steps and messages receive their published edits too.
      applyVisualOverrides(latestVisualOverrides);
      sendEditorInventory();
      observeEditableContent();
    });
    observeEditableContent();
  }

  function selectVisualEditorElement(element, pageKey) {
    if (!element) return;
    if (element.closest('.nav')) {
      window.parent.postMessage({type:'holden-health-editor-header'}, 'https://portal.holden.health');
      return;
    }
    var customSection = element.closest('[data-holden-section-id]');
    document.querySelectorAll('.holden-editor-selected').forEach(function (item) { item.classList.remove('holden-editor-selected'); });
    if (customSection) {
      activeEditorSectionId = customSection.getAttribute('data-holden-section-id') || '';
      customSection.classList.add('holden-editor-selected');
      window.parent.postMessage({ type: 'holden-health-editor-selection', pageKey: pageKey, selection: { selector: '[data-holden-section-id="' + activeEditorSectionId.replace(/"/g, '\\"') + '"]', kind: 'section', label: 'Custom section', customSectionId: activeEditorSectionId } }, 'https://portal.holden.health');
      return;
    }
    activeEditorSectionId = '';
    var selection = editableSelection(element);
    if (!selection) return;
    element.classList.add('holden-editor-selected');
    window.parent.postMessage({ type: 'holden-health-editor-selection', pageKey: pageKey, selection: selection }, 'https://portal.holden.health');
  }

  function initVisualEditorSelection(pageKey) {
    editorPageKey = pageKey;
    var customerFetch = window.fetch;
    window.fetch = function (input, options) {
      var method = String((options && options.method) || (input && input.method) || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') return Promise.reject(new Error('Customer submissions are disabled in the website editor.'));
      return customerFetch.call(window, input, options);
    };
    prepareEditableText();
    document.body.classList.add('holden-visual-editing');
    var style = document.createElement('style');
    style.textContent = '.holden-visual-editing holden-edit-text,.holden-visual-editing label,.holden-visual-editing button,.holden-visual-editing input,.holden-visual-editing textarea,.holden-visual-editing h1,.holden-visual-editing h2,.holden-visual-editing h3,.holden-visual-editing h4,.holden-visual-editing h5,.holden-visual-editing p,.holden-visual-editing li,.holden-visual-editing span,.holden-visual-editing b,.holden-visual-editing strong,.holden-visual-editing small,.holden-visual-editing figcaption,.holden-visual-editing a,.holden-visual-editing img,.holden-visual-editing [data-holden-section-id],.holden-visual-editing [data-featured-program],.holden-visual-editing [data-featured-program] *{cursor:pointer}.holden-editor-selected{outline:4px solid #8b5cf6!important;outline-offset:4px!important;border-radius:4px}.holden-visual-editing img.holden-editor-selected{border-radius:12px}';
    document.head.appendChild(style);
    document.addEventListener('click', function (event) {
      var clicked = event.target instanceof Element ? event.target : null;
      if (!clicked) return;
      if (editorBrowseMode) {
        // Allow exploring quiz steps and accordions, but never submit a customer form.
        if (clicked.closest('button[type="submit"],input[type="submit"]')) { event.preventDefault(); event.stopImmediatePropagation(); }
        var browseLink = clicked.closest('a[href]');
        if (browseLink) {
          try {
            var browseUrl = new URL(browseLink.href, window.location.href);
            if (editorReviewMode || browseUrl.origin !== window.location.origin || !pageKeyFromPath(browseUrl.pathname)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
            browseUrl.searchParams.set('holden-editor', '1'); browseLink.href = browseUrl.href;
          } catch (_) { event.preventDefault(); event.stopImmediatePropagation(); }
        }
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (clicked.closest('[data-featured-program]')) {
        window.parent.postMessage({ type: 'holden-health-editor-featured-program' }, 'https://portal.holden.health');
        return;
      }
      if (clicked.closest('.nav,.mobile-menu')) {
        window.parent.postMessage({type:'holden-health-editor-header'}, 'https://portal.holden.health');
        return;
      }
      var customField = clicked.closest('[data-holden-section-id]');
      var element = customField || clicked;
      if (!customField) while (element && !editableSelection(element)) element = element.parentElement;
      if (!element) return;
      selectVisualEditorElement(element, pageKey);
    }, true);
    document.addEventListener('submit', function (event) { event.preventDefault(); event.stopImmediatePropagation(); }, true);
    sendEditorInventory();
  }

  function initManagedSiteContent() {
    var pageKey = pageKeyFromPath(window.location.pathname);
    if (!pageKey) return;
    prepareEditableText();
    initEditableContentObserver();
    var editorPreview = new URLSearchParams(window.location.search).get('holden-editor') === '1';
    if (!editorPreview || window.parent === window) {
      fetch('https://portal.holden.health/api/site-content?page=' + encodeURIComponent(pageKey))
        .then(function (response) { if (!response.ok) throw new Error('Content unavailable'); return response.json(); })
        .then(applyManagedSiteContent)
        .catch(function () {
          if (/^custom:/.test(pageKey)) window.location.replace('/404.html');
          /* Built-in pages keep their embedded copy as a safe fallback. */
        });
      return;
    }
    document.querySelectorAll('a[href]').forEach(function (link) {
      try {
        var target = new URL(link.getAttribute('href'), window.location.href);
        if (target.origin !== window.location.origin || !pageKeyFromPath(target.pathname)) return;
        target.searchParams.set('holden-editor', '1');
        link.href = target.href;
      } catch (_) { /* Leave malformed or special links untouched. */ }
    });
    var editorParentContent;
    var editorPublicContent;
    {
      fetch('https://portal.holden.health/api/site-content?page=' + encodeURIComponent(pageKey))
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (result) { if (result) { editorPublicContent=result; applyManagedSiteContent(Object.assign({}, result, editorParentContent || {})); } })
        .catch(function () { /* Keep the embedded preview when the content service is unavailable. */ });
    }
    window.addEventListener('message', function (event) {
      if (event.origin !== 'https://portal.holden.health' || event.source !== window.parent) return;
      if (!event.data) return;
      if (event.data.type === 'holden-health-editor-mode') { editorBrowseMode = event.data.browse === true; return; }
      if (event.data.type === 'holden-health-editor-focus') {
        var target;
        if (typeof event.data.selector === 'string') {
          try { target = document.querySelector(event.data.selector); } catch (_) { return; }
        } else target = event.data.sectionId ? document.querySelector('[data-holden-section-id="' + String(event.data.sectionId).replace(/"/g, '\\"') + '"]') : document.querySelector('[data-site-content="' + String(event.data.contentKey || '').replace(/"/g, '\\"') + '"]');
        if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); selectVisualEditorElement(target, pageKey); }
        return;
      }
      if (event.data.type !== 'holden-health-editor-preview') return;
      if (event.data.pageKey && event.data.pageKey !== pageKey) return;
      editorParentContent = event.data.content;
      editorReviewMode = event.data.review === true;
      editorBrowseMode = editorReviewMode;
      document.body.classList.toggle('holden-visual-editing', !editorReviewMode);
      applyManagedSiteContent(Object.assign({}, editorPublicContent || {}, editorParentContent));
      if (editorReviewMode) document.querySelectorAll('.holden-editor-selected').forEach(function(el){el.classList.remove('holden-editor-selected');});
      if (event.data.header) {
        editorDraftHeader=event.data.header;
        if (editorNavigationPages) applySiteNavigation({pages:editorNavigationPages,header:editorDraftHeader});
      }
      window.parent.postMessage({type:'holden-health-editor-applied',pageKey:pageKey,requestId:event.data.requestId},event.origin);
    });
    initVisualEditorSelection(pageKey);
    window.parent.postMessage({ type: 'holden-health-editor-ready', pageKey: pageKey, pathname: window.location.pathname }, 'https://portal.holden.health');
  }

  function init() { initPageA11y(); initLegacyProgramVisibility(); initReveal(); initFaq(); initMobileNav(); initSiteNavigation(); initDropInVisibility(); initGuideForms(); initNoteForms(); initManagedSiteContent(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
