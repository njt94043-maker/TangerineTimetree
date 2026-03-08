package com.thegreentangerine.gigbooks.data.supabase

import com.thegreentangerine.gigbooks.data.supabase.models.AwayDate
import com.thegreentangerine.gigbooks.data.supabase.models.Gig
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order

object GigRepository {

    private val client get() = SupabaseProvider.client

    /** All gigs whose date falls within the given month. */
    suspend fun getGigsForMonth(year: Int, month: Int): List<Gig> {
        val start = "%04d-%02d-01".format(year, month)
        val end   = "%04d-%02d-31".format(year, month)
        return client.from("gigs").select {
            filter {
                gte("date", start)
                lte("date", end)
            }
            order("date", Order.ASCENDING)
        }.decodeList()
    }

    /** Away dates that overlap with the given month (start_date ≤ end_of_month AND end_date ≥ start_of_month). */
    suspend fun getAwayDatesForMonth(year: Int, month: Int): List<AwayDate> {
        val start = "%04d-%02d-01".format(year, month)
        val end   = "%04d-%02d-31".format(year, month)
        return client.from("away_dates").select {
            filter {
                lte("start_date", end)
                gte("end_date", start)
            }
        }.decodeList()
    }
}
