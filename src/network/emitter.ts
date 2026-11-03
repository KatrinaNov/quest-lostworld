/** Минимальный типизированный эмиттер событий. */
export class Emitter<Events extends object> {
  private listeners = new Map<keyof Events, Set<(data: never) => void>>();

  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (data: never) => void);
    return () => {
      set?.delete(listener as (data: never) => void);
    };
  }

  protected emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as (d: Events[K]) => void)(data);
      } catch (err) {
        console.error(`[emitter] ошибка в обработчике "${String(event)}"`, err);
      }
    }
  }

  protected clearListeners(): void {
    this.listeners.clear();
  }
}
