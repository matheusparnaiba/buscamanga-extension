/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

function base64ToUint8Array(b64: string): Uint8Array {
  const base64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  const len = padded.length;
  let validLen = len;
  if (padded.endsWith("==")) validLen -= 2;
  else if (padded.endsWith("=")) validLen -= 1;

  const byteLen = Math.floor((validLen * 3) / 4);
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = lookup[padded.charCodeAt(i)] ?? 0;
    const enc2 = lookup[padded.charCodeAt(i + 1)] ?? 0;
    const enc3 = lookup[padded.charCodeAt(i + 2)] ?? 0;
    const enc4 = lookup[padded.charCodeAt(i + 3)] ?? 0;

    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (p < byteLen) bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (p < byteLen) bytes[p++] = ((enc3 & 3) << 6) | enc4;
  }
  return bytes;
}

export function getParams(value: string): { v: number; e: number } {
  const byteArray = base64ToUint8Array(value);
  const v = byteArray[0] ?? 1;
  const e =
    ((byteArray[1] ?? 0) << 24) |
    ((byteArray[2] ?? 0) << 16) |
    ((byteArray[3] ?? 0) << 8) |
    (byteArray[4] ?? 0) |
    0;
  return { v, e };
}

function sha256(data: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const len = data.length;
  const bitLen = len * 8;
  const padLen = (len + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen >>> 0, false);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Int32Array(64);

  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getInt32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 =
        ((W[t - 15]! >>> 7) | (W[t - 15]! << 25)) ^
        ((W[t - 15]! >>> 18) | (W[t - 15]! << 14)) ^
        (W[t - 15]! >>> 3);
      const s1 =
        ((W[t - 2]! >>> 17) | (W[t - 2]! << 15)) ^
        ((W[t - 2]! >>> 19) | (W[t - 2]! << 13)) ^
        (W[t - 2]! >>> 10);
      W[t] = (W[t - 16]! + s0 + W[t - 7]! + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t]! + W[t]!) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  rv.setInt32(0, h0, false);
  rv.setInt32(4, h1, false);
  rv.setInt32(8, h2, false);
  rv.setInt32(12, h3, false);
  rv.setInt32(16, h4, false);
  rv.setInt32(20, h5, false);
  rv.setInt32(24, h6, false);
  rv.setInt32(28, h7, false);
  return result;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > 64) {
    k = sha256(k);
  }
  const keyPad = new Uint8Array(64);
  keyPad.set(k);

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = keyPad[i]! ^ 0x5c;
    iKeyPad[i] = keyPad[i]! ^ 0x36;
  }

  const inner = new Uint8Array(64 + message.length);
  inner.set(iKeyPad, 0);
  inner.set(message, 64);
  const innerHash = sha256(inner);

  const outer = new Uint8Array(64 + 32);
  outer.set(oKeyPad, 0);
  outer.set(innerHash, 64);
  return sha256(outer);
}

export function decrypt(payload: string, key: string): string {
  const bytes = base64ToUint8Array(payload);
  const baseData = bytes.slice(5, 13);
  const cipherText = bytes.slice(13);
  const totalLength = cipherText.length;

  const chapterKey = base64ToUint8Array(key);
  const keystream = new Uint8Array(totalLength);
  let o = 0;
  let i = 0;

  while (o < totalLength) {
    const block = new Uint8Array(baseData.length + 1);
    block.set(baseData, 0);
    block[baseData.length] = i & 0xff;

    const hashBlock = hmacSha256(chapterKey, block);
    const copyLength = Math.min(hashBlock.length, totalLength - o);
    keystream.set(hashBlock.subarray(0, copyLength), o);

    o += copyLength;
    i++;
  }

  const decryptedBytes = new Uint8Array(totalLength);
  for (let idx = 0; idx < totalLength; idx++) {
    decryptedBytes[idx] = (cipherText[idx]! ^ keystream[idx]!) & 0xff;
  }

  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(decryptedBytes);
  }

  // Fallback for UTF-8 decoding
  let str = "";
  for (let idx = 0; idx < decryptedBytes.length; idx++) {
    str += String.fromCharCode(decryptedBytes[idx]!);
  }
  return decodeURIComponent(escape(str));
}
