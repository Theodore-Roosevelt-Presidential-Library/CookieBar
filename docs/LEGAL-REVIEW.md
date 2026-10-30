# Legal review before launch

CookieBar tells visitors which law applies where they are. Wrong or overstated law text is a risk of its own, so **every entry in `territories.json` needs counsel's approval before launch.** Claude drafted the entries on October 29, 2026; nobody has reviewed them yet, and Claude is not a lawyer.

## 1. Where the bar appears

Termly decides this from its region settings, not CookieBar. Counsel should approve the list of places where the Library asks for consent **before** any tracking, for example:

| Place | Kind of law | Draft position |
|---|---|---|
| EU and EEA (EU + Iceland, Liechtenstein, Norway) | Consent before non-essential cookies (ePrivacy Directive + GDPR) | Bar, opt-in |
| United Kingdom | Consent before most non-essential cookies (PECR + UK GDPR). The Data (Use and Access) Act 2025 relaxed some analytics cookies; confirm what still needs consent | Bar, opt-in |
| Switzerland | Mainly transparency; opt-out generally accepted | Counsel to decide |
| Quebec | Profiling and location technology off by default (Law 25) | Counsel to decide whether Law 25 reaches the Library |
| Brazil | Legal basis needed (LGPD) | Counsel to decide |
| California | CCPA is opt-out and covers businesses, not nonprofits. Lawsuit risk comes from **CIPA** (wiretapping) claims over pixels, session replay and chat, which don't depend on nonprofit status | Bar, opt-in (litigation defense) |
| Other US states with comprehensive privacy laws | Mostly opt-out rights over targeted ads and the sale of data. Several exempt nonprofits; some (Colorado, Oregon, Delaware, Minnesota, Maryland, New Jersey) don't | Counsel to decide per state |
| States with wiretap or two-party-consent laws used against website tracking (e.g. Pennsylvania, Massachusetts, Washington, Florida) | Litigation risk, not a cookie law | Counsel to decide |

**Termly's regions** (dashboard, October 29, 2026): Europe (EU, EEA, UK, Switzerland as one group), Brazil, Canada (all provinces as one group), California, US states with consumer privacy laws (Termly's own list), all other US states, and all other regions. Termly can't target a single state outside California, so the choice for the other privacy-law states is all of them or none.

## 2. The law text

Each entry in `territories.json` is one sentence about what the law does. Most US entries describe residents' rights ("gives Texas residents the right to opt out of targeted advertising and the sale of personal data") rather than claiming the law requires the Library to ask. Please check for each:

- [ ] The law's name is correct.
- [ ] The sentence is accurate and not overstated.
- [ ] The **Read the law** link points to an official source. Only the non-US entries and California have links so far.
- [ ] Effective dates. Alabama's entry carries `"effective": "2027-05-01"` and stays hidden until then. Oklahoma's new law (effective January 1, 2027) is **not** in the file yet. Its official name and the rights it grants still need confirming.
- [ ] Any state law enacted after mid-2026 that's missing.

Places without an entry fall back to: "Some privacy laws require websites to ask before using cookies that aren't essential to how the site works."

## 3. Behaviors to approve

- **Re-ask every new visit after a decline.** This is fine in the US. European regulators (France's CNIL most explicitly) treat repeated prompts after a refusal as pressure and suggest remembering a refusal for about six months. Options: keep it everywhere, limit it to the US, or turn it off (`reaskEachSession: false`).
- **Decline note and "If you decline" tab.** They say the site may feel less personal and some features, such as embedded videos, may not load. Confirm this doesn't read as pressure.
- **Record of consent.** Termly's consent log is the official record, but Termly keeps it for only **180 days**. Decide how long the Library must keep proof of consent; if longer, export the log on a schedule. CookieBar's `trpl_cookie_consent` cookie, with the acceptance date, is a convenience copy that Safari deletes after 7 days.
- **Banner text.** Termly's main banner message is edited in the Termly dashboard. It should name the Library, say what the cookies do and link the privacy policy.

## 4. Sign-off

| Item | Approved by | Date |
|---|---|---|
| Where the bar appears | | |
| Law text, each entry | | |
| Re-ask behavior | | |
| Banner and decline wording | | |
