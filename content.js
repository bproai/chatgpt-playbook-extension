// content.js

// Constants
const CHATGPT_INPUT_SELECTOR = '#prompt-textarea';
const POLLING_INTERVAL = 100;
const MAX_RETRIES = 50;
const DEBUG = true;

// State
let retryCount = 0;
let pollingInterval = null;

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);

  if (request.action === "insertPrompt") {
    // Clear any existing polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Reset retry count
    retryCount = 0;

    // Poll for input element
    pollingInterval = setInterval(() => {
      const inputBox = document.querySelector(CHATGPT_INPUT_SELECTOR);
      console.log("Trying to find input box:", inputBox);

      if (inputBox) {
        // Clear the interval once element is found
        clearInterval(pollingInterval);

        // Insert the prompt
        inputBox.value = request.prompt;
        inputBox.innerHTML = request.prompt;

        // Focus the input
        inputBox.focus();

        // Dispatch input event
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));

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