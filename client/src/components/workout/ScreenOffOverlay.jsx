import { useEffect } from 'react';

export default function ScreenOffOverlay({ onWake }) {
  useEffect(() => {
    let wakeLock = null;

    async function requestWakeLock() {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        onWake?.();
      } catch (err) {
        // Wake Lock not supported or denied – that's okay
      }
    }
    requestWakeLock();

    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  return null;
}