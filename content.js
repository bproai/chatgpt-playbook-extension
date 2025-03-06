// content.js

// Constants
const CHATGPT_INPUT_SELECTOR = '#prompt-textarea';
const CLAUDE_INPUT_SELECTOR = 'div[contenteditable="true"]';
const POLLING_INTERVAL = 100;
const MAX_RETRIES = 50;
const DEBUG = true;

// State
let retryCount = 0;
let pollingInterval = null;

// Get current platform
function getCurrentPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes('chat.openai.com')) return 'chatgpt';
  if (hostname.includes('chatgpt.com')) return 'chatgpt';
  if (hostname.includes('claude.ai')) return 'claude';
  return null;
}

// Toggle search button state (enabled/disabled)
function toggleSearchButton(enabled) {
  console.log("Setting search button state to:", enabled ? "enabled" : "disabled");
  
  const platform = getCurrentPlatform();
  if (!platform) return;
  
  // Find search button
  let searchButton = document.querySelector('button[aria-label="Search"]');
  
  if (!searchButton) {
    console.log("Search button not found, will try again later");
    // Schedule a retry if button not found
    setTimeout(() => toggleSearchButton(enabled), 2000);
    return;
  }
  
  console.log("Found search button:", searchButton);
  
  // Check current state
  const ariaPressed = searchButton.getAttribute('aria-pressed');
  const isCurrentlyEnabled = ariaPressed === 'true';
  console.log("Current search button state:", isCurrentlyEnabled ? "enabled" : "disabled");
  
  // Only change state if different from current
  if (isCurrentlyEnabled !== enabled) {
    console.log("Changing search button state");
    
    // Click the button to toggle state if needed
    searchButton.click();
    
    // Schedule verification to ensure it worked
    setTimeout(() => {
      const nowPressed = searchButton.getAttribute('aria-pressed');
      console.log("Verification - button state now:", nowPressed === 'true' ? "enabled" : "disabled");
      
      // If state doesn't match expected state, try again
      if ((nowPressed === 'true') !== enabled) {
        console.log("Button state still doesn't match desired state, trying again");
        searchButton.click();
      }
    }, 300);
  } else {
    console.log("Search button already in desired state");
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);

  if (request.action === "insertPrompt") {
    // Get current platform
    const platform = getCurrentPlatform();
    if (!platform) {
      console.error("Unsupported platform");
      sendResponse({ success: false, error: "Unsupported platform" });
      return;
    }

    // Clear any existing polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Reset retry count
    retryCount = 0;

    // Poll for input element
    pollingInterval = setInterval(() => {
      // Select appropriate input selector based on platform
      const selector = platform === 'claude' ? CLAUDE_INPUT_SELECTOR : CHATGPT_INPUT_SELECTOR;
      const inputBox = document.querySelector(selector);
      console.log("Trying to find input box:", inputBox, "for platform:", platform);

      if (inputBox) {
        // Clear the interval once element is found
        clearInterval(pollingInterval);

        // Insert the prompt
        if (platform === 'claude') {
          // Claude.ai specific handling
          inputBox.textContent = request.prompt;
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // ChatGPT handling
          inputBox.value = request.prompt;
          inputBox.innerHTML = request.prompt;
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Focus the input
        inputBox.focus();

        // Send success response
        sendResponse({ success: true });
        
        // Only call the background script if autoSubmit is enabled
        if (request.autoSubmit) {
          // Get current tab ID and call the background script to execute the click
          setTimeout(() => {
            chrome.runtime.sendMessage({
              action: "clickSubmitButton",
              platform: platform
            });
          }, 500);
        }
      } else if (retryCount >= MAX_RETRIES) {
        // Clear interval if max retries reached
        clearInterval(pollingInterval);
        console.error("Failed to find input element after max retries");
        sendResponse({ success: false, error: "Input element not found" });
      }

      retryCount++;
    }, POLLING_INTERVAL);

    // Keep message channel open for async response
    return true;
  }
  
  // Handle toggle search button message
  if (request.action === "toggleSearch") {
    toggleSearchButton(request.enabled);
    sendResponse({ success: true });
    return true;
  }
});

// When content script loads, check if search should be enabled/disabled
chrome.storage.sync.get(['searchEnabled'], function(result) {
  if (typeof result.searchEnabled !== 'undefined') {
    const searchEnabled = result.searchEnabled;
    console.log('Initial search button setting:', searchEnabled);
    
    // Apply the setting after a delay to ensure page has loaded
    setTimeout(() => {
      toggleSearchButton(searchEnabled);
    }, 2000);
  }
});

// Cleanup on page unload
window.addEventListener('unload', () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
});