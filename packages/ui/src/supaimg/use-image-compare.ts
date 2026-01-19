import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import { useCallback, useEffect, useRef } from "react";

type ImageCompareOptions = {
  initialSplit?: number;
  onDragStateChange?: (dragging: boolean) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useImageCompareDrag(options: ImageCompareOptions = {}) {
  const { initialSplit = 50, onDragStateChange } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const latestClientXRef = useRef<number | null>(null);
  const listeningRef = useRef(false);
  const removeListenersRef = useRef<() => void>(() => {});
  const onDragStateChangeRef = useRef(onDragStateChange);

  useEffect(() => {
    onDragStateChangeRef.current = onDragStateChange;
  }, [onDragStateChange]);

  const setSplit = useCallback((value: number) => {
    const node = containerRef.current;
    if (!node) return;
    const clamped = clamp(value, 0, 100);
    node.style.setProperty("--split", `${clamped}%`);
    node.setAttribute("aria-valuenow", `${Math.round(clamped)}`);
  }, []);

  const flushSplit = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const clientX = latestClientXRef.current;
    if (clientX === null || rect.width === 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSplit(next);
  }, [setSplit]);

  const scheduleSplit = useCallback(
    (clientX: number) => {
      latestClientXRef.current = clientX;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        flushSplit();
      });
    },
    [flushSplit],
  );

  const stopDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    removeListenersRef.current();
    onDragStateChangeRef.current?.(false);
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingRef.current) return;
      scheduleSplit(event.clientX);
    },
    [scheduleSplit],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!draggingRef.current) return;
      event.preventDefault();
      const touch = event.touches.item(0);
      if (!touch) return;
      scheduleSplit(touch.clientX);
    },
    [scheduleSplit],
  );

  const handleMouseUp = useCallback(() => {
    stopDrag();
  }, [stopDrag]);

  const handleTouchEnd = useCallback(() => {
    stopDrag();
  }, [stopDrag]);

  const addGlobalListeners = useCallback(() => {
    if (listeningRef.current) return;
    listeningRef.current = true;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const removeGlobalListeners = useCallback(() => {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  removeListenersRef.current = removeGlobalListeners;

  const startDrag = useCallback(
    (clientX: number) => {
      draggingRef.current = true;
      onDragStateChangeRef.current?.(true);
      addGlobalListeners();
      scheduleSplit(clientX);
    },
    [addGlobalListeners, scheduleSplit],
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      startDrag(event.clientX);
    },
    [startDrag],
  );

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.touches.item(0);
      if (!touch) return;
      startDrag(touch.clientX);
    },
    [startDrag],
  );

  useEffect(() => {
    setSplit(initialSplit);
  }, [initialSplit, setSplit]);

  useEffect(() => {
    return () => {
      stopDrag();
      removeGlobalListeners();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [removeGlobalListeners, stopDrag]);

  return {
    containerRef,
    handleMouseDown,
    handleTouchStart,
    resetSplit: setSplit,
  };
}
