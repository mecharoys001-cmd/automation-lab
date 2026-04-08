'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const MIN_ROW_HEIGHT = 60;

/**
 * Hook for drag-to-resize week row heights in calendar grids.
 * Returns per-row heights and a mousedown handler to attach to resize dividers.
 */
export function useResizableRows(numRows: number, defaultHeight: number) {
  const [rowHeights, setRowHeights] = useState<number[]>(() =>
    Array(numRows).fill(defaultHeight),
  );

  // Ref mirrors state so startDrag always reads fresh values without re-creating the callback
  const heightsRef = useRef(rowHeights);
  heightsRef.current = rowHeights;

  const dragRef = useRef<{
    row: number;
    startY: number;
    startH: number;
  } | null>(null);

  const startDrag = useCallback(
    (rowIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      dragRef.current = {
        row: rowIndex,
        startY: e.clientY,
        startH: heightsRef.current[rowIndex],
      };
    },
    [],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const newH = Math.max(MIN_ROW_HEIGHT, d.startH + (e.clientY - d.startY));
      setRowHeights((prev) => {
        const next = [...prev];
        next[d.row] = newH;
        return next;
      });
    };

    const onUp = () => {
      if (dragRef.current) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        dragRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return { rowHeights, startDrag };
}
