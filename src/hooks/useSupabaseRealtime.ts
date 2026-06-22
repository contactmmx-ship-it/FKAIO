import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseSupabaseRealtimeOptions {
  table: string;
  filter?: string; // e.g., 'lead_id=eq.xxx'
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  callback?: (payload: any) => void;
  enabled?: boolean;
}

export function useSupabaseRealtime({
  table,
  filter,
  event = '*',
  callback,
  enabled = true,
}: UseSupabaseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    const channelName = `rt-${table}-${filter || 'all'}-${Date.now()}`;
    let channel: RealtimeChannel | null = null;

    const config: any = {
      event,
      schema: 'public',
      table,
    };
    if (filter) {
      config.filter = filter;
    }

    channel = supabase
      .channel(channelName, { config: { broadcast: { self: false } } })
      .on('postgres_changes', config, (payload) => {
        setIsConnected(true);
        callbackRef.current?.(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
        }
      });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      setIsConnected(false);
    };
  }, [table, filter, event, enabled]);

  return { isConnected };
}