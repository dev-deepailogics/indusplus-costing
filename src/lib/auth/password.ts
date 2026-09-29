import bcrypt from "bcryptjs";
import crypto from "crypto";

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password with bcrypt (12 rounds).
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*_+-=";
const ALL_CHARS = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

/**
 * Generate a cryptographically random password that satisfies:
 *  - At least 1 uppercase
 *  - At least 1 lowercase
 *  - At least 1 digit
 *  - At least 1 symbol
 */
export function generatePassword(length = 16): string {
  if (length < 8) throw new Error("Password length must be at least 8");

  // Guarantee one from each category
  const mandatory = [
    UPPERCASE[crypto.randomInt(UPPERCASE.length)],
    LOWERCASE[crypto.randomInt(LOWERCASE.length)],
    DIGITS[crypto.randomInt(DIGITS.length)],
    SYMBOLS[crypto.randomInt(SYMBOLS.length)],
  ];

  // Fill the rest randomly from the full charset
  const remaining: string[] = [];
  for (let i = mandatory.length; i < length; i++) {
    remaining.push(ALL_CHARS[crypto.randomInt(ALL_CHARS.length)]);
  }

  // Shuffle (Fisher-Yates) to avoid mandatory chars always at the start
  const chars = [...mandatory, ...remaining];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
