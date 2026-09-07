# paint-calculator

How many litres and tins of paint you need for a room or a wall. Enter room
dimensions (or a direct wall area), add doors/windows to subtract, choose coats,
coverage (with surface presets), tin size, price and a wastage %. Output: litres
needed, whole tins, litres purchased, leftover, and cost. Metric, client-side,
inputs in the URL for sharing.

**Live:** https://paint-calculator.correia95.workers.dev/

## Stack

- React 18 + TypeScript + Vite, no runtime deps beyond React
- Static-assets Cloudflare Worker

## Engine

[`src/paint.ts`](src/paint.ts): wall area = perimeter × height (room mode) or the
entered area; + ceiling; − Σ(opening w × h × count); × coats; ÷ coverage; ×
(1 + wastage); `Math.ceil` to whole tins (min 1 if any area).

Verified in Node: 4 × 3.5 × 2.4 room, 1 door + 1 window, 2 coats, 13 m²/L, 5%
wastage → 32.9 m² paintable, 5.31 L, 2 × 4 L tins; ceiling adds 14 m²; area mode
100 m² → 5 tins; tiny areas still round to 1 tin.

## Develop / deploy

```bash
npm install
npm run dev
npm run deploy
```
