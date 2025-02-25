// background.js

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "clickSubmitButton") {
    // Get the tab ID from the sender
    const tabId = sender.tab.id;
    
    console.log("Received clickSubmitButton request for platform:", request.platform);
    
    // Execute a script in the tab to click the submit button
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: clickSubmitButton,
      args: [request.platform]
    })
    .then(results => {
      console.log("Button click script executed:", results);
      sendResponse({ success: true });
    })
    .catch(error => {
      console.error("Error executing button click script:", error);
      sendResponse({ success: false, error: error.message });
    });
    
    // Keep the message channel open for async response
    return true;
  }
});

// Function that will be injected into the page to click the submit button
function clickSubmitButton(platform) {
  console.log(`Attempting to click submit button for ${platform}`);
  
  if (platform === 'chatgpt') {
    // ChatGPT - Keep the existing implementation that works
    const button = document.querySelector('button[data-testid="send-button"]');
    if (button && !button.disabled) {
      console.log("Found and clicking ChatGPT send button");
      button.click();
      return true;
    } else {
      console.log("ChatGPT button not found or is disabled");
      return false;
    }
  } 
  else if (platform === 'claude') {
    // Claude - Based on the HTML snippet provided
    const claudeButton = document.querySelector('button[aria-label="Send Message"]');
    if (claudeButton && !claudeButton.disabled) {
      console.log("Found and clicking Claude send button");
      claudeButton.click();
      return true;
    } else {
      console.log("Claude button not found or is disabled");
      return false;
    }
  }
  
  return false;
}