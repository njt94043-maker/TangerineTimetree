package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.supabase.AuthRepository
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlinx.coroutines.launch

@Composable
fun LoginScreen() {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    fun signIn() {
        if (email.isBlank() || password.isBlank()) return
        scope.launch {
            loading = true
            error = null
            try {
                AuthRepository.signIn(email.trim(), password)
            } catch (e: Exception) {
                error = "Invalid email or password"
            } finally {
                loading = false
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(GigColors.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Logo mark
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(GigColors.orange.copy(alpha = 0.1f))
                    .border(2.dp, GigColors.orange.copy(alpha = 0.5f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "T",
                    fontFamily = Karla,
                    fontWeight = FontWeight.Bold,
                    fontSize = 36.sp,
                    style = TextStyle(
                        color = GigColors.orange,
                        shadow = androidx.compose.ui.graphics.Shadow(
                            color = GigColors.orange.copy(alpha = 0.8f),
                            offset = Offset.Zero,
                            blurRadius = 20f,
                        ),
                    ),
                )
            }

            Spacer(Modifier.height(20.dp))

            // Title
            Text(
                text = "GigBooks",
                fontFamily = Karla,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
                style = TextStyle(
                    color = GigColors.orange,
                    shadow = androidx.compose.ui.graphics.Shadow(
                        color = GigColors.orange.copy(alpha = 0.5f),
                        offset = Offset.Zero,
                        blurRadius = 20f,
                    ),
                ),
            )
            Text(
                text = "The Green Tangerine",
                fontFamily = Karla,
                fontSize = 13.sp,
                color = GigColors.textMuted,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(40.dp))

            // Email field
            LoginTextField(
                value = email,
                onValueChange = { email = it; error = null },
                placeholder = "Email",
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
                onImeAction = { focusManager.moveFocus(FocusDirection.Down) },
            )

            Spacer(Modifier.height(12.dp))

            // Password field
            LoginTextField(
                value = password,
                onValueChange = { password = it; error = null },
                placeholder = "Password",
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
                isPassword = true,
                onImeAction = { focusManager.clearFocus(); signIn() },
            )

            // Error
            if (error != null) {
                Spacer(Modifier.height(10.dp))
                Text(
                    text = error!!,
                    fontFamily = Karla,
                    fontSize = 13.sp,
                    color = GigColors.danger,
                    textAlign = TextAlign.Center,
                )
            }

            Spacer(Modifier.height(24.dp))

            // Sign in button
            Button(
                onClick = { focusManager.clearFocus(); signIn() },
                enabled = !loading && email.isNotBlank() && password.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = GigColors.orange,
                    contentColor = Color.Black,
                    disabledContainerColor = GigColors.orange.copy(alpha = 0.3f),
                    disabledContentColor = Color.Black.copy(alpha = 0.4f),
                ),
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.Black,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text(
                        text = "Sign in",
                        fontFamily = Karla,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun LoginTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    keyboardType: KeyboardType,
    imeAction: ImeAction,
    isPassword: Boolean = false,
    onImeAction: () -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    TextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .border(1.dp, GigColors.neuBorder, shape),
        placeholder = {
            Text(placeholder, fontFamily = Karla, color = GigColors.textMuted, fontSize = 14.sp)
        },
        textStyle = TextStyle(
            fontFamily = JetBrainsMono,
            fontSize = 14.sp,
            color = GigColors.text,
        ),
        singleLine = true,
        visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
        keyboardActions = KeyboardActions(onAny = { onImeAction() }),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = GigColors.surfaceInset,
            unfocusedContainerColor = GigColors.surfaceInset,
            focusedTextColor = GigColors.text,
            unfocusedTextColor = GigColors.text,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            cursorColor = GigColors.orange,
        ),
    )
}
