package com.thegreentangerine.gigbooks.ui.screens

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorService
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors

/**
 * Orchestrator screen — drummer's gig-time controller (S118 A1).
 *
 * Default mode: auto-discovers the E6330 Reaper appliance via mDNS (`_osc._udp.`,
 * advertised by avahi as "TGT Reaper"). Works on home WiFi or S23 hotspot — no
 * config to change between locations.
 *
 * Manual override toggle exists for diagnostics if discovery is failing.
 */
@Composable
fun OrchestratorScreen(onMenuClick: () -> Unit) {
    val context = LocalContext.current
    var service by remember { mutableStateOf<OrchestratorService?>(null) }

    DisposableEffect(Unit) {
        val intent = Intent(context, OrchestratorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        val conn = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
                service = (binder as? OrchestratorService.LocalBinder)?.service
            }
            override fun onServiceDisconnected(name: ComponentName?) {
                service = null
            }
        }
        context.bindService(intent, conn, Context.BIND_AUTO_CREATE)
        onDispose { runCatching { context.unbindService(conn) } }
    }

    val isRecording = service?.isRecording?.collectAsState()?.value ?: false
    val lastSendOk = service?.osc?.lastSendOk?.collectAsState()?.value
    val peerCount = service?.peerCount?.collectAsState()?.value ?: 0
    val discovered = service?.discoveryFlow?.collectAsState()?.value
    val isSearching = service?.isSearching?.collectAsState()?.value ?: false
    val autoDiscover = service?.autoDiscover?.collectAsState()?.value ?: true
    val target = service?.osc?.target?.collectAsState()?.value

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
                "Orchestrator",
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
            ReaperConnectionCard(
                discovered = discovered,
                isSearching = isSearching,
                target = target,
                lastSendOk = lastSendOk,
                autoDiscover = autoDiscover,
                onAutoDiscoverChange = { service?.setAutoDiscover(it) },
                onManualHostChange = { host, port -> service?.osc?.setTarget(host, port) },
            )

            Box(
                modifier = Modifier.fillMaxWidth().height(220.dp),
                contentAlignment = Alignment.Center,
            ) {
                val color = if (isRecording) TangerineColors.danger else TangerineColors.orange
                Box(
                    modifier = Modifier
                        .size(180.dp)
                        .clip(CircleShape)
                        .background(color.copy(alpha = 0.15f))
                        .border(3.dp, color, CircleShape)
                        .clickable(enabled = target != null) {
                            if (isRecording) service?.stopRecording() else service?.startRecording()
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = if (isRecording) Icons.Default.Stop else Icons.Default.FiberManualRecord,
                        contentDescription = if (isRecording) "Stop" else "Record",
                        tint = color,
                        modifier = Modifier.size(72.dp),
                    )
                }
            }

            Text(
                when {
                    target == null -> "Searching for Reaper..."
                    isRecording -> "Reaper recording"
                    else -> "Tap to record"
                },
                color = TangerineColors.textMuted,
                fontFamily = Karla,
                modifier = Modifier.fillMaxWidth(),
            )

            PeerCountCard(peerCount = peerCount)
        }
    }
}

@Composable
private fun ReaperConnectionCard(
    discovered: com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorDiscovery.Discovered?,
    isSearching: Boolean,
    target: com.thegreentangerine.gigbooks.data.orchestrator.ReaperOscClient.Target?,
    lastSendOk: Boolean?,
    autoDiscover: Boolean,
    onAutoDiscoverChange: (Boolean) -> Unit,
    onManualHostChange: (String, Int) -> Unit,
) {
    val statusColor = when {
        target == null -> TangerineColors.textMuted
        lastSendOk == false -> TangerineColors.danger
        lastSendOk == true -> TangerineColors.green
        else -> TangerineColors.orange
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(TangerineColors.surface)
            .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(statusColor))
            Spacer(Modifier.width(8.dp))
            Text(
                "Reaper",
                fontFamily = Karla,
                fontWeight = FontWeight.SemiBold,
                color = TangerineColors.text,
                modifier = Modifier.weight(1f),
            )
            Text("auto", fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textDim)
            Spacer(Modifier.width(6.dp))
            Switch(
                checked = autoDiscover,
                onCheckedChange = onAutoDiscoverChange,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = TangerineColors.orange,
                    checkedTrackColor = TangerineColors.orange.copy(alpha = 0.4f),
                ),
            )
        }
        Text(
            text = when {
                target == null && isSearching -> "Searching the network..."
                target == null -> "No Reaper found yet"
                discovered != null && autoDiscover -> "Found: ${discovered.name} → ${target.host}:${target.port}"
                else -> "Manual: ${target.host}:${target.port}"
            },
            fontFamily = Karla,
            color = TangerineColors.textMuted,
            fontSize = 13.sp,
        )
        Text(
            text = when (lastSendOk) {
                true -> "Last OSC packet OK"
                false -> "Last OSC packet failed"
                null -> "No OSC packets sent yet"
            },
            fontSize = 12.sp,
            fontFamily = Karla,
            color = TangerineColors.textMuted,
        )

        if (!autoDiscover) {
            ManualOverrideFields(
                target = target,
                onChange = onManualHostChange,
            )
        }
    }
}

@Composable
private fun ManualOverrideFields(
    target: com.thegreentangerine.gigbooks.data.orchestrator.ReaperOscClient.Target?,
    onChange: (String, Int) -> Unit,
) {
    var host by remember { mutableStateOf(TextFieldValue(target?.host ?: "192.168.1.222")) }
    var port by remember { mutableStateOf(TextFieldValue((target?.port ?: 8000).toString())) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
        OutlinedTextField(
            value = host,
            onValueChange = { host = it; onChange(it.text, port.text.toIntOrNull() ?: 8000) },
            label = { Text("Host", fontFamily = Karla) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = port,
            onValueChange = { port = it; onChange(host.text, it.text.toIntOrNull() ?: 8000) },
            label = { Text("Port", fontFamily = Karla) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun PeerCountCard(peerCount: Int) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(TangerineColors.surface)
            .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
            .padding(16.dp),
    ) {
        Text(
            "Phone fleet",
            fontFamily = Karla,
            fontWeight = FontWeight.SemiBold,
            color = TangerineColors.text,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "$peerCount connected",
            fontFamily = Karla,
            color = TangerineColors.textMuted,
            fontSize = 14.sp,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            "Peer fanout lands in A2 (next session)",
            fontFamily = Karla,
            color = TangerineColors.textMuted.copy(alpha = 0.6f),
            fontSize = 11.sp,
        )
    }
}
