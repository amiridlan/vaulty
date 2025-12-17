export async function waitForTauri(timeout = 5000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (window.__TAURI__) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return false;
}

export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI__;
}

export function isDesktopApp(): boolean {
  return isTauriAvailable();
}

export function isWebApp(): boolean {
  return !isTauriAvailable();
}