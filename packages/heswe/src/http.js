export const DEFAULT_REMOTE_TIMEOUT_MS = 30_000;
export const DEFAULT_TEXT_RESPONSE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_BINARY_RESPONSE_BYTES = 25 * 1024 * 1024;

export async function fetchRemote(input, init = {}, options = {}) {
  const timeoutMs = positiveNumber(options.timeoutMs, DEFAULT_REMOTE_TIMEOUT_MS);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new Error(`Remote request timed out after ${timeoutMs}ms.`, { cause: error });
    }
    throw error;
  }
}

export async function readResponseBytes(response, options = {}) {
  const maxBytes = positiveNumber(options.maxBytes, DEFAULT_BINARY_RESPONSE_BYTES);
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    throw responseTooLargeError(maxBytes);
  }

  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        throw responseTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readResponseText(response, options = {}) {
  const bytes = await readResponseBytes(response, {
    maxBytes: options.maxBytes ?? DEFAULT_TEXT_RESPONSE_BYTES,
  });
  return new TextDecoder().decode(bytes);
}

function responseTooLargeError(maxBytes) {
  return new Error(`Remote response exceeds the ${maxBytes}-byte limit.`);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
