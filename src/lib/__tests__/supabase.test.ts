import { describe, it, expect, vi } from 'vitest';

// Mock import.meta.env before importing supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
      insert: vi.fn(),
      update: vi.fn(() => ({ eq: vi.fn() })),
      delete: vi.fn(() => ({ eq: vi.fn() })),
    })),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe('supabase client', () => {
  it('should export a supabase client object', async () => {
    const { supabase } = await import('../../lib/supabase');
    expect(supabase).toBeDefined();
    expect(supabase.from).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('should have auth methods', async () => {
    const { supabase } = await import('../../lib/supabase');
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.auth.getSession).toBe('function');
    expect(typeof supabase.auth.signInWithPassword).toBe('function');
    expect(typeof supabase.auth.signUp).toBe('function');
    expect(typeof supabase.auth.signOut).toBe('function');
  });

  it('should not have any demo data fallback wrapper', async () => {
    const { supabase } = await import('../../lib/supabase');
    // The client should be a standard SupabaseClient, not a Proxy
    expect(supabase).not.toHaveProperty('schemaErrorTables');
    expect(supabase).not.toHaveProperty('isDemo');
  });
});

// NOTE: Type exports (Brand, Consultant, Lead, etc.) are TypeScript-only.
// They do not exist at runtime — `export type` is erased during compilation.
// Testing them as runtime values would always fail. Verified at the type level
// by `tsc --noEmit` instead.
