// Platform-agnostic Supabase client reference.
// Each app calls initSupabase() once at startup with its platform-specific client.
// Uses inline type to avoid requiring @supabase/supabase-js in shared/.

interface SupabaseClientLike {
  from: (table: string) => any;
  auth: any;
  channel: (name: string) => any;
  removeChannel: (channel: any) => any;
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
