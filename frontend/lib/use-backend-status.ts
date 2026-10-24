'use client';

import { useEffect, useState } from 'react';
import { probeBackend, type BackendStatus } from './backend-status';

const RECHECK_MS = 30_000;

export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const next = await probeBackend();
      if (!cancelled) setStatus(next);
    };
    check();
    const id = setInterval(check, RECHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return status;
}
