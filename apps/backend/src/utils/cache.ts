/**
 * Simple in-memory cache with optional TTL (milliseconds).
 * Replace with Redis for production multi-instance deployments.
 */
export class Cache<T> {
  private store = new Map<string, { value: T; expiresAt: number | null }>();

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  size(): number {
    return this.store.size;
  }
}

/** Set for tracking items with no associated value (e.g. processed signatures). */
export class TimedSet {
  private store = new Map<string, number>(); // value -> expiresAt

  add(value: string, ttlMs?: number): void {
    this.store.set(value, ttlMs ? Date.now() + ttlMs : Infinity);
  }

  has(value: string): boolean {
    const exp = this.store.get(value);
    if (exp === undefined) return false;
    if (Date.now() > exp) {
      this.store.delete(value);
      return false;
    }
    return true;
  }

  size(): number {
    return this.store.size;
  }
}
