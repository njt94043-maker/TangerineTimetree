package com.thegreentangerine.gigbooks

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.thegreentangerine.gigbooks.data.supabase.AuthRepository
import com.thegreentangerine.gigbooks.ui.GigBooksApp
import com.thegreentangerine.gigbooks.ui.screens.LoginScreen
import com.thegreentangerine.gigbooks.ui.theme.GigBooksTheme
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import io.github.jan.supabase.auth.status.SessionStatus

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            GigBooksTheme {
                val sessionStatus by AuthRepository.sessionStatus.collectAsState(
                    initial = SessionStatus.Initializing
                )

                when (sessionStatus) {
                    is SessionStatus.Initializing -> {
                        Box(
                            modifier = Modifier.fillMaxSize().background(GigColors.background),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = GigColors.orange)
                        }
                    }
                    is SessionStatus.Authenticated -> GigBooksApp()
                    else -> LoginScreen()
                }
            }
        }
    }
}
