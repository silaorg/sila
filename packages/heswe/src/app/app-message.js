export function getMessageText(message) {
  return message.items
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

export function getPublicMessageText(message) {
  if (message.role === "user" && typeof message.meta?.app?.text === "string") {
    return message.meta.app.text;
  }
  const text = getMessageText(message);
  return message.role === "user"
    ? text.replace(/^<@[^>]+>:\s*/, "")
    : text;
}
