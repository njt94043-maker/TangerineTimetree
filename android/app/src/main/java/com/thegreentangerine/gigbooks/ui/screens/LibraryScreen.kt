package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistWithSongs
import com.thegreentangerine.gigbooks.data.supabase.models.Song
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla

enum class LibraryTab { Songs, Setlists }

// Scope filter (D-128)
private enum class ScopeFilter(val label: String) {
    All("All Songs"),
    Tgt("TGT"),
    Mine("My Songs"),
    Shared("Shared With Me"),
}

// Type filter (D-128)
private enum class TypeFilter(val label: String) {
    All("All Types"),
    Covers("Covers"),
    Originals("Originals"),
}

// Setlist filter
private enum class SetlistFilter(val label: String) {
    All("All"),
    Tange("TGT"),
    OtherBand("Other"),
}

@Composable
fun LibraryScreen(
    vm: AppViewModel,
    onMenuClick: () -> Unit,
    onLaunchLive: (Song) -> Unit,
    onLaunchPractice: (Song) -> Unit,
    onLaunchSetlistLive: (SetlistWithSongs) -> Unit,
    onLaunchSetlistPractice: (SetlistWithSongs) -> Unit,
    onLaunchView: (Song) -> Unit = {},
    onLaunchSetlistView: (SetlistWithSongs) -> Unit = {},
) {
    var activeTab by rememberSaveable { mutableStateOf(LibraryTab.Songs) }
    var showNewIdeaDialog by rememberSaveable { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().background(GigColors.background)) {
        LibraryHeader(
            activeTab = activeTab,
            onTabChange = { activeTab = it },
            onMenuClick = onMenuClick,
            onNewIdea = { showNewIdeaDialog = true },
        )

        when {
            vm.loadError != null -> ErrorState(vm.loadError!!)
            vm.isLoading         -> LoadingState()
            else -> when (activeTab) {
                LibraryTab.Songs -> SongsTab(
                    songs = vm.songs,
                    currentUserId = vm.currentUserId,
                    profileNames = vm.profileNames,
                    sharedSongIds = vm.sharedSongIds,
                    onLaunchLive = onLaunchLive,
                    onLaunchPractice = onLaunchPractice,
                    onLaunchView = onLaunchView,
                )
                LibraryTab.Setlists -> SetlistsTab(
                    setlists = vm.setlists,
                    onLaunchLive = onLaunchSetlistLive,
                    onLaunchPractice = onLaunchSetlistPractice,
                    onLaunchView = onLaunchSetlistView,
                )
            }
        }
    }

    // New Song Idea dialog (D-138)
    if (showNewIdeaDialog) {
        NewIdeaDialog(
            onDismiss = { showNewIdeaDialog = false },
            onCreate = { name ->
                showNewIdeaDialog = false
                vm.createSongIdea(name) { song ->
                    onLaunchPractice(song)
                    // Auto-start recording after a brief delay for screen transition
                    vm.clearNewIdeaFlag()
                }
            },
        )
    }
}

// ─── Header ──────────────────────────────────────────────────────────────────

@Composable
private fun LibraryHeader(
    activeTab: LibraryTab,
    onTabChange: (LibraryTab) -> Unit,
    onMenuClick: () -> Unit,
    onNewIdea: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(GigColors.surface)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 48.dp, start = 8.dp, end = 16.dp, bottom = 0.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, contentDescription = "Menu", tint = GigColors.textDim, modifier = Modifier.size(22.dp))
            }
            Text(
                text = "Library",
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                style = TextStyle(color = GigColors.teal, shadow = Shadow(GigColors.teal.copy(alpha = 0.4f), Offset.Zero, 14f)),
            )
            Spacer(Modifier.weight(1f))
            // New Idea button (D-138)
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(GigColors.danger.copy(alpha = 0.1f))
                    .border(1.dp, GigColors.danger.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                    .clickable(onClick = onNewIdea)
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            ) {
                Text(
                    "New Idea",
                    fontFamily = JetBrainsMono, fontSize = 10.sp, color = GigColors.danger,
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        LibraryTabBar(activeTab = activeTab, onTabChange = onTabChange)
    }
}

@Composable
private fun LibraryTabBar(activeTab: LibraryTab, onTabChange: (LibraryTab) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth()) {
        LibraryTab.entries.forEach { tab ->
            val selected = activeTab == tab
            val accent   = if (tab == LibraryTab.Songs) GigColors.teal else GigColors.orange
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(if (selected) accent.copy(alpha = 0.1f) else Color.Transparent)
                    .clickable { onTabChange(tab) }
                    .padding(vertical = 11.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = tab.name,
                        fontFamily = Karla,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 14.sp,
                        style = if (selected) TextStyle(color = accent, shadow = Shadow(accent.copy(0.5f), Offset.Zero, 10f))
                        else TextStyle(color = GigColors.textDim),
                    )
                    Spacer(Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.5f).height(2.dp)
                            .background(if (selected) accent else Color.Transparent, RoundedCornerShape(1.dp)),
                    )
                }
            }
        }
    }
    HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.2f))
}

// ─── Filter Pills ─────────────────────────────────────────────────────────────

@Composable
private fun <T> FilterPillRow(
    filters: List<T>,
    selected: T,
    onSelect: (T) -> Unit,
    label: (T) -> String,
    accent: Color,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        filters.forEach { filter ->
            val isSelected = filter == selected
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        if (isSelected) accent.copy(alpha = 0.15f) else Color.Transparent,
                        RoundedCornerShape(16.dp),
                    )
                    .border(
                        0.5.dp,
                        if (isSelected) accent.copy(alpha = 0.5f) else GigColors.textMuted.copy(alpha = 0.25f),
                        RoundedCornerShape(16.dp),
                    )
                    .clickable { onSelect(filter) }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text(
                    text = label(filter),
                    fontFamily = Karla,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                    fontSize = 12.sp,
                    style = if (isSelected) TextStyle(
                        color = accent,
                        shadow = Shadow(accent.copy(0.4f), Offset.Zero, 6f),
                    ) else TextStyle(color = GigColors.textDim),
                )
            }
        }
    }
}

// ─── Songs Tab ───────────────────────────────────────────────────────────────

@Composable
private fun SongsTab(
    songs: List<Song>,
    currentUserId: String?,
    profileNames: Map<String, String>,
    sharedSongIds: Set<String>,
    onLaunchLive: (Song) -> Unit,
    onLaunchPractice: (Song) -> Unit,
    onLaunchView: (Song) -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    var scopeFilter by rememberSaveable { mutableStateOf(ScopeFilter.All) }
    var typeFilter by rememberSaveable { mutableStateOf(TypeFilter.All) }
    var expandedSongId by rememberSaveable { mutableStateOf<String?>(null) }

    val filtered = songs.filter { song ->
        // Scope filter
        val matchesScope = when (scopeFilter) {
            ScopeFilter.All -> true
            ScopeFilter.Tgt -> song.isTgtSong
            ScopeFilter.Mine -> song.ownerId == currentUserId
            ScopeFilter.Shared -> sharedSongIds.contains(song.id)
        }
        // Type filter
        val matchesType = when (typeFilter) {
            TypeFilter.All -> true
            TypeFilter.Covers -> song.isCover
            TypeFilter.Originals -> song.isOriginal
        }
        val matchesQuery = if (query.isBlank()) true
        else song.name.contains(query, ignoreCase = true) || song.artist.contains(query, ignoreCase = true)
        matchesScope && matchesType && matchesQuery
    }

    Column(modifier = Modifier.fillMaxSize()) {
        SearchBar(query = query, onQueryChange = { query = it }, placeholder = "Search songs…")

        // Two dropdown rows
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            FilterDropdown(
                entries = ScopeFilter.entries,
                selected = scopeFilter,
                onSelect = { scopeFilter = it },
                label = { it.label },
                accent = GigColors.teal,
                modifier = Modifier.weight(1f),
            )
            FilterDropdown(
                entries = TypeFilter.entries,
                selected = typeFilter,
                onSelect = { typeFilter = it },
                label = { it.label },
                accent = GigColors.teal,
                modifier = Modifier.weight(1f),
            )
        }

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            if (filtered.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No songs found", fontFamily = Karla, fontSize = 14.sp, color = GigColors.textMuted)
                    }
                }
            } else {
                items(filtered, key = { it.id }) { song ->
                    SongCard(
                        song = song,
                        expanded = expandedSongId == song.id,
                        onClick = { expandedSongId = if (expandedSongId == song.id) null else song.id },
                        onLive = { onLaunchLive(song) },
                        onPractice = { onLaunchPractice(song) },
                        onView = { onLaunchView(song) },
                        currentUserId = currentUserId,
                        ownerName = if (song.isPersonalSong && song.ownerId != null) profileNames[song.ownerId] else null,
                        isShared = sharedSongIds.contains(song.id),
                    )
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun SongCard(
    song: Song,
    expanded: Boolean,
    onClick: () -> Unit,
    onLive: () -> Unit,
    onPractice: () -> Unit,
    onView: () -> Unit,
    currentUserId: String?,
    ownerName: String?,
    isShared: Boolean,
) {
    val canEdit = song.canEdit(currentUserId)

    NeuCard(modifier = Modifier.padding(horizontal = 12.dp).clickable(onClick = onClick)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(song.name, fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = GigColors.text)
                    if (!canEdit) {
                        Text("\uD83D\uDD12", fontSize = 12.sp, color = GigColors.textMuted)
                    }
                }
                if (song.artist.isNotBlank()) {
                    Text(song.artist, fontFamily = Karla, fontSize = 12.sp, color = GigColors.textDim)
                }
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    CategoryTag(song.category)
                    if (ownerName != null) MetaBadge(ownerName, GigColors.textDim)
                    if (isShared) MetaBadge("Shared", GigColors.purple)
                    if (song.key.isNotBlank()) MetaBadge(song.key, GigColors.teal)
                    MetaBadge(song.timeSig, GigColors.textMuted)
                    song.durationFormatted?.let { MetaBadge(it, GigColors.textMuted) }
                    if (song.hasAudio) MetaBadge("TRACK", GigColors.green)
                }
            }
            // BPM on right side
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "${song.bpm.toInt()}",
                    fontFamily = JetBrainsMono, fontSize = 20.sp,
                    style = TextStyle(color = GigColors.orange, shadow = Shadow(GigColors.orange.copy(0.3f), Offset.Zero, 8f)),
                )
                Text("BPM", fontFamily = JetBrainsMono, fontSize = 9.sp, color = GigColors.textMuted)
            }
        }

        // Inline launch buttons (shown on tap)
        if (expanded) {
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.15f))
            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                LaunchButton(
                    icon = Icons.Default.GraphicEq,
                    label = "Live",
                    color = GigColors.green,
                    modifier = Modifier.weight(1f),
                    onClick = onLive,
                )
                LaunchButton(
                    icon = Icons.Default.Headphones,
                    label = "Practice",
                    color = GigColors.purple,
                    modifier = Modifier.weight(1f),
                    onClick = onPractice,
                )
                LaunchButton(
                    icon = Icons.Default.Videocam,
                    label = "View",
                    color = GigColors.teal,
                    modifier = Modifier.weight(1f),
                    onClick = onView,
                )
            }
        }
    }
}

@Composable
private fun CategoryTag(category: String) {
    val (label, color) = when (category) {
        "tgt_cover"          -> "TGT Cover" to GigColors.teal
        "tgt_original"       -> "TGT Original" to GigColors.teal
        "personal_cover"     -> "Personal Cover" to GigColors.orange
        "personal_original"  -> "Personal Original" to GigColors.orange
        else                 -> "Song" to GigColors.textMuted
    }
    MetaBadge(label, color)
}

/** Dropdown selector styled as a neumorphic pill. */
@Composable
private fun <T> FilterDropdown(
    entries: List<T>,
    selected: T,
    onSelect: (T) -> Unit,
    label: (T) -> String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val shape = RoundedCornerShape(10.dp)

    Box(modifier = modifier) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(GigColors.surfaceInset)
                .border(0.5.dp, if (selected != entries.first()) accent.copy(0.4f) else GigColors.neuBorder, shape)
                .clickable { expanded = true }
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                label(selected),
                fontFamily = Karla,
                fontSize = 12.sp,
                fontWeight = if (selected != entries.first()) FontWeight.SemiBold else FontWeight.Normal,
                color = if (selected != entries.first()) accent else GigColors.textDim,
                modifier = Modifier.weight(1f),
            )
            Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = GigColors.textMuted, modifier = Modifier.size(16.dp))
        }
        androidx.compose.material3.DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = GigColors.surface,
        ) {
            entries.forEach { entry ->
                androidx.compose.material3.DropdownMenuItem(
                    text = {
                        Text(
                            label(entry),
                            fontFamily = Karla, fontSize = 13.sp,
                            color = if (entry == selected) accent else GigColors.text,
                            fontWeight = if (entry == selected) FontWeight.Bold else FontWeight.Normal,
                        )
                    },
                    onClick = { onSelect(entry); expanded = false },
                )
            }
        }
    }
}

@Composable
private fun LaunchButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    color: Color,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    Row(
        modifier = modifier
            .height(40.dp)
            .background(color.copy(alpha = 0.08f), RoundedCornerShape(10.dp))
            .border(0.5.dp, color.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            label, fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
            style = TextStyle(color = color, shadow = Shadow(color.copy(0.35f), Offset.Zero, 6f)),
        )
    }
}

// ─── Setlists Tab ────────────────────────────────────────────────────────────

@Composable
private fun SetlistsTab(
    setlists: List<SetlistWithSongs>,
    onLaunchLive: (SetlistWithSongs) -> Unit,
    onLaunchPractice: (SetlistWithSongs) -> Unit,
    onLaunchView: (SetlistWithSongs) -> Unit,
) {
    var filter by rememberSaveable { mutableStateOf(SetlistFilter.All) }

    val filtered = setlists.filter { s ->
        when (filter) {
            SetlistFilter.All -> true
            SetlistFilter.Tange -> s.setlist.isTange
            SetlistFilter.OtherBand -> s.setlist.isOtherBand
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        FilterPillRow(
            filters = SetlistFilter.entries,
            selected = filter,
            onSelect = { filter = it },
            label = { it.label },
            accent = GigColors.orange,
        )

        if (filtered.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No setlists found", fontFamily = Karla, fontSize = 14.sp, color = GigColors.textMuted)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(filtered, key = { it.setlist.id }) { s ->
                    SetlistCard(
                        setlistWithSongs = s,
                        onLaunchLive = { onLaunchLive(s) },
                        onLaunchPractice = { onLaunchPractice(s) },
                        onLaunchView = { onLaunchView(s) },
                    )
                }
                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun SetlistCard(
    setlistWithSongs: SetlistWithSongs,
    onLaunchLive: () -> Unit,
    onLaunchPractice: () -> Unit,
    onLaunchView: () -> Unit,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val setlist = setlistWithSongs.setlist

    NeuCard(modifier = Modifier.padding(horizontal = 12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(setlist.name, fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = GigColors.text)
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    // Band tag
                    MetaBadge(
                        if (setlist.isTange) "TGT" else setlist.bandName,
                        if (setlist.isTange) GigColors.orange else GigColors.purple,
                    )
                    MetaBadge("${setlistWithSongs.songCount} songs", GigColors.textDim)
                    setlistWithSongs.totalDurationFormatted?.let { MetaBadge(it, GigColors.textMuted) }
                }
            }
            Icon(
                if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = null, tint = GigColors.textDim, modifier = Modifier.size(20.dp),
            )
        }

        if (expanded) {
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.15f))
            Spacer(Modifier.height(6.dp))

            // Song preview list
            if (setlistWithSongs.songs.isNotEmpty()) {
                setlistWithSongs.songs.forEachIndexed { index, row ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "${index + 1}", fontFamily = JetBrainsMono, fontSize = 11.sp,
                            color = GigColors.textMuted, modifier = Modifier.width(20.dp),
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                row.songs?.name ?: "", fontFamily = Karla, fontWeight = FontWeight.Medium,
                                fontSize = 13.sp, color = GigColors.text,
                            )
                            val artist = row.songs?.artist ?: ""
                            if (artist.isNotBlank()) Text(artist, fontFamily = Karla, fontSize = 11.sp, color = GigColors.textDim)
                        }
                        Text(
                            "${row.songs?.bpm?.toInt() ?: ""}", fontFamily = JetBrainsMono, fontSize = 12.sp, color = GigColors.orange,
                        )
                        if (row.songs?.hasAudio == true) {
                            Spacer(Modifier.width(6.dp))
                            Icon(Icons.Default.Headphones, contentDescription = null, tint = GigColors.green, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }

            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.15f))
            Spacer(Modifier.height(10.dp))

            // Launch buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                LaunchButton(
                    icon = Icons.Default.GraphicEq,
                    label = "Live",
                    color = GigColors.green,
                    modifier = Modifier.weight(1f),
                    onClick = onLaunchLive,
                )
                LaunchButton(
                    icon = Icons.Default.Headphones,
                    label = "Practice",
                    color = GigColors.purple,
                    modifier = Modifier.weight(1f),
                    onClick = onLaunchPractice,
                )
                LaunchButton(
                    icon = Icons.Default.Videocam,
                    label = "View",
                    color = GigColors.teal,
                    modifier = Modifier.weight(1f),
                    onClick = onLaunchView,
                )
            }
        }
    }
}

// ─── Shared small components ──────────────────────────────────────────────────

@Composable
private fun SearchBar(query: String, onQueryChange: (String) -> Unit, placeholder: String) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp)
            .clip(shape).background(GigColors.surfaceInset)
            .border(1.dp, GigColors.neuBorder, shape)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Search, contentDescription = null, tint = GigColors.textMuted, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        BasicTextField(
            value = query, onValueChange = onQueryChange,
            modifier = Modifier.weight(1f),
            textStyle = TextStyle(fontFamily = Karla, fontSize = 14.sp, color = GigColors.text),
            cursorBrush = SolidColor(GigColors.teal),
            singleLine = true,
            decorationBox = { inner ->
                if (query.isEmpty()) Text(placeholder, fontFamily = Karla, fontSize = 14.sp, color = GigColors.textMuted)
                inner()
            },
        )
    }
}

@Composable
private fun MetaBadge(text: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.1f))
            .border(0.5.dp, color.copy(alpha = 0.3f), RoundedCornerShape(4.dp))
            .padding(horizontal = 5.dp, vertical = 2.dp),
    ) {
        Text(text, fontFamily = JetBrainsMono, fontSize = 10.sp, color = color)
    }
}

@Composable
private fun LoadingState() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = GigColors.teal, modifier = Modifier.size(32.dp))
    }
}

@Composable
private fun ErrorState(message: String) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Text("Failed to load: $message", fontFamily = Karla, fontSize = 13.sp, color = GigColors.danger)
    }
}

// ─── New Song Idea Dialog (D-138) ────────────────────────────────────────────

@Composable
private fun NewIdeaDialog(onDismiss: () -> Unit, onCreate: (String) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = GigColors.surface,
        title = {
            Text("New Song Idea", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = GigColors.text)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Name your idea, then record immediately.", fontFamily = Karla, fontSize = 12.sp, color = GigColors.textMuted)
                BasicTextField(
                    value = name,
                    onValueChange = { name = it },
                    singleLine = true,
                    textStyle = TextStyle(fontFamily = Karla, fontSize = 14.sp, color = GigColors.text),
                    cursorBrush = SolidColor(GigColors.danger),
                    decorationBox = { inner ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(GigColors.surfaceInset)
                                .border(1.dp, GigColors.neuBorder, RoundedCornerShape(8.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                        ) {
                            if (name.isEmpty()) {
                                Text("Song name…", fontFamily = Karla, fontSize = 14.sp, color = GigColors.textMuted)
                            }
                            inner()
                        }
                    },
                )
            }
        },
        confirmButton = {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (name.isNotBlank()) GigColors.danger.copy(alpha = 0.15f) else Color.Transparent)
                    .border(1.dp, if (name.isNotBlank()) GigColors.danger.copy(alpha = 0.3f) else GigColors.textMuted.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                    .clickable(enabled = name.isNotBlank()) { onCreate(name.trim()) }
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            ) {
                Text("Create & Record", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = if (name.isNotBlank()) GigColors.danger else GigColors.textMuted)
            }
        },
        dismissButton = {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = onDismiss)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            ) {
                Text("Cancel", fontFamily = Karla, fontSize = 13.sp, color = GigColors.textMuted)
            }
        },
    )
}
