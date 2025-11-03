// A minimal LIFO event stack. Components register handlers for named events
// (e.g., "close"). The most recently registered handler runs first and can
// consume the event by returning true.
export type StackHandler = { id: string; fn: () => boolean };
export class EventStacks {
  private stacks = new Map<string, StackHandler[]>();

  on(event: string, fn: () => boolean): () => void {
    const list = this.stacks.get(event) ?? [];
    const entry = { id: crypto.randomUUID(), fn };
    list.push(entry);
    this.stacks.set(event, list);
    return () => {
      const arr = this.stacks.get(event);
      if (!arr) return;
      const i = arr.findIndex(h => h.id === entry.id);
      if (i !== -1) arr.splice(i, 1);
      if (arr.length === 0) this.stacks.delete(event);
    };
  }

  emit(event: string): boolean {
    const list = this.stacks.get(event);
    if (!list || list.length === 0) return false;
    for (let i = list.length - 1; i >= 0; i--) {
      try {
        if (list[i].fn()) return true;
      } catch {
        // ignore handler errors
      }
    }
    return false;
  }
}