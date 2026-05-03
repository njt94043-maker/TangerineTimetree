package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.orchestrator.PeerOrchestratorClient
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors

/**
 * Peer-mode screen for non-drummer phones in the gig camera fleet (S118 A2).
 *
 * Auto-discovers the drummer's orchestrator via mDNS (`_tgt-orchestrator._tcp.`),
 * connects, pairs. Shows discovery + recording state. The peer's [PeerOrchestratorClient]
 * receives StartRec / StopRec broadcasts and surfaces them via state — actual camera
 * recording integration is deferred to a future session (the `onStartRec` callback
 * here just flips the on-screen indicator for now).
 *
 * The same APK runs in either orchestrator OR peer mode depending on which drawer
 * entry the user opens. Picking the right device is on the human, by design — gig
 * setup is an explicit ritual, not auto-elected.
 */
@Composable
fun PeerScreen(onMenuClick: () -> Unit) {
    val context = LocalContext.current
    val client = remember { PeerOrchestratorClient(context) }
    var lastSession by remember { mutableStateOf<String?>(null) }
    var lastRecToggleMs by remember { mutableLongStateOf(0L) }

    DisposableEffect(client) {
        client.onStartRec = { sessionId, _ ->
            lastSession = sessionId
            lastRecToggleMs = System.currentTimeMillis()
        }
        client.onStopRec = {
            lastRecToggleMs = System.currentTimeMillis()
        }
        client.start()
        onDispose { client.shutdown() }
    }

    val state by client.state.collectAsState()
    val discovered by client.discovered.collectAsState()
    val phoneId by client.phoneId.collectAsState()

    val statusText = when (state) {
        PeerOrchestratorClient.State.Idle -> "Idle"
        PeerOrchestratorClient.State.Discovering -> "Searching for orchestrator…"
        PeerOrchestratorClient.State.Connecting -> "Connecting…"
        PeerOrchestratorClient.State.Paired -> "Paired — standing by"
        PeerOrchestratorClient.State.Recording -> "Recording"
    }
    val statusColor = when (state) {
        PeerOrchestratorClient.State.Recording -> TangerineColors.danger
        PeerOrchestratorClient.State.Paired -> TangerineColors.green
        PeerOrchestratorClient.State.Connecting -> TangerineColors.orange
        else -> TangerineColors.textMuted
    }

    Column(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, "Menu", tint = TangerineColors.text)
            }
            Spacer(Modifier.width(4.dp))
            Text(
                "Peer camera",
                fontFamily = Karla,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                color = TangerineColors.text,
            )
        }

        Column(
            modifier = Modifier.padding(horizontal = 20.dp).fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(TangerineColors.surface)
                    .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(statusColor))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Orchestrator",
                        fontFamily = Karla,
                        fontWeight = FontWeight.SemiBold,
                        color = TangerineColors.text,
                    )
                }
                Text(
                    discovered?.let { "Found: ${it.name} → ${it.host}:${it.port}" }
                        ?: "Not yet discovered",
                    fontFamily = Karla,
                    color = TangerineColors.textMuted,
                    fontSize = 13.sp,
                )
                Text(
                    statusText,
                    fontFamily = Karla,
                    color = TangerineColors.textMuted,
                    fontSize = 13.sp,
                )
                phoneId?.let {
                    Text(
                        "Phone ID: $it",
                        fontFamily = Karla,
                        color = TangerineColors.textMuted.copy(alpha = 0.7f),
                        fontSize = 12.sp,
                    )
                }
            }

            Box(
                modifier = Modifier.fillMaxWidth().height(220.dp),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(180.dp)
                        .clip(CircleShape)
                        .background(statusColor.copy(alpha = 0.15f))
                        .border(3.dp, statusColor, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = if (state == PeerOrchestratorClient.State.Recording) Icons.Default.FiberManualRecord else Icons.Default.Stop,
                        contentDescription = statusText,
                        tint = statusColor,
                        modifier = Modifier.size(72.dp),
                    )
                }
            }

            Text(
                statusText,
                fontFamily = Karla,
                color = TangerineColors.textMuted,
                modifier = Modifier.fillMaxWidth(),
            )

            lastSession?.let {
                Text(
                    "Last session: $it",
                    fontFamily = Karla,
                    color = TangerineColors.textMuted.copy(alpha = 0.7f),
                    fontSize = 11.sp,
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(
                "Camera capture is wired in a future session — this screen proves the orchestrator → peer fanout end-to-end.",
                fontFamily = Karla,
                color = TangerineColors.textMuted.copy(alpha = 0.6f),
                fontSize = 11.sp,
            )
        }
    }
}
