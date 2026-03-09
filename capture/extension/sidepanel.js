/**
 * TGT Audio Capture — Side Panel Script
 *
 * Quick record button uses WASAPI capture (backend API).
 * Monitor slider is for tab capture audio passthrough (future).
 * For WASAPI, audio plays through speakers naturally.
 */

const API_BASE = "http://localhost:9123";
const UI_BASE = "http://localhost:5174";

// DOM refs
const btnRec = document.getElementById("btn-rec");
const btnPause = document.getElementById("btn-pause");
const tabName = document.getElementById("tab-name");
const timerEl = document.getElementById("timer");
const errorBar = document.getElementById("error-bar");
const errorText = document.getElementById("error-text");
const frame = document.getElementById("app-frame");
const fallback = document.getElementById("fallback");
const offlineBanner = document.getElementById("offline-banner");
const retryBtn = document.getElementById("retry-btn");
const levelMeter = document.getElementById("level-meter");
const levelFill = document.getElementById("level-fill");

// State
let timerInterval = null;
let startTime = null;
let pausedAt = null;
let totalPaused = 0;
let sessionId = null;
let recordingStatus = "idle";

// ========== Helpers ==========

function showError(msg) {
  errorText.textContent = msg;
  errorBar.classList.remove("hidden");
  setTimeout(() => errorBar.classList.add("hidden"), 6000);
}

function clearError() {
  errorBar.classList.add("hidden");
}

async function api(path, method = "GET", body = null) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.message || res.statusText);
  }
  return res.json();
}

async function getTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return { title: tab?.title || "", url: tab?.url || "" };
  } catch {
    return { title: "", url: "" };
  }
}

// ========== Record button (WASAPI) ==========

btnRec.addEventListener("click", async () => {
  clearError();

  if (recordingStatus === "armed" || recordingStatus === "recording" || recordingStatus === "paused") {
    // Stop → goes to review (or cancelled if still armed with no audio)
    btnRec.disabled = true;
    try {
      const res = await api(`/api/wasapi/stop/${sessionId}`, "POST");
      if (res.status === "cancelled") {
        // Was still armed, no audio captured
        resetState();
        tabName.textContent = "Cancelled";
        setTimeout(() => { if (recordingStatus === "idle") tabName.textContent = "Ready"; }, 1500);
      } else {
        recordingStatus = "review";
        if (res.duration_seconds !== undefined) {
          updateTimerDisplay(res.duration_seconds);
        }
        stopPollingTimer();
        updateUI();
      }
    } catch (e) {
      showError(e.message);
    }
    btnRec.disabled = false;
    return;
  }

  if (recordingStatus === "review") {
    // Confirm save → encoding
    btnRec.disabled = true;
    try {
      await api(`/api/wasapi/confirm/${sessionId}`, "POST");
      recordingStatus = "encoding";
      updateUI();
      startPolling();
    } catch (e) {
      showError(e.message);
    }
    btnRec.disabled = false;
    return;
  }

  // Start new recording (armed mode — waits for audio)
  btnRec.disabled = true;
  tabName.textContent = "Starting...";
  try {
    const tab = await getTabInfo();
    const res = await api("/api/wasapi/start", "POST", {
      device_index: null,
      tab_title: tab.title,
      source_url: tab.url,
      armed: true,
    });
    if (!res.session_id) throw new Error("No session ID returned");
    sessionId = res.session_id;
    recordingStatus = res.status === "armed" ? "armed" : "recording";
    totalPaused = 0;
    pausedAt = null;
    if (recordingStatus === "recording") startTime = Date.now();
    updateUI();
    startPolling();
  } catch (e) {
    showError(e.message);
    tabName.textContent = "Ready";
  }
  btnRec.disabled = false;
});

// ========== Pause / Discard button ==========

btnPause.addEventListener("click", async () => {
  clearError();

  if (recordingStatus === "paused") {
    try {
      await api(`/api/capture/resume/${sessionId}`, "POST");
      recordingStatus = "recording";
      updateUI();
    } catch (e) { showError(e.message); }
  } else if (recordingStatus === "recording") {
    try {
      await api(`/api/capture/pause/${sessionId}`, "POST");
      recordingStatus = "paused";
      updateUI();
    } catch (e) { showError(e.message); }
  } else if (recordingStatus === "review") {
    // Discard recording
    try {
      await api(`/api/wasapi/discard/${sessionId}`, "POST");
      resetState();
      tabName.textContent = "Discarded";
      setTimeout(() => { if (recordingStatus === "idle") tabName.textContent = "Ready"; }, 1500);
    } catch (e) { showError(e.message); }
  }
});

// ========== Polling ==========

let pollTimer = null;

function startPolling() {
  stopPollingTimer();
  // Poll fast during armed/recording for responsive level meter
  const interval = (recordingStatus === "armed" || recordingStatus === "recording" || recordingStatus === "paused") ? 250 : 1000;
  pollTimer = setInterval(pollStatus, interval);
}

function stopPollingTimer() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function pollStatus() {
  if (!sessionId) return;
  try {
    const res = await api(`/api/capture/status/${sessionId}`);

    // Update level meter (visible in armed + recording states)
    if (res.level !== undefined) {
      const pct = Math.min(res.level * 100, 100);
      levelFill.style.width = `${pct}%`;
    }

    // Don't overwrite the client-side wall-clock timer during recording/paused.
    // WASAPI loopback doesn't deliver callbacks during silence, so server
    // duration can stay at 0 even while recording is "active". The client
    // timer (startTimer) shows wall-clock elapsed which is what the user expects.
    // Server duration is used only for the final review display.

    // Detect armed → recording transition (audio detected!)
    if (res.status === "recording" && recordingStatus === "armed") {
      recordingStatus = "recording";
      startTime = Date.now();
      updateUI();
    } else if (res.status === "complete") {
      recordingStatus = "complete";
      stopPollingTimer();
      updateUI();
      setTimeout(resetState, 4000);
    } else if (res.status === "failed") {
      stopPollingTimer();
      showError(res.error_message || "Encoding failed");
      setTimeout(resetState, 2000);
    } else if (res.status === "review" && recordingStatus !== "review") {
      recordingStatus = "review";
      stopPollingTimer();
      updateUI();
    }
  } catch {
    // ignore poll errors
  }
}

// ========== Timer ==========

function startTimer() {
  if (timerInterval) return;
  // Account for time spent paused when resuming
  if (pausedAt) {
    totalPaused += Date.now() - pausedAt;
    pausedAt = null;
  }
  timerInterval = setInterval(() => {
    if (!startTime) return;
    updateTimerDisplay((Date.now() - startTime - totalPaused) / 1000);
  }, 500);
}

function updateTimerDisplay(seconds) {
  if (seconds === undefined || seconds === null) return;
  const s = Math.floor(seconds);
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  timerEl.textContent = `${m}:${sec}`;
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function resetState() {
  sessionId = null;
  recordingStatus = "idle";
  startTime = null;
  pausedAt = null;
  totalPaused = 0;
  stopTimer();
  stopPollingTimer();
  updateUI();
}

// ========== UI update ==========

function updateUI() {
  switch (recordingStatus) {
    case "idle":
      btnRec.className = "rec-btn idle";
      btnRec.title = "Start recording";
      btnRec.disabled = false;
      btnPause.classList.add("hidden");
      tabName.textContent = "Ready";
      tabName.classList.remove("recording");
      timerEl.classList.add("hidden");
      levelMeter.classList.add("hidden");
      levelFill.style.width = "0%";
      stopTimer();
      break;

    case "armed":
      btnRec.className = "rec-btn armed";
      btnRec.title = "Cancel";
      btnRec.disabled = false;
      btnPause.classList.add("hidden");
      tabName.textContent = "Waiting for audio\u2026";
      tabName.classList.add("recording");
      timerEl.classList.add("hidden");
      levelMeter.classList.remove("hidden");
      break;

    case "recording":
      btnRec.className = "rec-btn recording";
      btnRec.title = "Stop recording";
      btnRec.disabled = false;
      btnPause.textContent = "| |";
      btnPause.title = "Pause (skip ad)";
      btnPause.className = "ctrl-btn pause";
      btnPause.classList.remove("hidden");
      tabName.textContent = "Recording\u2026";
      tabName.classList.add("recording");
      timerEl.classList.remove("hidden");
      levelMeter.classList.remove("hidden");
      startTimer();
      break;

    case "paused":
      btnRec.className = "rec-btn paused";
      btnRec.title = "Stop recording";
      btnRec.disabled = false;
      btnPause.textContent = "\u25B6";
      btnPause.title = "Resume";
      btnPause.className = "ctrl-btn pause";
      btnPause.classList.remove("hidden");
      tabName.textContent = "Paused";
      tabName.classList.add("recording");
      timerEl.classList.remove("hidden");
      levelMeter.classList.remove("hidden");
      pausedAt = Date.now();
      stopTimer();
      break;

    case "review":
      btnRec.className = "rec-btn review";
      btnRec.title = "Save & Analyze";
      btnRec.disabled = false;
      btnPause.textContent = "\u2715";
      btnPause.title = "Discard";
      btnPause.className = "ctrl-btn discard";
      btnPause.classList.remove("hidden");
      tabName.textContent = "Save this recording?";
      tabName.classList.add("recording");
      timerEl.classList.remove("hidden");
      levelMeter.classList.add("hidden");
      stopTimer();
      break;

    case "encoding":
      btnRec.className = "rec-btn idle";
      btnRec.disabled = true;
      btnPause.classList.add("hidden");
      tabName.textContent = "Encoding...";
      tabName.classList.add("recording");
      timerEl.classList.add("hidden");
      levelMeter.classList.add("hidden");
      break;

    case "complete":
      btnRec.className = "rec-btn idle";
      btnRec.disabled = false;
      btnPause.classList.add("hidden");
      tabName.textContent = "Saved! Check library.";
      tabName.classList.add("recording");
      levelMeter.classList.add("hidden");
      break;
  }
}

// ========== Health checks ==========

async function checkHealth() {
  let backendOk = false;
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    backendOk = res.ok;
  } catch {
    backendOk = false;
  }
  offlineBanner.classList.toggle("hidden", backendOk);

  try {
    await fetch(UI_BASE, { signal: AbortSignal.timeout(3000), mode: "no-cors" });
    frame.classList.remove("hidden");
    fallback.classList.add("hidden");
  } catch {
    frame.classList.add("hidden");
    fallback.classList.remove("hidden");
  }
}

retryBtn.addEventListener("click", () => {
  checkHealth();
  frame.src = UI_BASE;
});

// ========== Keyboard shortcut ==========
// Ctrl+Shift+R = reload extension
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === "R") {
    e.preventDefault();
    chrome.runtime.reload();
  }
});

// ========== Init ==========

checkHealth();
updateUI();
setInterval(checkHealth, 10000);
