// Generate simple extension icons as PNG files
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { deflateSync } from 'zlib';

// CRC32
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makePNG(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0;
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4;
      const di = y * (1 + size * 4) + 1 + x * 4;
      raw[di] = pixels[si]; raw[di+1] = pixels[si+1]; raw[di+2] = pixels[si+2]; raw[di+3] = pixels[si+3];
    }
  }
  const compressed = deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  }

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const dir = 'assets/icons';
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const px = new Uint8Array(size * size * 4);
  const bgR = 74, bgG = 144, bgB = 217;

  // Fill rounded rect background
  const R = Math.round(size * 0.18);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      if (x < R && y < R) inside = (R-x)**2 + (R-y)**2 <= R*R;
      else if (x >= size-R && y < R) inside = (x-size+R+1)**2 + (R-y)**2 <= R*R;
      else if (x < R && y >= size-R) inside = (R-x)**2 + (y-size+R+1)**2 <= R*R;
      else if (x >= size-R && y >= size-R) inside = (x-size+R+1)**2 + (y-size+R+1)**2 <= R*R;
      const i = (y * size + x) * 4;
      if (inside) { px[i]=bgR; px[i+1]=bgG; px[i+2]=bgB; px[i+3]=255; }
    }
  }

  // Draw "M"
  const m = Math.round(size * 0.22);
  const t = Math.max(2, Math.round(size * 0.14));
  const top = m, bot = size - m, lx = m, rx = size - m - t;
  const cx = Math.round(size / 2), half = Math.round((bot - top) * 0.5);

  function fill(x0, y0, w, h) {
    for (let yy = y0; yy < Math.min(y0+h, size); yy++)
      for (let xx = x0; xx < Math.min(x0+w, size); xx++)
        if (xx>=0 && yy>=0) { const i=(yy*size+xx)*4; px[i]=255; px[i+1]=255; px[i+2]=255; px[i+3]=255; }
  }

  fill(lx, top, t, bot-top);
  fill(rx, top, t, bot-top);
  for (let i = 0; i <= half; i++) {
    const p = i / (half || 1);
    fill(lx + t + Math.round(p * (cx - lx - t)), top + i, t, 1);
    fill(rx - Math.round(p * (rx - cx)), top + i, t, 1);
  }

  writeFileSync(`${dir}/icon-${size}.png`, makePNG(size, px));
  console.log(`icon-${size}.png`);
}
console.log('Done.');
