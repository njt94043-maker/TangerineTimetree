package com.thegreentangerine.gigbooks.data.supabase

import com.thegreentangerine.gigbooks.data.supabase.models.AwayDate
import com.thegreentangerine.gigbooks.data.supabase.models.Gig
import com.thegreentangerine.gigbooks.data.supabase.models.Profile

/**
 * Offline-first wrapper around GigRepository.
 * Returns cached data when offline, updates cache on successful fetches.
 */
class CachedGigRepository(private val cache: OfflineCache) {

    suspend fun getGigsForMonth(year: Int, month: Int): List<Gig> =
        cache.cacheFirst("gigs_${year}_${month}", Gig.serializer()) {
            GigRepository.getGigsForMonth(year, month)
        }

    suspend fun getAwayDatesForMonth(year: Int, month: Int): List<AwayDate> =
        cache.cacheFirst("away_${year}_${month}", AwayDate.serializer()) {
            GigRepository.getAwayDatesForMonth(year, month)
        }

    suspend fun getProfiles(): List<Profile> =
        cache.cacheFirst("profiles", Profile.serializer()) {
            GigRepository.getProfiles()
        }
}
