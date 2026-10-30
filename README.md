# CookieBar

Shows a cookie consent bar only to visitors in states and countries where privacy law calls for it, tells them which law applies where they are, and carries the Library's brand.

**Demo:** https://cookiebar.labs.trlibrary.com (uses a stand-in for Termly, so it works without an account)

## How it works

CookieBar is a thin layer on top of [Termly](https://termly.io), which the Library already licenses.

| Termly does | CookieBar adds |
|---|---|
| Works out where the visitor is | TRPL brand styling (Dark Gray bar, Gray Sky details, Deep Orange buttons; Clearface/Georgia and Frutiger Next) from [brand.labs.trlibrary.com](https://brand.labs.trlibrary.com) |
| Shows the banner only in regions set to require it | Three small tabs in a slim bar: **Why this?** (the visitor's state or country, its outline and its law), **What's collected** and **If you decline** |
| Blocks tracking scripts until the visitor chooses | A note after **Decline** that some features may be less personal or may not load |
| Keeps the official consent record | A re-ask at the start of each new visit for visitors who declined |
| Sends Google Consent Mode signals to GTM | A first-party cookie, `trpl_cookie_consent`, with the date of acceptance |
| | `dataLayer` events for GTM reporting |

CookieBar uses only Termly's documented hooks: `Termly.on('initialized' | 'consent')`, `Termly.getConsentState()` and the `[data-termly-part]` attributes on the banner ([Termly JS API](https://support.termly.io/hc/en-us/articles/30710442081553), [styling attributes](https://support.termly.io/hc/en-us/articles/49692190480785-Styling-the-consent-banner-data-termly-attributes)).

## Files

| File | What it is |
|---|---|
| `cookiebar.js` | The add-on. Loaded on trlibrary.com |
| `cookiebar.css` | Brand styles for Termly's banner and CookieBar's own bars |
| `territories.json` | The law text for each state and country. **Draft until counsel approves it** (see `docs/LEGAL-REVIEW.md`) |
| `shapes/` | One small outline per state or country (public-domain Census and Natural Earth data); `scripts/build-shapes.mjs` rebuilds them |
| `index.html`, `demo/` | The demo page |
| `scripts/termly.mjs` | Termly API helper: check keys, read banner settings, push the brand theme |
| `.env.example` | Template for your Termly API keys |
| `docs/GTM.md` | Google Tag Manager setup |
| `gtm/cookiebar-tag.html` | The CookieBar Custom HTML tag for GTM |
| `docs/LEGAL-REVIEW.md` | What counsel needs to approve before launch |

## Termly API

`scripts/termly.mjs` uses Termly's partner API, which needs a **public and private key pair**. The single API key in the Termly dashboard (Settings → API Key) is a different kind of token and is rejected by that API (tested October 29, 2026). Nothing in CookieBar needs an API key; Termly is configured in its dashboard. Keep the script for the day Termly issues partner keys, and keep any key in `.env`, which is git-ignored. GitHub Pages publishes everything else in this repository.

## Install on trlibrary.com (through GTM)

trlibrary.com loads Termly and CookieBar from Google Tag Manager (container GTM-N3888GS9), so no Drupal change is needed. Full steps are in `docs/GTM.md`. In short:

1. **Termly Consent Management Platform** template tag (from the GTM Community Template Gallery) on **Consent Initialization – All Pages** and a `userPrefUpdate` custom event, with "Inject Termly consent management platform script tag" on and website UUID `d00ef422-03f1-4cca-9773-63a1ea4a3b8d`.
2. **CookieBar – Loader** Custom HTML tag on **Consent Initialization – All Pages**, priority 100, using `gtm/cookiebar-tag.html`.
3. Consent settings on every other tag.

`d00ef422-03f1-4cca-9773-63a1ea4a3b8d` is the trlibrary.com website in Termly. It is public; it appears in page source.

**Limit of the GTM route:** Termly's Auto Blocker can't run when Termly loads from GTM, so only tags inside GTM are held back. Scripts that Drupal loads directly must move into GTM or they will run before consent (see `docs/GTM.md`, "Scripts outside GTM").

### Alternative: install in the page head

If FiveJars ever installs Termly directly, put this first in the `<head>`, above GTM, and keep Auto Blocker on:

```html
<script>
  window.__trplCookieBarQueueing = true;
  window.TRPLCookieBar = { q: [] };
  function onTermlyLoaded() {
    Termly.on('initialized', function (d) { TRPLCookieBar.q.push(['initialized', d]); });
    Termly.on('consent', function (d) { TRPLCookieBar.q.push(['consent', d]); });
  }
</script>
<script src="https://app.termly.io/resource-blocker/d00ef422-03f1-4cca-9773-63a1ea4a3b8d?autoBlock=on" onload="onTermlyLoaded()"></script>
<script src="https://cookiebar.labs.trlibrary.com/cookiebar.js" defer></script>
```

Then remove the GTM Termly and CookieBar tags so they don't load twice.

Add a **Cookie settings** link to the site footer so visitors can change their mind (required in the EU):

```html
<a href="#" onclick="TRPLCookieBar.openPreferences(); return false;">Cookie settings</a>
```

### Options

Set before `cookiebar.js` loads, if needed:

```html
<script>
  window.TRPLCookieBarConfig = {
    reaskEachSession: true,     // re-ask visitors who declined, once per new visit
    cookieDays: 395,            // how long the acceptance cookie lasts (~13 months)
    cookieDomain: '.trlibrary.com',
    debug: false                // or add ?cookiebar-debug=1 to any URL
  };
</script>
```

## Termly dashboard settings

**Consent Management → Consent Banner.** Set on October 29, 2026:

| Termly region | Setting |
|---|---|
| Europe (EU, EEA, UK, Switzerland) | Banner on · opt-in · decline button · no scroll consent · Google Consent Mode basic |
| Brazil | Same as Europe |
| Canada | Same as Europe |
| US: California | Banner on · opt-in · decline button · no scroll consent · GPC respected · "Do not sell or share" link · Consent Mode basic |
| US: States with consumer privacy laws | Same as California |
| US: All other states | **Banner off** |
| All other regions | **Banner off** |

Look: **Banner** style, **Bottom**, **Compact**. Custom theme: background `#25282A` (Dark Gray), text `#FFFFFF`, buttons `#E7805D` (Deep Orange), button text `#25282A`. CookieBar's CSS handles fonts and spacing.

Never turn on "Scroll-to-consent"; it counts scrolling as agreement.

Final say on which regions get the bar belongs to counsel (see `docs/LEGAL-REVIEW.md`).

## What CookieBar stores

| Name | Where | What | How long |
|---|---|---|---|
| `trpl_cookie_consent` | Cookie on `.trlibrary.com` | `{status, date, updated, categories, region, termly_uuid}` | 395 days |
| `trpl_cb_choice` | localStorage | Same record, plus declines | Until cleared |
| `trpl_cb_session` | sessionStorage | Whether this visit has already been asked | This visit |

These record the visitor's choice, which is an essential use and needs no consent. Safari deletes cookies set by JavaScript after 7 days, so treat `trpl_cookie_consent` as a convenience. **Termly's consent log is the record of consent, but Termly keeps only 180 days of it.** Export the log from Consent Management → Consent Logs at least every five months and keep the exports.

## Accessibility

The bars are labelled regions with real buttons and visible focus outlines. The tabs follow the ARIA tab pattern (arrow keys move between them; clicking the open tab closes it). Outlines are decorative and hidden from screen readers. Motion is turned off for visitors who prefer reduced motion. Every text color passes the brand contrast table (white on Dark Gray 14.8:1; Dark Gray on Deep Orange 5.4:1).
