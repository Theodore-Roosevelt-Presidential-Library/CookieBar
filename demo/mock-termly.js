/*
 * Demo-only stand-in for Termly, used on cookiebar.labs.trlibrary.com and in tests.
 * It mimics Termly's documented surface: Termly.on('initialized'|'consent'),
 * Termly.getConsentState(), and a banner marked with data-termly-part attributes.
 * Never load this on trlibrary.com.
 */
(function () {
  'use strict';
  var STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', IA: 'Iowa', IN: 'Indiana', KY: 'Kentucky', MD: 'Maryland', MN: 'Minnesota', MT: 'Montana', NE: 'Nebraska', NH: 'New Hampshire', NJ: 'New Jersey', NY: 'New York', ND: 'North Dakota', OR: 'Oregon', RI: 'Rhode Island', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VA: 'Virginia', WA: 'Washington', QC: 'Quebec', ON: 'Ontario' };
  var KEY = 'mock_termly_consent';
  var params = new URLSearchParams(location.search);
  var region = (params.get('region') || 'US-CA').toUpperCase();
  var parts = region.split('-');
  var loc = { continent: '', country: parts[0], state: parts[1] ? (STATES[parts[1]] || parts[1]) : '' };
  // Demo rule: places with a CookieBar entry (plus EEA) get the banner.
  var showIn = (params.get('show') || 'yes') === 'yes';

  var handlers = { initialized: [], consent: [] };
  var stored = null;
  try { stored = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}

  function state() {
    var on = stored && stored.accepted;
    return { unclassified: !!on, essential: true, performance: !!on, analytics: !!on, advertising: !!on, social_networking: !!on };
  }

  function emit(name, data) { handlers[name].forEach(function (h) { h(data); }); }

  function decide(accepted) {
    stored = { accepted: accepted, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) {}
    removeBanner();
    emit('consent', {
      categories: accepted ? ['essential', 'performance', 'analytics', 'advertising', 'social_networking'] : ['essential'],
      cookies: [],
      uuid: 'demo-' + Math.random().toString(16).slice(2, 10)
    });
  }

  function removeBanner() { var b = document.querySelector('[data-termly-part="consent-banner"]'); if (b) b.remove(); }

  function renderBanner() {
    removeBanner();
    var b = document.createElement('div');
    b.setAttribute('data-termly-part', 'consent-banner');
    b.setAttribute('data-termly-variant', 'banner');
    b.setAttribute('data-termly-position', 'bottom');
    b.setAttribute('data-termly-size', 'standard');
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Cookie Consent Prompt');
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147482000;background:#fff;color:#000;font-family:Roboto,Arial,sans-serif;padding:18px 20px;display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;justify-content:space-between';
    var msg = document.createElement('div');
    msg.setAttribute('data-termly-part', 'banner-message');
    msg.style.cssText = 'flex:1 1 420px;max-width:900px';
    msg.innerHTML = '<p style="margin:0">The Library uses cookies to see how the site is used and to show you relevant information. Essential cookies are always on.</p>';
    var actions = document.createElement('div');
    actions.setAttribute('data-termly-part', 'banner-actions');
    actions.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
    [['Preferences', function () { alertless(); }], ['Decline', function () { decide(false); }], ['Accept', function () { decide(true); }]].forEach(function (a) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = a[0];
      btn.addEventListener('click', a[1]);
      actions.appendChild(btn);
    });
    b.appendChild(msg);
    b.appendChild(actions);
    document.body.appendChild(b);
  }

  // Preferences: the demo simply re-opens the banner.
  function alertless() { renderBanner(); }
  window.displayPreferenceModal = function () { renderBanner(); };

  window.Termly = {
    on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    off: function () {},
    getConsentState: state
  };

  function boot() {
    emit('initialized', {
      consents_count: 0, consents_quota: Infinity, has_cookie_report: true, is_over_consent_quota: false,
      location: loc,
      region_settings: { enable_banner: showIn, consent_mode: 'opt_in' },
      theme: {}, website_last_modified_at: new Date().toISOString()
    });
    if (showIn && !stored) setTimeout(renderBanner, 150);
  }

  // Behave like a script with an onload callback: run onTermlyLoaded, then initialize.
  setTimeout(function () {
    if (typeof window.onTermlyLoaded === 'function') window.onTermlyLoaded();
    setTimeout(boot, 50);
  }, 30);
})();
