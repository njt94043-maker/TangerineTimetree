/**
 * TGT Audio Capture — Service Worker (Background Script)
 *
 * Minimal service worker: opens side panel on icon click,
 * reports active tab info to backend for WASAPI metadata.
 */

const API_BASE = "http://localhost:9123";

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ---------- Tab info reporting ----------
// Periodically report active tab to backend so WASAPI capture gets title/URL

async function reportActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url) {
      await fetch(`${API_BASE}/api/capture/tab-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: tab.title || "", url: tab.url || "" }),
      }).catch(() => {}); // Ignore if backend is offline
    }
  } catch (e) {
    // Ignore
  }
}

chrome.tabs.onActivated.addListener(() => reportActiveTab());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.title || changeInfo.url) reportActiveTab();
});
setInterval(reportActiveTab, 5000);
