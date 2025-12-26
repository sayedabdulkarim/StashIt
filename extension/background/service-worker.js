// StashIt Background Service Worker

const API_URL = 'http://localhost:3000/api';

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('StashIt extension installed');
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getToken') {
    chrome.storage.local.get(['stashit_token'], (result) => {
      sendResponse({ token: result.stashit_token });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'logout') {
    chrome.storage.local.remove(['stashit_token'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle messages from external web pages (localhost:3000)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToken' && request.token) {
    chrome.storage.local.set({ stashit_token: request.token }, () => {
      console.log('Token saved from external page');
      sendResponse({ success: true });
    });
    return true;
  }
});

// Check token expiry periodically (every hour)
chrome.alarms.create('checkTokenExpiry', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkTokenExpiry') {
    const result = await chrome.storage.local.get(['stashit_token']);
    if (result.stashit_token) {
      try {
        const response = await fetch(`${API_URL}/auth/verify`, {
          headers: { Authorization: `Bearer ${result.stashit_token}` }
        });

        if (!response.ok) {
          // Token expired, clear it
          await chrome.storage.local.remove(['stashit_token']);
          console.log('Token expired, cleared');
        }
      } catch (error) {
        console.error('Token check failed:', error);
      }
    }
  }
});
