package com.thegreentangerine.gigbooks

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.thegreentangerine.gigbooks.ui.GigBooksApp
import com.thegreentangerine.gigbooks.ui.theme.GigBooksTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            GigBooksTheme {
                GigBooksApp()
            }
        }
    }
}
