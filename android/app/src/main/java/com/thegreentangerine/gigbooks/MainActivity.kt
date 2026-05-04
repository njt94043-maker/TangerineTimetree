package com.thegreentangerine.gigbooks

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.thegreentangerine.gigbooks.data.supabase.AuthRepository
import com.thegreentangerine.gigbooks.ui.TangerineMediaApp
import com.thegreentangerine.gigbooks.ui.screens.LoginScreen
import com.thegreentangerine.gigbooks.ui.theme.TangerineMediaTheme
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import io.github.jan.supabase.auth.status.SessionStatus

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // S125 multi-cam test feedback: keep screen awake while app is open.
        // Without this, peers and orchestrator dim during long pairing/recording windows.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContent {
            TangerineMediaTheme {
                val sessionStatus by AuthRepository.sessionStatus.collectAsState(
                    initial = SessionStatus.Initializing
                )
                // D-166: Once authenticated, stay on TangerineMediaApp even if session
                // briefly flickers to Initializing on resume. Prevents destroying
                // the player/nav state when returning from background.
                var wasAuthenticated by remember { mutableStateOf(false) }
                if (sessionStatus is SessionStatus.Authenticated) wasAuthenticated = true
                if (sessionStatus is SessionStatus.NotAuthenticated) wasAuthenticated = false

                when {
                    wasAuthenticated -> TangerineMediaApp()
                    sessionStatus is SessionStatus.Initializing -> {
                        Box(
                            modifier = Modifier.fillMaxSize().background(TangerineColors.background),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = TangerineColors.orange)
                        }
                    }
                    else -> LoginScreen()
                }
            }
        }
    }
}
