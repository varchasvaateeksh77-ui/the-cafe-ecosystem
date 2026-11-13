import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { GH_CLOUD_REPO, getCloudSyncToken } from './lib/ecosystemStore';

const viteEnv = (import.meta as unknown as { env?: Record<string, string> })?.env || {};

// Preserve the APK's baked-in role across OTA bundle hot-swaps
const bakedRole = viteEnv.VITE_DEFAULT_APK;
const bakedOtaVersion = Number(viteEnv.VITE_OTA_VERSION || '242');

if (typeof window !== 'undefined' && bakedRole) {
  (window as unknown as { __BUILD_BROS_APK_ROLE__?: string }).__BUILD_BROS_APK_ROLE__ = bakedRole;
  try {
    localStorage.setItem('bb_apk_role', bakedRole);
  } catch {
    // Ignore storage errors
  }
}

async function fetchPublicOtaText(
  path: string,
  cacheBust: string | number,
  headers: Record<string, string>
): Promise<string | null> {
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${GH_CLOUD_REPO}/contents/${path}?t=${cacheBust}`,
      { headers, cache: 'no-store' }
    );
    if (apiRes.ok) return await apiRes.text();
  } catch {
    // Fallback to raw CDN below
  }
  try {
    const rawRes = await fetch(
      `https://raw.githubusercontent.com/${GH_CLOUD_REPO}/main/${path}?t=${cacheBust}`,
      { cache: 'no-store' }
    );
    if (rawRes.ok) return await rawRes.text();
  } catch {
    // Ignore offline error
  }
  return null;
}

function executeOtaBundle(version: number, cssText: string, jsText: string): void {
  (window as unknown as { __BB_OTA_BOOTED__?: boolean }).__BB_OTA_BOOTED__ = true;
  (window as unknown as { __BB_ACTIVE_OTA_VER__?: number }).__BB_ACTIVE_OTA_VER__ = version;

  // Replace baked stylesheets so updated utility classes never collide
  document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());

  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-ota-version', String(version));
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);

  const blob = new Blob([jsText], { type: 'text/javascript' });
  const scriptUrl = URL.createObjectURL(blob);
  const scriptEl = document.createElement('script');
  scriptEl.type = 'module';
  scriptEl.src = scriptUrl;
  document.body.appendChild(scriptEl);
}

// Over-The-Air (OTA) Live Bundle Loader for Installed Android APKs
// Ensures installed phone APKs automatically pull the newest UI/code bundle
// from the public cloud repo without requiring the user to re-download an .apk on every push.
async function checkNativeOtaBundle(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as unknown as { __BB_OTA_BOOTED__?: boolean }).__BB_OTA_BOOTED__) {
    return false;
  }

  const isCapacitor = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
  if (!isCapacitor) return false;

  (window as unknown as { __BB_ACTIVE_OTA_VER__?: number }).__BB_ACTIVE_OTA_VER__ = bakedOtaVersion;

  try {
    const token = getCloudSyncToken();
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw+json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const manifestRaw = await fetchPublicOtaText('ota/manifest.json', Date.now(), headers);
    let remoteVer = 0;
    if (manifestRaw) {
      const manifest = JSON.parse(manifestRaw) as { otaVersion?: number };
      remoteVer = manifest?.otaVersion || 0;
    }

    const cachedVer = Number(localStorage.getItem('bb_ota_cached_ver') || '0');
    const cachedCss = localStorage.getItem('bb_ota_cached_css') || '';
    const cachedJs = localStorage.getItem('bb_ota_cached_js') || '';

    // Case 1: Cloud has a newer OTA version than both baked APK and local OTA cache
    if (remoteVer > bakedOtaVersion && remoteVer !== cachedVer) {
      const [cssText, jsText] = await Promise.all([
        fetchPublicOtaText('ota/bundle.css', remoteVer, headers),
        fetchPublicOtaText('ota/bundle.js', remoteVer, headers),
      ]);
      if (cssText && jsText) {
        try {
          localStorage.setItem('bb_ota_cached_ver', String(remoteVer));
          localStorage.setItem('bb_ota_cached_css', cssText);
          localStorage.setItem('bb_ota_cached_js', jsText);
        } catch {
          // Ignore storage quota limits if large bundle
        }
        executeOtaBundle(remoteVer, cssText, jsText);
        return true;
      }
    }

    // Case 2: Previously downloaded OTA bundle in local cache is newer than baked APK
    const targetVer = Math.max(remoteVer, cachedVer);
    if (cachedVer > bakedOtaVersion && cachedVer >= targetVer && cachedCss && cachedJs) {
      executeOtaBundle(cachedVer, cachedCss, cachedJs);
      return true;
    }
  } catch {
    // Offline or network glitch: try cached OTA bundle if newer than baked APK
    try {
      const cachedVer = Number(localStorage.getItem('bb_ota_cached_ver') || '0');
      const cachedCss = localStorage.getItem('bb_ota_cached_css') || '';
      const cachedJs = localStorage.getItem('bb_ota_cached_js') || '';
      if (cachedVer > bakedOtaVersion && cachedCss && cachedJs) {
        executeOtaBundle(cachedVer, cachedCss, cachedJs);
        return true;
      }
    } catch {
      // Fall back seamlessly to local APK bundle
    }
  }
  return false;
}

checkNativeOtaBundle().then((bootedRemoteOta) => {
  if (!bootedRemoteOta) {
    createRoot(document.getElementById('root')!).render(<App />);
  }
});
