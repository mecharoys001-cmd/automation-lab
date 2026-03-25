/**
 * Request deduplication and caching layer
 * Prevents duplicate concurrent API calls and caches results briefly
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, Promise<unknown>>();
  private defaultTTL = 5000; // 5 seconds default cache

  /**
   * Fetch with deduplication and caching
   * If the same URL is requested multiple times concurrently, only one request is made
   * Results are cached for TTL milliseconds
   */
  async fetch<T>(url: string, options?: RequestInit, ttl = this.defaultTTL): Promise<T> {
    const cacheKey = `${url}:${JSON.stringify(options || {})}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    // Check if there's already a pending request for this
    const pending = this.pendingRequests.get(cacheKey) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    // Make the request
    const promise = fetch(url, options)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json() as T;
        
        // Cache the result
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        this.pendingRequests.delete(cacheKey);
        
        return data;
      })
      .catch((err) => {
        this.pendingRequests.delete(cacheKey);
        throw err;
      });

    this.pendingRequests.set(cacheKey, promise);
    return promise;
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
    for (const key of this.pendingRequests.keys()) {
      if (regex.test(key)) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.defaultTTL * 2) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const requestCache = new RequestCache();

// Auto-cleanup every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(() => requestCache.cleanup(), 30000);
}

/**
 * Hook for React components to use cached fetch
 */
export function useCachedFetch() {
  return {
    fetch: requestCache.fetch.bind(requestCache),
    invalidate: requestCache.invalidate.bind(requestCache),
    clear: requestCache.clear.bind(requestCache),
  };
}
