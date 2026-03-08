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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import kotlinx.coroutines.launch

enum class LibraryTab { Songs, Setlists }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    vm: AppViewModel,
    onMenuClick: () -> Unit,
    onLaunchLive: (Song) -> Unit,
    onLaunchPractice: (Song) -> Unit,
    onLaunchSetlistLive: (SetlistWithSongs) -> Unit,
) {
    var activeTab by rememberSaveable { mutableStateOf(LibraryTab.Songs) }
    var sheetSong by remember { mutableStateOf<Song?>(null) }
    val sheetState = rememberModalBottomSheetState()
    val scope      = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize().background(GigColors.background)) {
        LibraryHeader(activeTab = activeTab, onTabChange = { activeTab = it }, onMenuClick = onMenuClick)

        when {
            vm.loadError != null -> ErrorState(vm.loadError!!)
            vm.isLoading         -> LoadingState()
            else -> when (activeTab) {
                LibraryTab.Songs    -> SongsTab(songs = vm.songs, onSongTap = { sheetSong = it })
                LibraryTab.Setlists -> SetlistsTab(setlists = vm.setlists, onLaunchLive = onLaunchSetlistLive)
            }
        }
    }

    // Song action sheet
    val song = sheetSong
    if (song != null) {
        ModalBottomSheet(
            onDismissRequest = { sheetSong = null },
            sheetState       = sheetState,
            containerColor   = GigColors.surface,
            contentColor     = GigColors.text,
        ) {
            SongActionSheet(
                song       = song,
                onLive     = { scope.launch { sheetState.hide() }.invokeOnCompletion { sheetSong = null; onLaunchLive(song) } },
                onPractice = { scope.launch { sheetState.hide() }.invokeOnCompletion { sheetSong = null; onLaunchPractice(song) } },
            )
        }
    }
}

// ─── Header ──────────────────────────────────────────────────────────────────

@Composable
private fun LibraryHeader(
    activeTab: LibraryTab,
    onTabChange: (LibraryTab) -> Unit,
    onMenuClick: () -> Unit,
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

// ─── Songs Tab ───────────────────────────────────────────────────────────────

@Composable
private fun SongsTab(songs: List<Song>, onSongTap: (Song) -> Unit) {
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
                    SongCard(song = song, onClick = { onSongTap(song) })
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun SongCard(song: Song, onClick: () -> Unit) {
    NeuCard(modifier = Modifier.padding(horizontal = 12.dp).clickable(onClick = onClick)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(song.name, fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = GigColors.text)
                if (song.artist.isNotBlank()) {
                    Text(song.artist, fontFamily = Karla, fontSize = 12.sp, color = GigColors.textDim)
                }
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    MetaBadge("${song.bpm.toInt()} BPM", GigColors.orange)
                    if (song.key.isNotBlank()) MetaBadge(song.key, GigColors.teal)
                    MetaBadge(song.timeSig, GigColors.textMuted)
                    song.durationFormatted?.let { MetaBadge(it, GigColors.textMuted) }
                }
            }
            if (song.hasAudio) {
                Spacer(Modifier.width(8.dp))
                Icon(Icons.Default.Headphones, contentDescription = "Has audio", tint = GigColors.green, modifier = Modifier.size(18.dp))
            }
        }
    }
}

// ─── Setlists Tab ────────────────────────────────────────────────────────────

@Composable
private fun SetlistsTab(setlists: List<SetlistWithSongs>, onLaunchLive: (SetlistWithSongs) -> Unit) {
    if (setlists.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No setlists yet", fontFamily = Karla, fontSize = 14.sp, color = GigColors.textMuted)
        }
        return
    }
    LazyColumn(modifier = Modifier.fillMaxSize()) {
        item { Spacer(Modifier.height(12.dp)) }
        items(setlists, key = { it.setlist.id }) { s ->
            SetlistCard(setlistWithSongs = s, onLaunchLive = { onLaunchLive(s) })
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun SetlistCard(setlistWithSongs: SetlistWithSongs, onLaunchLive: () -> Unit) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val setlist = setlistWithSongs.setlist

    NeuCard(modifier = Modifier.padding(horizontal = 12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(setlist.name, fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = GigColors.text)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    MetaBadge("${setlistWithSongs.songCount} songs", GigColors.orange)
                    setlistWithSongs.totalDurationFormatted?.let { MetaBadge(it, GigColors.textMuted) }
                }
            }
            IconButton(onClick = onLaunchLive, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Default.PlayCircle, contentDescription = "Launch Live", tint = GigColors.green, modifier = Modifier.size(22.dp))
            }
            Icon(
                if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = null, tint = GigColors.textDim, modifier = Modifier.size(20.dp),
            )
        }

        if (expanded && setlistWithSongs.songs.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.15f))
            Spacer(Modifier.height(6.dp))
            setlistWithSongs.songs.forEachIndexed { index, row ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("${index + 1}", fontFamily = JetBrainsMono, fontSize = 11.sp,
                        color = GigColors.textMuted, modifier = Modifier.width(20.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(row.songs?.name ?: "", fontFamily = Karla, fontWeight = FontWeight.Medium,
                            fontSize = 13.sp, color = GigColors.text)
                        val artist = row.songs?.artist ?: ""
                        if (artist.isNotBlank()) Text(artist, fontFamily = Karla, fontSize = 11.sp, color = GigColors.textDim)
                    }
                    Text("${row.songs?.bpm?.toInt() ?: ""}", fontFamily = JetBrainsMono, fontSize = 12.sp, color = GigColors.orange)
                    if (row.songs?.hasAudio == true) {
                        Spacer(Modifier.width(6.dp))
                        Icon(Icons.Default.Headphones, contentDescription = null, tint = GigColors.green, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
    }
}

// ─── Song action sheet ────────────────────────────────────────────────────────

@Composable
private fun SongActionSheet(song: Song, onLive: () -> Unit, onPractice: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(GigColors.surface)
            .padding(horizontal = 20.dp, vertical = 8.dp)
            .navigationBarsPadding(),
    ) {
        Text(song.name, fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = GigColors.text)
        if (song.artist.isNotBlank()) {
            Text(song.artist, fontFamily = Karla, fontSize = 13.sp, color = GigColors.textDim)
        }
        Spacer(Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            MetaBadge("${song.bpm.toInt()} BPM", GigColors.orange)
            if (song.key.isNotBlank()) MetaBadge(song.key, GigColors.teal)
            MetaBadge(song.timeSig, GigColors.textMuted)
        }
        Spacer(Modifier.height(16.dp))
        HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.15f))
        Spacer(Modifier.height(12.dp))

        SheetAction(
            icon = Icons.Default.GraphicEq, label = "Launch in Live Mode",
            sub = "Click track · setlist view",
            color = GigColors.green, onClick = onLive,
        )
        Spacer(Modifier.height(8.dp))
        SheetAction(
            icon = Icons.Default.Headphones, label = "Open in Practice",
            sub = "Speed · A-B loop · beat nudge",
            color = GigColors.purple, onClick = onPractice,
        )
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun SheetAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String, sub: String, color: Color, onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(color.copy(alpha = 0.07f), RoundedCornerShape(12.dp))
            .border(0.5.dp, color.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(12.dp))
        Column {
            Text(label, fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                style = TextStyle(color = color, shadow = Shadow(color.copy(0.35f), Offset.Zero, 6f)))
            Text(sub, fontFamily = Karla, fontSize = 11.sp, color = GigColors.textMuted)
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
