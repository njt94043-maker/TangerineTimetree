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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Videocam
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
import com.thegreentangerine.gigbooks.ui.screens.GigModeScreen
import com.thegreentangerine.gigbooks.ui.screens.PeerScreen
import com.thegreentangerine.gigbooks.ui.screens.RecordingsScreen
import com.thegreentangerine.gigbooks.ui.screens.SettingsScreen
import com.thegreentangerine.gigbooks.ui.screens.SplashScreen
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import kotlinx.coroutines.launch

/**
 * Top-level navigation. Per S118 / S121 the APK is just:
 *   Calendar / Gig Mode / Peer / Settings.
 * Library / Live / Practice / View / SongForm / XR18Camera all retired with
 * the kill-Songs work — Media Server PWA + Studio v2 own those flows now.
 */
sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    data object Splash     : Screen("splash",     "Splash",        Icons.Default.CalendarMonth)
    data object Calendar   : Screen("calendar",   "Calendar",      Icons.Default.CalendarMonth)
    data object GigMode    : Screen("gig-mode",   "Gig Mode",      Icons.Default.MusicNote)
    data object Peer       : Screen("peer",       "Peer (camera)", Icons.Default.Videocam)
    data object Recordings : Screen("recordings", "Recordings",    Icons.Default.FolderOpen)
    data object Settings   : Screen("settings",   "Settings",      Icons.Default.Settings)
}

@Composable
fun TangerineMediaApp() {
    val vm: AppViewModel = viewModel()
    val startDest = if (vm.splashDone) Screen.Calendar.route else Screen.Splash.route
    val navController = rememberNavController()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val currentEntry by navController.currentBackStackEntryAsState()
    val currentRoute = currentEntry?.destination?.route ?: Screen.Calendar.route

    fun navigate(route: String) {
        navController.navigate(route) {
            popUpTo(Screen.Calendar.route) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
        scope.launch { drawerState.close() }
    }

    val openMenu = { scope.launch { drawerState.open() } }

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = currentRoute != Screen.Splash.route,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = TangerineColors.surface,
                drawerContentColor = TangerineColors.text,
                modifier = Modifier.width(268.dp),
            ) {
                DrawerHeader()
                HorizontalDivider(color = TangerineColors.textMuted.copy(alpha = 0.25f), modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(8.dp))

                DrawerSectionLabel("CALENDAR")
                DrawerNavItem(Screen.Calendar, currentRoute == Screen.Calendar.route, TangerineColors.orange) { navigate(Screen.Calendar.route) }

                Spacer(Modifier.height(4.dp))
                HorizontalDivider(color = TangerineColors.textMuted.copy(alpha = 0.15f), modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(4.dp))

                DrawerSectionLabel("GIG")
                DrawerNavItem(Screen.GigMode, currentRoute == Screen.GigMode.route, TangerineColors.orange) { navigate(Screen.GigMode.route) }
                DrawerNavItem(Screen.Peer, currentRoute == Screen.Peer.route, TangerineColors.green) { navigate(Screen.Peer.route) }
                DrawerNavItem(Screen.Recordings, currentRoute == Screen.Recordings.route, TangerineColors.teal) { navigate(Screen.Recordings.route) }

                Spacer(Modifier.weight(1f))
                HorizontalDivider(color = TangerineColors.textMuted.copy(alpha = 0.15f), modifier = Modifier.padding(horizontal = 16.dp))
                DrawerNavItem(Screen.Settings, currentRoute == Screen.Settings.route, TangerineColors.textDim) { navigate(Screen.Settings.route) }
                DrawerUserFooter()
            }
        },
    ) {
        NavHost(
            navController = navController,
            startDestination = startDest,
            modifier = Modifier.fillMaxSize().systemBarsPadding().background(TangerineColors.background),
        ) {
            composable(Screen.Splash.route) {
                SplashScreen(onFinished = {
                    vm.splashDone = true
                    navController.navigate(Screen.Calendar.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                })
            }
            composable(Screen.Calendar.route) {
                CalendarScreen(vm = vm, onMenuClick = { openMenu() })
            }
            composable(Screen.GigMode.route) {
                GigModeScreen(onMenuClick = { openMenu() })
            }
            composable(Screen.Peer.route) {
                PeerScreen(onMenuClick = { openMenu() })
            }
            composable(Screen.Recordings.route) {
                RecordingsScreen(onMenuClick = { openMenu() })
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
        modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp).clip(CircleShape)
                .background(TangerineColors.orange.copy(alpha = 0.15f))
                .border(1.5.dp, TangerineColors.orange.copy(alpha = 0.6f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "T", fontFamily = Karla, fontWeight = FontWeight.Bold,
                fontSize = 18.sp, color = TangerineColors.orange, textAlign = TextAlign.Center,
                style = TextStyle(shadow = androidx.compose.ui.graphics.Shadow(TangerineColors.orange.copy(0.7f), Offset.Zero, 12f)),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Row {
                Text("Gig", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    style = TextStyle(color = TangerineColors.orange, shadow = androidx.compose.ui.graphics.Shadow(TangerineColors.orange.copy(0.6f), Offset.Zero, 16f)))
                Text("Books", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    style = TextStyle(color = TangerineColors.green, shadow = androidx.compose.ui.graphics.Shadow(TangerineColors.green.copy(0.5f), Offset.Zero, 14f)))
            }
            Text("The Green Tangerine", fontFamily = Karla, fontSize = 10.sp, color = TangerineColors.textMuted, letterSpacing = 0.3.sp)
        }
    }
}

@Composable
private fun DrawerSectionLabel(label: String) {
    Text(
        text = label, fontFamily = Karla, fontWeight = FontWeight.Bold,
        fontSize = 10.sp, letterSpacing = 1.sp, color = TangerineColors.textMuted,
        modifier = Modifier.padding(start = 20.dp, top = 8.dp, bottom = 2.dp),
    )
}

@Composable
private fun DrawerNavItem(screen: Screen, selected: Boolean, accentColor: Color, onClick: () -> Unit) {
    Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 1.dp).height(44.dp)) {
        if (selected) {
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .height(36.dp)
                    .background(accentColor, RoundedCornerShape(1.5.dp))
                    .align(Alignment.CenterVertically),
            )
        }
        NavigationDrawerItem(
            icon = {
                Box(modifier = if (selected) Modifier.glowBehind(accentColor, radius = 28.dp, alpha = 0.35f) else Modifier) {
                    Icon(screen.icon, contentDescription = screen.label,
                        tint = if (selected) accentColor else TangerineColors.textDim, modifier = Modifier.size(20.dp))
                }
            },
            label = {
                Text(
                    screen.label, fontFamily = Karla, fontSize = 14.sp,
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                    style = if (selected) TextStyle(
                        color = TangerineColors.text,
                        shadow = androidx.compose.ui.graphics.Shadow(accentColor.copy(alpha = 0.3f), Offset.Zero, 8f),
                    ) else TextStyle(color = TangerineColors.textDim),
                )
            },
            selected = selected, onClick = onClick,
            colors = NavigationDrawerItemDefaults.colors(
                selectedContainerColor = accentColor.copy(alpha = 0.08f),
                unselectedContainerColor = Color.Transparent,
            ),
            modifier = Modifier.weight(1f),
        )
    }
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
                .background(TangerineColors.green.copy(alpha = 0.08f))
                .border(1.5.dp, TangerineColors.green.copy(alpha = 0.5f), CircleShape)
                .drawBehind {
                    drawCircle(
                        brush = androidx.compose.ui.graphics.Brush.radialGradient(
                            colors = listOf(TangerineColors.green.copy(alpha = 0.2f), Color.Transparent),
                            center = center, radius = size.minDimension * 0.8f,
                        ),
                    )
                },
            contentAlignment = Alignment.Center,
        ) {
            Text("N", fontSize = 13.sp, fontWeight = FontWeight.Bold,
                style = TextStyle(color = TangerineColors.green, shadow = androidx.compose.ui.graphics.Shadow(TangerineColors.green.copy(0.6f), Offset.Zero, 10f)))
        }
        Spacer(Modifier.width(10.dp))
        Column {
            Text("Nathan", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = TangerineColors.text)
            Text("Drums", fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted)
        }
    }
}
