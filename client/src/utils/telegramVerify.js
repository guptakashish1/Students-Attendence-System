/**
 * telegramVerify.js — Telegram Mini App initData Signature Verification
 *
 * Uses the Web Crypto API (HMAC-SHA-256) to verify that initData really
 * came from Telegram and hasn't been tampered with.
 *
 * Algorithm (per Telegram docs):
 *   1. Parse initData into key=value pairs.
 *   2. Remove `hash` from the params.
 *   3. Sort remaining pairs alphabetically, join with "\n" → dataCheckString.
 *   4. secret_key = HMAC_SHA256("WebAppData", botToken)
 *   5. computed_hash = HMAC_SHA256(dataCheckString, secret_key) → hex
 *   6. Ensure computed_hash === hash received in initData.
 *
 * ⚠️  For production: perform this check SERVER-SIDE so the bot token is
 *      never exposed in the browser bundle.
 */

/**
 * Verify Telegram Mini App initData against the bot token.
 *
 * @param {string} initDataString - raw initData string from window.Telegram.WebApp.initData
 * @param {string} botToken       - Telegram bot token from @BotFather
 * @returns {Promise<boolean>}    - true if valid, false otherwise
 */
export async function verifyTelegramInitData(initDataString, botToken) {
  if (!initDataString || !botToken || botToken === "YOUR_TELEGRAM_BOT_TOKEN") {
    // Skip verification in dev / when token is not configured
    return true;
  }

  try {
    const params  = new URLSearchParams(initDataString);
    const hash    = params.get("hash");

    if (!hash) {
      console.warn("[TelegramVerify] No hash found in initData.");
      return false;
    }

    // Build data-check string (all params except hash, sorted, joined by \n)
    params.delete("hash");
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const encoder = new TextEncoder();

    // Step 1: secret_key = HMAC_SHA256("WebAppData", botToken)
    const secretKeyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const secretKeyBuffer = await crypto.subtle.sign(
      "HMAC",
      secretKeyMaterial,
      encoder.encode(botToken)
    );

    // Step 2: computed_hash = HMAC_SHA256(dataCheckString, secret_key)
    const verifyKey = await crypto.subtle.importKey(
      "raw",
      secretKeyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      verifyKey,
      encoder.encode(dataCheckString)
    );

    const computedHash = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const valid = computedHash === hash;
    if (!valid) {
      console.warn("[TelegramVerify] ❌ Hash mismatch — possible spoofed request.");
    }
    return valid;
  } catch (err) {
    console.error("[TelegramVerify] Verification error:", err);
    return false;
  }
}

/**
 * Parse Telegram initData string into a plain object.
 * @param {string} initDataString
 * @returns {Object}
 */
export function parseTelegramInitData(initDataString) {
  if (!initDataString) return {};
  const result = {};
  new URLSearchParams(initDataString).forEach((val, key) => {
    try {
      result[key] = JSON.parse(val); // parse nested JSON (e.g. user object)
    } catch {
      result[key] = val;
    }
  });
  return result;
}
