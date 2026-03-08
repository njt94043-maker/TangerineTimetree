package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.supabase.AuthRepository
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(vm: AppViewModel, onMenuClick: () -> Unit) {
    val scope   = rememberCoroutineScope()
    var signing by remember { mutableStateOf(false) }
    val email   = remember { AuthRepository.currentUserEmail() ?: "—" }

    Column(Modifier.fillMaxSize().background(GigColors.background)) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(GigColors.surface)
                .padding(top = 48.dp, start = 8.dp, end = 16.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, contentDescription = "Menu", tint = GigColors.textDim, modifier = Modifier.size(22.dp))
            }
            Text(
                text = "Settings",
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                style = TextStyle(color = GigColors.textDim, shadow = Shadow(GigColors.textDim.copy(alpha = 0.3f), Offset.Zero, 10f)),
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(12.dp))

            // Account
            NeuCard {
                Text("Account", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
                    color = GigColors.textMuted, letterSpacing = 0.5.sp)
                Spacer(Modifier.height(6.dp))
                Text("Nathan · Drums", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
                    style = TextStyle(color = GigColors.green, shadow = Shadow(GigColors.green.copy(0.35f), Offset.Zero, 8f)))
                Text(email, fontFamily = JetBrainsMono, fontSize = 12.sp, color = GigColors.textDim)
            }

            // Audio engine status
            NeuCard {
                Text("Audio Engine", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
                    color = GigColors.textMuted, letterSpacing = 0.5.sp)
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(
                                if (vm.engineAvailable) GigColors.green else GigColors.danger,
                                RoundedCornerShape(4.dp),
                            ),
                    )
                    Spacer(Modifier.size(8.dp))
                    Text(
                        if (vm.engineAvailable) "Running — Oboe (C++ / NDK)" else "Unavailable on this device",
                        fontFamily = Karla, fontSize = 13.sp,
                        color = if (vm.engineAvailable) GigColors.text else GigColors.danger,
                    )
                }
            }

            // About
            NeuCard {
                Text("About", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
                    color = GigColors.textMuted, letterSpacing = 0.5.sp)
                Spacer(Modifier.height(6.dp))
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("GigBooks", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 15.sp,
                        style = TextStyle(color = GigColors.orange, shadow = Shadow(GigColors.orange.copy(0.4f), Offset.Zero, 8f)),
                        modifier = Modifier.weight(1f))
                    Text("v1.0.0", fontFamily = JetBrainsMono, fontSize = 11.sp, color = GigColors.textMuted)
                }
                Text("The Green Tangerine", fontFamily = Karla, fontSize = 12.sp, color = GigColors.textDim)
            }

            Spacer(Modifier.weight(1f))
            Spacer(Modifier.height(32.dp))

            // Sign out
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .background(GigColors.danger.copy(alpha = 0.08f), RoundedCornerShape(12.dp))
                    .border(0.5.dp, GigColors.danger.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                    .clickable(enabled = !signing) {
                        scope.launch {
                            signing = true
                            try { AuthRepository.signOut() } catch (_: Exception) { signing = false }
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                if (signing) {
                    CircularProgressIndicator(color = GigColors.danger, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                } else {
                    Text("Sign Out", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                        color = GigColors.danger)
                }
            }

            Spacer(Modifier.height(32.dp))
        }
    }
}
