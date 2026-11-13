(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const IMG = 'https://framerusercontent.com/images/';

  /* ================= exact spring curves (Framer/motion springs → CSS linear()) ================= */
  const spring = ({ k, c, bounce, duration }) => {
    let w0, zeta;
    if (k) { w0 = Math.sqrt(k); zeta = c / (2 * w0); }
    else { zeta = 1 - bounce; w0 = 4.6 / (zeta * duration); }
    const dt = 1 / 600; let x = 0, v = 0, t = 0; const pts = [];
    while (t < 6) {
      const a = -2 * zeta * w0 * v - w0 * w0 * (x - 1);
      v += a * dt; x += v * dt; t += dt;
      pts.push([t, x]);
      if (t > 0.05 && Math.abs(1 - x) < 0.001 && Math.abs(v) < 0.01) break;
    }
    const n = 48, out = [];
    for (let i = 0; i <= n; i++) {
      const p = pts[Math.min(pts.length - 1, Math.round(((i / n) * t) / dt))];
      out.push(+(i === n ? 1 : p[1]).toFixed(4));
    }
    return { ease: `linear(${out.join(',')})`, dur: (duration && !k ? duration : +t.toFixed(2)) + 's' };
  };
  if (CSS.supports('transition-timing-function', 'linear(0, 1)')) {
    const root = document.documentElement.style;
    const set = (name, s) => { root.setProperty(`--${name}`, s.ease); root.setProperty(`--${name}-d`, s.dur); };
    set('sp-btn', spring({ bounce: .2, duration: .4 }));
    set('sp-head', spring({ bounce: .25, duration: .7 }));
    set('sp-stiff', spring({ k: 320, c: 50 }));
    set('sp-2', spring({ bounce: .2, duration: 2 }));
    set('sp-3', spring({ bounce: .2, duration: 3 }));
  }

  /* ================= smooth scroll (Framer "Smooth Scroll", intensity 20) ================= */
  const b = 0.22 - (0.2 / 0.5) * 0.12;                   // same formula as the original component
  let target = scrollY, pos = scrollY, raf = 0, lt = 0;
  const maxY = () => document.documentElement.scrollHeight - innerHeight;
  const step = now => {
    const dt = lt ? Math.max(0, (now - lt) / 1000) : 1 / 60; lt = now;
    pos += (target - pos) * (1 - Math.exp(-b * 60 * dt));
    if (Math.abs(target - pos) < .35) pos = target;
    scrollTo({ top: pos, behavior: 'instant' });
    if (pos !== target) raf = requestAnimationFrame(step); else { raf = 0; lt = 0; }
  };
  const go = y => { if (!raf) pos = scrollY; target = Math.max(0, Math.min(maxY(), y)); if (!raf) raf = requestAnimationFrame(step); };
  const jump = y => { cancelAnimationFrame(raf); raf = 0; lt = 0; scrollTo({ top: y, behavior: 'instant' }); target = pos = scrollY; };
  addEventListener('wheel', e => {
    if (reduce.matches || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (e.target.closest && e.target.closest('select, iframe')) return;
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    go((raf ? target : scrollY) + d);
  }, { passive: false });
  addEventListener('scroll', () => { if (!raf) target = pos = scrollY; }, { passive: true });

  /* ================= language: EN (source) / LT (assets/i18n-lt.js) ================= */
  const LT = window.TENNICO_LT || { TEXT: {}, HTML: {} };
  const squash = s => s.replace(/\s+/g, ' ').trim();
  let lang = 'en';
  try { lang = localStorage.getItem('tennico-lang') === 'lt' ? 'lt' : 'en'; } catch (e) {}
  let undo = [];                                   // how to put the English back
  const t = s => (lang === 'lt' && LT.TEXT[s]) || s;

  const toLT = () => {
    // 1) headings with coloured words: swap the whole element so word order stays right
    $$('h1, h2, h3, h4, h5, h6, p').forEach(el => {
      if (el.closest('[data-tr]')) return;
      const lt = LT.HTML[squash(el.innerHTML)];
      if (!lt) return;
      const en = el.innerHTML;
      el.innerHTML = lt; el.setAttribute('data-tr', '');
      undo.push(() => { el.innerHTML = en; el.removeAttribute('data-tr'); });
    });
    // 2) plain text nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const p = n.parentElement;
      if (!p || p.closest('[data-tr], script, style, svg')) return;
      const key = squash(n.nodeValue);
      const lt = key && LT.TEXT[key];
      if (!lt) return;
      const en = n.nodeValue;
      n.nodeValue = en.replace(key.length ? en.trim() : en, lt);
      undo.push(() => { n.nodeValue = en; });
    });
    // 3) attributes people see or hear
    $$('[placeholder], [aria-label], [alt], [title]').forEach(el => {
      ['placeholder', 'aria-label', 'alt', 'title'].forEach(attr => {
        const v = el.getAttribute(attr), lt = v && LT.TEXT[squash(v)];
        if (!lt) return;
        el.setAttribute(attr, lt);
        undo.push(() => el.setAttribute(attr, v));
      });
    });
    const title = document.title, ltTitle = LT.TEXT[title];
    if (ltTitle) { document.title = ltTitle; undo.push(() => { document.title = title; }); }
  };
  const toEN = () => { undo.reverse().forEach(fn => fn()); undo = []; };

  const syncLangUI = () => {
    document.documentElement.lang = lang;
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  };
  const setLang = next => {
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem('tennico-lang', lang); } catch (e) {}
    const run = () => { lang === 'lt' ? toLT() : toEN(); syncLangUI(); };
    // same circle reveal as the page transition
    document.startViewTransition && !reduce.matches ? document.startViewTransition(run) : run();
  };

  /* ================= per-page features (re-run after every page swap) ================= */
  let cleanups = [];
  const later = fn => cleanups.push(fn);

  const init = (afterSwap = false) => {
    /* hero background appear: opacity 0 + scale 1.1 → 1 over 1s */
    const heroImg = $('.hero-bg img');
    const showHero = () => requestAnimationFrame(() => requestAnimationFrame(() => $$('.hero-bg, .pshade').forEach(el => el.classList.add('in'))));
    if (heroImg) heroImg.complete ? showHero() : (heroImg.onload = showHero, setTimeout(showHero, 1500));

    /* coaches */
    const grid = $('#coachGrid');
    if (grid) {
      const coaches = [
        ['nSNE6N5ZrYEW2weUsnftPse7E', 'Alex Morgan'], ['rYLzhw86eC9cymZW6FzsGJZjM', 'Marco Reyes'], ['6sNFKl7rBt34XAdXDfMGctMjskM', 'Owen Hartley'],
        ['nXy54qpDdHIv1dY6ELIkCkrQZw', 'Leo Varga'], ['QAF2CF81kcTAzXTlMCpHtnZ0uk', 'Peter Lund'], ['hqsbbZAdVAzQaLdIpljK70WSQ', 'Sam Okafor']
      ];
      grid.innerHTML = coaches.map(([id, name]) => `
        <div class="coach"><img src="${IMG}${id}.png" alt="${name}">
          <div class="identity"><b>${name}</b><span class="soc"><svg><use href="#i-x"/></svg><svg><use href="#i-tt"/></svg><svg><use href="#i-yt"/></svg></span></div>
        </div>`).join('');
    }

    /* pricing table: rows slide in from x:-20, staggered .05s */
    const pbody = $('#pbody');
    if (pbody) {
      const C = '<i class="ck"></i>', D = '<i class="dash"></i>';
      const rows = [
        ['Sessions per week', '3', '4', '5'],
        ['Group training sessions', C, C, C],
        ['Technique fundamentals', C, C, C],
        ['Match play', 'Introduction', C, 'Full match prep'],
        ['Progress tracking', 'Standard', 'Standard', 'Personalized plan'],
        ['Fitness & conditioning', 'General', C, C],
        ['1-on-1 private coaching', D, C, C],
        ['Video analysis', D, C, C],
        ['Nutritional guidance', D, C, C],
        ['Priority booking', D, C, C],
        ['Advanced tactical development', D, D, C]
      ];
      pbody.innerHTML = rows.map((r, i) =>
        `<div class="prow" data-a="row" data-th=".2" style="transition-delay:${(i * .05).toFixed(2)}s">${r.map(c => `<div>${c}</div>`).join('')}</div>`).join('');
    }

    /* FAQ: exactly one item open, .5s height change */
    const acc = $('#acc');
    if (acc) {
      const faqs = [
        ['Who can join the Elite Training Plan?', 'Our Elite Training Plan is designed for advanced and competitive players who want to elevate their performance.'],
        ['Do I need previous tennis experience?', 'Not at all. Our Foundation program starts from zero and coaches group players by level, so everyone feels comfortable from day one.'],
        ['How is my progress measured?', 'Coaches track technique, match stats and fitness benchmarks, with video analysis and regular feedback sessions.'],
        ['Can I customize my training schedule?', 'Yes. Pick the session times that fit you, and switch or add private lessons anytime from your account.'],
        ['Will I receive tournament preparation?', 'Performance and Elite plans include match strategy, mental preparation and tournament planning with your coach.']
      ];
      acc.innerHTML = faqs.map(([q, a], i) => `
        <div class="item${i === 0 ? ' open' : ''}">
          <button class="q" aria-expanded="${i === 0}"><span>${q}</span><i></i></button>
          <div class="a"><div><div class="inner"><p>${a}</p><a href="contact.html" class="btn sm dark"><i class="ib"></i><span>Get in touch</span><svg><use href="#arr"/></svg></a></div></div></div>
        </div>`).join('');
      $$('.item', acc).forEach(item => $('.q', item).addEventListener('click', () => {
        if (item.classList.contains('open')) return;
        $$('.item', acc).forEach(o => { o.classList.remove('open'); $('.q', o).setAttribute('aria-expanded', 'false'); });
        item.classList.add('open'); $('.q', item).setAttribute('aria-expanded', 'true');
      }));
    }

    /* appear-on-scroll (animate once), per-threshold observers */
    const observers = {};
    $$('[data-a]').forEach(el => {
      const th = parseFloat(el.dataset.th || 0);
      if (!observers[th]) observers[th] = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); observers[th].unobserve(e.target); }
      }), { threshold: th });
      observers[th].observe(el);
    });
    later(() => Object.values(observers).forEach(o => o.disconnect()));

    /* counters: count up, 1.6s ease-out-cubic, start at 50% visible */
    const cio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      const el = e.target, to = +el.dataset.to, t0 = performance.now(), dur = 1600;
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur), s = 1 - (1 - p) ** 3;
        el.textContent = Math.round(to * s).toLocaleString('en-US');
        if (p < 1 && el.isConnected) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: .5 });
    $$('.count').forEach(el => cio.observe(el));
    later(() => cio.disconnect());

    /* mobile menu */
    const nav = $('#nav'), burger = $('#burger');
    if (burger) burger.addEventListener('click', () => nav.classList.toggle('open'));

    /* slideshow: instant swap every 2s, dot colour animates */
    if ($('#slider')) {
      const slides = $$('#slider img'), dots = $('#slider .dots');
      let cur = 0, timer;
      slides.forEach((_, i) => { const btn = document.createElement('button'); btn.setAttribute('aria-label', 'Slide ' + (i + 1)); btn.onclick = () => show(i); dots.appendChild(btn); });
      const show = i => {
        slides[cur].classList.remove('on'); dots.children[cur].classList.remove('on');
        cur = i; slides[cur].classList.add('on'); dots.children[cur].classList.add('on');
        clearTimeout(timer); timer = setTimeout(() => show((cur + 1) % slides.length), 2000);
      };
      show(0);
      later(() => clearTimeout(timer));
    }

    /* ticker: constant 60px/s to the left, never pauses */
    const track = $('#track');
    if (track) {
      const ids = ['3R59JfurWFPIeUViu60HAADunfk', 'go3XZ6tkz9LfyFDrxXoF2x7b4', 'ex6OX8fat0IC9MSs2RKLBQE4', 'KBojtd7K5xDgFrqA3rWsMyfhlc', 'nV0cn3Al5DDZeKKsihCvzPYM', 'tVs1K74neA2pMcZA4nVB5Qgg'];
      const set = ids.map(id => `<img src="${IMG}${id}.png" alt="" loading="lazy">`).join('');
      track.innerHTML = set + set + set + set;
      let tx = 0, last = 0, half = 0, id = 0;
      const run = now => {
        if (last) {
          half = half || track.scrollWidth / 2;
          tx -= 60 * Math.min(.1, (now - last) / 1000);
          if (half && -tx >= half) tx += half;
          track.style.transform = `translateX(${tx}px)`;
        }
        last = now; id = requestAnimationFrame(run);
      };
      id = requestAnimationFrame(run);
      const onResize = () => { half = 0; };
      addEventListener('resize', onResize);
      later(() => { cancelAnimationFrame(id); removeEventListener('resize', onResize); });
    }

    /* videos moved in from a fetched page never start loading on their own,
       so rebuild them as fresh elements created in this document */
    if (afterSwap) $$('video').forEach(old => {
      const v = document.createElement('video');
      [...old.attributes].forEach(a => v.setAttribute(a.name, a.value));
      v.muted = true; v.playsInline = true;
      old.replaceWith(v);
      if (v.autoplay) v.play().catch(() => {});
    });

    /* "Button 2" states: Default → Sending → Success (contact form, Load More) */
    const sendState = btn => {
      const label = $('span', btn);
      label.textContent = t('Sending...');
      const timer = setTimeout(() => { label.textContent = t('Success'); }, 700);
      later(() => clearTimeout(timer));
    };
    const form = $('#form');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); sendState($('.btn', form)); });
    const more = $('#loadMore');
    if (more) more.addEventListener('click', () => sendState(more), { once: true });
    const sub = $('#subForm');
    if (sub) sub.addEventListener('submit', e => { e.preventDefault(); $('.btn span', sub).textContent = t('Subscribed'); });

    /* language switcher + apply the saved language to this page */
    $$('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
    undo = [];
    if (lang === 'lt') toLT();
    syncLangUI();
  };

  /* ================= page navigation with Framer's page transition ================= */
  // Framer swaps pages in place and reveals the new one through a circle mask
  // growing from the centre (0.8s, linear). We do the same with a same-document
  // View Transition; the animation itself lives in site.css (::view-transition-new).
  const norm = p => p.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const isInternalPage = a => a.origin === location.origin && !a.target && !a.hasAttribute('download') &&
    /(\/|\.html)$/.test(a.pathname) && a.getAttribute('href') !== '#';
  const scrollToHash = (hash, smooth) => {
    const el = hash && hash !== '#top' ? document.getElementById(hash.slice(1)) : null;
    const y = el ? el.getBoundingClientRect().top + scrollY : 0;
    smooth && !reduce.matches ? go(y) : jump(y);
  };

  let navigating = false;
  const navigate = async (url, push) => {
    if (navigating) return;
    navigating = true;
    let doc;
    try {
      const res = await fetch(url, { headers: { Accept: 'text/html' } });
      doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      if (!doc.body || !doc.querySelector('#nav')) throw new Error('not a site page');
    } catch (err) { location.href = url; return; }
    const swap = () => {
      cleanups.forEach(fn => fn()); cleanups = [];
      document.title = doc.title;
      document.body.replaceWith(document.adoptNode(doc.body));
      if (push) history.pushState({}, '', url);
      scrollToHash(new URL(url, location.href).hash, false);
      init(true);
    };
    if (document.startViewTransition && !reduce.matches) {
      const vt = document.startViewTransition(swap);
      vt.updateCallbackDone.finally(() => { navigating = false; });   // free as soon as the new page is in
    } else { swap(); navigating = false; }
  };

  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a) return;
    if ($('#nav.open')) $('#nav').classList.remove('open');
    if (a.getAttribute('href') === '#') { e.preventDefault(); return; }
    if (a.origin === location.origin && norm(a.pathname) === norm(location.pathname) && a.hash) {
      e.preventDefault(); history.replaceState({}, '', a.href); scrollToHash(a.hash, true); return;
    }
    if (isInternalPage(a)) { e.preventDefault(); navigate(a.href, true); }
  });
  addEventListener('popstate', () => navigate(location.href, false));

  init();
})();
