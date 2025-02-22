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

  const playbooksContainer = document.getElementById('playbooks');

  playbooks.forEach((book) => {
    const div = document.createElement('div');
    div.className = 'prompt';
    div.textContent = book.title;
    div.addEventListener('click', () => {
      // Send the chosen prompt to the content script on the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "insertPrompt", prompt: book.prompt });
        }
      });
    });
    playbooksContainer.appendChild(div);
  });
});

