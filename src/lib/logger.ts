/**
 * Conditional logger utility
 * Only logs in development mode, except for errors which are always logged
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },

  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },

  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },

  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },

  // Always log errors, even in production
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  // Group logs (dev only)
  group: (label: string) => {
    if (isDev) console.group(label);
  },

  groupEnd: () => {
    if (isDev) console.groupEnd();
  },

  // Table logs (dev only)
  table: (data: unknown) => {
    if (isDev) console.table(data);
  },
};
