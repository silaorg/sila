import type { VertexOperation } from "@sila/core";
import {
  newMoveVertexOp,
  newSetVertexPropertyOp
} from "@sila/core";

export type ParsedOp = {
  type: 'm' | 'p';
  counter: number;
  peerId: string;
  targetId: string;
  parentId?: string;
  key?: string;
  value?: any;
};

type PendingRequest = {
  resolve: (ops: VertexOperation[]) => void;
  reject: (error: Error) => void;
};

/**
 * Handles parsing of JSONL operation lines using a Web Worker.
 * Manages request-response correlation to avoid race conditions.
 */
export class OpsParser {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = 10000) {
    this.timeoutMs = timeoutMs;
    
    // Only create worker if Worker is available (browser environment)
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./opsParser.worker.ts', import.meta.url));
      this.setupWorkerMessageHandler();
    }
  }

  private setupWorkerMessageHandler(): void {
    if (!this.worker) return;
    
    this.worker.addEventListener('message', (e: MessageEvent) => {
      const { requestId, operations, error } = e.data;
      const pending = this.pendingRequests.get(requestId);
      
      if (!pending) {
        console.warn('Received response for unknown request:', requestId);
        return;
      }
      
      this.pendingRequests.delete(requestId);
      
      if (error) {
        pending.reject(new Error(error));
      } else {
        const vertexOps = operations.map((op: ParsedOp) => {
          if (op.type === 'm') {
            return newMoveVertexOp(op.counter, op.peerId, op.targetId, op.parentId ?? null);
          } else {
            // Decode encoded property values
            const decoded = this.decodePropertyValue(op.value);
            return newSetVertexPropertyOp(op.counter, op.peerId, op.targetId, op.key!, decoded);
          }
        });
        pending.resolve(vertexOps);
      }
    });
  }

  /**
   * Parse JSONL lines into VertexOperation objects.
   * @param lines - Array of JSONL strings to parse
   * @param peerId - The peer ID to associate with the operations
   * @returns Promise that resolves to an array of VertexOperation objects
   */
  async parseLines(lines: string[], peerId: string): Promise<VertexOperation[]> {
    // If no worker (Node.js environment), parse synchronously
    if (!this.worker) {
      return this.parseLinesSync(lines, peerId);
    }

    const requestId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Operation parsing timed out'));
      }, this.timeoutMs);

      this.pendingRequests.set(requestId, {
        resolve: (ops: VertexOperation[]) => {
          clearTimeout(timeout);
          resolve(ops);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.worker!.postMessage({ lines, peerId, requestId });
    });
  }

  private parseLinesSync(lines: string[], peerId: string): VertexOperation[] {
    const operations: VertexOperation[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const parsed = JSON.parse(line) as [string, number, string, any, any?];
        const [type, counter, targetId, value1, value2] = parsed;
        
        if (type === 'm') {
          operations.push(newMoveVertexOp(counter, peerId, targetId, value1));
        } else if (type === 'p') {
          // value1 is the property key, value2 is the property value
          const key = value1 as string;
          const rawValue = value2;
          const decoded = this.decodePropertyValue(rawValue);
          operations.push(newSetVertexPropertyOp(counter, peerId, targetId, key, decoded));
        }
      } catch (error) {
        console.warn('Failed to parse operation line:', line, error);
      }
    }
    
    return operations;
  }

  /**
   * Decode property value previously encoded in FileSystemPersistenceLayer.
   * Backward compatible with old encoding where undefined was represented as {}.
   */
  private decodePropertyValue(rawValue: any): any {
    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      // New encoding
      if (Array.isArray((rawValue as any).__silaProp)) {
        const [tag, payload] = (rawValue as any).__silaProp as [string, any?];
        if (tag === 'u') return undefined;
        if (tag === 'o') return payload;
      }
      // Old encoding: empty object meant undefined
      if (Object.keys(rawValue).length === 0) return undefined;
    }
    return rawValue;
  }

  /**
   * Terminate the worker and clean up resources.
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
    }
    
    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error('OpsParser destroyed'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Get the number of pending requests (useful for debugging).
   */
  get pendingRequestCount(): number {
    return this.pendingRequests.size;
  }
} 