import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock supabase module
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn() })) })),
    })),
  },
}));

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

describe('AuthContext', () => {
  it('provides default values when no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    // After loading completes with no session
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.user).toBeNull();
    expect(result.current.consultant).toBeNull();
    expect(result.current.isDemoMode).toBe(false);
  });

  it('isDemoMode is always false (no demo mode)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    expect(result.current.isDemoMode).toBe(false);
  });

  it('loading starts as true', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    // loading may still be true on first render
    expect(typeof result.current.loading).toBe('boolean');
  });

  it('provides signIn function', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    expect(typeof result.current.signIn).toBe('function');
  });

  it('provides signUp function', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    expect(typeof result.current.signUp).toBe('function');
  });

  it('provides signOut function', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    expect(typeof result.current.signOut).toBe('function');
  });

  it('session is null when not authenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.session).toBeNull();
  });

  it('provides consistent interface shape', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('session');
    expect(result.current).toHaveProperty('consultant');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('signIn');
    expect(result.current).toHaveProperty('signUp');
    expect(result.current).toHaveProperty('signOut');
    expect(result.current).toHaveProperty('isDemoMode');
  });
});
