"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Icon } from "@iconify/react";

export default function DashboardSync() {
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    // Small delay to let the dashboard load
    const timer = setTimeout(() => {
      checkAndSync();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const checkAndSync = async () => {
    try {

      // Check if any accounts need syncing
      const checkResponse = await fetch('/api/bank-link/sync-all');
      if (!checkResponse.ok) {
        console.error('Failed to check sync status');
        return;
      }

      const checkData = await checkResponse.json();

      if (checkData.accountsDue === 0) {
        return;
      }

      // Perform the sync
      const syncResponse = await fetch('/api/bank-link/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ background: true })
      });

      if (!syncResponse.ok) {
        throw new Error('Sync failed');
      }

    } catch (error: any) {
      // Show error toast only if it's not a network/auth issue
      toast.error('Failed to sync accounts', {
        duration: 4000,
        icon: <Icon icon="mdi:alert-circle" className="text-red-500" />
      });
    }
  };

  return null
}