package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thegreentangerine.gigbooks.data.supabase.GigLockRepository
import com.thegreentangerine.gigbooks.data.supabase.SetlistChangelogRepository
import com.thegreentangerine.gigbooks.data.supabase.SetlistEntriesRepository
import com.thegreentangerine.gigbooks.data.supabase.SetlistPendingEditsRepository
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistChangelogEntry
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistEntry
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistPendingEdit
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors

/**
 * APK setlist authoring surface (S127). Cross-surface direct edit per S118 —
 * shares schema + Realtime channels with MS PWA + TGT Web.
 *
 * Compose-idiomatic adaptation of the MS PWA mockup: 3-list pills + LazyColumn
 * of song rows + tap-to-edit ModalBottomSheet for per-song detail. APK is
 * always a phone so the MS PWA's 2-col-with-drawer layout doesn't apply —
 * Queued / Changelog are reachable via top-bar icon buttons that open their
 * own bottom sheets.
 */

private const val LIST_STAPLES = "staples"
private const val LIST_PARTY = "party"
private const val LIST_CLASSIC_ROCK = "classic_rock"
private val LIST_ORDER = listOf(LIST_STAPLES, LIST_PARTY, LIST_CLASSIC_ROCK)
private val LIST_LABELS = mapOf(
    LIST_STAPLES to "Staples",
    LIST_PARTY to "Party",
    LIST_CLASSIC_ROCK to "Classic Rock",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SetlistsScreen(
    onMenuClick: () -> Unit,
    vm: SetlistsViewModel = viewModel(),
) {
    val entries by SetlistEntriesRepository.entries.collectAsState()
    val lockState by GigLockRepository.state.collectAsState()
    val changelog by SetlistChangelogRepository.entries.collectAsState()
    val pending by SetlistPendingEditsRepository.entries.collectAsState()
    val saving by vm.saving.collectAsState()
    val error by vm.error.collectAsState()

    var activeList by remember { mutableStateOf(LIST_STAPLES) }
    var detailEntryId by remember { mutableStateOf<String?>(null) }
    var actionEntryId by remember { mutableStateOf<String?>(null) }
    var addSheetOpen by remember { mutableStateOf(false) }
    var queuedSheetOpen by remember { mutableStateOf(false) }
    var changelogSheetOpen by remember { mutableStateOf(false) }

    val isLocked = lockState.isLocked
    val unappliedPending = pending.filter { it.appliedAt == null }
    val grouped = LIST_ORDER.associateWith { id ->
        entries.filter { it.listId == id }.sortedBy { it.position }
    }
    val activeEntries = grouped[activeList] ?: emptyList()
    val detailEntry = entries.firstOrNull { it.id == detailEntryId }
    val actionEntry = entries.firstOrNull { it.id == actionEntryId }

    Column(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
        TopBar(
            unappliedCount = unappliedPending.size,
            onMenuClick = onMenuClick,
            onQueuedClick = { queuedSheetOpen = true },
            onChangelogClick = { changelogSheetOpen = true },
            onAddClick = { addSheetOpen = true },
        )

        SyncBanner(
            isLocked = isLocked,
            gigLabel = lockState.gigLabel,
            saving = saving,
            error = error,
            onClearError = { vm.clearError() },
            lastEdit = changelog.firstOrNull(),
        )

        ListPills(
            activeList = activeList,
            grouped = grouped,
            onSelect = { activeList = it },
        )

        Box(modifier = Modifier.fillMaxSize().weight(1f)) {
            if (activeEntries.isEmpty()) {
                EmptyState(activeList)
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 8.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    items(activeEntries, key = { it.id }) { entry ->
                        SongRow(
                            entry = entry,
                            position = activeEntries.indexOf(entry) + 1,
                            isFirst = activeEntries.indexOf(entry) == 0,
                            isLast = activeEntries.indexOf(entry) == activeEntries.size - 1,
                            onClick = { detailEntryId = entry.id },
                            onMore = { actionEntryId = entry.id },
                        )
                    }
                }
            }
        }
    }

    // ── Bottom sheets ──────────────────────────────────────────────────────

    if (detailEntry != null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { detailEntryId = null },
            sheetState = sheetState,
            containerColor = TangerineColors.surface,
            contentWindowInsets = { WindowInsets(0) },
        ) {
            SongDetailSheet(
                entry = detailEntry,
                onSave = { patch -> vm.updateEntry(detailEntry, patch) },
                onClose = { detailEntryId = null },
            )
        }
    }

    if (actionEntry != null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { actionEntryId = null },
            sheetState = sheetState,
            containerColor = TangerineColors.surface,
            contentWindowInsets = { WindowInsets(0) },
        ) {
            ActionSheet(
                entry = actionEntry,
                isFirst = activeEntries.indexOfFirst { it.id == actionEntry.id } == 0,
                isLast = activeEntries.indexOfFirst { it.id == actionEntry.id } == activeEntries.size - 1,
                onMoveUp = { vm.reorder(actionEntry.listId, actionEntry.id, -1); actionEntryId = null },
                onMoveDown = { vm.reorder(actionEntry.listId, actionEntry.id, 1); actionEntryId = null },
                onMoveToList = { to -> vm.moveEntry(actionEntry, to); actionEntryId = null },
                onDelete = { vm.deleteEntry(actionEntry); actionEntryId = null },
                onClose = { actionEntryId = null },
            )
        }
    }

    if (addSheetOpen) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { addSheetOpen = false },
            sheetState = sheetState,
            containerColor = TangerineColors.surface,
            contentWindowInsets = { WindowInsets(0) },
        ) {
            AddEntrySheet(
                activeList = activeList,
                onAdd = { title, artist, bpm, click ->
                    vm.addEntry(activeList, title, artist, bpm, click)
                    addSheetOpen = false
                },
                onClose = { addSheetOpen = false },
            )
        }
    }

    if (queuedSheetOpen) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { queuedSheetOpen = false },
            sheetState = sheetState,
            containerColor = TangerineColors.surface,
            contentWindowInsets = { WindowInsets(0) },
        ) {
            QueuedSheet(pending = unappliedPending, isLocked = isLocked)
        }
    }

    if (changelogSheetOpen) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { changelogSheetOpen = false },
            sheetState = sheetState,
            containerColor = TangerineColors.surface,
            contentWindowInsets = { WindowInsets(0) },
        ) {
            ChangelogSheet(changelog = changelog)
        }
    }
}

// ── Top bar ───────────────────────────────────────────────────────────────

@Composable
private fun TopBar(
    unappliedCount: Int,
    onMenuClick: () -> Unit,
    onQueuedClick: () -> Unit,
    onChangelogClick: () -> Unit,
    onAddClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onMenuClick) {
            Icon(Icons.Default.Menu, "Menu", tint = TangerineColors.text)
        }
        Spacer(Modifier.width(4.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Setlists",
                fontFamily = Karla, fontWeight = FontWeight.Bold,
                fontSize = 22.sp, color = TangerineColors.orange,
            )
            Text(
                "3-list master order",
                fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted,
            )
        }
        Box {
            IconButton(onClick = onQueuedClick) {
                Icon(Icons.Default.HourglassEmpty, "Queued", tint = TangerineColors.text)
            }
            if (unappliedCount > 0) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 6.dp, end = 6.dp)
                        .background(TangerineColors.orange, RoundedCornerShape(8.dp))
                        .padding(horizontal = 5.dp, vertical = 1.dp),
                ) {
                    Text(
                        unappliedCount.toString(),
                        fontFamily = JetBrainsMono, fontSize = 9.sp,
                        fontWeight = FontWeight.Bold, color = TangerineColors.background,
                    )
                }
            }
        }
        IconButton(onClick = onChangelogClick) {
            Icon(Icons.Default.History, "Changelog", tint = TangerineColors.text)
        }
        IconButton(onClick = onAddClick) {
            Icon(Icons.Default.Add, "Add song", tint = TangerineColors.orange)
        }
    }
}

// ── Sync banner ───────────────────────────────────────────────────────────

@Composable
private fun SyncBanner(
    isLocked: Boolean,
    gigLabel: String?,
    saving: Boolean,
    error: String?,
    onClearError: () -> Unit,
    lastEdit: SetlistChangelogEntry?,
) {
    val accent = when {
        error != null -> TangerineColors.danger
        isLocked -> TangerineColors.orange
        else -> TangerineColors.green
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(TangerineColors.surfaceInset)
            .border(1.dp, accent.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
            .padding(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(8.dp)
                    .background(accent, RoundedCornerShape(4.dp)),
            )
            Spacer(Modifier.width(8.dp))
            val statusText = when {
                error != null -> "Error: $error"
                isLocked -> "Gig in progress${gigLabel?.let { " — $it" } ?: ""} · edits queue"
                saving -> "Saving…"
                lastEdit != null -> "Synced · ${lastEdit.actorName.ifBlank { "unknown" }} ${lastEdit.action} (${lastEdit.surface})"
                else -> "Synced · no edits yet"
            }
            Text(
                statusText,
                fontFamily = Karla, fontSize = 12.sp,
                color = TangerineColors.text,
                modifier = Modifier.weight(1f),
            )
            if (error != null) {
                Text(
                    "Dismiss",
                    fontFamily = Karla, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                    color = TangerineColors.orange,
                    modifier = Modifier.clickable { onClearError() }.padding(4.dp),
                )
            }
        }
    }
}

// ── 3-list pill tabs ──────────────────────────────────────────────────────

@Composable
private fun ListPills(
    activeList: String,
    grouped: Map<String, List<SetlistEntry>>,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(TangerineColors.surface)
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        for (id in LIST_ORDER) {
            val active = id == activeList
            val count = grouped[id]?.size ?: 0
            Row(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (active) TangerineColors.surfaceLight else androidx.compose.ui.graphics.Color.Transparent)
                    .clickable { onSelect(id) }
                    .padding(vertical = 10.dp, horizontal = 8.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    LIST_LABELS[id] ?: id,
                    fontFamily = Karla, fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = if (active) TangerineColors.orange else TangerineColors.textDim,
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    count.toString(),
                    fontFamily = JetBrainsMono, fontSize = 10.sp,
                    color = if (active) TangerineColors.orange else TangerineColors.textMuted,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(TangerineColors.surfaceInset)
                        .padding(horizontal = 6.dp, vertical = 1.dp),
                )
            }
        }
    }
}

// ── Song row ──────────────────────────────────────────────────────────────

@Composable
private fun SongRow(
    entry: SetlistEntry,
    position: Int,
    isFirst: Boolean,
    isLast: Boolean,
    onClick: () -> Unit,
    onMore: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(TangerineColors.surfaceInset)
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            position.toString().padStart(2, '0'),
            fontFamily = JetBrainsMono, fontSize = 11.sp,
            color = TangerineColors.textMuted,
            modifier = Modifier.width(28.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                entry.title,
                fontFamily = Karla, fontWeight = FontWeight.Bold,
                fontSize = 14.sp, color = TangerineColors.text,
                maxLines = 1,
            )
            Row {
                if (!entry.artist.isNullOrBlank()) {
                    Text(
                        entry.artist,
                        fontFamily = Karla, fontSize = 11.sp,
                        color = TangerineColors.textDim,
                        maxLines = 1,
                    )
                }
                if (entry.bpm != null) {
                    if (!entry.artist.isNullOrBlank()) {
                        Text(" · ", fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted)
                    }
                    Text(
                        "${entry.bpm} BPM",
                        fontFamily = JetBrainsMono, fontSize = 11.sp,
                        color = TangerineColors.textMuted,
                    )
                }
            }
        }
        // Flag pills
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            FlagPill(
                text = if (entry.clickYN) "click" else "no click",
                color = if (entry.clickYN) TangerineColors.green else TangerineColors.orange,
                dashed = !entry.clickYN,
            )
            if (!entry.ledVisual.isNullOrBlank()) {
                FlagPill(text = "LED", color = TangerineColors.cyan, dashed = false)
            }
        }
        // Quick reorder + more
        IconButton(
            onClick = onMore,
            modifier = Modifier.size(36.dp),
        ) {
            Icon(Icons.Default.MoreVert, "More actions", tint = TangerineColors.textDim)
        }
    }
}

@Composable
private fun FlagPill(text: String, color: androidx.compose.ui.graphics.Color, dashed: Boolean) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.1f))
            .border(
                width = 1.dp,
                color = color.copy(alpha = if (dashed) 0.4f else 0.25f),
                shape = RoundedCornerShape(8.dp),
            )
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(
            text.uppercase(),
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
            fontSize = 9.sp, color = color,
        )
    }
}

// ── Empty state ───────────────────────────────────────────────────────────

@Composable
private fun EmptyState(listId: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
            Text(
                "No songs in ${LIST_LABELS[listId] ?: listId}",
                fontFamily = Karla, fontWeight = FontWeight.Bold,
                fontSize = 16.sp, color = TangerineColors.text,
            )
            Spacer(Modifier.size(6.dp))
            Text(
                "Tap + to add the first one.",
                fontFamily = Karla, fontSize = 12.sp,
                color = TangerineColors.textMuted,
            )
        }
    }
}

// ── Action sheet (⋯ menu) ─────────────────────────────────────────────────

@Composable
private fun ActionSheet(
    entry: SetlistEntry,
    isFirst: Boolean,
    isLast: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onMoveToList: (String) -> Unit,
    onDelete: () -> Unit,
    onClose: () -> Unit,
) {
    var showMoveMenu by remember { mutableStateOf(false) }
    val otherLists = LIST_ORDER.filter { it != entry.listId }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            entry.title,
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 16.sp, color = TangerineColors.text,
            modifier = Modifier.padding(vertical = 8.dp).fillMaxWidth(),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        if (!showMoveMenu) {
            ActionSheetButton(
                icon = Icons.Default.KeyboardArrowUp,
                label = "Move up",
                enabled = !isFirst,
                onClick = onMoveUp,
            )
            ActionSheetButton(
                icon = Icons.Default.KeyboardArrowDown,
                label = "Move down",
                enabled = !isLast,
                onClick = onMoveDown,
            )
            ActionSheetButton(
                icon = Icons.Default.SwapHoriz,
                label = "Move to list…",
                enabled = true,
                onClick = { showMoveMenu = true },
            )
            ActionSheetButton(
                icon = Icons.Default.Delete,
                label = "Remove from list",
                enabled = true,
                color = TangerineColors.danger,
                onClick = onDelete,
            )
            Spacer(Modifier.size(4.dp))
            ActionSheetButton(
                icon = null,
                label = "Cancel",
                enabled = true,
                color = TangerineColors.textMuted,
                onClick = onClose,
            )
        } else {
            for (l in otherLists) {
                ActionSheetButton(
                    icon = null,
                    label = "Move to ${LIST_LABELS[l] ?: l}",
                    enabled = true,
                    onClick = { onMoveToList(l) },
                )
            }
            Spacer(Modifier.size(4.dp))
            ActionSheetButton(
                icon = Icons.AutoMirrored.Filled.ArrowBack,
                label = "Back",
                enabled = true,
                color = TangerineColors.textMuted,
                onClick = { showMoveMenu = false },
            )
        }
    }
}

@Composable
private fun ActionSheetButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector?,
    label: String,
    enabled: Boolean,
    color: androidx.compose.ui.graphics.Color = TangerineColors.text,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(TangerineColors.surfaceInset)
            .clickable(enabled = enabled) { onClick() }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(
                icon, contentDescription = null,
                tint = if (enabled) color else color.copy(alpha = 0.4f),
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(12.dp))
        }
        Text(
            label,
            fontFamily = Karla, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
            color = if (enabled) color else color.copy(alpha = 0.4f),
        )
    }
}

// ── Add-entry sheet ───────────────────────────────────────────────────────

@Composable
private fun AddEntrySheet(
    activeList: String,
    onAdd: (title: String, artist: String?, bpm: Int?, click: Boolean) -> Unit,
    onClose: () -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var artist by remember { mutableStateOf("") }
    var bpm by remember { mutableStateOf("") }
    var click by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .imePadding()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            "Add to ${LIST_LABELS[activeList] ?: activeList}",
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 16.sp, color = TangerineColors.orange,
        )
        SheetTextField(label = "Song title (required)", value = title, onChange = { title = it })
        SheetTextField(label = "Artist", value = artist, onChange = { artist = it })
        SheetTextField(
            label = "BPM",
            value = bpm,
            onChange = { bpm = it.filter { c -> c.isDigit() } },
            keyboardType = KeyboardType.Number,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = click,
                onCheckedChange = { click = it },
                colors = CheckboxDefaults.colors(
                    checkedColor = TangerineColors.orange,
                    uncheckedColor = TangerineColors.textDim,
                ),
            )
            Text("Click track on", fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.text)
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SheetSecondaryButton("Cancel", onClick = onClose, modifier = Modifier.weight(1f))
            SheetPrimaryButton(
                "Add",
                enabled = title.isNotBlank(),
                onClick = {
                    onAdd(title.trim(), artist.trim().ifBlank { null }, bpm.toIntOrNull(), click)
                },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

// ── Per-song detail sheet ─────────────────────────────────────────────────

@Composable
private fun SongDetailSheet(
    entry: SetlistEntry,
    onSave: (Map<String, Any?>) -> Unit,
    onClose: () -> Unit,
) {
    var title by remember(entry.id) { mutableStateOf(entry.title) }
    var artist by remember(entry.id) { mutableStateOf(entry.artist ?: "") }
    var bpm by remember(entry.id) { mutableStateOf(entry.bpm?.toString() ?: "") }
    var beatsPerBar by remember(entry.id) { mutableStateOf(entry.beatsPerBar?.toString() ?: "4") }
    var click by remember(entry.id) { mutableStateOf(entry.clickYN) }
    var ledVisual by remember(entry.id) { mutableStateOf(entry.ledVisual ?: "") }
    var backdropUrl by remember(entry.id) { mutableStateOf(entry.backdropUrl ?: "") }
    var notes by remember(entry.id) { mutableStateOf(entry.notes ?: "") }
    var chordText by remember(entry.id) { mutableStateOf(entry.chordText ?: "") }
    var lyricText by remember(entry.id) { mutableStateOf(entry.lyricText ?: "") }
    var drumText by remember(entry.id) { mutableStateOf(entry.drumText ?: "") }
    var practiceRef by remember(entry.id) { mutableStateOf(entry.practiceAudioRef ?: "") }

    val dirty = title != entry.title
        || artist != (entry.artist ?: "")
        || bpm != (entry.bpm?.toString() ?: "")
        || beatsPerBar != (entry.beatsPerBar?.toString() ?: "4")
        || click != entry.clickYN
        || ledVisual != (entry.ledVisual ?: "")
        || backdropUrl != (entry.backdropUrl ?: "")
        || notes != (entry.notes ?: "")
        || chordText != (entry.chordText ?: "")
        || lyricText != (entry.lyricText ?: "")
        || drumText != (entry.drumText ?: "")
        || practiceRef != (entry.practiceAudioRef ?: "")

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 720.dp)
            .imePadding()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Edit song",
                    fontFamily = Karla, fontWeight = FontWeight.Bold,
                    fontSize = 16.sp, color = TangerineColors.orange,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onClose) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Close", tint = TangerineColors.textDim)
                }
            }
        }
        item { SectionLabel("Identity") }
        item { SheetTextField(label = "Title", value = title, onChange = { title = it }) }
        item { SheetTextField(label = "Artist", value = artist, onChange = { artist = it }) }
        item { SheetTextField(label = "BPM", value = bpm, onChange = { bpm = it.filter { c -> c.isDigit() } }, keyboardType = KeyboardType.Number) }
        item { SheetTextField(label = "Beats / bar", value = beatsPerBar, onChange = { beatsPerBar = it.filter { c -> c.isDigit() } }, keyboardType = KeyboardType.Number) }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = click,
                    onCheckedChange = { click = it },
                    colors = CheckboxDefaults.colors(
                        checkedColor = TangerineColors.orange,
                        uncheckedColor = TangerineColors.textDim,
                    ),
                )
                Text("Click track on at gig-time", fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.text)
            }
        }
        item { SectionLabel("Stage display") }
        item { SheetTextField(label = "LED visual", value = ledVisual, onChange = { ledVisual = it }) }
        item { SheetTextField(label = "Backdrop URL", value = backdropUrl, onChange = { backdropUrl = it }) }
        item { SheetTextField(label = "Stage notes", value = notes, onChange = { notes = it }) }
        item { SectionLabel("Practice audio") }
        item { SheetTextField(label = "Track ref", value = practiceRef, onChange = { practiceRef = it }, mono = true) }
        item {
            Text(
                "Track picker lives on Media Server PWA — APK shows the ref but doesn't browse.",
                fontFamily = Karla, fontSize = 11.sp,
                color = TangerineColors.textMuted,
            )
        }
        item { SectionLabel("Lyrics / chords / drum notes") }
        item { SheetTextField(label = "Chord chart", value = chordText, onChange = { chordText = it }, multiline = true) }
        item { SheetTextField(label = "Lyrics", value = lyricText, onChange = { lyricText = it }, multiline = true) }
        item { SheetTextField(label = "Drum notes", value = drumText, onChange = { drumText = it }, multiline = true) }
        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SheetSecondaryButton("Close", onClick = onClose, modifier = Modifier.weight(1f))
                SheetPrimaryButton(
                    "Save changes",
                    enabled = dirty,
                    onClick = {
                        val patch = mutableMapOf<String, Any?>()
                        if (title != entry.title) patch["title"] = title
                        if (artist != (entry.artist ?: "")) patch["artist"] = artist.ifBlank { null }
                        val bpmInt = bpm.toIntOrNull()
                        if (bpmInt != entry.bpm) patch["bpm"] = bpmInt
                        val bpb = beatsPerBar.toIntOrNull() ?: 4
                        if (bpb != (entry.beatsPerBar ?: 4)) patch["beats_per_bar"] = bpb
                        if (click != entry.clickYN) patch["click_y_n"] = click
                        if (ledVisual != (entry.ledVisual ?: "")) patch["led_visual"] = ledVisual.ifBlank { null }
                        if (backdropUrl != (entry.backdropUrl ?: "")) patch["backdrop_url"] = backdropUrl.ifBlank { null }
                        if (notes != (entry.notes ?: "")) patch["notes"] = notes.ifBlank { null }
                        if (chordText != (entry.chordText ?: "")) patch["chord_text"] = chordText.ifBlank { null }
                        if (lyricText != (entry.lyricText ?: "")) patch["lyric_text"] = lyricText.ifBlank { null }
                        if (drumText != (entry.drumText ?: "")) patch["drum_text"] = drumText.ifBlank { null }
                        if (practiceRef != (entry.practiceAudioRef ?: "")) patch["practice_audio_ref"] = practiceRef.ifBlank { null }
                        if (patch.isNotEmpty()) onSave(patch)
                        onClose()
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

// ── Queued sheet ──────────────────────────────────────────────────────────

@Composable
private fun QueuedSheet(pending: List<SetlistPendingEdit>, isLocked: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 600.dp)
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(
            "Queued edits",
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 16.sp, color = TangerineColors.orange,
        )
        Spacer(Modifier.size(6.dp))
        Text(
            if (isLocked) "Edits queue while a gig is in progress. They auto-apply on gig-end."
            else "Edits queued during the previous gig that haven't applied yet.",
            fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textDim,
        )
        Spacer(Modifier.size(10.dp))
        if (pending.isEmpty()) {
            Text(
                if (isLocked) "Nothing queued yet." else "No edits are queued.",
                fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
                modifier = Modifier.padding(vertical = 24.dp),
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items(pending, key = { it.id }) { p ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(TangerineColors.surfaceInset)
                            .padding(10.dp),
                    ) {
                        Text(
                            "${p.actorName.ifBlank { "unknown" }} · ${p.action} in ${LIST_LABELS[p.listId] ?: p.listId}",
                            fontFamily = Karla, fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp, color = TangerineColors.text,
                        )
                        Text(
                            p.payload.toString().take(180),
                            fontFamily = JetBrainsMono, fontSize = 10.sp,
                            color = TangerineColors.textDim,
                        )
                        if (p.applyError != null) {
                            Text(
                                "apply error: ${p.applyError}",
                                fontFamily = Karla, fontSize = 11.sp,
                                color = TangerineColors.danger,
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── Changelog sheet ───────────────────────────────────────────────────────

@Composable
private fun ChangelogSheet(changelog: List<SetlistChangelogEntry>) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 600.dp)
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(
            "Changelog",
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 16.sp, color = TangerineColors.orange,
        )
        Spacer(Modifier.size(6.dp))
        Text(
            "Append-only audit log. Most recent first.",
            fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textDim,
        )
        Spacer(Modifier.size(10.dp))
        if (changelog.isEmpty()) {
            Text(
                "No edits yet.",
                fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
                modifier = Modifier.padding(vertical = 24.dp),
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                items(changelog, key = { it.id }) { row ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                    ) {
                        Row {
                            Text(
                                row.actorName.ifBlank { "unknown" },
                                fontFamily = Karla, fontWeight = FontWeight.Bold,
                                fontSize = 12.sp, color = TangerineColors.orange,
                            )
                            Text(
                                " ${row.action}",
                                fontFamily = Karla, fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp, color = TangerineColors.text,
                            )
                            row.fieldChanged?.let {
                                Text(" $it", fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted)
                            }
                            Text(
                                " in ${LIST_LABELS[row.listId] ?: row.listId}",
                                fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted,
                            )
                        }
                        if (row.oldValue != null || row.newValue != null) {
                            Text(
                                buildString {
                                    if (row.oldValue != null) append("was ${row.oldValue}")
                                    if (row.oldValue != null && row.newValue != null) append(" → ")
                                    if (row.newValue != null) append(row.newValue)
                                },
                                fontFamily = JetBrainsMono, fontSize = 10.sp,
                                color = TangerineColors.textDim,
                            )
                        }
                        Text(
                            "${row.surface}",
                            fontFamily = JetBrainsMono, fontSize = 9.sp,
                            color = TangerineColors.textMuted,
                        )
                    }
                }
            }
        }
    }
}

// ── Shared sheet primitives ───────────────────────────────────────────────

@Composable
private fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        fontFamily = Karla, fontWeight = FontWeight.Bold,
        fontSize = 10.sp, letterSpacing = 1.sp,
        color = TangerineColors.textMuted,
        modifier = Modifier.padding(top = 4.dp),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SheetTextField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    keyboardType: KeyboardType = KeyboardType.Text,
    multiline: Boolean = false,
    mono: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = {
            Text(label, fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textDim)
        },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        singleLine = !multiline,
        minLines = if (multiline) 3 else 1,
        textStyle = TextStyle(
            fontFamily = if (mono) JetBrainsMono else Karla,
            fontSize = 14.sp,
            color = TangerineColors.text,
        ),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = TangerineColors.orange,
            unfocusedBorderColor = TangerineColors.surfaceLight,
            cursorColor = TangerineColors.orange,
            focusedTextColor = TangerineColors.text,
            unfocusedTextColor = TangerineColors.text,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun SheetPrimaryButton(
    label: String,
    enabled: Boolean = true,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (enabled) TangerineColors.orange else TangerineColors.orange.copy(alpha = 0.3f))
            .clickable(enabled = enabled) { onClick() }
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 13.sp, color = TangerineColors.background,
        )
    }
}

@Composable
private fun SheetSecondaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(TangerineColors.surfaceInset)
            .border(1.dp, TangerineColors.surfaceLight, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 13.sp, color = TangerineColors.textDim,
        )
    }
}
