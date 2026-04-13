/** @vitest-environment jsdom */

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvailabilityEditor } from '../AvailabilityEditor';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderEditor() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const onChange = vi.fn();

  act(() => {
    root!.render(<AvailabilityEditor value={null} onChange={onChange} />);
  });

  return { onChange, container };
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('AvailabilityEditor layout regression', () => {
  it('renders grid cell tooltip wrappers with display: contents so cells remain visible and fill the grid', () => {
    const { container } = renderEditor();

    const gridCell = container.querySelector('[role="gridcell"]');
    expect(gridCell).toBeTruthy();

    const wrapper = gridCell?.parentElement as HTMLElement | null;
    expect(wrapper).toBeTruthy();
    expect(wrapper?.style.display).toBe('contents');
  });

  it('still allows clicking a 30-minute cell to create availability', () => {
    const { container, onChange } = renderEditor();

    const gridCell = container.querySelector('[role="gridcell"]') as HTMLElement | null;
    expect(gridCell).toBeTruthy();

    act(() => {
      gridCell!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      gridCell!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        monday: [{ start: '08:00', end: '08:30' }],
      }),
    );
  });
});
