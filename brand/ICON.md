# Flat Groceries icon

The app mark: a black shopping cart with a little house roof over it, on a
yellow tile. The roof stands for the flat, the cart for the shopping.

## App icon — `icon.png`

1024×1024 PNG, RGB, opaque, full bleed with square corners. Homeroom rounds
the corners of the tile itself, so the file is a plain square.

- Pairing: Black `#000000` on Yellow `#FFEE6F` (contrast 17.7:1). Yellow was
  chosen over cream for the tile because it also stands out on dark home
  screens; a black tile would disappear on them.
- Style: one bold flat mark, 64 px strokes with round caps and joins, no
  gradients, no shadows, no text. Reads down to 32 px: the gap between the
  roof and the basket rim stays yellow at that size.
- Set as `icon.image` in `dapp.json`, with `icon.emoji` 🛒 kept as the
  fallback if the image ever fails to load.

## Featured icons — `featured-light.png`, `featured-dark.png`

1200×800 PNGs for the Homeroom directory, built from the same mark and
palette. Both carry the same yellow rounded-square tile (480×480, corner
radius 112) with the mark scaled onto it, plus three small round dots as
decoration: green `#A9CF97`, blue `#3090E1` and yellow `#FFEE6F`.

- Light: ground Cream `#FFFEEA`; each dot outlined in black, so every colour
  sits next to black as the brand pairings ask.
- Dark: ground Black `#000000`; the dots sit directly on black.

Note: Homeroom's `dapp.json` has no field for a featured image, so these two
files are committed here but not wired up anywhere. If the platform adds a
key for it, point it at these files; until then they need to be uploaded by
hand where the directory asks for one.

## Regenerating

```sh
node brand/render-icons.js
```

The script draws all three PNGs with Node built-ins only (no dependencies,
no image services) and checks dimensions, file size, palette (every pixel is
a brand colour or an antialiased blend of two that touch) and 32 px
readability. It exits non-zero when a check fails.

## Palette in use

Yellow `#FFEE6F`, Black `#000000`, Cream `#FFFEEA`, Green `#A9CF97`,
Blue `#3090E1` — from the Homeroom brand framework
(https://baked.design/brand/homeroom/). The framework page also ships a
downloadable brand file for AI generators; it was unreachable (HTTP 401)
when these icons were drawn, so the rules used are the colours, pairings and
flat one-mark style quoted in the request.
