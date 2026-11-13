import dotenv from "dotenv";
dotenv.config();

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

const getEncryptionKey = (): Buffer => {
  const key = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      "BANK_ACCOUNT_ENCRYPTION_KEY must be a 64-character hexadecimal key.",
    );
  }

  return Buffer.from(key, "hex");
};

export const encryptAccountNumber = (accountNumber: string): string => {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(accountNumber, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

export const decryptAccountNumber = (encryptedValue: string): string => {
  const [ivHex, authTagHex, encryptedHex] = encryptedValue.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted bank account data.");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};
