---
name: Curb
description: A trading key that can't withdraw, and can't trade off Kuru's live order book.
colors:
  asphalt: "#0b0d0f"
  asphalt-raised: "#111417"
  asphalt-high: "#171b1f"
  hairline: "#242a30"
  hairline-strong: "#343b42"
  road-white: "#ededed"
  road-grey: "#9aa1a8"
  road-grey-dim: "#5f666d"
  kerb-yellow: "#ffd600"
  stop-red: "#ff3838"
  signal-green: "#2bd47d"
typography:
  display:
    fontFamily: "Big Shoulders Stencil, Archivo, sans-serif"
    fontSize: "clamp(84px, 7vw, 112px)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Switzer, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Switzer, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
  figure:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tnum"
    fontVariation: "'wdth' 72"
  body:
    fontFamily: "Switzer, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Switzer, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
  data-mono:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.7
    fontFeature: "tnum"
  signage:
    fontFamily: "Big Shoulders Stencil, Archivo, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  gutter-mobile: "16px"
  gutter-hero: "22px"
  gutter-desktop: "32px"
  panel: "20px"
  stack: "16px"
  stack-wide: "24px"
components:
  button-primary:
    backgroundColor: "{colors.road-white}"
    textColor: "{colors.asphalt}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "56px"
  button-owner:
    backgroundColor: "{colors.kerb-yellow}"
    textColor: "{colors.asphalt}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "56px"
  button-quiet:
    backgroundColor: "{colors.asphalt-high}"
    textColor: "{colors.road-white}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "56px"
  button-disabled:
    backgroundColor: "{colors.asphalt-high}"
    textColor: "{colors.road-grey}"
    rounded: "{rounded.md}"
    height: "56px"
  panel:
    backgroundColor: "{colors.asphalt-raised}"
    rounded: "{rounded.lg}"
    padding: "20px"
  field:
    backgroundColor: "{colors.asphalt}"
    textColor: "{colors.road-white}"
    rounded: "{rounded.md}"
    padding: "12px 16px 10px"
  pill:
    backgroundColor: "{colors.asphalt-raised}"
    textColor: "{colors.road-grey}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "26px"
  filter-tab:
    backgroundColor: "{colors.asphalt-raised}"
    textColor: "{colors.road-grey}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "40px"
  filter-tab-selected:
    backgroundColor: "{colors.asphalt-high}"
    textColor: "{colors.road-white}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "40px"
  nav-tab-bar:
    backgroundColor: "{colors.asphalt}"
    textColor: "{colors.road-grey}"
    typography: "{typography.label}"
    height: "72px"
---

# Design System: Curb

## Overview

**Creative North Star: "The Painted Road at Night"**

Curb is a trading app whose information architecture is road markings. The ground is near-black asphalt; the book lives in a lane bounded by two solid double curb lines; dashed lane markings advance one period per real Monad block and only then; whatever lies past a curb is hatched, the way a road marks space you may not drive into. Paint colours carry meaning, not decoration: road white is everything the trading key does, kerb yellow is the owner key and money moving, stop red is an onchain refusal. The price stands in stencilled street lettering over a photographic plate of a night curb.

The surfaces are layered and restrained: hairline-bordered rounded panels lifted by one soft shadow, a quiet sans for the interface, condensed engineered figures for every number that is compared. Density is that of a trading terminal on desktop (three columns) and a single thumb-reachable column on a 375–430px phone. Every figure on screen is live chain data, printed at the market's full precision.

It rejects the category default: no exchange table plus candle chart, no red/green price direction, no yellow as a generic accent or selection colour.

**Key Characteristics:**
- Asphalt ground, hairline panels, one soft lift.
- Three paint colours with fixed meanings; white carries almost everything.
- Curb lines, lane dashes and hatching are the structural vocabulary, reused on every screen.
- Stencil street lettering for the hero price and wordmark; condensed Archivo for figures; Switzer for everything read.
- Motion is caused by the chain: dashes step, the live dot pulses and digits settle only when a real block or price change arrives.

## Colors

A monochrome asphalt palette with three road paints and one signal, each bound to one meaning.

### Primary
- **Road White** (road-white): the trading key and everything inside the lane. Primary buttons, the hero price, best bid/ask, lane dashes, curb lines, the selected tab and filter, focus rings, the draft-order chip. Hover on a white button lifts toward white.

### Secondary
- **Kerb Yellow** (kerb-yellow; `color(display-p3 1 0.85 0.05)` on wide-gamut screens): the owner key and money moving in or out, only. The wordmark's two slashes, owner-key names and glyphs, the owner key card border (45% alpha), the painted-kerb strip atop a money-moving panel, the Deposit glyph, focus border on an owner-key amount field, and the yellow button.

### Tertiary
The chain's two verdicts.
- **Stop Red** (stop-red; `color(display-p3 1 0.24 0.22)` on wide-gamut screens): a refusal made onchain by the Curb account. White on red is about 3.5:1, so red carries large stencil signage or marks, never small text.
- **Signal Green** (signal-green; `color(display-p3 0.33 0.82 0.52)` on wide-gamut screens): live and confirmed onchain. The block-stream dot (pulsing once per block) and its "Live" word, the live pill's border at 35% while blocks arrive, a confirmed transaction's dot and word, the "Allowed" verdict for trading inside the lane, the live dot on the lane preview. Never a price, a gain, a selection or a local success (a key derived on this device is road white, not green).

### Neutral
- **Asphalt** (asphalt): the page ground and field wells.
- **Raised Asphalt** (asphalt-raised): panel surfaces, inactive filter pills.
- **High Asphalt** (asphalt-high): quiet buttons, selected tabs, disabled paint, icon wells.
- **Hairline** (hairline): panel borders, dividers, field borders at rest.
- **Strong Hairline** (hairline-strong): pill borders, quiet-button borders, dashed disabled borders.
- **Road Grey** (road-grey): secondary text, helpers, inactive nav.
- **Dim Road Grey** (road-grey-dim): faint marks: stalled/connecting dots, the dashed border of the refused button.

### Named Rules
**The Paint Means Something Rule.** Road white is the trading key; kerb yellow is the owner key and money; stop red is an onchain refusal; signal green is live and confirmed onchain. No paint is ever used for emphasis, selection, brand flourish or price direction.

**The Face ID Now Rule.** A button is yellow only when pressing it triggers a Face ID (owner key) prompt at that moment. Navigation into owner-key territory is yellow text at most, never a yellow button.

**The No Direction Rule.** There is no red/green up/down: green means live, never up. Ask and bid are both road white; the best level is full white, depth is road white at reduced alpha.

## Typography

**Display Font:** Big Shoulders Stencil 700 (price) and 800 (wordmark, zone signage) (with Archivo, sans-serif)
**Body Font:** Switzer 400/500/600 (with system-ui)
**Figures:** Archivo, width axis 66–80, semibold, tabular
**Data Mono:** Martian Mono (addresses, hashes)

**Character:** Street lettering over a quiet, precise interface. The stencil face is signage; Archivo's compressed widths make numbers engineered and dense; Switzer stays out of the way.

### Hierarchy
- **Display** (700, 81px on the phone hero, clamp(84px, 7vw, 112px) on desktop, 0.94): the live mid price only. Rendered through a settling-number component so only changed digits animate.
- **Headline** (600, 30px mobile / 44px desktop, tight, -0.015em): one screen title per page, followed by a 122px stretch of lane dashes at 60% opacity.
- **Title** (600, 17px): panel and card headings; 15px for the lane header.
- **Figure** (Archivo 600, 13–26px, wdth 66–80, tabular): book prices (15px, wdth 72), book sizes (13px, wdth 80), hero ask/bid (21px, 26px on the side the draft joins, wdth 66), balances (24px, wdth 75), the BUY bar (20.5px, wdth 80).
- **Body** (400, 13.5–14px, 1.625, max 44–52ch): explanations, in road grey.
- **Label** (500, 12px): field labels, pills, curb-edge notes, tab-bar labels.
- **Data mono** (Martian Mono 400, 11–12.5px, 1.7): addresses and transaction hashes.
- **Signage** (Stencil 800, 11px, uppercase, 0.14em): only as a sign painted on a hatched plate, naming that zone.

### Named Rules
**The Full Precision Rule.** Prices print at the market's full precision from live data (six decimals on MON/USDC), never rounded; a one-tick spread must never read as zero.

**The Borrowed Four Rule.** Every stencil "4" on the site renders from Big Shoulders (the non-stencil cut, loaded for U+0034 only and first in the stencil stack) because the stencil 4's detached crossbar reads as a second decimal point.

**The Tabular Figures Rule.** Every compared number is tabular (`tnum`); addresses and hashes are Martian Mono.

## Layout

Mobile-first at 375px. Phone content runs in one column with 16px gutters (22px on the Trade hero and screen headers), 16px stacks, and 128px bottom padding to clear the 72px tab bar plus the safe-area inset. The Trade hero is a full-bleed stack: header, network/block row, market, price over the photographic plate, spread, live pill, lane dashes, ask, centre line, bid, BUY bar.

At 768px (md) the tab bar becomes a 72px sticky top bar, gutters widen to 32px, stacks to 24px, and Trade becomes two columns with the market panel spanning both. At 1280px (xl) Trade is a three-column terminal (market + key limits / order lane / ticket, 1.05fr : 1.2fr : 0.95fr) inside max 1480px. Keys runs in max 1100px; narrower screens in max 860px. The block indicator joins the top bar at 1024px (lg).

## Elevation & Depth

Layered and mostly flat: depth comes from three asphalt tones plus hairlines, with one shadow for panels. Translucent chrome (tab bar, top bar, live pill) sits on asphalt at 60–95% with a backdrop blur.

### Shadow Vocabulary
- **Panel lift** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.03) inset, 0 12px 32px -12px rgb(0 0 0 / 0.7)`): every panel.
- **Owner halo** (`0 0 0 1px rgb(255 214 0 / 0.06)` added to the panel lift): the owner key card only.
- **Block pulse** (ring from 55% road white to 7px transparent): the live dot, once per block.

### Named Rules
**The One Lift Rule.** Panels share a single shadow; nothing floats higher. Hierarchy is carried by tone, borders and paint.

## Shapes

Gently rounded panels (16px) holding 12px buttons, fields and wells; nested elements step down (10px off-book zones and the BUY bar, 9px segment buttons and hatch strips, 6px mini hatches). Status, filters and nav items are full pills. Road geometry is square and painted: curb lines are two 2px strokes 7px apart; lane dashes are 20px on a 34px period, 3px tall; hatching is 135° stripes (6px paint, 8px gap); the kerb strip is 6px of yellow broken every 78px; wordmark slashes are filled parallelograms as thick as the letter stems. Icons are line icons (lucide, 1.7–2.4 stroke) or custom line SVGs.

## Components

### Buttons
- **Shape:** 12px radius, 56px tall, 20px inline padding, 17px/600 label.
- **Primary (road white):** trading-key actions and navigation. Hover lifts toward white; press scales to 0.985 on the spring.
- **Owner (kerb yellow):** only for an action that prompts Face ID now.
- **Quiet:** high asphalt with a strong hairline; hover lifts the border to road grey. Secondary choices and empty-state actions.
- **Disabled paint:** never a faded yellow or white. Disabled primary and owner buttons become high asphalt with a dashed strong-hairline border and road-grey text. A refused action (off the lane) is a hatched, dashed-border button.

### Chips
- **Pill:** 26px, strong hairline border, 12px/500. An owner-key pill takes a 40% yellow border and yellow text.
- **Filter tabs:** 40px pills; selected is a road-white border on high asphalt, never yellow.
- **Draft chip:** dashed road-white outline inside the lane ("Your buy …"); solid road-white fill with asphalt text when off the lane.

### Cards / Containers
- **Panel:** raised asphalt, 1px hairline, 16px radius, panel lift, 20px padding (16px for the ticket).
- **Key card:** panel with a 44px round glyph well; owner variant with a yellow 45% border and halo.
- **Money panel:** panel topped by the painted-kerb strip.
- **Empty panel:** centred 56px icon well, 18px title, road-grey body, one quiet action. It says what will appear and shows nothing pretending to be it.

### Inputs / Fields
- **Style:** asphalt well, 1px hairline, 12px radius, label row (12px grey label, unit in road white) over a large Archivo figure and a helper line.
- **Focus:** the border turns road white (kerb yellow on an owner-key amount).
- **Invalid / off the lane:** road-white border; off the lane the field is hatched and the status line names the curb price, with "Snap to curb" beside a disabled hatched "Off the lane".

### Navigation
- **Mobile:** fixed 72px five-item tab bar, 22px line icons over 12px/500 labels; active is road white with a heavier stroke, inactive road grey.
- **Desktop:** sticky 72px top bar with the wordmark, pill nav items (active: high asphalt, strong-hairline ring, road white) and the block indicator pill.

### Signer line
Before every action, a 12px line names the key that signs it: the key glyph and name in road white ("Trading key · no prompt") or kerb yellow ("Owner key · Face ID required").

### Order Lane (signature)
Kuru's live book between two curb lines. From top: a hatched off-book zone with its stencil sign, the max-buy curb line and its value, asks inside the lane, the centre line (a road-white dot or the draft chip, then lane dashes stepping per block), bids inside the lane, the min-sell curb line, a hatched off-book zone below. Levels past a curb are drawn inside the hatching at 55% opacity. Depth bars are square-root scaled, road white at 30–100% alpha.

### Block Indicator
A pill: status dot (signal green and pulsing once per block when live, faint when connecting or stalled, a hollow ring when offline), status word (signal green when live), average block interval in condensed Archivo, a hairline divider, and the block number. Dashes dim to 35% when the stream stalls.

## Do's and Don'ts

### Do:
- **Do** use road white for every trading-key action, the selected tab and filter, focus, and both sides of the book.
- **Do** reserve the yellow button for an action that triggers Face ID in that tap; mark owner-key text, glyphs and the money-moving panel strip in kerb yellow.
- **Do** mark anything past a curb, or refused, with 135° hatching; label the zone with stencil signage on the hatch itself.
- **Do** print prices at full precision from live data with tabular figures, and render stencil 4s from Big Shoulders.
- **Do** tie motion to the chain: dashes step 34px per real block, decelerating (ease-out, never overshooting: road markings don't wobble), moved by transform, digits settle only when they change, the live dot pulses once per block; pair every animation with its reduced-motion replacement.
- **Do** put a stretch of lane dashes under every screen title so the road runs through every screen.
- **Do** show the signer before every action.
- **Do** light signal green only from the chain: a block arriving, a transaction confirmed, an action the account allows.

### Don't:
- **Don't** colour prices or depth red or green by direction.
- **Don't** use kerb yellow for selection, hover, emphasis, charts or brand accents beyond the wordmark slashes.
- **Don't** use stop red for anything but an onchain refusal, and never for small text.
- **Don't** use signal green for prices, gains, selection, or success that never touched the chain; offline is a hollow grey ring, not red.
- **Don't** fade a paint button when disabled; switch it to dashed high asphalt.
- **Don't** add a second shadow level, glow or gradient surface; the only gradient is the scrim over the photographic plate.
- **Don't** use stencil signage as a label above a heading or outside a hatched zone.
- **Don't** show mock, placeholder or rounded figures; an absent value is an em dash.
