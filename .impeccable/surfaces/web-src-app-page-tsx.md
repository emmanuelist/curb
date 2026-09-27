---
version: 1
slug: "web-src-app-page-tsx"
primary_target: "web/src/app/page.tsx"
related_targets: ["web/src/components/trading/trade-screen.tsx"]
---

# Surface: Trade (web/src/app/page.tsx)

**Mode:** Operate. The visitor completes a task: read the live market and place an order inside the lane. A judge must also grasp the claim within one screen.

**Audience and job:**
- Crypto-savvy traders on a phone, placing and cancelling MON/USDC orders on Kuru without signing prompts.
- Judges on laptops, understanding "a trading key that can't withdraw, and can't trade off Kuru's live book" in seconds.

**Content and proof:** everything on screen is real:
- the live Kuru book (bestBidAsk plus getL2Book)
- the Monad block stream over WebSocket
- lane limits from computeLane()
- the signer shown before every action

**Constraints:** the colour meanings in PRODUCT.md bind; there are no mocks. Buy stays disabled until CurbAccount exists, and the UI says so honestly.

**Memorable moment:** the lane. Kuru's live book sits between two curb lines, and a draft order visibly slides into the hatched off-book zone when it crosses them.

**Unresolved:** the Mera and Kuru bounty texts (#5).

## Direction contract

THESIS: Trade on the real curb. A premium, layered mobile trading app whose information architecture is road markings: the price stands over a photograph of an actual yellow curb, and the book lives in a lane bounded by live limits. It refuses the category default of a generic exchange table plus candle chart.

OWN-WORLD:
- Near-black asphalt #0B0D0F under hairline-bordered rounded panels (12–16px radius, 1px #262B30) with soft depth.
- A photographic night-asphalt plate with a painted yellow curb.
- Condensed heavy display figures; quiet sans for body; mono for data.
- Kerb yellow for owner key and money; road white for the trading key; stop red only for onchain refusal.
- Line-icon tab bar and pill status chips. The active tab is road white, not the board's yellow: selection is not money, and the user ruled "yellow only for owner-key/money" (Board's look, brief's meanings).

STORY: see the live price and block, see where the trading key may trade, draft an order, and know which key signs it before tapping.

FIRST VIEWPORT (390×790):
- Wordmark with yellow slashes and a menu top-left and right; the network and block row.
- Market selector, then a huge price over the curb photo, then a real-data subline.
- A live pill, then the dashed lane with Ask above and Bid below, bars and sizes.
- An outlined BUY ticket bar, then the tab bar.

FORM: pinned by the user (the concept board is the approved comp; the "board's look, brief's meanings" translation: ask/bid/BUY in road white, not yellow; live status in the palette). Seed key 123f24d0 was overridden by the pin.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
