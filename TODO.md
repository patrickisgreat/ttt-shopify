# Threaditate Theme — TODO

Working punch-list. Created 2026-05-28. In progress on branch `feat/home-pdp-setup-edits`.

---

## Home page — [templates/index.json](templates/index.json)

- [ ] **Reorder:** move the **How-It-Works video** to just below the hero.
- [ ] **Reorder:** put **"Built to Help You Finish"** (features-grid) right below that video.
- [ ] **Video:** set the How-It-Works video to YouTube `4ScK3RsoMSk`.
- [ ] **Icon:** "Built to Help You Finish" → change the *Custom from Any Photo* icon to a **portrait** icon.
- [ ] **Remove** the "Try it with your photo" button on the home page.
      ⚠️ **Not found in code** — `index.json` and its sections have no such button (only the PDP does).
      Likely a Theme-Editor customization on the live page. Needs a pointer from you.
- [ ] **Nav:** add **active states** to the top menu (highlight current page).
- [ ] **Footer:** add **patent info** — Justia: https://patents.justia.com/patent/12423349 (U.S. Patent 12,423,349).

## Product page (PDP) — [templates/product.json](templates/product.json)

- [ ] **Slider:** add a **2-image** slider (not 3 — "YOUR LOGO HERE" slide is on hold).
      ⚠️ `assets/slider-images/` doesn't exist yet → scaffolding with **placeholders**; real images to be added.
- [ ] **Video:** set the PDP video to `https://www.youtube.com/watch?v=u_hnI-tE4is`.
- [ ] **Remove** the button beneath the sliders.
- [ ] **"How the App Works" — add GIFs** (placeholders for now; to be generated):
  - [ ] upload button → upload photo
  - [ ] zoom to center
  - [ ] fiddling with the line-count slider
- [ ] **"Try it with your photo" → link button to the FAQ page** (`shopify://pages/faq`).

## Setup / How-It-Works page — [templates/page.how-it-works.json](templates/page.how-it-works.json)

- [ ] "See how it works" — add a bit **more space below** the text.
- [ ] Make the **video section a bit smaller**.

---

### Notes / needs input
1. Home "Try it with your photo" button isn't in the theme code — point me to it.
2. PDP slider: 2 images for now; add files to `assets/slider-images/` (placeholders in place).
3. "How the App Works" GIFs to be generated; placeholders go in first.
4. Separate/related: header logo + announcement bar fix is in **PR #8** (logo capped at 300 by theme schema).
