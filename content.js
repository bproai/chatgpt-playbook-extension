chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "insertPrompt") {
    // Use an interval to check for the presence of the input box
    const interval = setInterval(() => {
      // Adjust the selector to target ChatGPT's prompt input area as needed
      const inputBox = document.querySelector("textarea[placeholder='Send a message...']");
      if (inputBox) {
        inputBox.value = request.prompt;
        // Dispatch an input event in case the page framework needs to detect the change
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        clearInterval(interval);
      }
    }, 500);
  }
});

