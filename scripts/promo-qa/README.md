# Promo QA

Checks a promo landing page against the checkout it sends people to. It opens the page at 390x844 and 1440x900, follows every `/cart/` link, reads the checkout's line items, discount and subtotal, and compares them with what the page promised. It stops at the checkout page: nothing is typed and nothing is submitted.

Each run creates an abandoned checkout in Shopify analytics, one per cart link per viewport. Run it sparingly, for example once before a promo goes live.

## Setup

```bash
cd scripts/promo-qa
npm install          # installs Playwright; Chromium is already on this machine
```

If `npm install` tries to download a browser, cancel it and set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` first. The script uses whatever Chromium Playwright already has.

## Run against the preview theme

Take the preview link Shopify gives for the unpublished theme (`?preview_theme_id=...`) and point the script at the promo page:

```bash
node promo-qa.mjs \
  --url "https://string-ring-2.myshopify.com/pages/labor-day?preview_theme_id=188814393639" \
  --expect "1=89.00,2=133.50"
```

`--expect` maps each buy option (1 or 2) to the price the page should promise and checkout should charge before shipping and tax. Leave it out to trust the prices the page renders and only check that checkout agrees with them.

The offer must still be live on the page. If the end date has passed the page shows the ended message and there are no cart links, so the run fails with "no /cart/ links found". Set a future end date on the preview theme first, then set it back.

## Output

A pass/fail table in the terminal, plus a folder under `out/<timestamp>/` with:

- `landing-mobile.png`, `landing-desktop.png` and full-page versions
- `checkout-<viewport>-opt<n>.png` for each cart link
- `results.json` with everything the script read

Exit code is 0 when every row passes.
