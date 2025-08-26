"use client";
import { useEffect, useRef, useState } from "react";

export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<any>(null);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(!!(navigator as any).wakeLock);
  }, []);
  useEffect(() => {
    if (!enabled || !supported) return;
    let released = false;
    (async () => {
      try {
        lockRef.current = await (navigator as any).wakeLock.request("screen");
        lockRef.current.addEventListener?.("release", () => {
          if (!released) {
            // auto re-acquire on release if still enabled
          }
        });
      } catch {}
    })();
    const onVis = async () => {
      if (document.visibilityState === "visible" && enabled) {
        try {
          lockRef.current = await (navigator as any).wakeLock.request("screen");
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      released = true;
      try {
        lockRef.current?.release?.();
      } catch {}
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, supported]);
  return { supported };
}

