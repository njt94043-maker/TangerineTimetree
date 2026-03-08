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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.supabase.SetlistRepository
import com.thegreentangerine.gigbooks.data.supabase.SongRepository
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistWithSongs
import com.thegreentangerine.gigbooks.data.supabase.models.Song
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla

enum class LibraryTab { Songs, Setlists }

@Composable
fun LibraryScreen(onMenuClick: () -> Unit) {
    var activeTab by rememberSaveable { mutableStateOf(LibraryTab.Songs) }
    var songs by rememberSaveable { mutableStateOf<List<Song>?>(null) }
    var setlists by rememberSaveable { mutableStateOf<List<SetlistWithSongs>?>(null) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            songs = SongRepository.getSongs()
            setlists = SetlistRepository.getAllSetlistsWithSongs()
        } catch (e: Exception) {
            error = e.message
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GigColors.background),
    ) {
        LibraryHeader(activeTab = activeTab, onTabChange = { activeTab = it }, onMenuClick = onMenuClick)

        when {
            error != null -> ErrorState(error!!)
            songs == null -> LoadingState()
            else -> when (activeTab) {
                LibraryTab.Songs    -> SongsTab(songs = songs!!)
                LibraryTab.Setlists -> SetlistsTab(setlists = setlists ?: emptyList())
            }
        }
    }
}

// ─── Header ──────────────────────────────────────────────

@Composable
private fun LibraryHeader(
    activeTab: LibraryTab,
    onTabChange: (LibraryTab) -> Unit,
    onMenuClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(GigColors.surface),
    ) {
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
                fontFamily = Karla,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                style = TextStyle(
                    color = GigColors.teal,
                    shadow = androidx.compose.ui.graphics.Shadow(GigColors.teal.copy(alpha = 0.4f), Offset.Zero, 14f),
                ),
            )
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
            val accent = if (tab == LibraryTab.Songs) GigColors.teal else GigColors.orange
            val isFirst = tab == LibraryTab.Songs

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
                        style = if (selected) TextStyle(
                            color = accent,
                            shadow = androidx.compose.ui.graphics.Shadow(accent.copy(alpha = 0.5f), Offset.Zero, 10f),
                        ) else TextStyle(color = GigColors.textDim),
                    )
                    Spacer(Modifier.height(8.dp))
                    // Active underline
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.5f)
                            .height(2.dp)
                            .background(if (selected) accent else Color.Transparent, RoundedCornerShape(1.dp)),
                    )
                }
            }
        }
    }
    HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.2f))
}

// ─── Songs Tab ───────────────────────────────────────────

@Composable
private fun SongsTab(songs: List<Song>) {
    var query by rememberSaveable { mutableStateOf("") }
    val filtered = if (query.isBlank()) songs
    else songs.filter { it.name.contains(query, ignoreCase = true) || it.artist.contains(query, ignoreCase = true) }

    Column(modifier = Modifier.fillMaxSize()) {
        SearchBar(query = query, onQueryChange = { query = it }, placeholder = "Search songs…")

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            item { Spacer(Modifier.height(4.dp)) }
            if (filtered.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No songs found", fontFamily = Karla, fontSize = 14.sp, color = GigColors.textMuted)
                    }
                }
            } else {
                items(filtered, key = { it.id }) { song ->
                    SongCard(song = song, onClick = { /* TODO: open practice/live */ })
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun SongCard(song: Song, onClick: () -> Unit) {
    NeuCard(
        modifier = Modifier
            .padding(horizontal = 12.dp)
            .clickable(onClick = onClick),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = song.name,
                    fontFamily = Karla,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = GigColors.text,
                )
                if (song.artist.isNotBlank()) {
                    Text(
                        text = song.artist,
                        fontFamily = Karla,
                        fontSize = 12.sp,
                        color = GigColors.textDim,
                    )
                }
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    MetaBadge(text = "${song.bpm} BPM", color = GigColors.orange)
                    if (song.key.isNotBlank()) MetaBadge(text = song.key, color = GigColors.teal)
                    MetaBadge(text = song.timeSig, color = GigColors.textMuted)
                    song.durationFormatted?.let { MetaBadge(text = it, color = GigColors.textMuted) }
                }
            }
            if (song.hasAudio) {
                Spacer(Modifier.width(8.dp))
                Icon(
                    Icons.Default.Headphones,
                    contentDescription = "Has audio",
                    tint = GigColors.green,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}

// ─── Setlists Tab ────────────────────────────────────────

@Composable
private fun SetlistsTab(setlists: List<SetlistWithSongs>) {
    if (setlists.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No setlists yet", fontFamily = Karla, fontSize = 14.sp, color = GigColors.textMuted)
        }
        return
    }

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        item { Spacer(Modifier.height(12.dp)) }
        items(setlists, key = { it.setlist.id }) { setlistWithSongs ->
            SetlistCard(setlistWithSongs = setlistWithSongs)
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun SetlistCard(setlistWithSongs: SetlistWithSongs) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val setlist = setlistWithSongs.setlist

    NeuCard(modifier = Modifier.padding(horizontal = 12.dp)) {
        // Header row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = setlist.name,
                    fontFamily = Karla,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = GigColors.text,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    MetaBadge(
                        text = "${setlistWithSongs.songCount} songs",
                        color = GigColors.orange,
                    )
                    setlistWithSongs.totalDurationFormatted?.let {
                        MetaBadge(text = it, color = GigColors.textMuted)
                    }
                }
            }
            Icon(
                if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = if (expanded) "Collapse" else "Expand",
                tint = GigColors.textDim,
                modifier = Modifier.size(20.dp),
            )
        }

        // Expanded song list
        if (expanded && setlistWithSongs.songs.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.15f))
            Spacer(Modifier.height(6.dp))

            setlistWithSongs.songs.forEachIndexed { index, setlistSong ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${index + 1}",
                        fontFamily = JetBrainsMono,
                        fontSize = 11.sp,
                        color = GigColors.textMuted,
                        modifier = Modifier.width(20.dp),
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = setlistSong.songs?.name ?: "",
                            fontFamily = Karla,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp,
                            color = GigColors.text,
                        )
                        val artist = setlistSong.songs?.artist ?: ""
                        if (artist.isNotBlank()) {
                            Text(
                                text = artist,
                                fontFamily = Karla,
                                fontSize = 11.sp,
                                color = GigColors.textDim,
                            )
                        }
                    }
                    Text(
                        text = "${setlistSong.songs?.bpm ?: ""}",
                        fontFamily = JetBrainsMono,
                        fontSize = 12.sp,
                        color = GigColors.orange,
                    )
                    if (setlistSong.songs?.hasAudio == true) {
                        Spacer(Modifier.width(6.dp))
                        Icon(
                            Icons.Default.Headphones,
                            contentDescription = "Has audio",
                            tint = GigColors.green,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
            }
        }
    }
}

// ─── Shared components ───────────────────────────────────

@Composable
private fun SearchBar(query: String, onQueryChange: (String) -> Unit, placeholder: String) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .clip(shape)
            .background(GigColors.surfaceInset)
            .border(1.dp, GigColors.neuBorder, shape)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Search, contentDescription = null, tint = GigColors.textMuted, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.weight(1f),
            textStyle = TextStyle(fontFamily = Karla, fontSize = 14.sp, color = GigColors.text),
            cursorBrush = SolidColor(GigColors.teal),
            singleLine = true,
            decorationBox = { inner ->
                if (query.isEmpty()) {
                    Text(placeholder, fontFamily = Karla, fontSize = 14.sp, color = GigColors.textMuted)
                }
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
        Text(
            text = text,
            fontFamily = JetBrainsMono,
            fontSize = 10.sp,
            color = color,
        )
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
        Text(
            text = "Failed to load: $message",
            fontFamily = Karla,
            fontSize = 13.sp,
            color = GigColors.danger,
        )
    }
}
