/* SPDX-License-Identifier: GPL-3.0-or-later */

export function base64UrlBytes(value: string): Uint8Array {
  const raw = String(value || "");
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let validLen = padded.length;
  if (padded.endsWith("==")) validLen -= 2;
  else if (padded.endsWith("=")) validLen -= 1;

  const byteLen = Math.floor((validLen * 3) / 4);
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < padded.length; i += 4) {
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

export function decryptORX3(envelope: Uint8Array, key: string): ArrayBuffer {
  if (
    envelope.length < 20 ||
    envelope[0] !== 0x4f || // O
    envelope[1] !== 0x52 || // R
    envelope[2] !== 0x58 || // X
    envelope[3] !== 0x33 // 3
  ) {
    return envelope.buffer.slice(
      envelope.byteOffset,
      envelope.byteOffset + envelope.byteLength,
    ) as ArrayBuffer;
  }

  const view = new DataView(envelope.buffer, envelope.byteOffset, envelope.byteLength);
  const transformBytes = view.getUint32(4, false);
  const bytes = envelope.slice(8);
  const count = Math.min(bytes.length, Math.max(0, Number(transformBytes || 0)));
  const keyBytes = base64UrlBytes(key);

  if (count && keyBytes.length) {
    for (let i = 0; i < count; i++) {
      bytes[i] = ((bytes[i] ?? 0) ^ (keyBytes[i % keyBytes.length] ?? 0)) & 0xff;
    }
  }

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
