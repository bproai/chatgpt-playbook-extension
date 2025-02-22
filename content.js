chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request); // Debug log

  if (request.action === "insertPrompt") {
    // Poll every 500ms for the element to appear
    const interval = setInterval(() => {
      // Grab the contenteditable <div> by its ID (#prompt-textarea)
      const inputBox = document.querySelector("#prompt-textarea");
      console.log("Trying to find input box:", inputBox);

      if (inputBox) {
        // Because it's a contenteditable <div>, set the innerText instead of 'value'
        inputBox.innerText = request.prompt;

        // Dispatch an 'input' event so the page knows the content changed
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));

        // Stop polling once we've successfully updated the element
        clearInterval(interval);
      }
    }, 500);
  }
});
