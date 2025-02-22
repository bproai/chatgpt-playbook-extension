// popup.js

document.addEventListener('DOMContentLoaded', () => {
  // Find all playbook cards
  const playbookCards = document.querySelectorAll('.playbook-card');
  
  // Add click handlers to each card
  playbookCards.forEach(card => {
    card.addEventListener('click', async () => {
      try {
        const prompt = card.dataset.prompt;
        console.log('Clicked card with prompt:', prompt);
        
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
          showNotification('Error: No active tab found', 'error');
          return;
        }

        // Send message to content script
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'insertPrompt',
          prompt: prompt
        });

        if (response && response.success) {
          showNotification('Prompt inserted successfully');
          // Close popup after short delay
          setTimeout(() => window.close(), 1000);
        } else {
          showNotification('Failed to insert prompt', 'error');
        }

      } catch (error) {
        console.error('Error:', error);
        showNotification('Error inserting prompt', 'error');
      }
    });
  });

  // Setup notification system
  function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
      notification.className = 'notification';
    }, 2000);
  }

  // Add custom button handler
  const addCustomBtn = document.getElementById('addCustom');
  if (addCustomBtn) {
    addCustomBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showNotification('Custom prompts coming soon!');
    });
  }

  // Settings button handler
  const settingsBtn = document.getElementById('settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showNotification('Settings coming soon!');
    });
  }
});