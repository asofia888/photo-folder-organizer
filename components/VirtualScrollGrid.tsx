import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

interface VirtualScrollGridProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number; // Number of extra items to render outside visible area
  renderItem: (item: T, index: number, isVisible: boolean) => React.ReactNode;
  className?: string;
}

export function VirtualScrollGrid<T>({ 
  items, 
  itemHeight, 
  containerHeight, 
  overscan = 3,
  renderItem, 
  className = '' 
}: VirtualScrollGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const { visibleItems, startIndex, totalHeight, offsetY } = useMemo(() => {
    if (items.length === 0) {
      return { 
        visibleItems: [], 
        startIndex: 0, 
        totalHeight: 0, 
        offsetY: 0 
      };
    }

    const itemsPerView = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + itemsPerView + 2 * overscan
    );

    const visibleItems = items.slice(startIndex, endIndex + 1);
    const totalHeight = items.length * itemHeight;
    const offsetY = startIndex * itemHeight;

    return {
      visibleItems: visibleItems.map((item, index) => ({
        item,
        originalIndex: startIndex + index,
        isVisible: index >= overscan && index < visibleItems.length - overscan
      })),
      startIndex,
      totalHeight,
      offsetY
    };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  // Auto-scroll to top when items change significantly
  useEffect(() => {
    if (scrollElementRef.current && items.length > 0 && startIndex > items.length) {
      scrollElementRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length, startIndex]);

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ 
          transform: `translateY(${offsetY}px)`,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0
        }}>
          {visibleItems.map(({ item, originalIndex, isVisible }) => (
            <div key={originalIndex} style={{ height: itemHeight }}>
              {renderItem(item, originalIndex, isVisible)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook for managing virtual scroll state
export const useVirtualScroll = (
  totalItems: number,
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    if (totalItems === 0) {
      return { start: 0, end: 0, offsetY: 0 };
    }

    const itemsPerView = Math.ceil(containerHeight / itemHeight);
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      totalItems - 1,
      start + itemsPerView + 2 * overscan
    );

    return {
      start,
      end,
      offsetY: start * itemHeight
    };
  }, [totalItems, itemHeight, containerHeight, scrollTop, overscan]);

  const handleScroll = useCallback((scrollTop: number) => {
    setScrollTop(scrollTop);
  }, []);

  const scrollToIndex = useCallback((index: number, scrollElement: HTMLElement) => {
    const targetScrollTop = index * itemHeight;
    scrollElement.scrollTop = targetScrollTop;
    setScrollTop(targetScrollTop);
  }, [itemHeight]);

  return {
    visibleRange,
    handleScroll,
    scrollToIndex,
    totalHeight: totalItems * itemHeight
  };
};