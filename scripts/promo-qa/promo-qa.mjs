#!/usr/bin/env node
/**
 * Promo landing page QA.
 *
 * Loads a landing page at phone and desktop sizes, follows every /cart/ link
 * it finds, and checks the checkout's line items, discount and subtotal
 * against what the page promised. It stops on the checkout page: it never
 * types an email, address or card, and never submits anything.
 *
 * Every run creates an abandoned checkout in Shopify analytics. Run it
 * sparingly.
 *
 * Usage:
 *   node promo-qa.mjs --url <landing page url> [--expect 1=89.00,2=133.50] [--out ./out] [--viewport mobile|desktop|both]
 *
 * --expect maps option number (from data-promo-option on the page's buttons)
 * to the price the page should promise and checkout should charge before
 * shipping and tax. Without it, the script trusts the data-promo-total the
 * page renders and only checks that checkout agrees with it.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = parseArgs(process.argv.slice(2));
if (!args.url) {
  console.error('Usage: node promo-qa.mjs --url <landing page url> [--expect 1=89.00,2=133.50] [--out ./out]');
  process.exit(2);
}

const expected = parseExpect(args.expect);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(args.out || 'out', stamp);
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
].filter((vp) => !args.viewport || args.viewport === 'both' || args.viewport === vp.name);

const results = [];
const browser = await chromium.launch();

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  await page.goto(args.url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);
  await dismissPopups(page);
  await page.screenshot({ path: join(outDir, `landing-${vp.name}.png`) });
  await page.screenshot({ path: join(outDir, `landing-${vp.name}-full.png`), fullPage: true });

  // Only links a shopper can actually see. Hidden markup (an ended offer's
  // leftover buttons, a collapsed sticky bar) is not a promise to anyone.
  const links = await page.$$eval('a[href*="/cart/"]', (anchors) =>
    anchors.filter((a) => a.offsetParent !== null || a.closest('[data-promo-sticky]')).map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
      option: a.dataset.promoOption || '',
      qty: Number(a.dataset.promoQty || 0),
      promisedCents: a.dataset.promoTotal ? Number(a.dataset.promoTotal) : null,
      code: a.dataset.promoCode || '',
      placement: a.closest('[data-promo-sticky]') ? 'sticky bar' : 'page',
    }))
  );

  const seen = new Set();
  for (const link of links) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);

    const result = { viewport: vp.name, ...link, promised: null, checkout: null, status: 'FAIL', notes: [] };
    result.promised = pickPromised(link, expected);
    results.push(result);

    const checkoutPage = await context.newPage();
    const tag = `${vp.name}-opt${link.option || seen.size}`;
    try {
      await checkoutPage.goto(new URL(link.href, args.url).toString(), { waitUntil: 'load', timeout: 90000 });
      await checkoutPage.waitForURL(/\/checkouts?\//, { timeout: 60000 });
      await checkoutPage.waitForTimeout(4000);
      await expandOrderSummary(checkoutPage);
      await checkoutPage.screenshot({ path: join(outDir, `checkout-${tag}.png`), fullPage: true });

      result.checkoutUrl = checkoutPage.url();
      result.checkout = await readOrderSummary(checkoutPage);
      result.notes.push(...judge(result));
      result.status = result.notes.some((n) => n.startsWith('FAIL')) ? 'FAIL' : 'PASS';
    } catch (error) {
      result.notes.push(`FAIL could not read checkout: ${error.message.split('\n')[0]}`);
      await checkoutPage.screenshot({ path: join(outDir, `checkout-${tag}-error.png`), fullPage: true }).catch(() => {});
    } finally {
      // Stop here. Nothing is typed, nothing is submitted.
      await checkoutPage.close();
    }
  }

  if (!links.length) {
    results.push({ viewport: vp.name, href: '(none)', status: 'FAIL', notes: ['FAIL no /cart/ links found on the page'], promised: null, checkout: null });
  }

  await context.close();
}

await browser.close();

writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
printTable(results);
console.log(`\nScreenshots and results.json: ${outDir}`);
process.exit(results.every((r) => r.status === 'PASS') ? 0 : 1);

/* ------------------------------------------------------------------ */

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith('--')) {
      const key = list[i].slice(2);
      const next = list[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; } else { out[key] = true; }
    }
  }
  return out;
}

function parseExpect(text) {
  const map = {};
  if (!text || text === true) return map;
  for (const part of String(text).split(',')) {
    const [option, price] = part.split('=').map((s) => s.trim());
    if (option && price) map[option] = Math.round(parseFloat(price.replace(/[^0-9.]/g, '')) * 100);
  }
  return map;
}

function pickPromised(link, expectedMap) {
  if (link.option && expectedMap[link.option] != null) return expectedMap[link.option];
  return link.promisedCents;
}

async function dismissPopups(page) {
  for (let i = 0; i < 3; i++) {
    const dialog = page.locator('[aria-label="POPUP Form"], [role="dialog"]').first();
    if (!(await dialog.count()) || !(await dialog.isVisible().catch(() => false))) return;
    const close = dialog.locator('[aria-label*="Close" i], button:has-text("No Thanks")').first();
    if (await close.count()) await close.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }
}

async function expandOrderSummary(page) {
  const toggle = page.locator('button:has-text("order summary"), [aria-controls*="order-summary" i]').first();
  if (await toggle.count() && await toggle.isVisible().catch(() => false)) {
    const expanded = await toggle.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await toggle.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
  }
}

async function readOrderSummary(page) {
  const text = await page.evaluate(() => document.body.innerText);
  // Checkout's innerText puts labels and amounts on separate lines, so every
  // pattern tolerates whitespace and newlines between them.
  const cents = (str) => Math.round(parseFloat(str.replace(/,/g, '')) * 100);
  const money = (label) => {
    const re = new RegExp(`(?:^|\\n)\\s*${label}\\s*(?:USD)?\\s*\\$\\s?([0-9][0-9,]*\\.[0-9]{2})`, 'i');
    const m = text.match(re);
    return m ? cents(m[1]) : null;
  };

  const items = [];
  const lineRe = /\n([A-Za-z][^\n$]{3,90}?)\s+(\d+)\s+\$\s?([0-9][0-9,]*\.[0-9]{2})/g;
  let m;
  while ((m = lineRe.exec(text))) {
    if (/subtotal|discount|shipping|total|tax|quantity/i.test(m[1])) continue;
    items.push({ title: m[1].trim(), qty: Number(m[2]), priceCents: cents(m[3]) });
  }

  // An applied code shows as a tag next to the discount row, e.g. "LABORDAY ... −$44.50".
  const discountMatch = text.match(/Discount[\s\S]{0,80}?(?:−|-|–)\s?\$\s?([0-9][0-9,]*\.[0-9]{2})/i);
  const codeMatch = text.match(/(?:Discount|Order discount)[\s\S]{0,40}?\b([A-Z][A-Z0-9]{3,})\b(?![a-z])/);
  const quantityBadges = [...text.matchAll(/(?:^|\n)\s*(\d+)\s*(?:\n|×)/g)].map((x) => Number(x[1]));

  return {
    items,
    quantityHints: quantityBadges.slice(0, 5),
    discountCents: discountMatch ? cents(discountMatch[1]) : 0,
    discountCode: codeMatch ? codeMatch[1] : '',
    subtotalCents: money('Subtotal'),
    totalCents: money('Total'),
    bodyExcerpt: text.replace(/\s+/g, ' ').slice(0, 400),
  };
}

function judge(result) {
  const notes = [];
  const c = result.checkout;
  if (!c) return ['FAIL no checkout data'];
  if (c.subtotalCents == null) notes.push('FAIL could not find a Subtotal line on the checkout');

  if (result.qty) {
    const seenQty = c.items.some((i) => i.qty === result.qty) || c.quantityHints.includes(result.qty);
    notes.push(seenQty ? `PASS quantity ${result.qty} found in checkout` : `FAIL quantity ${result.qty} not found in checkout`);
  }

  if (result.code) {
    notes.push(c.discountCode === result.code || c.discountCents > 0
      ? `PASS discount applied (${c.discountCode || 'code hidden'} −${fmt(c.discountCents)})`
      : `FAIL code ${result.code} did not apply at checkout`);
  }

  if (result.promised != null && c.subtotalCents != null) {
    notes.push(c.subtotalCents === result.promised
      ? `PASS subtotal ${fmt(c.subtotalCents)} matches promised ${fmt(result.promised)}`
      : `FAIL subtotal ${fmt(c.subtotalCents)} but page promised ${fmt(result.promised)}`);
  }
  return notes;
}

function fmt(cents) {
  return cents == null ? '?' : `$${(cents / 100).toFixed(2)}`;
}

function printTable(rows) {
  const cols = [
    ['viewport', 8], ['placement', 10], ['option', 6], ['qty', 3], ['code', 10], ['promised', 9], ['subtotal', 9], ['discount', 9], ['status', 6],
  ];
  const line = cols.map(([name, w]) => name.padEnd(w)).join('  ');
  console.log('\n' + line + '\n' + '-'.repeat(line.length));
  for (const r of rows) {
    const c = r.checkout || {};
    const vals = [r.viewport, r.placement || '', r.option || '', r.qty || '', r.code || '', fmt(r.promised), fmt(c.subtotalCents), fmt(c.discountCents), r.status];
    console.log(vals.map((v, i) => String(v).padEnd(cols[i][1])).join('  '));
    for (const n of r.notes || []) console.log('   ' + n);
  }
}
