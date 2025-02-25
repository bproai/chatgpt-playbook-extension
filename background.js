// background.js

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "clickSubmitButton") {
    const platform = request.platform;
    
    // Get the current tab ID from the sender
    const tabId = sender.tab.id;
    
    // Execute the appropriate function based on the platform
    if (platform === 'chatgpt') {
      // For ChatGPT
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const btn = document.querySelector('button[data-testid="send-button"]');
          if (btn && !btn.disabled) {
            console.log("Found and clicking ChatGPT send button");
            btn.click();
            return true;
          } else {
            console.log("Button not found or disabled");
            // Try finding by aria-label
            const altBtn = document.querySelector('button[aria-label="Send prompt"]');
            if (altBtn && !altBtn.disabled) {
              console.log("Found and clicking by aria-label");
              altBtn.click();
              return true;
            }
            return false;
          }
        }
      }).then(results => {
        console.log("Script executed:", results);
      }).catch(err => {
        console.error("Error executing script:", err);
      });
    } else if (platform === 'claude') {
      // For Claude
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const btn = document.querySelector('button[aria-label="Send message"]');
          if (btn && !btn.disabled) {
            console.log("Found and clicking Claude send button");
            btn.click();
            return true;
          } else {
            console.log("Claude button not found or disabled");
            // Try finding buttons with "Send" text
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const button of buttons) {
              if (!button.disabled && button.textContent.includes('Send')) {
                console.log("Found and clicking by text content");
                button.click();
                return true;
              }
            }
            return false;
          }
        }
      }).then(results => {
        console.log("Script executed:", results);
      }).catch(err => {
        console.error("Error executing script:", err);
      });
    }
    
    // Return true to indicate we're handling this asynchronously
    return true;
  }
});