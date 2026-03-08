package com.thegreentangerine.gigbooks.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.thegreentangerine.gigbooks.ui.components.glowBehind
import com.thegreentangerine.gigbooks.ui.screens.CalendarScreen
import com.thegreentangerine.gigbooks.ui.screens.LibraryScreen
import com.thegreentangerine.gigbooks.ui.screens.LiveScreen
import com.thegreentangerine.gigbooks.ui.screens.PracticeScreen
import com.thegreentangerine.gigbooks.ui.screens.SettingsScreen
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlinx.coroutines.launch

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    data object Calendar : Screen("calendar", "Calendar",         Icons.Default.CalendarMonth)
    data object Library  : Screen("library",  "Songs & Setlists", Icons.AutoMirrored.Filled.QueueMusic)
    data object Live     : Screen("live",     "Live Mode",        Icons.Default.GraphicEq)
    data object Practice : Screen("practice", "Practice",         Icons.Default.Headphones)
    data object Settings : Screen("settings", "Settings",         Icons.Default.Settings)
}

private val performanceScreens = listOf(Screen.Live, Screen.Practice)

@Composable
fun GigBooksApp() {
    val vm: AppViewModel    = viewModel()
    val navController       = rememberNavController()
    val drawerState         = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope               = rememberCoroutineScope()
    val currentEntry by navController.currentBackStackEntryAsState()
    val currentRoute  = currentEntry?.destination?.route ?: Screen.Calendar.route

    fun navigate(route: String) {
        navController.navigate(route) {
            popUpTo(Screen.Calendar.route) { saveState = true }
            launchSingleTop = true
            restoreState    = true
        }
        scope.launch { drawerState.close() }
    }

    val openMenu = { scope.launch { drawerState.open() } }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = GigColors.surface,
                drawerContentColor   = GigColors.text,
                modifier             = Modifier.width(268.dp),
            ) {
                DrawerHeader()
                HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.25f), modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(8.dp))

                DrawerNavItem(Screen.Calendar, currentRoute == Screen.Calendar.route, GigColors.orange) { navigate(Screen.Calendar.route) }

                Spacer(Modifier.height(4.dp))
                HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.15f), modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(4.dp))

                DrawerSectionLabel("LIBRARY")
                DrawerNavItem(Screen.Library, currentRoute == Screen.Library.route, GigColors.teal) { navigate(Screen.Library.route) }

                Spacer(Modifier.height(4.dp))
                HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.15f), modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(4.dp))

                DrawerSectionLabel("PERFORMANCE")
                performanceScreens.forEach { screen ->
                    val accent = if (screen == Screen.Live) GigColors.green else GigColors.purple
                    DrawerNavItem(screen, currentRoute == screen.route, accent) { navigate(screen.route) }
                }

                Spacer(Modifier.weight(1f))
                HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.15f), modifier = Modifier.padding(horizontal = 16.dp))
                DrawerNavItem(Screen.Settings, currentRoute == Screen.Settings.route, GigColors.textDim) { navigate(Screen.Settings.route) }
                DrawerUserFooter()
            }
        },
    ) {
        NavHost(
            navController    = navController,
            startDestination = Screen.Calendar.route,
            modifier = Modifier.fillMaxSize().background(GigColors.background),
        ) {
            composable(Screen.Calendar.route) {
                CalendarScreen(vm = vm, onMenuClick = { openMenu() })
            }
            composable(Screen.Library.route) {
                LibraryScreen(
                    vm          = vm,
                    onMenuClick = { openMenu() },
                    onLaunchLive = { song ->
                        vm.selectSong(song)
                        navigate(Screen.Live.route)
                    },
                    onLaunchPractice = { song ->
                        vm.selectSong(song)
                        navigate(Screen.Practice.route)
                    },
                    onLaunchSetlistLive = { setlist ->
                        vm.selectSetlist(setlist)
                        navigate(Screen.Live.route)
                    },
                )
            }
            composable(Screen.Live.route) {
                LiveScreen(
                    vm            = vm,
                    onMenuClick   = { openMenu() },
                    onGoToLibrary = { navigate(Screen.Library.route) },
                )
            }
            composable(Screen.Practice.route) {
                PracticeScreen(
                    vm            = vm,
                    onMenuClick   = { openMenu() },
                    onGoToLibrary = { navigate(Screen.Library.route) },
                )
            }
            composable(Screen.Settings.route) {
                SettingsScreen(vm = vm, onMenuClick = { openMenu() })
            }
        }
    }
}

// ─── Drawer components ────────────────────────────────────────────────────────

@Composable
private fun DrawerHeader() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp).clip(CircleShape)
                .background(GigColors.orange.copy(alpha = 0.15f))
                .border(1.5.dp, GigColors.orange.copy(alpha = 0.6f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "T", fontFamily = Karla, fontWeight = FontWeight.Bold,
                fontSize = 18.sp, color = GigColors.orange, textAlign = TextAlign.Center,
                style = TextStyle(shadow = androidx.compose.ui.graphics.Shadow(GigColors.orange.copy(0.7f), Offset.Zero, 12f)),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Row {
                Text("Gig",   fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    style = TextStyle(color = GigColors.orange, shadow = androidx.compose.ui.graphics.Shadow(GigColors.orange.copy(0.6f), Offset.Zero, 16f)))
                Text("Books", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    style = TextStyle(color = GigColors.green,  shadow = androidx.compose.ui.graphics.Shadow(GigColors.green.copy(0.5f),  Offset.Zero, 14f)))
            }
            Text("The Green Tangerine", fontFamily = Karla, fontSize = 10.sp, color = GigColors.textMuted, letterSpacing = 0.3.sp)
        }
    }
}

@Composable
private fun DrawerSectionLabel(label: String) {
    Text(
        text = label, fontFamily = Karla, fontWeight = FontWeight.Bold,
        fontSize = 10.sp, letterSpacing = 1.sp, color = GigColors.textMuted,
        modifier = Modifier.padding(start = 20.dp, top = 8.dp, bottom = 2.dp),
    )
}

@Composable
private fun DrawerNavItem(screen: Screen, selected: Boolean, accentColor: Color, onClick: () -> Unit) {
    NavigationDrawerItem(
        icon = {
            Box(modifier = if (selected) Modifier.glowBehind(accentColor, radius = 28.dp, alpha = 0.35f) else Modifier) {
                Icon(screen.icon, contentDescription = screen.label,
                    tint = if (selected) accentColor else GigColors.textDim, modifier = Modifier.size(20.dp))
            }
        },
        label = {
            Text(
                screen.label, fontFamily = Karla, fontSize = 14.sp,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                style = if (selected) TextStyle(
                    color  = GigColors.text,
                    shadow = androidx.compose.ui.graphics.Shadow(accentColor.copy(alpha = 0.3f), Offset.Zero, 8f),
                ) else TextStyle(color = GigColors.textDim),
            )
        },
        selected = selected, onClick = onClick,
        colors = NavigationDrawerItemDefaults.colors(
            selectedContainerColor   = accentColor.copy(alpha = 0.08f),
            unselectedContainerColor = Color.Transparent,
        ),
        modifier = Modifier.padding(horizontal = 8.dp, vertical = 1.dp).height(44.dp),
    )
}

@Composable
private fun DrawerUserFooter() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(32.dp).clip(CircleShape)
                .background(GigColors.green.copy(alpha = 0.08f))
                .border(1.5.dp, GigColors.green.copy(alpha = 0.5f), CircleShape)
                .drawBehind {
                    drawCircle(
                        brush = androidx.compose.ui.graphics.Brush.radialGradient(
                            colors = listOf(GigColors.green.copy(alpha = 0.2f), Color.Transparent),
                            center = center, radius = size.minDimension * 0.8f,
                        ),
                    )
                },
            contentAlignment = Alignment.Center,
        ) {
            Text("N", fontSize = 13.sp, fontWeight = FontWeight.Bold,
                style = TextStyle(color = GigColors.green, shadow = androidx.compose.ui.graphics.Shadow(GigColors.green.copy(0.6f), Offset.Zero, 10f)))
        }
        Spacer(Modifier.width(10.dp))
        Column {
            Text("Nathan", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = GigColors.text)
            Text("Drums",  fontFamily = Karla, fontSize = 11.sp, color = GigColors.textMuted)
        }
    }
}
