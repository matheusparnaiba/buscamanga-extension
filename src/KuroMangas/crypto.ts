/* SPDX-License-Identifier: GPL-3.0-or-later */
import CryptoJS from "crypto-js";

const VITE_API_ENCRYPTION_KEY = "8at7vo8l6sai74jyIHfE2oeshoforanuYTusF4jKdqEwhUEft9dsadcxzsaipnjm8";

export function getKuroKey(): string {
  const r = new Date().toISOString().split("T")[0];
  const n = "kuromangas.com::v2";
  const i = "x9_4v2_b";
  const k = CryptoJS.MD5(r + n + i)
    .toString()
    .substring(0, 8);
  return VITE_API_ENCRYPTION_KEY + k;
}

export function decryptKuroPayload(payload: any, datakey?: string | null): any {
  if (!payload || typeof payload !== "object" || !("_v_secure" in payload)) {
    return payload;
  }

  try {
    const key = getKuroKey();
    const decrypted = CryptoJS.Rabbit.decrypt(payload._v_secure, key);
    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
    const parsed = JSON.parse(decryptedStr);
    let result = parsed;
    if (datakey && parsed[datakey]) {
      result = parsed[datakey];
    }
    delete result._v_secure;
    return result;
  } catch (e) {
    console.error("Falha ao descriptografar payload do Kuro Mangás:", e);
    return payload;
  }
}
