import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRealtimeTableOptions {
  tableName: string;
  tableId?: string | null;
  onUpdate: () => void;
  enabled?: boolean;
}

/**
 * Hook for subscribing to real-time updates on a specific table.
 * Uses stable refs to avoid subscription churn and prevent blinking.
 */
export function useRealtimeTable({ 
  tableName, 
  tableId,
  onUpdate, 
  enabled = true 
}: UseRealtimeTableOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const subscribedTableIdRef = useRef<string | null>(null);

  // Keep callback ref updated without triggering re-subscription
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled || !tableName) {
      // Cleanup on disable
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Use deterministic channel name - only re-subscribe if tableId changes
    const channelKey = tableId || 'all';
    
    // If already subscribed to the same table, don't recreate
    if (channelRef.current && subscribedTableIdRef.current === channelKey) {
      return;
    }

    // Cleanup previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `realtime-${tableName}-${channelKey}`;
    
    const channel = supabase.channel(channelName);

    // Subscribe to rows changes for this specific table
    if (tableId) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rdbms_rows',
          filter: `table_id=eq.${tableId}`,
        },
        () => {
          setLastUpdate(new Date());
          onUpdateRef.current();
        }
      );
    }

    // Subscribe to table metadata changes
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rdbms_tables',
        filter: tableId ? `id=eq.${tableId}` : undefined,
      },
      () => {
        setLastUpdate(new Date());
        onUpdateRef.current();
      }
    );

    channel.subscribe((status) => {
      setIsConnected(status === 'SUBSCRIBED');
    });

    channelRef.current = channel;
    subscribedTableIdRef.current = channelKey;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedTableIdRef.current = null;
      }
      setIsConnected(false);
    };
  }, [tableName, tableId, enabled]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      subscribedTableIdRef.current = null;
      setIsConnected(false);
    }
  }, []);

  return {
    isConnected,
    lastUpdate,
    disconnect,
  };
}

// Real-time status indicator component
interface RealtimeStatusProps {
  isConnected: boolean;
  lastUpdate?: Date | null;
}

export const RealtimeStatus = ({ isConnected, lastUpdate }: RealtimeStatusProps) => {
  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--terminal-green))]"></span>
      </span>
      <span className="text-[hsl(var(--terminal-green))]">Live</span>
      {lastUpdate && (
        <span className="text-muted-foreground/70">
          (last: {lastUpdate.toLocaleTimeString()})
        </span>
      )}
    </div>
  );
};
