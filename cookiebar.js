/*!
 * TRPL CookieBar — brand and territory layer for the Termly consent banner.
 * https://cookiebar.labs.trlibrary.com · Theodore Roosevelt Presidential Library
 *
 * Termly decides where the banner appears, blocks tracking until consent,
 * records consent and sends Google Consent Mode signals. CookieBar adds:
 *   1. TRPL brand styling on Termly's banner
 *   2. A "Why am I seeing this?" panel naming the visitor's territory and law
 *   3. A note after a visitor declines, explaining what changes
 *   4. A re-ask in each new session for visitors who declined
 *   5. A first-party record cookie with the date of acceptance
 *   6. dataLayer events for GTM
 *
 * Install: see README.md. This file uses only Termly's documented API
 * (Termly.on, Termly.getConsentState, [data-termly-part] attributes).
 */
(function () {
  'use strict';

  var W = window, D = document;
  if (W.__trplCookieBarLoaded) return;
  W.__trplCookieBarLoaded = true;

  var SCRIPT = D.currentScript;
  var BASE = (SCRIPT && SCRIPT.src) ? SCRIPT.src.replace(/[^/]*(\?.*)?$/, '') : 'https://cookiebar.labs.trlibrary.com/';
  var CFG = Object.assign({
    territoriesUrl: BASE + 'territories.json',
    shapesUrl: BASE + 'shapes/',
    cssUrl: BASE + 'cookiebar.css',
    cookieName: 'trpl_cookie_consent',
    cookieDays: 395,               // ~13 months, then Termly/your settings decide
    cookieDomain: guessCookieDomain(),
    reaskEachSession: true,
    privacyUrl: 'https://www.trlibrary.com/privacy-policy',
    debug: /[?&]cookiebar-debug=1/.test(location.search)
  }, W.TRPLCookieBarConfig || {});

  var STORE_KEY = 'trpl_cb_choice';
  var SESSION_KEY = 'trpl_cb_session';
  // 'unclassified' is left out on purpose: it can appear even when a visitor declines.
  var NON_ESSENTIAL = ['performance', 'analytics', 'advertising', 'social_networking'];

  var state = {
    location: null,      // {country, state, continent} from Termly
    regionSettings: null,
    territory: null,     // resolved territory {key, place, law, source}
    territories: null,
    shape: null,         // {viewBox, d} outline of the visitor's state or country
    bannerSeen: false,
    initialized: false
  };

  // ---------- helpers ----------

  function log() { if (CFG.debug && W.console) console.log.apply(console, ['[CookieBar]'].concat([].slice.call(arguments))); }

  function guessCookieDomain() {
    var h = location.hostname;
    return /(^|\.)trlibrary\.com$/.test(h) ? '.trlibrary.com' : '';
  }

  function safe(fn, fallback) { try { return fn(); } catch (e) { log('error', e); return fallback; } }

  function lsGet(k) { return safe(function () { return JSON.parse(localStorage.getItem(k)); }, null); }
  function lsSet(k, v) { safe(function () { localStorage.setItem(k, JSON.stringify(v)); }); }
  function lsDel(k) { safe(function () { localStorage.removeItem(k); }); }
  function ssGet(k) { return safe(function () { return sessionStorage.getItem(k); }, null); }
  function ssSet(k, v) { safe(function () { sessionStorage.setItem(k, v); }); }

  function setCookie(name, value, days) {
    var parts = [name + '=' + encodeURIComponent(value), 'path=/', 'SameSite=Lax'];
    if (days) parts.push('max-age=' + Math.round(days * 86400));
    if (CFG.cookieDomain) parts.push('domain=' + CFG.cookieDomain);
    if (location.protocol === 'https:') parts.push('Secure');
    D.cookie = parts.join('; ');
  }

  function getCookie(name) {
    var m = D.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function delCookie(name) { setCookie(name, '', -1); }

  function push(event, extra) {
    W.dataLayer = W.dataLayer || [];
    W.dataLayer.push(Object.assign({ event: event, cookiebar_region: state.territory ? state.territory.key : null }, extra || {}));
  }

  function el(tag, attrs, children) {
    var n = D.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? D.createTextNode(c) : c); });
    return n;
  }

  function loadCss() {
    if (D.querySelector('link[data-trpl-cookiebar]')) return;
    D.head.appendChild(el('link', { rel: 'stylesheet', href: CFG.cssUrl, 'data-trpl-cookiebar': '' }));
  }

  function loadTerritories() {
    if (state.territories) return Promise.resolve(state.territories);
    return fetch(CFG.territoriesUrl, { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (j) { state.territories = j; return j; })
      .catch(function (e) { log('territories failed', e); state.territories = { territories: {}, groups: {}, fallback: {} }; return state.territories; });
  }

  // ---------- territory resolution ----------

  var US = { 'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY' };
  var CA = { 'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB', 'New Brunswick': 'NB', 'Newfoundland and Labrador': 'NL', 'Nova Scotia': 'NS', 'Ontario': 'ON', 'Prince Edward Island': 'PE', 'Quebec': 'QC', 'Québec': 'QC', 'Saskatchewan': 'SK', 'Northwest Territories': 'NT', 'Nunavut': 'NU', 'Yukon': 'YT' };

  function subdivisionCode(country, name) {
    if (!name) return null;
    if (/^[A-Z]{2}$/.test(name)) return name;
    var map = country === 'US' ? US : country === 'CA' ? CA : null;
    return map ? (map[name] || null) : null;
  }

  function countryName(code) {
    return safe(function () { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code); }, code);
  }

  function resolveTerritory(loc, data) {
    if (!loc || !loc.country) return null;
    var country = String(loc.country).toUpperCase();
    var sub = subdivisionCode(country, loc.state);
    var t = data.territories || {};
    var today = new Date().toISOString().slice(0, 10);
    var keys = [];
    if (sub) keys.push(country + '-' + sub);
    keys.push(country);
    Object.keys(data.groups || {}).forEach(function (g) { if ((data.groups[g] || []).indexOf(country) !== -1) keys.push(g); });

    for (var i = 0; i < keys.length; i++) {
      var entry = t[keys[i]];
      if (entry && (!entry.effective || entry.effective <= today)) {
        return {
          key: keys[i],
          place: entry.place || (sub && keys[i].indexOf('-') !== -1 ? loc.state : countryName(country)),
          law: entry.law,
          source: entry.source || null
        };
      }
    }
    var place = sub ? loc.state : countryName(country);
    return { key: sub ? country + '-' + sub : country, place: place, law: (data.fallback || {}).law, source: null, fallback: true };
  }

  // ---------- consent helpers ----------

  function consentState() {
    return safe(function () { return W.Termly && W.Termly.getConsentState ? W.Termly.getConsentState() : null; }, null);
  }

  function acceptedCategories(cs) {
    if (!cs) return [];
    return NON_ESSENTIAL.filter(function (k) { return cs[k] === true; });
  }

  function openPreferences() {
    push('cookiebar_open_preferences');
    if (typeof W.displayPreferenceModal === 'function') { W.displayPreferenceModal(); return; }
    var link = D.querySelector('.termly-display-preferences');
    if (!link) {
      link = el('a', { href: '#', class: 'termly-display-preferences', style: 'display:none' });
      D.body.appendChild(link);
    }
    link.click();
  }

  // ---------- UI: "Why am I seeing this?" ----------

  // ---------- territory outline ----------

  function shapeKey(loc) {
    if (!loc || !loc.country) return null;
    var c = String(loc.country).toUpperCase();
    var sub = subdivisionCode(c, loc.state);
    return (c === 'US' || c === 'CA') && sub ? c + '-' + sub : c;
  }

  function loadShape() {
    var key = shapeKey(state.location);
    if (!key || !/^[A-Z]{2}(-[A-Z]{2})?$/.test(key)) return Promise.resolve(null);
    return fetch(CFG.shapesUrl + key + '.json', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { state.shape = j && j.d ? j : null; return state.shape; })
      .catch(function () { return null; });
  }

  function shapeSvg() {
    var s = state.shape;
    if (!s) return null;
    var NS = 'http://www.w3.org/2000/svg';
    var svg = D.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', s.viewBox);
    svg.setAttribute('class', 'trpl-cb-shape');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var path = D.createElementNS(NS, 'path');
    path.setAttribute('d', s.d);
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(path);
    return svg;
  }

  // Small tabs that reveal short explanations. Clicking the open tab closes it.
  var TAB_COPY = {
    collected: 'With your OK, the site uses cookies for analytics, advertising and social media features. Essential cookies that keep the site working are always on.',
    decline: 'The site still works. It may feel less personal, and some features, such as embedded videos, may not load. You can change your choice any time from Cookie settings at the bottom of any page.'
  };
  var tabSeq = 0;

  function infoTabs(which) {
    var t = state.territory;
    var defs = [];
    if (t && t.law) defs.push({ id: 'why', label: 'Why this?', render: function (panel) {
      var copy = el('div', { class: 'trpl-cb-why-text' }, [el('strong', { class: 'trpl-cb-place', text: t.place }), el('span', { text: t.law })]);
      if (t.source) {
        copy.lastChild.appendChild(D.createTextNode(' '));
        copy.lastChild.appendChild(el('a', { href: t.source, target: '_blank', rel: 'noopener', text: 'Read the law' }));
      }
      var outline = shapeSvg();
      panel.className = 'trpl-cb-panel trpl-cb-panel--why' + (outline ? ' has-shape' : '');
      if (outline) panel.appendChild(outline);
      panel.appendChild(copy);
    } });
    defs.push({ id: 'collected', label: 'What’s collected', render: function (panel) { panel.textContent = TAB_COPY.collected; } });
    defs.push({ id: 'decline', label: 'If you decline', render: function (panel) { panel.textContent = TAB_COPY.decline; } });
    defs = defs.filter(function (d) { return !which || which.indexOf(d.id) !== -1; });

    var uid = 'trpl-cb-' + (++tabSeq);
    var panel = el('div', { class: 'trpl-cb-panel', id: uid + '-panel', role: 'tabpanel', hidden: '' });
    var buttons = [];
    var current = null;

    function select(i, focus) {
      var d = defs[i];
      if (current === d.id) {             // toggle closed
        current = null;
        panel.hidden = true;
        buttons.forEach(function (b) { b.setAttribute('aria-selected', 'false'); b.setAttribute('aria-expanded', 'false'); });
        return;
      }
      current = d.id;
      buttons.forEach(function (b, j) {
        var on = j === i;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.setAttribute('aria-expanded', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      panel.innerHTML = '';
      panel.className = 'trpl-cb-panel';
      d.render(panel);
      panel.setAttribute('aria-labelledby', uid + '-' + d.id);
      panel.hidden = false;
      if (focus) buttons[i].focus();
      push('cookiebar_tab_opened', { cookiebar_tab: d.id });
    }

    var list = el('div', { class: 'trpl-cb-tabs', role: 'tablist', 'aria-label': 'About cookies' });
    defs.forEach(function (d, i) {
      var btn = el('button', {
        type: 'button', role: 'tab', id: uid + '-' + d.id, class: 'trpl-cb-tab', 'data-tab': d.id,
        'aria-selected': 'false', 'aria-expanded': 'false', 'aria-controls': uid + '-panel', text: d.label,
        onclick: function () { select(i); },
        onkeydown: function (e) {
          var k = e.key, n = defs.length;
          if (k === 'ArrowRight' || k === 'ArrowLeft') {
            e.preventDefault();
            var j = (i + (k === 'ArrowRight' ? 1 : n - 1)) % n;
            buttons[j].focus();
          }
        }
      });
      if (i > 0) btn.tabIndex = -1;
      buttons.push(btn);
      list.appendChild(btn);
    });

    return el('div', { class: 'trpl-cb-info', 'data-trpl-cookiebar-info': '' }, [list, panel]);
  }

  function decorateBanner(banner) {
    if (!banner || !state.territory) return;
    var host = banner.querySelector('[data-termly-part="banner-message"]') || banner;
    if (host.querySelector('[data-trpl-cookiebar-info]')) return;
    host.appendChild(infoTabs());
  }

  function isVisible(n) {
    if (!n || !n.isConnected) return false;
    var s = W.getComputedStyle(n);
    return s.display !== 'none' && s.visibility !== 'hidden' && n.getBoundingClientRect().height > 0;
  }

  function watchBanner() {
    var check = function () {
      var b = D.querySelector('[data-termly-part="consent-banner"]');
      if (b && isVisible(b)) {
        decorateBanner(b);
        if (!state.bannerSeen) {
          state.bannerSeen = true;
          hideOwnBars();
          push('cookiebar_shown', { cookiebar_source: 'termly' });
          log('Termly banner shown for', state.territory);
        }
      }
    };
    new MutationObserver(check).observe(D.documentElement, { childList: true, subtree: true });
    check();
  }

  // ---------- UI: CookieBar's own bars ----------

  var bar = null;

  function hideOwnBars() {
    if (!bar) return;
    var b = bar; bar = null;
    b.classList.remove('is-open');
    setTimeout(function () { b.remove(); }, 300);
  }

  function showBar(opts) {
    hideOwnBars();
    var text = el('div', { class: 'trpl-cb-text' }, [
      el('p', null, [el('strong', { class: 'trpl-cb-lead', text: opts.lead }), ' ' + opts.body]),
      opts.tabs ? infoTabs(opts.tabs) : null
    ]);
    var actions = el('div', { class: 'trpl-cb-actions' }, opts.actions.map(function (a) {
      return el('button', { type: 'button', class: 'trpl-cb-btn' + (a.ghost ? ' trpl-cb-btn--ghost' : ''), text: a.label, onclick: a.onclick });
    }));
    var close = el('button', { type: 'button', class: 'trpl-cb-close', 'aria-label': 'Close', onclick: function () { hideOwnBars(); push('cookiebar_dismissed', { cookiebar_bar: opts.kind }); } }, ['×']);
    var node = el('section', { class: 'trpl-cb', role: 'region', 'aria-label': opts.label, 'data-trpl-cookiebar': opts.kind }, [
      el('div', { class: 'trpl-cb-inner' }, [text, actions, close])
    ]);
    D.body.appendChild(node);
    bar = node;
    requestAnimationFrame(function () { requestAnimationFrame(function () { node.classList.add('is-open'); }); });
    push('cookiebar_shown', { cookiebar_source: opts.kind });
    return node;
  }

  function showDeclineNote() {
    showBar({
      kind: 'decline-note',
      label: 'Cookie choice saved',
      lead: 'Cookies are off.',
      body: 'The site may feel less personal, and some features, such as embedded videos, may not load.',
      tabs: ['why'],
      actions: [
        { label: 'Change', onclick: function () { hideOwnBars(); openPreferences(); } }
      ]
    });
  }

  function showReask() {
    ssSet(SESSION_KEY, 'reasked');
    showBar({
      kind: 'reask',
      label: 'Cookie choice',
      lead: 'Cookies are still off.',
      body: 'Turn them on for embedded videos and a more personal site?',
      tabs: ['why', 'collected'],
      actions: [
        { label: 'Review choices', onclick: function () { hideOwnBars(); openPreferences(); } },
        { label: 'Keep off', ghost: true, onclick: function () { hideOwnBars(); push('cookiebar_kept_declined'); } }
      ]
    });
  }

  // ---------- Termly events ----------

  function onInitialized(data) {
    state.initialized = true;
    state.location = (data && data.location) || null;
    state.regionSettings = (data && data.region_settings) || null;
    log('initialized', data);
    Promise.all([loadTerritories(), loadShape()]).then(function (res) {
      var t = res[0];
      state.territory = resolveTerritory(state.location, t);
      W.TRPLCookieBar.territory = state.territory;
      watchBanner();
      maybeReask();
    });
  }

  function onConsent(data) {
    log('consent', data);
    var cats = (data && data.categories) || acceptedCategories(consentState());
    var accepted = cats.filter(function (c) { return NON_ESSENTIAL.indexOf(c) !== -1; });
    var now = new Date().toISOString();
    if (accepted.length) {
      var prev = lsGet(STORE_KEY);
      var record = {
        status: 'accepted',
        date: (prev && prev.status === 'accepted' && prev.date) || now,
        updated: now,
        categories: accepted,
        region: state.territory ? state.territory.key : null,
        termly_uuid: (data && data.uuid) || null,
        v: 1
      };
      setCookie(CFG.cookieName, JSON.stringify(record), CFG.cookieDays);
      lsSet(STORE_KEY, record);
      if (state.bannerSeen || bar) { hideOwnBars(); push('cookiebar_accept', { cookiebar_categories: accepted.join(',') }); }
    } else {
      delCookie(CFG.cookieName);
      lsSet(STORE_KEY, { status: 'declined', date: now, region: state.territory ? state.territory.key : null, v: 1 });
      // Only speak up when the visitor just acted on a banner on this page.
      if (state.bannerSeen || bar) { ssSet(SESSION_KEY, 'declined'); push('cookiebar_decline'); showDeclineNote(); }
    }
  }

  function maybeReask() {
    if (!CFG.reaskEachSession) return;
    if (ssGet(SESSION_KEY)) return;                       // already handled this session
    var choice = lsGet(STORE_KEY);
    if (!choice || choice.status !== 'declined') { ssSet(SESSION_KEY, 'seen'); return; }
    if (state.regionSettings && state.regionSettings.enable_banner === false) return;
    // Give Termly's own banner a moment; if it shows, it is the ask.
    setTimeout(function () {
      if (state.bannerSeen) return;
      if (acceptedCategories(consentState()).length) return; // changed mind elsewhere
      showReask();
    }, 1200);
  }

  // ---------- wire up ----------

  function attach() {
    if (!W.Termly || typeof W.Termly.on !== 'function') return false;
    if (W.__trplCookieBarAttached || W.__trplCookieBarHooked) return true;
    W.__trplCookieBarAttached = true;
    W.Termly.on('initialized', onInitialized);
    W.Termly.on('consent', onConsent);
    return true;
  }

  // Public API (also replaces the event queue set up by the install snippet).
  var prior = W.TRPLCookieBar && W.TRPLCookieBar.q ? W.TRPLCookieBar.q : [];
  W.TRPLCookieBar = {
    version: '1.0.0',
    config: CFG,
    territory: null,
    openPreferences: openPreferences,
    record: function () { var c = getCookie(CFG.cookieName); return c ? safe(function () { return JSON.parse(c); }, null) : lsGet(STORE_KEY); },
    // The install snippet queues Termly events that fire before this file loads.
    q: { push: function (item) { dispatch(item); } },
    _resolve: resolveTerritory
  };

  function dispatch(item) {
    if (!item) return;
    if (item[0] === 'initialized') onInitialized(item[1]);
    else if (item[0] === 'consent') onConsent(item[1]);
  }

  function start() {
    loadCss();
    var queued = prior.slice ? prior.slice() : [];
    if (queued.length || W.__trplCookieBarQueueing) {
      // Snippet path: events arrive through the queue.
      queued.forEach(dispatch);
      return;
    }
    // No snippet: attach to Termly directly once it exists.
    if (attach()) return;
    var tries = 0;
    var t = setInterval(function () {
      if (attach() || ++tries > 400) clearInterval(t);
    }, 25);
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start);
  else start();
})();
