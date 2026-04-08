/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Track channel names passed to supabase.channel()
const channelNames: string[] = [];

const mockSubscribe = vi.fn((cb?: (status: string) => void) => {
  cb?.('SUBSCRIBED');
  return { unsubscribe: vi.fn() };
});

const mockChannelObj = {
  on: vi.fn().mockReturnThis(),
  subscribe: mockSubscribe,
};

const mockChannel = vi.fn((name: string) => {
  channelNames.push(name);
  return mockChannelObj;
});

const mockRemoveChannel = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...(args as [string])),
    removeChannel: mockRemoveChannel,
  },
}));

const { useImpactRealtime } = await import('../useImpactRealtime');

/**
 * Minimal wrapper to invoke a React hook outside of a full test renderer.
 * Renders synchronously via react-dom/client and flushes effects.
 */
async function mountHook() {
  const { createRoot } = await import('react-dom/client');

  const container = document.createElement('div');
  let root: ReturnType<typeof createRoot>;

  function Wrapper() {
    useImpactRealtime();
    return null;
  }

  // createRoot + render triggers useEffect synchronously in test env
  await React.act(() => {
    root = createRoot(container);
    root.render(React.createElement(Wrapper));
  });

  return () => {
    React.act(() => {
      root!.unmount();
    });
  };
}

describe('useImpactRealtime', () => {
  beforeEach(() => {
    channelNames.length = 0;
    mockChannel.mockClear();
    mockRemoveChannel.mockClear();
  });

  it('uses unique channel names when mounted by multiple consumers', async () => {
    const unmount1 = await mountHook();
    const unmount2 = await mountHook();

    expect(channelNames).toHaveLength(2);
    expect(channelNames[0]).not.toBe(channelNames[1]);

    // Both should still start with a recognisable prefix
    expect(channelNames[0]).toMatch(/^impact-dashboard/);
    expect(channelNames[1]).toMatch(/^impact-dashboard/);

    unmount1();
    unmount2();
  });
});
