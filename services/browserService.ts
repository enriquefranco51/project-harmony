
/**
 * Browser API Integration Manager
 * Handles File System, Geolocation, and Hardware permissions
 */

export interface GeoContext {
  lat: number;
  lng: number;
  locale: string;
  timezone: string;
}

class BrowserService {
  
  // --- Permissions ---
  async checkPermissions(): Promise<Record<string, string>> {
    const permissionsToCheck = ['microphone', 'camera', 'geolocation'] as const;
    const results: Record<string, string> = {};

    for (const name of permissionsToCheck) {
      try {
        const status = await navigator.permissions.query({ name: name as PermissionName });
        results[name] = status.state;
      } catch (e) {
        console.warn(`Permission check failed for ${name}`, e);
        results[name] = 'unknown';
      }
    }
    return results;
  }

  // --- Geolocation ---
  async getGeolocation(): Promise<GeoContext> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            locale: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          });
        },
        (err) => reject(err),
        { timeout: 5000 }
      );
    });
  }

  // --- File System Access API ---
  async saveToFile(data: any, filename: string): Promise<void> {
    const jsonStr = JSON.stringify(data, null, 2);

    // Try modern File System Access API
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Project Harmony JSON',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled
        console.warn("FS API failed, falling back to download", err);
      }
    }

    // Fallback: Classic Download
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Web Storage Wrapper ---
  saveLocal(key: string, data: any) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error("LocalStorage Save Error", e);
    }
  }

  loadLocal<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error("LocalStorage Load Error", e);
      return null;
    }
  }
}

export const browserService = new BrowserService();
