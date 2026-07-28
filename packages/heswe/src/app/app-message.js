export function getMessageText(message) {
  return message.items
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

export function getPublicMessageText(message) {
  const text = getMessageText(message);
  return message.role === "user"
    ? text.replace(/^<@[^>]+>:\s*/, "")
    : text;
}
