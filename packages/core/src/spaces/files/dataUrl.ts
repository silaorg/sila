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

export function bytesToDataUrl(
  bytes: Uint8Array,
  mimeType: string = "application/octet-stream",
): string {
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(bytes).toString("base64")
      : btoa(String.fromCharCode(...bytes));

  return `data:${mimeType};base64,${base64}`;
}
