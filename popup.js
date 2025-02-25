// popup.js

// Global variables
let allPrompts = [];
let apiUrl = 'http://localhost:3030'; // Default API URL

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  loadSettings();
  
  // Initialize the prompt collection with built-in prompts
  collectBuiltInPrompts();
  
  // Set up pull prompts button
  const pullPromptsBtn = document.getElementById('pullPrompts');
  if (pullPromptsBtn) {
    pullPromptsBtn.addEventListener('click', async () => {
      try {
        pullPromptsBtn.classList.add('spinning');
        const success = await fetchCustomPrompts(true);
        pullPromptsBtn.classList.remove('spinning');
        
        if (!success) {
          // If connection failed, show the help modal after a short delay
          setTimeout(() => {
            showApiHelpModal();
          }, 1000);
        }
      } catch (error) {
        pullPromptsBtn.classList.remove('spinning');
      }
    });
  }
  
  // Initial fetch of custom prompts from localhost API
  fetchCustomPrompts();

  // Add custom button handler
  const addCustomBtn = document.getElementById('addCustom');
  const addCustomModal = document.getElementById('addCustomModal');
  const closeModalBtn = document.querySelector('.close-modal');
  const cancelButton = document.getElementById('cancelButton');
  const addPromptForm = document.getElementById('addPromptForm');
  
  if (addCustomBtn) {
    addCustomBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Show the modal
      addCustomModal.classList.add('active');
    });
  }
  
  // Close modal when clicking the X button
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      addCustomModal.classList.remove('active');
    });
  }
  
  // Close modal when clicking the Cancel button
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      addCustomModal.classList.remove('active');
    });
  }
  
  // Handle form submission
  if (addPromptForm) {
    addPromptForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Get form values
      const title = document.getElementById('promptTitle').value;
      const category = document.getElementById('promptCategory').value;
      const description = document.getElementById('promptText').value;
      
      // Validate form
      if (!title || !category || !description) {
        showNotification('Please fill in all fields', 'error');
        return;
      }
      
      try {
        // Create new prompt data
        const newPrompt = {
          title,
          category,
          description,
          is_active: 1
        };
        
        // Send to API
        const response = await fetch(`${apiUrl}/api/prompts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newPrompt)
        });
        
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
          // Show success message
          showNotification('Prompt added successfully');
          
          // Reset form and close modal
          addPromptForm.reset();
          addCustomModal.classList.remove('active');
          
          // Refresh prompts list
          fetchCustomPrompts();
        } else {
          throw new Error('Failed to add prompt');
        }
      } catch (error) {
        console.error('Error saving prompt:', error);
        
        // Show error but keep modal open to let user try again or modify data
        showNotification('Unable to save prompt: ' + getConnectionErrorMessage(error), 'error');
        
        // Make sure our buttons stay functional
        ensureButtonsFunctional();
      }
    });
  }

  // Settings button handler (consistent with Add Custom approach)
  const settingsBtn = document.getElementById('settings');
  const settingsModal = document.getElementById('settingsModal');

  if (settingsBtn) {
    // DON'T replace the button - just add the event listener
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Settings button clicked (initial)');
      
      if (settingsModal) {
        console.log('Opening settings modal');
        settingsModal.classList.add('active');
        
        // Pre-fill current settings
        try {
          const url = new URL(apiUrl);
          document.getElementById('apiHost').value = url.hostname;
          document.getElementById('apiPort').value = url.port || '3030';
          
          // Also update preview
          const previewHost = document.getElementById('previewHost');
          const previewPort = document.getElementById('previewPort');
          if (previewHost) previewHost.textContent = url.hostname;
          if (previewPort) previewPort.textContent = url.port || '3030';
        } catch (error) {
          console.error('Error parsing API URL:', error);
        }
      } else {
        console.error('Settings modal not found in the DOM');
      }
    });
  }
  
  // Make sure the cancel button in the settings modal works properly
  document.querySelectorAll('.close-settings-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      if (settingsModal) {
        settingsModal.classList.remove('active');
      }
    });
  });
    
  
  // Preview API URL as user types
  const apiHostInput = document.getElementById('apiHost');
  const apiPortInput = document.getElementById('apiPort');
  const previewHost = document.getElementById('previewHost');
  const previewPort = document.getElementById('previewPort');
  
  if (apiHostInput && previewHost) {
    apiHostInput.addEventListener('input', function() {
      previewHost.textContent = this.value || 'localhost';
    });
  }
  
  if (apiPortInput && previewPort) {
    apiPortInput.addEventListener('input', function() {
      previewPort.textContent = this.value || '3030';
    });
  }
  
  // Save settings form
  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const host = document.getElementById('apiHost').value.trim();
      const port = document.getElementById('apiPort').value.trim();
      
      // Basic validation
      if (!host) {
        showNotification('Please enter a valid host', 'error');
        return;
      }
      
      if (!port || isNaN(parseInt(port))) {
        showNotification('Please enter a valid port number', 'error');
        return;
      }
      
      // Save the settings
      saveSettings(host, port);
      
      // Close modal and show confirmation
      const settingsModal = document.getElementById('settingsModal');
      if (settingsModal) {
        settingsModal.classList.remove('active');
      }
      
      showNotification('Settings saved successfully');
      
      // Important: Make sure buttons remain functional before testing connection
      ensureButtonsFunctional();
      
      // Test the new connection after a short delay, but don't let it break UI
      setTimeout(async () => {
        try {
          const success = await fetchCustomPrompts(true);
          if (!success) {
            // If connection fails, show a more helpful message
            showNotification(`API connection failed with ${host}:${port}. UI remains functional.`, 'error');
            
            // Critical: Make sure buttons remain functional again after failed connection
            ensureButtonsFunctional();
          }
        } catch (error) {
          console.error("Connection test error:", error);
          // Ensure buttons remain functional even if test fails
          ensureButtonsFunctional();
        }
        
        // Add a final call to ensure buttons are functional regardless of connection outcome
        setTimeout(ensureButtonsFunctional, 100);
      }, 500);
    });
  }
  
  // API Help Modal
  const apiHelpModal = document.getElementById('apiHelpModal');
  const closeHelpModalBtns = document.querySelectorAll('.close-help-modal');
  const testApiButton = document.getElementById('testApiButton');
  
  function showApiHelpModal() {
    if (apiHelpModal) {
      apiHelpModal.classList.add('active');
    }
  }
  
  // Close help modal when clicking the X button
  if (closeHelpModalBtns) {
    closeHelpModalBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        apiHelpModal.classList.remove('active');
      });
    });
  }
  
  // Test API connection
  if (testApiButton) {
    testApiButton.addEventListener('click', async () => {
      try {
        testApiButton.disabled = true;
        testApiButton.textContent = 'Testing...';
        
        const result = await testApiConnection();
        
        if (result.success) {
          testApiButton.textContent = 'Connection Successful!';
          testApiButton.style.backgroundColor = '#28a745';
          
          // Close the modal after a successful test
          setTimeout(() => {
            apiHelpModal.classList.remove('active');
            fetchCustomPrompts(true);
          }, 1500);
        } else {
          testApiButton.textContent = 'Connection Failed';
          testApiButton.style.backgroundColor = '#dc3545';
          
          setTimeout(() => {
            testApiButton.textContent = 'Test API Connection';
            testApiButton.style.backgroundColor = '';
            testApiButton.disabled = false;
          }, 2000);
        }
      } catch (error) {
        testApiButton.textContent = 'Error Testing Connection';
        testApiButton.style.backgroundColor = '#dc3545';
        
        setTimeout(() => {
          testApiButton.textContent = 'Test API Connection';
          testApiButton.style.backgroundColor = '';
          testApiButton.disabled = false;
        }, 2000);
      }
    });
  }
  
  // Make sure buttons stay functional even if initial API connection fails
  ensureButtonsFunctional();
});

// Load settings from storage
function loadSettings() {
  // Load settings from chrome.storage
  chrome.storage.sync.get(['apiUrl'], function(result) {
    if (result.apiUrl) {
      apiUrl = result.apiUrl;
      console.log('Loaded API URL from settings:', apiUrl);
      
      // Update any UI elements that display the current settings
      const apiHostInput = document.getElementById('apiHost');
      const apiPortInput = document.getElementById('apiPort');
      
      if (apiHostInput && apiPortInput) {
        try {
          const url = new URL(apiUrl);
          apiHostInput.value = url.hostname;
          apiPortInput.value = url.port || '3030';
        } catch (error) {
          console.error('Error parsing stored API URL:', error);
        }
      }
    }
  });
}

// Save settings to storage
function saveSettings(host, port) {
  // Construct the full URL
  const newApiUrl = `http://${host}:${port}`;
  
  // Save to chrome.storage
  chrome.storage.sync.set({ apiUrl: newApiUrl }, function() {
    console.log('API URL saved:', newApiUrl);
    apiUrl = newApiUrl;
  });
}

// Simplified version that doesn't use attributes
function ensureButtonsFunctional() {
  console.log('Checking button functionality');

  // For Settings button: add listener only if not already attached.
  const settingsBtn = document.getElementById('settings');
  if (settingsBtn && !settingsBtn.dataset.listenerAttached) {
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Settings button clicked');
      const settingsModal = document.getElementById('settingsModal');
      if (settingsModal) {
        settingsModal.classList.add('active');
        // Pre-fill current settings
        try {
          const url = new URL(apiUrl);
          const apiHostInput = document.getElementById('apiHost');
          const apiPortInput = document.getElementById('apiPort');
          if (apiHostInput) apiHostInput.value = url.hostname;
          if (apiPortInput) apiPortInput.value = url.port || '3030';
          const previewHost = document.getElementById('previewHost');
          const previewPort = document.getElementById('previewPort');
          if (previewHost) previewHost.textContent = url.hostname;
          if (previewPort) previewPort.textContent = url.port || '3030';
        } catch (error) {
          console.error('Error parsing API URL:', error);
        }
      }
    });
    settingsBtn.dataset.listenerAttached = "true";
  }

  // For Add Custom button: attach the listener once.
  const addCustomBtn = document.getElementById('addCustom');
  if (addCustomBtn && !addCustomBtn.dataset.listenerAttached) {
    addCustomBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Add Custom button clicked');
      const addCustomModal = document.getElementById('addCustomModal');
      if (addCustomModal) {
        addCustomModal.classList.add('active');
      }
    });
    addCustomBtn.dataset.listenerAttached = "true";
  }
}


// Helper function to get a user-friendly error message
function getConnectionErrorMessage(error) {
  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    return 'API connection failed. Check your settings.';
  } else if (error.message.includes('timed out')) {
    return 'Connection timed out.';
  } else if (error.message.includes('CORS')) {
    return 'CORS policy error.';
  }
  return error.message;
}

// Add this to make the error more visible but non-blocking
function showApiConnectionError(host, port) {
  showNotification(`API connection to ${host}:${port} failed. Check your settings.`, 'error');
  
  // Optional: Add a visible indicator in the UI that API is disconnected
  const container = document.querySelector('.container');
  if (container) {
    const disconnectBanner = document.createElement('div');
    disconnectBanner.className = 'api-disconnect-banner';
    disconnectBanner.innerHTML = `
      <div style="background-color: rgba(255, 60, 60, 0.1); color: #ff3b30; padding: 8px 12px; margin: 8px 12px; border-radius: 4px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span>API Connection Failed: ${host}:${port}</span>
        <button id="reconnectBtn" style="background: #444; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 11px; cursor: pointer;">Retry</button>
      </div>
    `;
    
    // Insert after header
    const header = document.querySelector('.header');
    if (header && header.nextSibling) {
      container.insertBefore(disconnectBanner, header.nextSibling);
    } else {
      container.appendChild(disconnectBanner);
    }
    
    // Add reconnect functionality
    document.getElementById('reconnectBtn').addEventListener('click', () => {
      disconnectBanner.remove();
      fetchCustomPrompts(true);
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (disconnectBanner.parentNode) {
        disconnectBanner.remove();
      }
    }, 10000);
  }
}

// Collect built-in prompts from the DOM
function collectBuiltInPrompts() {
  console.log('Collecting built-in prompts...');
  
  // Find all existing prompt cards
  const existingCards = document.querySelectorAll('.playbook-card');
  console.log(`Found ${existingCards.length} built-in cards`);
  
  // Store built-in prompts
  const builtInPrompts = [];
  const seenTitles = new Set(); // To track duplicates within hardcoded prompts
  
  existingCards.forEach((card, index) => {
    try {
      // Get category from parent elements
      const section = card.closest('.playbook-section');
      const categoryLabel = section ? 
                          section.previousElementSibling : 
                          null;
      const category = categoryLabel ? categoryLabel.textContent.trim() : 'Uncategorized';
      
      // Extract prompt details
      const titleEl = card.querySelector('.playbook-title');
      const descEl = card.querySelector('.playbook-description');
      
      if (!titleEl || !descEl) {
        console.log(`Skipping card #${index} - missing title or description elements`);
        return;
      }
      
      const title = titleEl.textContent.trim();
      const description = descEl.textContent.trim();
      const promptText = card.dataset.prompt ? card.dataset.prompt.trim() : '';
      
      // Skip if we've seen this title before (to avoid duplicates in the DOM)
      const titleKey = title.toUpperCase();
      if (seenTitles.has(titleKey)) {
        console.log(`Skipping duplicate built-in title: ${title}`);
        return;
      }
      
      seenTitles.add(titleKey);
      
      // Store the prompt
      builtInPrompts.push({
        title,
        description,
        category,
        builtIn: true,
        prompt: promptText
      });
      
      // Add click event handler to the prompt
      addPromptClickHandler(card);
    } catch (err) {
      console.error(`Error processing card #${index}:`, err);
    }
  });
  
  console.log('Built-in prompts collected:', builtInPrompts);
  
  // Store in our global variable
  allPrompts = [...builtInPrompts];
  
  // Render the prompts
  renderAllPrompts();
}

// Add click handler to a prompt card
function addPromptClickHandler(card) {
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
}

// Fetch custom prompts from API
async function fetchCustomPrompts(showNotifications = false) {
  try {
    if (showNotifications) {
      showNotification('Fetching prompts from API...');
    }
    
    console.log(`Attempting to fetch custom prompts from ${apiUrl}/api/prompts`);
    
    // Use the dynamic apiUrl
    const response = await fetch(`${apiUrl}/api/prompts`);
    console.log('API response:', response);
    
    if (!response.ok) {
      throw new Error(`API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API response data:', data);
    
    // Check if response has the expected structure
    if (data.status === 'success' && Array.isArray(data.prompts)) {
      // Process API prompts
      processApiPrompts(data.prompts);
      
      if (showNotifications) {
        showNotification(`Loaded ${data.prompts.length} prompts successfully`);
      }
      
      return true; // Success
    } else {
      console.log('Unexpected API response format');
      if (showNotifications) {
        showNotification('Unexpected API response format', 'error');
      }
      return false;
    }
  } catch (error) {
    console.error('Could not fetch custom prompts:', error);
    
    if (showNotifications) {
      let errorMessage = `Could not connect to API at ${apiUrl}`;
      
      // Provide more specific error messages
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage = `API server not running at ${apiUrl}`;
      } else if (error.message.includes('timed out')) {
        errorMessage = 'Connection to API timed out';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'CORS policy blocking request';
      }
      
      showNotification(errorMessage, 'error');
    }
    
    // Instead of disabling buttons, just use default prompts and allow UI to continue functioning
    console.log('Connection failed but keeping UI functional');
    
    // Make sure UI is responsive even when API fails
    ensureButtonsFunctional();
    
    return false; // Failed
  }
}

// Process prompts from API
function processApiPrompts(apiPrompts) {
  console.log('-----------------------------------------------------------');
  console.log('PROCESSING API PROMPTS');
  console.log('-----------------------------------------------------------');
  
  // Log the current hardcoded prompts
  console.log('CURRENT HARDCODED PROMPTS:');
  const hardcodedPrompts = allPrompts.filter(p => p.builtIn);
  hardcodedPrompts.forEach(p => {
    console.log(`  - "${p.title}" (${p.category})`);
  });
  
  console.log('API PROMPTS FROM SERVER:');
  apiPrompts.forEach(p => {
    console.log(`  - "${p.title}" (${p.category})`);
  });
  
  // Create a lookup of hardcoded prompts by title
  const hardcodedTitleMap = {};
  hardcodedPrompts.forEach(p => {
    const titleKey = p.title.trim().toUpperCase();
    hardcodedTitleMap[titleKey] = p;
  });
  
  // Process API prompts
  const formattedApiPrompts = apiPrompts.map(apiPrompt => {
    const title = apiPrompt.title.trim();
    const normalizedTitle = title.toUpperCase();
    const isHardcodedDuplicate = !!hardcodedTitleMap[normalizedTitle];
    
    // Always add the API prompt, but mark duplicates for special handling
    return {
      title: title,
      description: apiPrompt.title.trim(), // Show title as description
      category: apiPrompt.category.trim(),
      prompt: apiPrompt.description.trim(),
      builtIn: false,
      isDuplicate: isHardcodedDuplicate, // Mark if it duplicates a hardcoded prompt
      apiId: apiPrompt.id
    };
  });
  
  // Update our global prompts array
  allPrompts = [
    ...hardcodedPrompts,
    ...formattedApiPrompts
  ];
  
  console.log('ALL PROMPTS AFTER MERGING:', allPrompts);
  
  // Re-render all prompts
  renderAllPrompts();
}

// Render all prompts (built-in and API)
function renderAllPrompts() {
  console.log('-----------------------------------------------------------');
  console.log('RENDERING ALL PROMPTS');
  console.log('-----------------------------------------------------------');
  
  console.log(`Total prompts to render: ${allPrompts.length}`);
  console.log(`  - ${allPrompts.filter(p => p.builtIn).length} hardcoded prompts`);
  console.log(`  - ${allPrompts.filter(p => !p.builtIn).length} API prompts`);
  
  // Clear existing content
  clearAllContent();
  
  // Group prompts by normalized category (case-insensitive)
  const promptsByCategory = {};
  const categoryDisplayNames = {}; // To store original casing of categories
  
  // Process all prompts and organize them
  allPrompts.forEach(prompt => {
    // Skip API prompts that duplicate hardcoded prompts
    if (!prompt.builtIn && prompt.isDuplicate) {
      console.log(`Skipping duplicate API prompt: "${prompt.title}"`);
      return;
    }
    
    const category = prompt.category || 'Uncategorized';
    const normalizedCategory = category.toUpperCase(); // Normalize for comparison
    
    if (!promptsByCategory[normalizedCategory]) {
      promptsByCategory[normalizedCategory] = [];
      // Store the first occurrence as the display name
      categoryDisplayNames[normalizedCategory] = category;
    }
    
    promptsByCategory[normalizedCategory].push(prompt);
  });
  
  // Define category order (Finance & Markets first)
  const normalizedCategoryOrder = [
    'FINANCE & MARKETS',
    'WRITING & ANALYSIS', 
    'CODE & DEVELOPMENT'
  ];
  
  // Add any other categories to the end
  Object.keys(promptsByCategory).forEach(normalizedCategory => {
    if (!normalizedCategoryOrder.includes(normalizedCategory)) {
      normalizedCategoryOrder.push(normalizedCategory);
    }
  });
  
  console.log('Category order:', normalizedCategoryOrder);
  
  // Render prompts in order by category
  normalizedCategoryOrder.forEach(normalizedCategory => {
    if (promptsByCategory[normalizedCategory] && promptsByCategory[normalizedCategory].length > 0) {
      // Use the stored display name for rendering
      renderCategory(categoryDisplayNames[normalizedCategory], promptsByCategory[normalizedCategory]);
    }
  });
}

// Clear all content
function clearAllContent() {
  console.log('Clearing content');
  
  const container = document.querySelector('.container');
  const header = document.querySelector('.header');
  const notification = document.getElementById('notification');
  
  if (!container) {
    console.error('Container not found');
    return;
  }
  
  if (!header) {
    console.error('Header not found');
    return;
  }
  
  if (!notification) {
    console.error('Notification not found');
    return;
  }
  
  // Remove everything except header and notification
  Array.from(container.children).forEach(child => {
    if (child !== header && child !== notification) {
      child.remove();
    }
  });
}

// Render a category with its prompts
function renderCategory(category, prompts) {
  const container = document.querySelector('.container');
  const notification = document.getElementById('notification');
  
  if (!container || !notification) {
    console.error('Container or notification element not found');
    return;
  }
  
  // Create category label
  const categoryLabel = document.createElement('div');
  categoryLabel.className = 'category-label';
  categoryLabel.textContent = category;
  
  // Create section for prompts
  const section = document.createElement('div');
  section.className = 'playbook-section';
  
  // Insert before notification
  container.insertBefore(categoryLabel, notification);
  container.insertBefore(section, notification);
  
  // Add prompt cards
  prompts.forEach(prompt => {
    const card = createPromptCard(prompt);
    section.appendChild(card);
  });
}

// Create a prompt card from a prompt object
function createPromptCard(prompt) {
  const card = document.createElement('div');
  card.className = 'playbook-card';
  card.setAttribute('data-prompt', prompt.prompt.trim());
  
  if (!prompt.builtIn) {
    card.classList.add('api-prompt');
  }
  
  // Get appropriate description based on source
  let displayDescription;
  if (prompt.builtIn) {
    // For built-in prompts, show the original description
    displayDescription = prompt.description;
  } else {
    // For API prompts, show a truncated part of the actual prompt text
    const shortDesc = prompt.prompt.substring(0, 40);
    displayDescription = shortDesc + (prompt.prompt.length > 40 ? '...' : '');
  }
  
  card.innerHTML = `
    <div>
      <div class="playbook-title">${prompt.title || 'Untitled'}</div>
      <div class="playbook-description">${displayDescription}</div>
    </div>
    <span class="action-icon">→</span>
  `;
  
  // Add click event handler to the prompt
  addPromptClickHandler(card);
  
  return card;
}

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

// Test API connection
async function testApiConnection() {
  try {
    console.log(`Testing API connection to ${apiUrl}/api/prompts`);
    
    // Add debug information to console
    console.log('Sending fetch request...');
    
    const response = await fetch(`${apiUrl}/api/prompts`);
    console.log('Response received:', response);
    
    if (!response.ok) {
      return { success: false, error: `Status: ${response.status}` };
    }
    
    const data = await response.json();
    console.log('Data received:', data);
    
    if (data.status === 'success' && Array.isArray(data.prompts)) {
      return { success: true, prompts: data.prompts };
    } else {
      return { success: false, error: 'Invalid response format' };
    }
  } catch (error) {
    console.error('Test connection error:', error);
    return { success: false, error: error.message };
  }
}