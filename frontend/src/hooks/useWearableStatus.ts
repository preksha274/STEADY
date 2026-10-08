"use client";

import { useState, useEffect } from "react";
import { WearableStatus } from "@/config/wearableConfig";
import { fetchWearableStatus } from "@/lib/wearableClient";

export function useWearableStatus(pollingIntervalMs: number = 10000) {
  const [status, setStatus] = useState<WearableStatus | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      try {
        const data = await fetchWearableStatus();
        if (mounted) {
          setStatus(data);
          setHasError(false);
        }
      } catch (err) {
        if (mounted) {
          setHasError(true);
        }
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, pollingIntervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pollingIntervalMs]);

  return {
    status,
    isConnected: Boolean(status?.connected),
    hasError,
  };
}
