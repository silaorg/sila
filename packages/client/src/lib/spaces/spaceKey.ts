const SPACE_KEY_SEPARATOR = "\u0000";

export function makeSpaceKey(uri: string, id: string): string {
  return `${uri}${SPACE_KEY_SEPARATOR}${id}`;
}

export function parseSpaceKey(spaceKey: string): { uri: string; id: string } {
  const idx = spaceKey.lastIndexOf(SPACE_KEY_SEPARATOR);
  if (idx === -1) {
    return { uri: spaceKey, id: "" };
  }
  return {
    uri: spaceKey.slice(0, idx),
    id: spaceKey.slice(idx + SPACE_KEY_SEPARATOR.length),
  };
}

