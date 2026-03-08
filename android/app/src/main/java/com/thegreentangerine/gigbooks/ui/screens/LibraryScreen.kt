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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.Karla

enum class LibraryTab { Songs, Setlists }

@Composable
fun LibraryScreen(onMenuClick: () -> Unit) {
    var activeTab by rememberSaveable { mutableStateOf(LibraryTab.Songs) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GigColors.background),
    ) {
        // Header
        LibraryHeader(activeTab = activeTab, onTabChange = { activeTab = it }, onMenuClick = onMenuClick)

        // Content
        when (activeTab) {
            LibraryTab.Songs    -> SongsTab()
            LibraryTab.Setlists -> SetlistsTab()
        }
    }
}

@Composable
private fun LibraryHeader(
    activeTab: LibraryTab,
    onTabChange: (LibraryTab) -> Unit,
    onMenuClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(GigColors.surface)
            .padding(top = 48.dp, bottom = 0.dp),
    ) {
        // Top row: hamburger + title
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(
                    Icons.Default.Menu,
                    contentDescription = "Menu",
                    tint = GigColors.textDim,
                    modifier = Modifier.size(22.dp),
                )
            }
            Text(
                text = "Library",
                fontFamily = Karla,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                style = TextStyle(
                    color = GigColors.teal,
                    shadow = androidx.compose.ui.graphics.Shadow(
                        color = GigColors.teal.copy(alpha = 0.4f),
                        offset = Offset.Zero,
                        blurRadius = 14f,
                    ),
                ),
            )
        }

        Spacer(Modifier.height(12.dp))

        // Tab toggle
        LibraryTabBar(activeTab = activeTab, onTabChange = onTabChange)
    }
}

@Composable
private fun LibraryTabBar(activeTab: LibraryTab, onTabChange: (LibraryTab) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        LibraryTab.entries.forEach { tab ->
            val selected = activeTab == tab
            val accent = if (tab == LibraryTab.Songs) GigColors.teal else GigColors.orange

            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(if (tab == LibraryTab.Songs) RoundedCornerShape(topStart = 8.dp, bottomStart = 0.dp, topEnd = 0.dp, bottomEnd = 0.dp)
                    else RoundedCornerShape(topStart = 0.dp, bottomStart = 0.dp, topEnd = 8.dp, bottomEnd = 0.dp))
                    .background(
                        if (selected) accent.copy(alpha = 0.12f)
                        else GigColors.surfaceInset.copy(alpha = 0.5f)
                    )
                    .then(
                        if (selected) Modifier.border(
                            width = 1.dp,
                            color = accent.copy(alpha = 0.4f),
                            shape = if (tab == LibraryTab.Songs) RoundedCornerShape(topStart = 8.dp, topEnd = 0.dp)
                            else RoundedCornerShape(topStart = 0.dp, topEnd = 8.dp),
                        ) else Modifier
                    )
                    .clickable { onTabChange(tab) }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = tab.name,
                    fontFamily = Karla,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                    fontSize = 13.sp,
                    style = if (selected) TextStyle(
                        color = accent,
                        shadow = androidx.compose.ui.graphics.Shadow(
                            color = accent.copy(alpha = 0.5f),
                            offset = Offset.Zero,
                            blurRadius = 10f,
                        ),
                    ) else TextStyle(color = GigColors.textDim),
                )
            }
        }
    }
}

@Composable
private fun SongsTab() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(40.dp))
        Text(
            text = "🎵",
            fontSize = 40.sp,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            text = "Song library coming soon",
            fontFamily = Karla,
            fontSize = 15.sp,
            color = GigColors.textMuted,
        )
    }
}

@Composable
private fun SetlistsTab() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(40.dp))
        Text(
            text = "🎶",
            fontSize = 40.sp,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            text = "Setlists coming soon",
            fontFamily = Karla,
            fontSize = 15.sp,
            color = GigColors.textMuted,
        )
    }
}
