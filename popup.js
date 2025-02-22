document.addEventListener('DOMContentLoaded', () => {
  // Define your playbooks with a title and corresponding prompt text
  const playbooks = [
    {
      title: "Summarize Article",
      prompt: "Please summarize the key points of the following article."
    },
    {
      title: "Generate Code",
      prompt: "Write a sample code snippet in JavaScript that demonstrates X."
    },
    {
      title: "Explain Concept",
      prompt: "Explain the concept of machine learning in simple terms."
    }
    // Add more playbooks as needed
  ];

  // Get the container element where playbook buttons will be added
  const playbooksContainer = document.getElementById('playbooks');

  // Loop through the playbooks and create a clickable div for each
  playbooks.forEach((book) => {
    const div = document.createElement('div');
    div.className = 'prompt';
    div.textContent = book.title;

    // On click, send the prompt to the active tab
    div.addEventListener('click', () => {
      console.log("Sending prompt:", book.prompt); // Debug log
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(
            tabs[0].id, 
            { action: "insertPrompt", prompt: book.prompt },
            (response) => {
              // If there's an error (e.g., no content script), log it
              if (chrome.runtime.lastError) {
                console.error("Message error:", chrome.runtime.lastError.message);
              }
            }
          );
        }
      });
    });

    playbooksContainer.appendChild(div);
  });
});
