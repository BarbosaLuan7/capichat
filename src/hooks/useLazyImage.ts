import { useState, useEffect, useRef, RefObject } from 'react';

interface UseLazyImageResult {
  imgRef: RefObject<HTMLImageElement>;
  shouldLoad: boolean;
  isLoaded: boolean;
  onLoad: () => void;
  src: string | undefined;
}

/**
 * Hook for lazy loading images using Intersection Observer.
 * Images only load when they enter the viewport (with 100px margin).
 * 
 * @param src - The image source URL
 * @returns Object with ref, loading state, and handlers
 * 
 * @example
 * const { imgRef, src, isLoaded, onLoad } = useLazyImage(imageUrl);
 * return (
 *   <img 
 *     ref={imgRef} 
 *     src={src} 
 *     onLoad={onLoad}
 *     className={isLoaded ? 'opacity-100' : 'opacity-0'}
 *   />
 * );
 */
export function useLazyImage(src: string | undefined): UseLazyImageResult {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Preload 100px before entering viewport
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  // Reset loaded state when src changes
  useEffect(() => {
    setIsLoaded(false);
  }, [src]);

  return {
    imgRef,
    shouldLoad: isInView,
    isLoaded,
    onLoad: () => setIsLoaded(true),
    src: isInView ? src : undefined,
  };
}
