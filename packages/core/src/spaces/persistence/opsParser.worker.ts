import { type ParsedOp } from './OpsParser';

self.onmessage = (e: MessageEvent) => {
  const { lines, peerId, requestId, opTypeHint } = e.data;
  
  try {
    const operations: ParsedOp[] = [];

    for (const line of lines) {
      if (line.trim()) {
        try {
          // Remove surrounding quotes and null characters if present
          const cleanLine = line.replace(/^"|"$/g, '').replace(/\u0000/g, '');

          if (opTypeHint === "m") {
            const [counter, targetId, parentId] = JSON.parse(cleanLine);
            operations.push({
              type: 'm',
              counter,
              peerId,
              targetId,
              parentId
            });
            continue;
          }

          if (opTypeHint === "p") {
            const [counter, targetId, key, value] = JSON.parse(cleanLine);
            operations.push({
              type: 'p',
              counter,
              peerId,
              targetId,
              key,
              value
            });
            continue;
          }

          const [opType, counter, targetId, ...rest] = JSON.parse(cleanLine);
          
          if (opType === "m" && rest.length === 1) {
            operations.push({
              type: 'm',
              counter,
              peerId,
              targetId,
              parentId: rest[0]
            });
          } else if (opType === "p" && rest.length === 2) {
            operations.push({
              type: 'p',
              counter,
              peerId,
              targetId,
              key: rest[0],
              value: rest[1]
            });
          }
        } catch (error) {
          console.error("Error parsing JSON line:", line, error);
          // Continue processing other lines even if one fails
        }
      }
    }

    self.postMessage({ requestId, operations });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    self.postMessage({ requestId, error: errorMessage });
  }
};
