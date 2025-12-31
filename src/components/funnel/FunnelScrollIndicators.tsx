import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useThrottledCallback } from '@/hooks/useThrottle';

interface FunnelScrollIndicatorsProps {
  containerRef: React.RefObject<HTMLDivElement>;
  totalColumns: number;
  columnWidth?: number;
}

export function FunnelScrollIndicators({ 
  containerRef, 
  totalColumns,
  columnWidth = 320 + 16 // w-80 + gap-4
}: FunnelScrollIndicatorsProps) {
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    hiddenLeft: 0,
    hiddenRight: 0,
  });

  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScroll = scrollWidth - clientWidth;
    
    // Calculate hidden columns
    const visibleColumns = Math.floor(clientWidth / columnWidth);
    const scrolledColumns = Math.floor(scrollLeft / columnWidth);
    const hiddenLeft = scrolledColumns;
    const hiddenRight = Math.max(0, totalColumns - visibleColumns - scrolledColumns);

    setScrollState({
      canScrollLeft: scrollLeft > 10,
      canScrollRight: scrollLeft < maxScroll - 10,
      hiddenLeft,
      hiddenRight,
    });
  }, [containerRef, totalColumns, columnWidth]);

  // Throttled version of updateScrollState (100ms)
  const throttledUpdateScrollState = useThrottledCallback(updateScrollState, 100);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial update (immediate)
    updateScrollState();
    
    // Throttled scroll handler for better performance
    container.addEventListener('scroll', throttledUpdateScrollState, { passive: true });
    window.addEventListener('resize', throttledUpdateScrollState);

    return () => {
      container.removeEventListener('scroll', throttledUpdateScrollState);
      window.removeEventListener('resize', throttledUpdateScrollState);
    };
  }, [containerRef, updateScrollState, throttledUpdateScrollState]);

  const scrollTo = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;

    const scrollAmount = columnWidth * 2; // Scroll 2 columns at a time
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const showIndicators = scrollState.canScrollLeft || scrollState.canScrollRight;

  if (!showIndicators) return null;

  return (
    <>
      {/* Left indicator */}
      {scrollState.canScrollLeft && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm"
            onClick={() => scrollTo('left')}
            aria-label={`Rolar para esquerda (${scrollState.hiddenLeft} etapas ocultas)`}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {scrollState.hiddenLeft > 0 && (
            <Badge 
              variant="secondary" 
              className="shadow-md bg-background/95 backdrop-blur-sm"
            >
              ← {scrollState.hiddenLeft} {scrollState.hiddenLeft === 1 ? 'etapa' : 'etapas'}
            </Badge>
          )}
        </div>
      )}

      {/* Right indicator */}
      {scrollState.canScrollRight && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2">
          {scrollState.hiddenRight > 0 && (
            <Badge 
              variant="secondary"
              className="shadow-md bg-background/95 backdrop-blur-sm"
            >
              {scrollState.hiddenRight} {scrollState.hiddenRight === 1 ? 'etapa' : 'etapas'} →
            </Badge>
          )}
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm"
            onClick={() => scrollTo('right')}
            aria-label={`Rolar para direita (${scrollState.hiddenRight} etapas ocultas)`}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}
    </>
  );
}
