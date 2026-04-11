package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import com.thegreentangerine.gigbooks.data.supabase.SongRepository
import com.thegreentangerine.gigbooks.data.supabase.models.Song
import com.thegreentangerine.gigbooks.data.supabase.models.SongShare
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

private const val BEAT_ANALYSIS_URL = "https://beat-analysis-672617156755.europe-west1.run.app"

private val CATEGORIES = listOf(
    "tgt_cover" to "TGT Cover",
    "tgt_original" to "TGT Original",
    "personal_cover" to "Personal Cover",
    "personal_original" to "Personal Original",
)

@Composable
fun SongFormScreen(
    vm: AppViewModel,
    song: Song,
    onBack: () -> Unit,
) {
    val canEdit = song.canEdit(vm.currentUserId)

    // Form state — initialised from song
    var name by rememberSaveable { mutableStateOf(song.name) }
    var artist by rememberSaveable { mutableStateOf(song.artist) }
    var category by rememberSaveable { mutableStateOf(song.category) }
    var bpm by rememberSaveable { mutableStateOf(song.bpm.toString()) }
    var key by rememberSaveable { mutableStateOf(song.key) }
    var timeSigTop by rememberSaveable { mutableStateOf(song.timeSignatureTop.toInt().toString()) }
    var timeSigBottom by rememberSaveable { mutableStateOf(song.timeSignatureBottom.toInt().toString()) }
    var subdivision by rememberSaveable { mutableStateOf(song.subdivision.toInt().toString()) }
    var swingPercent by rememberSaveable { mutableStateOf(song.swingPercent.toInt().toString()) }
    var countInBars by rememberSaveable { mutableStateOf(song.countInBars.toInt().toString()) }
    var clickSound by rememberSaveable { mutableStateOf(song.clickSound) }
    var liveClickMode by rememberSaveable { mutableStateOf(song.liveClickMode) }
    var notes by rememberSaveable { mutableStateOf(song.notes) }
    var lyrics by rememberSaveable { mutableStateOf(song.lyrics) }
    var chords by rememberSaveable { mutableStateOf(song.chords) }
    var drumNotation by rememberSaveable { mutableStateOf(song.drumNotation) }

    var saving by rememberSaveable { mutableStateOf(false) }
    var processingMsg by rememberSaveable { mutableStateOf("") }
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    // ── Sharing state (personal_original only) ──
    val isPersonalOriginal = category == "personal_original"
    val isOwner = song.ownerId == vm.currentUserId
    var shares by remember { mutableStateOf<List<SongShare>>(emptyList()) }
    var sharesLoading by remember { mutableStateOf(false) }

    // Load shares when form opens (for personal_original songs owned by user)
    LaunchedEffect(song.id) {
        if (isPersonalOriginal && isOwner) {
            sharesLoading = true
            try {
                shares = SongRepository.getSongShares(song.id)
            } catch (_: Exception) { }
            sharesLoading = false
        }
    }

    fun pollProcessingStatus(songId: String) {
        scope.launch(Dispatchers.IO) {
            repeat(30) { // Poll up to 5 minutes (30 × 10s)
                kotlinx.coroutines.delay(10_000)
                try {
                    val bm = SongRepository.getBeatMap(songId)
                    val status = bm?.status ?: "unknown"
                    withContext(Dispatchers.Main) {
                        processingMsg = when (status) {
                            "ready" -> "Ready"
                            "failed" -> "Failed"
                            "pending" -> "Queued..."
                            "analysing" -> "Detecting beats..."
                            "separating" -> "Separating stems..."
                            else -> status
                        }
                    }
                    if (status == "ready" || status == "failed") return@launch
                } catch (_: Exception) {
                    withContext(Dispatchers.Main) { processingMsg = "Poll error" }
                    return@launch
                }
            }
        }
    }

    fun triggerProcess(reAnalyseOnly: Boolean) {
        val audioUrl = song.audioUrl ?: return
        processingMsg = if (reAnalyseOnly) "Re-analysing..." else "Processing..."
        scope.launch(Dispatchers.IO) {
            try {
                val endpoint = if (reAnalyseOnly) "/re-analyse" else "/process"
                val body = if (reAnalyseOnly) {
                    """{"song_id":"${song.id}","audio_url":"$audioUrl"}"""
                } else {
                    """{"song_id":"${song.id}","audio_url":"$audioUrl","skip_stems":true}"""
                }
                val conn = URL("$BEAT_ANALYSIS_URL$endpoint").openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.outputStream.use { it.write(body.toByteArray()) }
                val code = conn.responseCode
                conn.disconnect()
                if (code in 200..299) {
                    withContext(Dispatchers.Main) { processingMsg = "Queued — polling..." }
                    pollProcessingStatus(song.id)
                } else {
                    withContext(Dispatchers.Main) { processingMsg = "Failed ($code)" }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    processingMsg = "Error: ${e.message}"
                }
            }
        }
    }

    fun save() {
        if (!canEdit || saving) return
        saving = true
        val updates = mutableMapOf<String, Any?>(
            "name" to name.trim(),
            "artist" to artist.trim(),
            "category" to category,
            "bpm" to (bpm.toDoubleOrNull() ?: 120.0),
            "key" to key.trim(),
            "time_signature_top" to (timeSigTop.toDoubleOrNull() ?: 4.0),
            "time_signature_bottom" to (timeSigBottom.toDoubleOrNull() ?: 4.0),
            "subdivision" to (subdivision.toDoubleOrNull() ?: 1.0),
            "swing_percent" to (swingPercent.toDoubleOrNull() ?: 50.0),
            "count_in_bars" to (countInBars.toDoubleOrNull() ?: 0.0),
            "click_sound" to clickSound,
            "live_click_mode" to liveClickMode,
            "notes" to notes,
            "lyrics" to lyrics,
            "chords" to chords,
            "drum_notation" to drumNotation,
        )
        // Set owner_id for personal songs
        if (category.startsWith("personal")) {
            updates["owner_id"] = vm.currentUserId
        }
        vm.updateSong(song.id, updates) {
            saving = false
            onBack()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TangerineColors.background),
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(TangerineColors.surface)
                .padding(start = 4.dp, end = 16.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TangerineColors.textDim, modifier = Modifier.size(22.dp))
            }
            Text(
                text = if (canEdit) "Edit Song" else "Song Details",
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                style = TextStyle(color = TangerineColors.teal, shadow = Shadow(TangerineColors.teal.copy(alpha = 0.4f), Offset.Zero, 14f)),
            )
            Spacer(Modifier.weight(1f))
            if (canEdit) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (!saving) TangerineColors.green.copy(alpha = 0.12f) else Color.Transparent)
                        .border(1.dp, if (!saving) TangerineColors.green.copy(alpha = 0.3f) else TangerineColors.textMuted.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                        .clickable(enabled = !saving) { save() }
                        .padding(horizontal = 14.dp, vertical = 7.dp),
                ) {
                    Text(
                        if (saving) "Saving..." else "Save",
                        fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        color = if (!saving) TangerineColors.green else TangerineColors.textMuted,
                    )
                }
            }
        }
        HorizontalDivider(color = TangerineColors.textMuted.copy(alpha = 0.15f))

        // Form body
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // ── Core fields ──
            SectionLabel("SONG INFO")
            FormTextField("Name", name, { name = it }, canEdit)
            FormTextField("Artist", artist, { artist = it }, canEdit)
            CategoryDropdown(category, { category = it }, canEdit)

            // ── Sharing (personal_original owned by current user) ──
            if (isPersonalOriginal && isOwner) {
                Spacer(Modifier.height(4.dp))
                SectionLabel("SHARING")
                NeuCard {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (sharesLoading) {
                            Text("Loading shares...", fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted)
                        } else if (shares.isEmpty()) {
                            Text("Not shared with anyone", fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textDim)
                        } else {
                            shares.forEach { share ->
                                val memberName = vm.profileNames[share.sharedWith] ?: share.sharedWith
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(24.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(TangerineColors.purple.copy(alpha = 0.15f)),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            memberName.firstOrNull()?.uppercase() ?: "?",
                                            fontFamily = Karla, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                            color = TangerineColors.purple,
                                        )
                                    }
                                    Spacer(Modifier.width(8.dp))
                                    Text(memberName, fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.text, modifier = Modifier.weight(1f))
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(TangerineColors.danger.copy(alpha = 0.08f))
                                            .border(0.5.dp, TangerineColors.danger.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                                            .clickable {
                                                scope.launch(Dispatchers.IO) {
                                                    try {
                                                        SongRepository.unshareSong(share.id)
                                                        val updated = SongRepository.getSongShares(song.id)
                                                        withContext(Dispatchers.Main) { shares = updated }
                                                    } catch (_: Exception) { }
                                                }
                                            }
                                            .padding(horizontal = 8.dp, vertical = 4.dp),
                                    ) {
                                        Text("Remove", fontFamily = Karla, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = TangerineColors.danger)
                                    }
                                }
                            }
                        }

                        // Add member dropdown
                        val currentSharedIds = shares.map { it.sharedWith }.toSet() + setOfNotNull(vm.currentUserId)
                        val availableMembers = vm.profileNames.filter { it.key !in currentSharedIds }
                        if (availableMembers.isNotEmpty()) {
                            Spacer(Modifier.height(2.dp))
                            ShareMemberDropdown(
                                members = availableMembers,
                                onShare = { memberId ->
                                    val userId = vm.currentUserId ?: return@ShareMemberDropdown
                                    scope.launch(Dispatchers.IO) {
                                        try {
                                            SongRepository.shareSong(song.id, memberId, userId)
                                            val updated = SongRepository.getSongShares(song.id)
                                            withContext(Dispatchers.Main) { shares = updated }
                                        } catch (_: Exception) { }
                                    }
                                },
                            )
                        }
                    }
                }
            }

            FormTextField("Key", key, { key = it }, canEdit)

            Spacer(Modifier.height(4.dp))
            SectionLabel("TEMPO & RHYTHM")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FormTextField("BPM", bpm, { bpm = it }, canEdit, KeyboardType.Decimal, Modifier.weight(1f))
                FormTextField("Time Sig Top", timeSigTop, { timeSigTop = it }, canEdit, KeyboardType.Number, Modifier.weight(1f))
                FormTextField("Bottom", timeSigBottom, { timeSigBottom = it }, canEdit, KeyboardType.Number, Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FormTextField("Subdivision", subdivision, { subdivision = it }, canEdit, KeyboardType.Number, Modifier.weight(1f))
                FormTextField("Swing %", swingPercent, { swingPercent = it }, canEdit, KeyboardType.Number, Modifier.weight(1f))
                FormTextField("Count-in", countInBars, { countInBars = it }, canEdit, KeyboardType.Number, Modifier.weight(1f))
            }

            // S41: Per-song live click mode toggle
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Live Click:", fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted)
                listOf("full" to "Full", "count_in" to "30s Count-in", "off" to "Off").forEach { (value, label) ->
                    val selected = liveClickMode == value
                    Box(
                        modifier = Modifier
                            .height(32.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (selected) TangerineColors.green else TangerineColors.surfaceLight)
                            .clickable(enabled = canEdit) { liveClickMode = value }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            label,
                            fontFamily = Karla,
                            fontSize = 11.sp,
                            color = if (selected) Color.White else TangerineColors.textMuted,
                        )
                    }
                }
            }

            Spacer(Modifier.height(4.dp))
            SectionLabel("TEXT CONTENT")
            FormTextArea("Notes", notes, { notes = it }, canEdit, lines = 3)
            FormTextArea("Lyrics", lyrics, { lyrics = it }, canEdit, lines = 5)
            FormTextArea("Chords", chords, { chords = it }, canEdit, lines = 4)
            FormTextArea("Drum Notation", drumNotation, { drumNotation = it }, canEdit, lines = 4)

            // ── Audio + Processing ──
            if (song.hasAudio) {
                Spacer(Modifier.height(4.dp))
                SectionLabel("AUDIO & PROCESSING")
                NeuCard {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row {
                            Text("Duration: ", fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted)
                            Text(song.durationFormatted ?: "—", fontFamily = JetBrainsMono, fontSize = 12.sp, color = TangerineColors.text)
                        }
                        Row {
                            Text("Audio: ", fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted)
                            Text("Track loaded", fontFamily = JetBrainsMono, fontSize = 12.sp, color = TangerineColors.green)
                        }
                        if (processingMsg.isNotEmpty()) {
                            Text(processingMsg, fontFamily = JetBrainsMono, fontSize = 11.sp, color = TangerineColors.teal)
                        }
                        if (canEdit) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ActionButton("Re-analyse Beats", TangerineColors.teal, Modifier.weight(1f)) { triggerProcess(reAnalyseOnly = true) }
                                ActionButton("Full Re-process", TangerineColors.purple, Modifier.weight(1f)) { triggerProcess(reAnalyseOnly = false) }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(32.dp))
        }
    }
}

// ─── Form Components ─────────────────────────────────────────────────────────

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        fontFamily = Karla, fontWeight = FontWeight.Bold,
        fontSize = 10.sp, letterSpacing = 1.sp,
        color = TangerineColors.textMuted,
        modifier = Modifier.padding(top = 4.dp),
    )
}

@Composable
private fun FormTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean,
    keyboardType: KeyboardType = KeyboardType.Text,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(8.dp)
    Column(modifier = modifier) {
        Text(label, fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textDim, modifier = Modifier.padding(bottom = 4.dp))
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = true,
            textStyle = TextStyle(fontFamily = Karla, fontSize = 14.sp, color = if (enabled) TangerineColors.text else TangerineColors.textDim),
            cursorBrush = SolidColor(TangerineColors.teal),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            decorationBox = { inner ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(TangerineColors.surfaceInset)
                        .border(1.dp, TangerineColors.neuBorder, shape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    if (value.isEmpty()) Text(label, fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.textMuted)
                    inner()
                }
            },
        )
    }
}

@Composable
private fun FormTextArea(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean,
    lines: Int = 3,
) {
    val shape = RoundedCornerShape(8.dp)
    Column {
        Text(label, fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textDim, modifier = Modifier.padding(bottom = 4.dp))
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            textStyle = TextStyle(fontFamily = Karla, fontSize = 13.sp, color = if (enabled) TangerineColors.text else TangerineColors.textDim),
            cursorBrush = SolidColor(TangerineColors.teal),
            minLines = lines,
            decorationBox = { inner ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(TangerineColors.surfaceInset)
                        .border(1.dp, TangerineColors.neuBorder, shape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    if (value.isEmpty()) Text(label, fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted)
                    inner()
                }
            },
        )
    }
}

@Composable
private fun ActionButton(label: String, color: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.1f))
            .border(1.dp, color.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = color)
    }
}

@Composable
private fun CategoryDropdown(selected: String, onSelect: (String) -> Unit, enabled: Boolean) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val shape = RoundedCornerShape(8.dp)
    val displayLabel = CATEGORIES.find { it.first == selected }?.second ?: selected

    Column {
        Text("Category", fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textDim, modifier = Modifier.padding(bottom = 4.dp))
        Box {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(TangerineColors.surfaceInset)
                    .border(1.dp, TangerineColors.neuBorder, shape)
                    .clickable(enabled = enabled) { expanded = true }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    displayLabel,
                    fontFamily = Karla, fontSize = 14.sp,
                    color = if (enabled) TangerineColors.text else TangerineColors.textDim,
                    modifier = Modifier.weight(1f),
                )
                Text("\u25BE", fontSize = 14.sp, color = TangerineColors.textMuted)
            }
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                containerColor = TangerineColors.surface,
            ) {
                CATEGORIES.forEach { (value, label) ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                label, fontFamily = Karla, fontSize = 13.sp,
                                color = if (value == selected) TangerineColors.teal else TangerineColors.text,
                                fontWeight = if (value == selected) FontWeight.Bold else FontWeight.Normal,
                            )
                        },
                        onClick = { onSelect(value); expanded = false },
                    )
                }
            }
        }
    }
}

@Composable
private fun ShareMemberDropdown(
    members: Map<String, String>,
    onShare: (String) -> Unit,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val shape = RoundedCornerShape(8.dp)
    Box {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(TangerineColors.purple.copy(alpha = 0.06f))
                .border(1.dp, TangerineColors.purple.copy(alpha = 0.2f), shape)
                .clickable { expanded = true }
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("+ Share with member", fontFamily = Karla, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TangerineColors.purple, modifier = Modifier.weight(1f))
            Text("\u25BE", fontSize = 14.sp, color = TangerineColors.purple.copy(alpha = 0.5f))
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = TangerineColors.surface,
        ) {
            members.forEach { (id, name) ->
                DropdownMenuItem(
                    text = { Text(name, fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.text) },
                    onClick = { onShare(id); expanded = false },
                )
            }
        }
    }
}
