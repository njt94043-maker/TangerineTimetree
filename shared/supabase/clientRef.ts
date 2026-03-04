// Platform-agnostic Supabase client reference.
// Each app calls initSupabase() once at startup with its platform-specific client.
// Uses inline types to avoid requiring @supabase/supabase-js in shared/.

interface SupabaseError {
  message: string;
  code?: string;
}

interface SupabaseAuth {
  getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  getSession: () => Promise<{ data: { session: unknown | null } }>;
  refreshSession: () => Promise<{ data: { session: unknown | null }; error: SupabaseError | null }>;
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ data: unknown; error: SupabaseError | null }>;
  signOut: () => Promise<{ error: SupabaseError | null }>;
  onAuthStateChange: (callback: (event: string, session: unknown) => void) => { data: { subscription: { unsubscribe: () => void } } };
}

export interface SupabaseClientLike {
  // Query builder returns are inherently dynamic (table-dependent generics) —
  // typed at usage sites via cast in queries.ts instead.
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  auth: SupabaseAuth;
  // Realtime channel types have complex overloads; keep loose to avoid conflicts
  // with the full @supabase/supabase-js RealtimeChannel class.
  channel: (name: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  removeChannel: (channel: any) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  // Storage (optional — used by web for media uploads)
  storage?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

let _client: SupabaseClientLike | null = null;
let _onAuthError: (() => void) | null = null;

export function initSupabase(client: SupabaseClientLike): void {
  _client = client;
}

export function onAuthError(handler: () => void): void {
  _onAuthError = handler;
}

export function handleAuthError(): void {
  if (_onAuthError) _onAuthError();
}

export function getSupabase(): SupabaseClientLike {
  if (!_client) throw new Error('Supabase not initialized. Call initSupabase() first.');
  return _client;
}
