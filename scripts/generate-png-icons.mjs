import fs from 'fs';
import zlib from 'zlib';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(size, isMaskable = false) {
  const width = size;
  const height = size;

  // Scanline: 1 byte filter type (0) + width * 4 bytes (RGBA)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const scale = size / 192;

  // Design elements scaled
  // Outer rounded rect radius
  const cornerR = isMaskable ? 0 : 36 * scale;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Default background transparent
      let r = 0, g = 0, b = 0, a = 0;

      // Rounded rect boundary check for non-maskable
      let inBg = false;
      if (isMaskable) {
        // Full bleed for maskable
        inBg = true;
      } else {
        const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerR));
        const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerR));
        if (dx * dx + dy * dy <= cornerR * cornerR) {
          inBg = true;
        }
      }

      if (inBg) {
        // Background color: slate-800 #1e293b
        r = 30; g = 41; b = 59; a = 255;

        // Foreground: head circle (cx: 96, cy: 74, r: 34)
        const headCx = 96 * scale;
        const headCy = (isMaskable ? 80 : 74) * scale;
        const headR = (isMaskable ? 28 : 34) * scale;

        const distHead = Math.hypot(x - headCx, y - headCy);
        if (distHead <= headR) {
          // sky-400 #38bdf8
          r = 56; g = 189; b = 248; a = 255;
        }

        // Body: arc (cx: 96, cy: 152, rx: 54, ry: 52)
        const bodyCx = 96 * scale;
        const bodyCy = (isMaskable ? 154 : 152) * scale;
        const bodyRx = (isMaskable ? 46 : 54) * scale;
        const bodyRy = (isMaskable ? 44 : 52) * scale;

        if (y <= bodyCy && y >= bodyCy - bodyRy) {
          const normX = (x - bodyCx) / bodyRx;
          const normY = (y - bodyCy) / bodyRy;
          if (normX * normX + normY * normY <= 1) {
            r = 56; g = 189; b = 248; a = 255;
          }
        }

        // Status badge: green dot (cx: 140, cy: 56, r: 14)
        const badgeCx = (isMaskable ? 134 : 140) * scale;
        const badgeCy = (isMaskable ? 60 : 56) * scale;
        const badgeR = (isMaskable ? 12 : 14) * scale;
        const distBadge = Math.hypot(x - badgeCx, y - badgeCy);
        if (distBadge <= badgeR) {
          // emerald-500 #22c55e
          r = 34; g = 197; b = 94; a = 255;
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // Header chunk IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Compression deflate
  ihdrData[11] = 0; // Filter standard
  ihdrData[12] = 0; // Interlace none
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Compressed pixel data IDAT
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);

  // End chunk IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate icons
fs.writeFileSync('public/icon-192.png', generatePng(192, false));
fs.writeFileSync('public/icon-512.png', generatePng(512, false));
fs.writeFileSync('public/icon-maskable-512.png', generatePng(512, true));
fs.writeFileSync('public/apple-touch-icon.png', generatePng(180, false));

console.log('Generated PNG icons successfully!');
