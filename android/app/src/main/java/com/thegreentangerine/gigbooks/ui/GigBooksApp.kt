package com.thegreentangerine.gigbooks.ui

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsScore
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.thegreentangerine.gigbooks.ui.screens.CalendarScreen
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlinx.coroutines.launch

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    data object Calendar : Screen("calendar", "Gigs", Icons.Default.CalendarMonth)
    data object Songs : Screen("songs", "Songs", Icons.Default.LibraryMusic)
    data object Setlists : Screen("setlists", "Setlists", Icons.Default.QueueMusic)
    data object Live : Screen("live", "Live Mode", Icons.Default.SportsScore)
    data object Practice : Screen("practice", "Practice", Icons.Default.PlayCircle)
    data object Settings : Screen("settings", "Settings", Icons.Default.Settings)
}

private val managementScreens = listOf(Screen.Calendar, Screen.Songs, Screen.Setlists)
private val performanceScreens = listOf(Screen.Live, Screen.Practice)
private val settingsScreens = listOf(Screen.Settings)

@Composable
fun GigBooksApp() {
    val navController = rememberNavController()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val currentEntry by navController.currentBackStackEntryAsState()
    val currentRoute = currentEntry?.destination?.route ?: Screen.Calendar.route

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = GigColors.surface,
                drawerContentColor = GigColors.text,
                modifier = Modifier.width(260.dp),
            ) {
                // Logo header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // TODO: add logo image
                    Text(
                        text = "GigBooks",
                        fontFamily = Karla,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = GigColors.orange,
                    )
                }

                HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.2f))

                // Management section
                DrawerSectionLabel("MANAGEMENT")
                managementScreens.forEach { screen ->
                    DrawerNavItem(
                        screen = screen,
                        selected = currentRoute == screen.route,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(Screen.Calendar.route) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                            scope.launch { drawerState.close() }
                        },
                    )
                }

                HorizontalDivider(
                    color = GigColors.textMuted.copy(alpha = 0.2f),
                    modifier = Modifier.padding(vertical = 4.dp),
                )

                // Performance section
                DrawerSectionLabel("PERFORMANCE")
                performanceScreens.forEach { screen ->
                    DrawerNavItem(
                        screen = screen,
                        selected = currentRoute == screen.route,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(Screen.Calendar.route) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                            scope.launch { drawerState.close() }
                        },
                    )
                }

                HorizontalDivider(
                    color = GigColors.textMuted.copy(alpha = 0.2f),
                    modifier = Modifier.padding(vertical = 4.dp),
                )

                // Settings
                settingsScreens.forEach { screen ->
                    DrawerNavItem(
                        screen = screen,
                        selected = currentRoute == screen.route,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(Screen.Calendar.route) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                            scope.launch { drawerState.close() }
                        },
                    )
                }

                Spacer(Modifier.weight(1f))

                // User avatar footer
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(GigColors.surface)
                            // TODO: green border
                        ,
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("N", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GigColors.green)
                    }
                    Spacer(Modifier.width(8.dp))
                    Text("Nathan", fontSize = 12.sp, color = GigColors.textDim)
                }
            }
        },
    ) {
        NavHost(
            navController = navController,
            startDestination = Screen.Calendar.route,
            modifier = Modifier
                .fillMaxSize()
                .background(GigColors.background),
        ) {
            composable(Screen.Calendar.route) {
                CalendarScreen(onMenuClick = { scope.launch { drawerState.open() } })
            }
            composable(Screen.Songs.route) {
                PlaceholderScreen("Songs", onMenuClick = { scope.launch { drawerState.open() } })
            }
            composable(Screen.Setlists.route) {
                PlaceholderScreen("Setlists", onMenuClick = { scope.launch { drawerState.open() } })
            }
            composable(Screen.Live.route) {
                PlaceholderScreen("Live Mode", onMenuClick = { scope.launch { drawerState.open() } })
            }
            composable(Screen.Practice.route) {
                PlaceholderScreen("Practice", onMenuClick = { scope.launch { drawerState.open() } })
            }
            composable(Screen.Settings.route) {
                PlaceholderScreen("Settings", onMenuClick = { scope.launch { drawerState.open() } })
            }
        }
    }
}

@Composable
private fun DrawerSectionLabel(label: String) {
    Text(
        text = label,
        fontFamily = Karla,
        fontWeight = FontWeight.Bold,
        fontSize = 10.sp,
        letterSpacing = 0.5.sp,
        color = GigColors.textMuted,
        modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 4.dp),
    )
}

@Composable
private fun DrawerNavItem(screen: Screen, selected: Boolean, onClick: () -> Unit) {
    NavigationDrawerItem(
        icon = {
            Icon(
                screen.icon,
                contentDescription = screen.label,
                tint = if (selected) GigColors.orange else GigColors.textDim,
                modifier = Modifier.size(20.dp),
            )
        },
        label = {
            Text(
                screen.label,
                fontFamily = Karla,
                fontSize = 13.sp,
                color = if (selected) GigColors.text else GigColors.textDim,
            )
        },
        selected = selected,
        onClick = onClick,
        colors = NavigationDrawerItemDefaults.colors(
            selectedContainerColor = GigColors.orange.copy(alpha = 0.1f),
            unselectedContainerColor = GigColors.surface,
        ),
        modifier = Modifier
            .padding(horizontal = 8.dp)
            .height(40.dp),
    )
}

@Composable
fun PlaceholderScreen(title: String, onMenuClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GigColors.background)
            .padding(16.dp),
    ) {
        Text(
            text = title,
            fontFamily = Karla,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = GigColors.text,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "Coming soon...",
            color = GigColors.textDim,
        )
    }
}
