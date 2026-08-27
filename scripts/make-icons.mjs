// Regenerates the placeholder app icons. Run: node scripts/make-icons.mjs
//
// Hand-rolls a minimal truecolor PNG so the repo stays dependency-free. Only
// the pieces a solid-colour icon needs: signature, IHDR, one IDAT, IEND.

import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const BG = [0x11, 0x18, 0x27];
const FG = [0x34, 0xd3, 0x99];

function chunk(type, body) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([head, typed, crc]);
}

// Perpendicular distance from p to the segment ab, all in 0..1 coordinates.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function icon(size) {
  const stroke = 0.075;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // leading 0 = "no filter"
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size;
      const py = (y + 0.5) / size;
      const onCheck =
        distToSegment(px, py, 0.24, 0.52, 0.42, 0.71) < stroke ||
        distToSegment(px, py, 0.42, 0.71, 0.76, 0.31) < stroke;
      (onCheck ? FG : BG).forEach((v, i) => row.writeUInt8(v, 1 + x * 3 + i));
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);  // bit depth
  ihdr.writeUInt8(2, 9);  // colour type: truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512]) {
  const path = `icons/icon-${size}.png`;
  writeFileSync(path, icon(size));
  console.log(`wrote ${path}`);
}
