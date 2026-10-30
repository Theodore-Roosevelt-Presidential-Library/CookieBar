# Google Tag Manager setup

Container: **GTM-N3888GS9** (trlibrary.com).

Before this work, trlibrary.com had no consent management: GTM loaded with no Consent Mode defaults, so every tag fired for every visitor (checked October 29, 2026). The Drupal Google Tag module's own Consent Mode option is off; leave it off, since Termly's template sets the defaults.

## 1. How Termly and CookieBar load

Both load from GTM, following Termly's guide ([How to use Termly with Google Tag Manager](https://support.termly.io/hc/en-us/articles/30710480660881-How-to-use-Termly-with-Google-Tag-Manager)).

| Tag | Type | Triggers | Priority | Consent setting |
|---|---|---|---|---|
| **Termly – Consent Mode** | Termly Consent Management Platform (gallery template) | Consent Initialization – All Pages; `userPrefUpdate` (custom event) | 0 | No additional consent required |
| **CookieBar – Loader** | Custom HTML, from `gtm/cookiebar-tag.html` | Consent Initialization – All Pages | 100 | No additional consent required |

Termly template settings: **Inject Termly consent management platform script tag** on, website UUID `d00ef422-03f1-4cca-9773-63a1ea4a3b8d`. Regional defaults: **denied** for `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`, `personalization_storage`, `functionality_storage` in the opt-in regions; `security_storage` granted. Wait for update: 500 ms.

Triggers to create:

- `userPrefUpdate`: Custom Event, event name `userPrefUpdate`.
- `Termly.consentSaveDone`: Custom Event, event name `Termly.consentSaveDone`. Add it as a second firing trigger to non-Google tags that normally fire on page view, so they fire as soon as a visitor accepts.

CookieBar's loader runs first (priority 100), so it is listening before Termly starts and receives Termly's location event.

### Scripts outside GTM

Termly's Auto Blocker can't run when Termly loads from GTM. These load directly from Drupal (checked October 29, 2026) and **will run before consent** until they move into GTM with a consent setting:

| Script | Loaded by | Suggested GTM consent |
|---|---|---|
| Hotjar (site 3866061) | Drupal Hotjar module | `analytics_storage` |
| Mailchimp connected-site script (chimpstatic.com) | Theme file `themes/custom/trpl/js/mailchimp.js` | `ad_storage` |
| Deyra AI chat widget | Drupal Asset Injector ("ai_chat") | Ask counsel; likely functional |

## 2. Termly dashboard: Google Consent Mode

Termly dashboard → **Consent Management → Consent Banner** → each opt-in region: **Google Consent Mode** on (Basic). Already set for Europe, Brazil, Canada, California and the privacy-law states.

## 3. GTM container settings

1. **Admin → Container Settings → Additional Settings → Enable consent overview.** The shield icon on the Tags page then lists every tag's consent setup.
2. **Google tags** (GA4 configuration and events, Google Ads conversion and remarketing, Conversion Linker) have consent checks built in. In the consent overview, mark them "No additional consent required."
3. **Every non-Google tag** (Meta Pixel, LinkedIn Insight, TikTok, Hotjar or Clarity, any Custom HTML that sets cookies or sends data out):
   Tag → **Advanced Settings → Consent Settings → Require additional consent for tag to fire**:
   - Advertising and retargeting pixels: `ad_storage`
   - Analytics and session replay: `analytics_storage`
4. **Pop-ups (popup.labs) and the ticket alert** don't track, so they keep their current triggers. If a pop-up tag also sends data to a third party, give it `ad_storage`.
5. **Preview** in Tag Assistant with a VPN or Termly's region preview set to an EU country and California. Before Accept, non-Google tags should show "Blocked by consent" and GA4 should send no cookies. After Accept they should fire.

### Basic or advanced Consent Mode

- **Basic** (recommended to start): Google tags don't load at all until consent. This is safer against the wiretap suits that target tracking before consent.
- **Advanced:** Google tags load and send cookieless pings while consent is denied, which feeds Google's conversion modeling.

With Termly managing defaults, basic means adding `analytics_storage` / `ad_storage` as **required** consent on the Google tags too. Decide with counsel.

## 4. CookieBar events in the dataLayer

CookieBar pushes these. Each one carries `cookiebar_region` (for example `US-CA` or `EEA`).

| Event | When | Extra fields |
|---|---|---|
| `cookiebar_shown` | A bar appears | `cookiebar_source`: `termly`, `decline-note` or `reask` |
| `cookiebar_tab_opened` | A visitor opens a tab | `cookiebar_tab`: `why`, `collected` or `decline` |
| `cookiebar_accept` | Accept, right after a bar was shown | `cookiebar_categories` |
| `cookiebar_decline` | Decline, right after a bar was shown | |
| `cookiebar_kept_declined` | "Keep off" on the re-ask | |
| `cookiebar_open_preferences` | Preferences opened from CookieBar | |
| `cookiebar_dismissed` | A CookieBar bar was closed | `cookiebar_bar` |

To report on them in GA4: create Data Layer Variables for `cookiebar_region` and `cookiebar_tab`, a Custom Event trigger matching `^cookiebar_` (regex), and a GA4 Event tag using `{{Event}}` as the event name. Visitors who declined won't be counted, by design.

## 5. Footer link

Add **Cookie settings** to the site footer (Drupal menu or block):

```html
<a href="#" onclick="TRPLCookieBar.openPreferences(); return false;">Cookie settings</a>
```

## 6. Still to check

- [ ] List every tag in GTM-N3888GS9 and assign its consent type (step 3).
- [ ] Move Hotjar, the Mailchimp site script and the chat widget into GTM (see "Scripts outside GTM").
- [ ] Shopify store, ticketing, and the labs tools: decide whether they need their own banner. Shopify has its own Customer Privacy API.
- [ ] Embedded YouTube: Termly blocks it under social networking until consent. Consider youtube-nocookie.com embeds so videos still play.
