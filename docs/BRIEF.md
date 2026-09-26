# CURB — master build brief

> **Status:** adopted on 2026-09-26 as the design and frontend spec, **with the amendments below** (D-011 in docs/DECISIONS.md).
> Where an amendment and the brief disagree, the amendment wins. Everything else in the brief applies as written.
>
> **Amendments**
>
> 1. **No mock data layer (replaces §20).** The hackathon rules require "a functioning prototype, not a mockup" (§9.1), and CLAUDE.md rule 1 bans mocks.
>    - Development runs against an **anvil fork of Monad mainnet**: real Kuru bytecode, a real book snapshot, real refusals from CurbAccount, and repeatable.
>    - Production reads Kuru's book and new blocks straight from Monad.
>    - Fixed fixtures exist **only in tests** (empty, loading and error states) and never ship.
>    - §26 ("do not pretend") stands in full.
> 2. **No wagmi (amends §19).** Curb has no browser wallet: signing is passkey → Mera → viem `LocalAccount` (D-003). Use viem plus TanStack Query for async and onchain state. Use Zustand only if client interaction state needs it. Keep the domain/data layer exactly as §19 describes.
> 3. **Scope (amends §13).** Build the screens that carry the thesis:
>    - Onboarding, Trade (lane + book + inline ticket), and Order preview / lane-lock confirmation.
>    - Orders (Open · Filled · Cancelled), History (lane timeline), Transaction details, Refused transaction.
>    - Keys, the Owner-key Face ID sheet, Deposit and Withdraw.
>    - Network status folds into the block indicator; Security folds into Keys; empty, loading and error states live inside each screen.
>    - **Cut:** Notifications (iOS web push needs an installed PWA), appearance and currency settings, the market selector (only MON-USDC has liquidity), and a price chart. Settings shrinks to what's essential (sign out, recovery), under More.
> 4. **Onboarding is added (missing from §13).** Create or sign in with a passkey via Mera.
>    - Detect in-app browsers (Telegram, X, Discord, Instagram) **before** the ceremony and send users to Safari/Chrome.
>    - Map `PRF_UNAVAILABLE` / `PASSKEY_OPERATION_FAILED` to exact guidance (Safari; Chrome with Google Password Manager; or a phone).
>    - See docs/CONTEXT.md → Traps.
> 5. **Desktop is first-class from M1 (reinforces §7/§17).** Judges mostly open links on laptops, so the desktop terminal layout ships in the same milestone as mobile.
> 6. **Colours:** the brief's values are canonical (#0B0D0F, #EDEDED, #FFD600, #FF3838), with Display-P3 equivalents for wide-gamut screens. White text on Stop Red is ~3.5:1, so large stencil signage only; never small text on red.
> 7. **The concept board** (internal/design, gitignored) is a mood reference only. It is AI concept art, and it breaks this brief in places: red/green book and candles, yellow on trading-key actions, and swapped key semantics. It must never be published as a picture of the product (rules §10.1).

---


You are the lead product designer, frontend architect, interaction designer, and senior React engineer for this project.

Do not treat this as a generic crypto dashboard.

You are building **CURB**, a serious, forward-looking onchain trading interface whose entire visual language is derived from **street curbs, road markings, lane restrictions, asphalt, signage, and the history of curbside trading**.

The goal is not to make a pretty crypto UI.

The goal is to create a product that, when someone sees it for 3 seconds, immediately recognizes:

**CURB = trading inside enforced boundaries.**

The design must feel like a product that could plausibly ship in 2026–2028.

It must NOT look like a 2021–2024 crypto dashboard.

---

# 1. FIRST: INSPECT BEFORE BUILDING

Before writing significant code:

1. Inspect the entire repository.
2. Understand the existing architecture.
3. Identify the framework, package manager, dependencies, routing, state management, wallet integration, contracts, APIs, and existing design system.
4. Do not replace working infrastructure unnecessarily.
5. Identify what is already connected to Monad/Kuru/onchain data.
6. Identify what is mocked.
7. Identify the existing responsive breakpoints.
8. Identify any existing reusable components.
9. Identify existing fonts/assets before introducing duplicates.

Create a short internal implementation plan before modifying the code.

Do not ask me to make trivial design decisions.
Make strong design decisions consistent with this brief.

---

# 2. PRODUCT IDEA

CURB represents a trading system through the language of a street.

The core visual metaphor:

* asphalt = application environment
* road white = trading-key activity
* kerb yellow = owner-key / money-moving activity
* stop red = onchain rejection
* solid lines = enforced trading boundaries
* dashed lane = live order-book/trading area
* hatched zone = unavailable/refused/off-book area
* street lettering = important system states
* road markings = information architecture

The metaphor must be functional, not decorative.

Every major visual element should communicate product information.

Do not randomly add road textures just because they look cool.

---

# 3. DESIGN PRINCIPLE

The most important rule:

## THE DESIGN MUST COME FROM THE PRODUCT.

Do not build:

* generic Web3 dashboard
* glassmorphism
* purple/blue gradients
* neon cyberpunk
* floating rounded cards everywhere
* excessive blur
* giant glowing graphs
* generic green/red trading indicators
* Inter as the default font
* generic SaaS dashboard layouts
* excessive shadows
* decorative 3D objects without purpose

Do not copy existing crypto interfaces.

Do not make the application look like a template.

---

# 4. VISUAL SYSTEM

## Base

Background:

ASPHALT

Use a near-black asphalt surface with extremely subtle texture.

Do not turn the background into a noisy image.

Texture should be almost invisible until the user notices it.

---

## Colours

Use a deliberately tiny semantic palette.

### Asphalt

#0B0D0F

### Road White

#EDEDED

Used for:

* trading key
* active trading interface
* lane contents
* neutral system information

### Kerb Yellow

#FFD600

Used for:

* owner key
* withdrawals
* deposits
* money movement
* privileged actions

### Stop Red

#FF3838

Used ONLY for:

* rejected transactions
* refused actions
* contract restrictions

Important:

Red does NOT mean price is down.

Do not use red/green as generic trading colours.

Bid/ask distinction comes from spatial position and lane structure.

---

# 5. TYPOGRAPHY

Use three typography roles.

### Primary numerical type

Archivo

Use the variable font width axis aggressively.

Large prices should feel compressed and engineered.

Example:

0.02670

Numbers are the hero.

### Technical data

Martian Mono

Use for:

* addresses
* transaction hashes
* block numbers
* order-book data
* timestamps
* technical identifiers

### Interface/body

Switzer

Use quietly.

The UI should not scream typography everywhere.

### Signage

A stencil typeface may be used only for major system signage:

NO WITHDRAWAL
LOADING ZONE
OFF-BOOK
REFUSED

Do not use stencil typography for ordinary UI.

---

# 6. THE CORE CURB COMPONENT

Build a reusable `<CurbLane />` component.

This is the most important component in the application.

It represents the actual trading boundaries.

Conceptually:

---

```
  ASK
```

---

* * * * * TRADING LANE - - - - -

---

```
  BID
```

---

///////////////////////////////
OFF-BOOK / REFUSED
///////////////////////////////

The lane boundaries must derive from actual product data.

Do NOT hard-code the visual lines independently from the trading logic.

The same CurbLane component should appear in:

* main trading screen
* order ticket
* open orders
* order preview
* history
* rejected transaction state

This repetition is intentional.

The user should learn the visual language once.

---

# 7. MAIN TRADING SCREEN

Build the main trading experience first.

Desktop should feel like a professional trading terminal.

Mobile should feel like a native financial application rather than a squeezed desktop layout.

Primary hierarchy:

1. market
2. price
3. live block indicator
4. curb lane
5. order book
6. action
7. key identity

Example hierarchy:

CURB

MON / USDC

0.02670

+0.00012
+0.45%

MONAD
BLOCK 108,241,337
LIVE · ~400ms

---

## ASK 0.02671

---

BID 0.02669

---

BUY MON @ 0.02669

Trading key

Do not simply reproduce this text layout.

Design a genuinely strong interface around this hierarchy.

---

# 8. ORDER BOOK

The order book must feel integrated with the curb.

Avoid the traditional generic crypto exchange table.

Ask prices live above the lane.

Bid prices live below the lane.

The curb line is the boundary.

Use subtle movement when liquidity changes.

Do not animate every number.

Only meaningful changes should move.

Use fixed-width numerical typography.

---

# 9. ORDER ENTRY

The order ticket must visually inherit the curb.

When the user changes the price:

* the order position moves
* crossing a valid boundary is visually obvious
* moving outside the allowed region moves the order into the hatched zone
* the interface should explain the restriction through the visual language

Do not wait until the user submits to explain that an order is invalid.

The interface should communicate constraints before submission.

---

# 10. KEY-AWARE UI

Every action must clearly communicate which key will sign it.

Trading key:

WHITE

Owner key:

YELLOW

Examples:

Trading key
No prompt required

Owner key
Face ID required

Never hide signer identity inside a secondary modal.

The user should know BEFORE clicking the action.

---

# 11. REFUSAL MOMENT

This is one of the most important interactions.

Scenario:

Trading key attempts withdrawal.

The contract rejects the action.

The interface must not merely display:

"Transaction failed."

Instead:

1. The UI freezes briefly.
2. The relevant action enters the refused state.
3. A red curb/road marking appears.
4. Large stencil typography appears:

NO
WITHDRAWAL

5. The attempted action visually returns to the valid lane.
6. The transaction status is clearly marked REJECTED.
7. The rejected transaction hash is available.
8. Provide an explorer link.
9. Explain which key attempted the action.
10. Do not fabricate success.

The rejection animation must be dramatic but extremely short.

Think:

physical road barrier.

Not:

casino error animation.

---

# 12. BLOCK-TIME VISUALIZATION

Monad's live block stream should feed subtle motion.

Do not create a fake continuously looping animation.

When a new block arrives:

* lane dashes advance
* block number updates
* tiny status indicator changes
* relevant live data updates

The user should be able to understand:

"Something is actually happening onchain."

The animation must stop when the data stops.

Never fake real-time blockchain activity.

---

# 13. REQUIRED SCREENS

Do NOT stop after making the dashboard.

Build a coherent product with these screens:

1. Trading
2. Order Book
3. Order Entry
4. Order Confirmation
5. Open Orders
6. Filled Orders
7. Cancelled Orders
8. History
9. Transaction Details
10. Rejected Transaction
11. Keys
12. Owner Key / Face ID confirmation
13. Deposit
14. Withdraw
15. Market selector
16. Network status
17. Settings
18. Security
19. Notifications
20. Empty states
21. Loading states
22. Error states
23. Mobile navigation
24. Desktop navigation

These screens must feel like one product.

Do not create 24 unrelated designs.

---

# 14. NAVIGATION

Desktop:

Use a restrained persistent navigation system.

Mobile:

Use a bottom navigation structure where appropriate.

Potential primary navigation:

Trade
Orders
History
Keys
More

Avoid a dashboard sidebar filled with 15 menu items.

---

# 15. MOTION SYSTEM

Motion must communicate state.

Do NOT animate everything.

Use:

* CSS for simple transitions
* native browser View Transitions where appropriate
* Motion for spring physics, gestures, layout transitions and complex interaction

Motion principles:

* fast
* physical
* restrained
* interruptible
* data-driven

No:

* excessive bounce
* slow fades
* floating cards
* perpetual animations
* attention-seeking particle effects

Important events deserve motion.

Ordinary information should remain still.

---

# 16. ROAD-MARKING MOTION

Use subtle movement inspired by actual road markings.

Examples:

* lane dashes advance on new blocks
* order crossing boundary changes state
* rejected transaction paints a red boundary
* owner action introduces yellow marking
* history timeline uses road/lane geometry
* order confirmation uses a short lane-locking animation

Motion must always have a semantic relationship to the product.

---

# 17. RESPONSIVE DESIGN

Do not make desktop first and simply shrink it.

Design explicitly for:

### Mobile

390px
430px

### Tablet

768px

### Desktop

1280px
1440px
1728px+

At mobile widths:

* prioritize price
* order book
* curb
* action
* key identity

Secondary information moves below or into sheets.

Do not create horizontally overflowing tables.

---

# 18. COMPONENT ARCHITECTURE

Build reusable primitives rather than page-specific markup.

Suggested structure:

components/
curb/
curb-lane.tsx
curb-line.tsx
curb-hatched-zone.tsx
curb-block-indicator.tsx
curb-signage.tsx

trading/
market-header.tsx
price-display.tsx
order-book.tsx
order-entry.tsx
order-preview.tsx

keys/
trading-key-badge.tsx
owner-key-badge.tsx
signer-indicator.tsx

transactions/
transaction-status.tsx
transaction-details.tsx
rejection-state.tsx

navigation/
desktop-nav.tsx
mobile-nav.tsx

motion/
page-transition.tsx
block-tick.tsx
order-placement-motion.tsx
rejection-motion.tsx

Do not create huge monolithic components.

---

# 19. DATA ARCHITECTURE

Separate:

UI state

from

server/onchain state.

Use:

* TanStack Query for asynchronous/server state
* Zustand only for client interaction state where appropriate
* viem/wagmi for EVM/wallet interaction
* typed domain models for orders, markets, transactions and keys

Do not scatter blockchain calls across React components.

Create a domain/data layer.

Example:

lib/
chain/
kuru/
wallet/
markets/
orders/
transactions/

Components consume typed data.

Components should not know how RPC calls work.

---

# 20. REAL DATA VS MOCK DATA

During initial UI development:

Create a deterministic mock-data layer.

It must imitate:

* order-book updates
* price changes
* new blocks
* order creation
* order fills
* rejected transactions
* key switching

But make the interfaces identical to the real data layer.

Later, replace the adapter.

Do not mix mock logic directly into UI components.

Never display fake "live" data without clearly keeping it inside development/demo mode.

---

# 21. ACCESSIBILITY

The design is visually aggressive but must remain usable.

Requirements:

* keyboard navigation
* visible focus states
* reduced-motion support
* semantic buttons
* accessible dialogs
* screen-reader labels
* sufficient contrast
* touch targets
* no information conveyed by colour alone

Motion must respect the user's reduced-motion preference.

---

# 22. PERFORMANCE

Do not sacrifice performance for visual effects.

Avoid:

* giant background videos
* unnecessary WebGL
* huge image textures
* continuously running JavaScript animation loops
* layout thrashing
* excessive React re-renders

Prefer:

CSS

SVG

native browser animation

Motion only where useful.

If a visual effect costs meaningful performance, remove the effect rather than degrading the product.

---

# 23. OPTIONAL VISUAL EFFECTS

There may be ONE premium visual effect:

A subtle light glint moving across the curb when the device moves.

This is optional.

Build it only after the entire product is finished.

If it distracts from the product or costs performance, delete it.

---

# 24. DESIGN QUALITY BAR

After implementation, inspect the application as if you were reviewing a product for a major design award.

Ask:

Does this look like a generic crypto dashboard?

If yes, redesign it.

Does the curb metaphor disappear after the first screen?

If yes, strengthen the system.

Are there too many cards?

If yes, remove them.

Are there too many rounded rectangles?

If yes, remove them.

Does every page look like the same template?

If yes, introduce stronger information-specific layouts.

Does the interface communicate restrictions visually?

If no, redesign.

Does the UI look impressive in a screenshot but confusing when used?

If yes, prioritize usability.

---

# 25. IMPLEMENTATION ORDER

Do NOT build all pages randomly.

Build in this order:

PHASE 1
Design tokens
Typography
Global CSS
Navigation
CurbLane

PHASE 2
Main trading screen
Order book
Price system
Live block indicator

PHASE 3
Order entry
Order preview
Open orders

PHASE 4
History
Transaction details
Rejected transaction experience

PHASE 5
Keys
Owner key
Face ID flow
Deposit
Withdraw

PHASE 6
Settings
Network
Security
Notifications
Empty/loading/error states

PHASE 7
Mobile refinement

PHASE 8
Motion refinement

PHASE 9
Accessibility

PHASE 10
Performance

PHASE 11
Final visual audit

---

# 26. DO NOT PRETEND

If a feature is not connected to real onchain data:

label it internally as mocked/development state.

Do not fabricate transaction hashes.

Do not fabricate wallet balances.

Do not fabricate blockchain confirmation.

Do not fake successful transactions.

The UI can simulate flows in development mode, but the architecture must clearly distinguish simulation from production.

---

# 27. FINAL VISUAL DIRECTION

The final product should feel like:

street infrastructure
+
professional trading terminal
+
modern mobile financial product
+
onchain machine

It should NOT feel like:

crypto casino
+
gaming UI
+
generic SaaS dashboard.

The phrase to keep in mind:

# "The street already invented the UI."

Use road markings as information architecture.

Use the curb as the boundary.

Use asphalt as the environment.

Use yellow for ownership.

Use red for refusal.

Use white for trading.

Use motion to show real blockchain activity.

---

# 28. BEFORE DECLARING COMPLETE

Run:

* typecheck
* lint
* unit tests
* production build
* Playwright/browser checks
* responsive checks at 390px, 430px, 768px, 1280px, 1440px
* accessibility audit

Then perform a visual pass.

Do not stop when the code compiles.

The task is complete only when the interface looks intentionally designed and behaves like a coherent product.

Do not give me a generic "implementation complete" message.

Report:

1. what was built
2. what is connected to real data
3. what remains mocked
4. important architectural decisions
5. known limitations
6. commands used to validate the build
