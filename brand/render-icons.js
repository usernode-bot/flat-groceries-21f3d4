// Draws the Flat Groceries brand icons with no dependencies (Node built-ins only).
//
//   node brand/render-icons.js
//
// Writes brand/icon.png (1024x1024), brand/featured-light.png and
// brand/featured-dark.png (1200x800), then checks dimensions, file size,
// palette and small-size readability. Exits non-zero if a check fails.
//
// Colours are the Homeroom brand palette quoted in the request:
//   Cream #FFFEEA, Yellow #FFEE6F, Blue #3090E1, Green #A9CF97,
//   White #FFFFFF, Pale yellow #FCFAB3, Black #000000, Grey #B9B9B9.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const PAL = {
  cream: [255, 254, 234],
  yellow: [255, 238, 111],
  blue: [48, 144, 225],
  green: [169, 207, 151],
  white: [255, 255, 255],
  pale: [252, 250, 179],
  black: [0, 0, 0],
  grey: [185, 185, 185],
};

// --- Mark geometry, in a 1024x1024 space -------------------------------

const ROOF = [
  [332, 358],
  [568, 190],
  [804, 358],
];
const BODY = [
  [196, 418],
  [288, 418],
  [364, 690],
  [768, 690],
  [832, 486],
  [307, 486],
];
const WHEELS = [
  [412, 814, 52],
  [720, 814, 52],
];
const STROKE_R = 32; // 64 px wide strokes, round caps and joins

// --- Shape predicates ---------------------------------------------------
// All shapes are closed areas; a shape holds the points within its distance.

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = px - (ax + t * dx);
  const qy = py - (ay + t * dy);
  return Math.sqrt(qx * qx + qy * qy);
}

function polyDist(px, py, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return d;
}

function inPoly(pts, r, x, y) {
  return polyDist(x, y, pts) <= r;
}

function inDisc(cx, cy, r, x, y) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inRRect(cx, cy, hw, hh, rad, x, y) {
  const qx = Math.abs(x - cx) - (hw - rad);
  const qy = Math.abs(y - cy) - (hh - rad);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const dist = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - rad;
  return dist <= 0;
}

// --- Renderer ------------------------------------------------------------
// Layers are front to back; the first layer holding a sample wins, the last
// resort is the ground colour. 4x4 supersampling per pixel.

function render(width, height, layers, ground) {
  const px = Buffer.alloc(width * height * 3);
  const N = 4;
  let o = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const sampleX = x + (sx + 0.5) / N;
          const sampleY = y + (sy + 0.5) / N;
          let c = ground;
          for (const layer of layers) {
            if (layer.hit(sampleX, sampleY)) {
              c = layer.colour;
              break;
            }
          }
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      px[o++] = Math.round(r / (N * N));
      px[o++] = Math.round(g / (N * N));
      px[o++] = Math.round(b / (N * N));
    }
  }
  return px;
}

// --- PNG encoding (RGB, 8-bit, no alpha) ---------------------------------

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function writePng(file, width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter type 0
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB, no alpha, so the image is opaque
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

// --- The three images -----------------------------------------------------

function markLayers(scale, ox, oy, colour) {
  const s = (pts) => pts.map(([x, y]) => [ox + x * scale, oy + y * scale]);
  const layers = [];
  layers.push({ hit: (x, y) => inPoly(s(ROOF), STROKE_R * scale, x, y), colour });
  layers.push({ hit: (x, y) => inPoly(s(BODY), STROKE_R * scale, x, y), colour });
  for (const [cx, cy, r] of WHEELS) {
    layers.push({ hit: (x, y) => inDisc(ox + cx * scale, oy + cy * scale, r * scale, x, y), colour });
  }
  return layers;
}

function buildIcon() {
  return render(1024, 1024, markLayers(1, 0, 0, PAL.black), PAL.yellow);
}

function buildFeatured(dark) {
  const ground = dark ? PAL.black : PAL.cream;
  const layers = [];
  // The mark sits on the tile, so it goes first (front to back).
  layers.push(...markLayers(480 / 1024, 360, 160, PAL.black));
  // Accent dots. In the light version each dot gets a black outline, so every
  // colour sits next to black, as the brand pairings ask.
  const dots = [
    [300, 250, 30, PAL.green],
    [900, 560, 30, PAL.blue],
    [880, 220, 22, PAL.yellow],
  ];
  for (const [cx, cy, r, colour] of dots) layers.push({ hit: (x, y) => inDisc(cx, cy, r, x, y), colour });
  if (!dark) {
    for (const [cx, cy, r] of dots) layers.push({ hit: (x, y) => inDisc(cx, cy, r + 4, x, y), colour: PAL.black });
  }
  layers.push({
    hit: (x, y) => inRRect(360 + 240, 160 + 240, 240, 240, 112, x, y),
    colour: PAL.yellow,
  });
  return render(1200, 800, layers, ground);
}

// --- Checks ----------------------------------------------------------------

let failed = false;
function check(name, ok, detail) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed = true;
}

function readPngSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), buf };
}

function near(c, target, tol) {
  return (
    Math.abs(c[0] - target[0]) <= tol && Math.abs(c[1] - target[1]) <= tol && Math.abs(c[2] - target[2]) <= tol
  );
}

// Every pixel must be a palette colour, or a blend of two palette colours
// that touch in that image (the antialiased edges).
function paletteOk(rgb, touching) {
  const names = Object.keys(PAL);
  const pairs = [];
  for (let i = 0; i < touching.length; i++) {
    for (let j = i + 1; j < touching.length; j++) pairs.push([PAL[touching[i]], PAL[touching[j]]]);
  }
  for (let o = 0; o < rgb.length; o += 3) {
    const c = [rgb[o], rgb[o + 1], rgb[o + 2]];
    let ok = false;
    for (const name of names) {
      if (near(c, PAL[name], 2)) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      for (const [a, b] of pairs) {
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const ab2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
        let t = ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2]) / ab2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = [a[0] + t * ab[0] - c[0], a[1] + t * ab[1] - c[1], a[2] + t * ab[2] - c[2]];
        if (Math.abs(d[0]) <= 2 && Math.abs(d[1]) <= 2 && Math.abs(d[2]) <= 2) {
          ok = true;
          break;
        }
      }
    }
    if (!ok) return [o / 3, c];
  }
  return null;
}

function luminance(c) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function checkSmallSize() {
  // The icon again at 32x32, written to the temp dir (not committed): the
  // gap between the roof and the basket rim must still show yellow, so the
  // roof does not merge into the basket at the smallest size.
  const small = render(32, 32, markLayers(32 / 1024, 0, 0, PAL.black), PAL.yellow);
  const file = path.join(os.tmpdir(), 'flat-groceries-icon-32.png');
  writePng(file, 32, 32, small);
  const colA = Math.floor((568 / 1024) * 32); // roof apex x
  const gapTop = Math.ceil((190 + STROKE_R) / (1024 / 32));
  const gapBottom = Math.floor((486 - STROKE_R) / (1024 / 32));
  let sawYellow = false;
  const rows = [];
  for (let x = colA - 1; x <= colA + 1 && !sawYellow; x++) {
    for (let y = gapTop; y <= gapBottom; y++) {
      const c = [small[(y * 32 + x) * 3], small[(y * 32 + x) * 3 + 1], small[(y * 32 + x) * 3 + 2]];
      const dYellow = Math.hypot(c[0] - 255, c[1] - 238, c[2] - 111);
      const dBlack = Math.hypot(c[0], c[1], c[2]);
      rows.push(`x${x}y${y}=rgb(${c.join(',')})`);
      if (dYellow < dBlack) {
        sawYellow = true;
        break;
      }
    }
  }
  check('small size: roof separated from rim at 32px', sawYellow, `${file} (${rows.slice(0, 4).join(' ')})`);
}

// --- Run ---------------------------------------------------------------------

const here = __dirname;
const iconPath = path.join(here, 'icon.png');
const lightPath = path.join(here, 'featured-light.png');
const darkPath = path.join(here, 'featured-dark.png');

const t0 = Date.now();
const icon = buildIcon();
const light = buildFeatured(false);
const dark = buildFeatured(true);
const iconSize = writePng(iconPath, 1024, 1024, icon);
const lightSize = writePng(lightPath, 1200, 800, light);
const darkSize = writePng(darkPath, 1200, 800, dark);
console.log(`rendered in ${Date.now() - t0} ms`);

const iconPng = readPngSize(iconPath);
const lightPng = readPngSize(lightPath);
const darkPng = readPngSize(darkPath);
check('icon dimensions 1024x1024', !!iconPng && iconPng.width === 1024 && iconPng.height === 1024);
check('featured dimensions 1200x800', !!lightPng && lightPng.width === 1200 && lightPng.height === 800 && !!darkPng && darkPng.width === 1200 && darkPng.height === 800);
check('icon file under 256 KB', iconSize < 256 * 1024, `${(iconSize / 1024).toFixed(1)} KB`);

check('icon palette (yellow, black)', paletteOk(icon, ['yellow', 'black']) === null, JSON.stringify(paletteOk(icon, ['yellow', 'black'])));
check('featured light palette', paletteOk(light, ['cream', 'yellow', 'black', 'green', 'blue']) === null, JSON.stringify(paletteOk(light, ['cream', 'yellow', 'black', 'green', 'blue'])));
check('featured dark palette', paletteOk(dark, ['black', 'yellow', 'green', 'blue']) === null, JSON.stringify(paletteOk(dark, ['black', 'yellow', 'green', 'blue'])));

const cMark = contrast(PAL.black, PAL.yellow);
const cOnBlack = contrast(PAL.yellow, PAL.black);
const cOnWhite = contrast(PAL.yellow, PAL.white);
console.log(`contrast: mark on tile ${cMark.toFixed(1)}:1, tile on #000000 ${cOnBlack.toFixed(1)}:1, tile on #FFFFFF ${cOnWhite.toFixed(1)}:1`);
check('mark on tile contrast >= 4.5', cMark >= 4.5);

checkSmallSize();

process.exit(failed ? 1 : 0);
