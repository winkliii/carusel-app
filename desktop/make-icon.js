// Draws the app icon (1024px PNG) and wraps a 256px PNG into a Windows .ico. No dependencies.
const zlib = require('zlib'), fs = require('fs'), path = require('path');
const out = process.argv[2];

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function png(w, h, rgba) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// signed distance to a rounded rectangle
const sd = (x, y, cx, cy, hw, hh, r) => { const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r; return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r; };
const cover = d => Math.min(1, Math.max(0, 0.5 - d));

// mode: 'round' = desktop icon with transparent corners, 'square' = full-bleed (iOS), 'fg' = Android adaptive foreground (content in the safe zone)
function draw(S, mode = 'round') {
  const buf = Buffer.alloc(S * S * 4), k = mode === 'fg' ? 0.6 : mode === 'square' ? 0.94 : 1, u = S / 1024 * k;
  const panels = [                      // carousel frames: two side ones behind, main one in front
    { cx: 262, cy: 512, hw: 150, hh: 215, r: 34, a: 0.55 },
    { cx: 762, cy: 512, hw: 150, hh: 215, r: 34, a: 0.55 },
    { cx: 512, cy: 512, hw: 205, hh: 285, r: 44, a: 1 },
  ];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const gx = (x + .5) * 1024 / S, gy = (y + .5) * 1024 / S, t = (gx + gy) / 2048, px = (gx - 512) / k + 512, py = (gy - 512) / k + 512;
    let r = 255 + (236 - 255) * t, g = 164 + (88 - 164) * t, b = 104 + (40 - 104) * t;
    const bgA = mode === 'round' ? cover(sd(px, py, 512, 512, 412, 412, 185) * u) : 1;
    for (const p of panels) {
      const sh = cover(sd(px, py - 14, p.cx, p.cy, p.hw + 10, p.hh + 10, p.r + 10) * u / 14 + .5) * 0.16 * p.a;
      r *= 1 - sh; g *= 1 - sh; b *= 1 - sh;
      const a = cover(sd(px, py, p.cx, p.cy, p.hw, p.hh, p.r) * u) * p.a;
      r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a;
    }
    // "photo" inside the main panel: orange block with a seam line, hinting at the continuous image
    const ph = cover(sd(px, py, 512, 480, 165, 205, 22) * u);
    r += (250 - r) * ph; g += (120 - g) * ph; b += (70 - b) * ph;
    const sun = cover((Math.hypot(px - 580, py - 400) - 46) * u) * ph;
    r += (255 - r) * sun; g += (236 - g) * sun; b += (200 - b) * sun;
    const hill = cover((Math.hypot(px - 450, py - 830) - 300) * u) * ph;
    r += (150 - r) * hill; g += (52 - g) * hill; b += (30 - b) * hill;
    const i = (y * S + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = Math.round(bgA * 255);
  }
  return png(S, S, buf);
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-1024.png'), draw(1024));
const p256 = draw(256), ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(p256.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([ico, p256]));
fs.writeFileSync(path.join(out, 'icon-ios-1024.png'), draw(1024, 'square'));
fs.writeFileSync(path.join(out, 'icon-android-fg.png'), draw(432, 'fg'));
