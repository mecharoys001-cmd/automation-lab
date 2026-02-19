'use client';
import { useState, useCallback } from 'react';

export function useGas(url: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = Boolean(url && url.startsWith('https://'));

  const get = useCallback(async (params: Record<string, string> = {}) => {
    if (!connected) return null;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${url}${qs ? '?' + qs : ''}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'GAS error');
      return json.data;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    } finally { setLoading(false); }
  }, [url, connected]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    if (!connected) return null;
    setLoading(true); setError(null);
    try {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'GAS error');
      return json.data;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    } finally { setLoading(false); }
  }, [url, connected]);

  return { loading, error, connected, get, post };
}
