export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:([^;]*);base64,(.*)$/);
  if (!match) {
    throw new Error("Unsupported data URL format");
  }

  const b64 = match[2];
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    return new Uint8Array(buf);
  }

  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

/**
 * Converts bytes to base64 string, handling large arrays safely.
 * Avoids stack overflow by using Array.from instead of spread operator.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  // Avoid stack overflow for large arrays by using Array.from instead of spread operator
  const binaryString = Array.from(
    bytes,
    (byte: number) => String.fromCharCode(byte),
  ).join("");
  return btoa(binaryString);
}

export function bytesToDataUrl(
  bytes: Uint8Array,
  mimeType: string = "application/octet-stream",
): string {
  const base64 = bytesToBase64(bytes);
  return `data:${mimeType};base64,${base64}`;
}
