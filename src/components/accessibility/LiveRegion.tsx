import { useEffect, useState } from 'react';

interface LiveRegionProps {
  message: string;
  /** 'polite' for non-urgent, 'assertive' for urgent */
  politeness?: 'polite' | 'assertive';
  /** Clear the message after this many ms (default: 5000) */
  clearAfter?: number;
}

/**
 * Announces dynamic content changes to screen readers.
 * Usage:
 *   <LiveRegion message={statusMessage} />
 */
export function LiveRegion({ 
  message, 
  politeness = 'polite',
  clearAfter = 5000 
}: LiveRegionProps) {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (message) {
      setAnnouncement(message);
      const timer = setTimeout(() => setAnnouncement(''), clearAfter);
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

/**
 * Global live region for app-wide announcements.
 * Can be used via a store or context.
 */
export function GlobalLiveRegion() {
  return (
    <>
      <div
        id="aria-live-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        id="aria-live-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}

/**
 * Utility function to announce to screen readers programmatically.
 * Call this from anywhere to announce dynamic content.
 */
export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  const region = document.getElementById(
    politeness === 'assertive' ? 'aria-live-assertive' : 'aria-live-polite'
  );
  if (region) {
    // Clear first to ensure announcement even if same message
    region.textContent = '';
    requestAnimationFrame(() => {
      region.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        region.textContent = '';
      }, 3000);
    });
  }
}
