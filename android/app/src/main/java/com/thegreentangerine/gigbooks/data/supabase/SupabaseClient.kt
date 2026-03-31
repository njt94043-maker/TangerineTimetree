package com.thegreentangerine.gigbooks.data.supabase

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.storage.Storage

/**
 * Singleton Supabase client — same project as the web app.
 * URL and anon key from BuildConfig (set via local.properties or env vars).
 */
object SupabaseProvider {

    // These match shared/supabase/config.ts
    private const val SUPABASE_URL = "https://jlufqgslgjowfaqmqlds.supabase.co"
    private const val SUPABASE_ANON_KEY = "sb_publishable_JwBPIqMBRavKV326-3oc9w_62AsevO1"

    val client: SupabaseClient by lazy {
        createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY) {
            install(Auth)
            install(Postgrest)
            install(Storage)
            install(Realtime)
        }
    }
}
