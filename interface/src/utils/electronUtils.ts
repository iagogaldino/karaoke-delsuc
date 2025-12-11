/**
 * Detect if running in Electron environment
 */
export function isElectron(): boolean {
  // Check for Electron-specific properties
  return (
    typeof window !== 'undefined' &&
    (window.navigator.userAgent.includes('Electron') ||
      // @ts-ignore - Electron specific
      window.process?.type === 'renderer' ||
      // @ts-ignore - Electron specific
      (window as any).electron !== undefined)
  );
}

/**
 * Get the base URL for API requests
 * In Electron production, we need to use localhost:3001 directly
 * In development or browser, we can use relative URLs (handled by Vite proxy)
 */
export function getApiBaseUrl(): string {
  if (isElectron() && window.location.protocol === 'file:') {
    // In Electron production (file:// protocol), use localhost
    return 'http://localhost:3001';
  }
  // In development or browser, use relative URLs (Vite proxy handles it)
  return '';
}

/**
 * Get WebSocket URL
 */
export function getWebSocketUrl(path: string): string {
  if (isElectron() && window.location.protocol === 'file:') {
    // In Electron production, use localhost
    return `ws://localhost:3001${path}`;
  }
  // In development or browser, use current host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

