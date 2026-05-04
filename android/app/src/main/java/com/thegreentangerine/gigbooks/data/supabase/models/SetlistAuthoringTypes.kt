package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * Cross-surface setlist authoring types — hand-synced from
 * shared/supabase/types.ts (S125). Every change here MUST be mirrored in
 * the TS file (or vice versa). Schema lives in Supabase migration
 * 20260504120000_s125_setlist_changelog_pending_lock.sql.
 *
 * Per S118: all 3 surfaces (MS PWA / Web / APK) write directly to
 * setlist_entries. LWW + the changelog is the editorial-control mechanism.
 * During gig-lock, edits queue to setlist_pending_edits and auto-apply on
 * gig-end.
 */

/** Identifies the surface that produced an edit. Used for changelog
 *  attribution and to drive UI affordances per surface. */
object EditSurface {
    const val MS_PWA = "ms_pwa"
    const val WEB = "web"
    const val APK = "apk"
    const val STUDIO_V2 = "studio_v2"
}

/** Setlist edit verbs — match the enum in the SQL CHECK constraint. */
object SetlistAction {
    const val CREATED = "created"
    const val UPDATED = "updated"
    const val DELETED = "deleted"
    const val REORDERED = "reordered"
    const val MOVED = "moved"
}

/** Append-only audit log row. Read by the Changelog drawer; one row per
 *  changed scalar field on update (so history is precise field-by-field). */
@Serializable
data class SetlistChangelogEntry(
    val id: String,
    @SerialName("list_id")        val listId: String,
    @SerialName("entry_id")       val entryId: String? = null,
    @SerialName("actor_id")       val actorId: String? = null,
    @SerialName("actor_name")     val actorName: String = "",
    val surface: String,
    val action: String,
    @SerialName("field_changed")  val fieldChanged: String? = null,
    @SerialName("old_value")      val oldValue: String? = null,
    @SerialName("new_value")      val newValue: String? = null,
    @SerialName("created_at")     val createdAt: String = "",
)

/** Edit queued during gig-lock. Auto-apply daemon (deferred) drains the
 *  queue at gig-end; until then surfaces show pending edits in a drawer
 *  so anyone can see what's about to land. */
@Serializable
data class SetlistPendingEdit(
    val id: String,
    @SerialName("list_id")        val listId: String,
    @SerialName("entry_id")       val entryId: String? = null,
    @SerialName("actor_id")       val actorId: String? = null,
    @SerialName("actor_name")     val actorName: String = "",
    val surface: String,
    val action: String,
    val payload: JsonElement,
    @SerialName("created_at")     val createdAt: String = "",
    @SerialName("applied_at")     val appliedAt: String? = null,
    @SerialName("apply_error")    val applyError: String? = null,
)

/** Single-row Realtime control. Surface checks `isLocked` before writing —
 *  if locked, route the edit to setlist_pending_edits instead of
 *  setlist_entries. */
@Serializable
data class GigLockState(
    val id: Int = 1,
    @SerialName("is_locked")          val isLocked: Boolean = false,
    @SerialName("locked_by_surface")  val lockedBySurface: String? = null,
    @SerialName("locked_at")          val lockedAt: String? = null,
    @SerialName("gig_label")          val gigLabel: String? = null,
    @SerialName("updated_at")         val updatedAt: String = "",
)

/** Display-side actor identity used when writing changelog rows. Kotlin
 *  surface gets the auth user id from AuthRepository.currentUserId(); the
 *  display name defaults to the email local-part. */
data class SetlistActor(
    val id: String,
    val name: String,
)
