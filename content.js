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
          // inputBox.innerHTML = request.prompt;
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Focus the input
        inputBox.focus();

        // Send success response
        sendResponse({ success: true });
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
});

// Cleanup on page unload
window.addEventListener('unload', () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
});