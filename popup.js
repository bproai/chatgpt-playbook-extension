// popup.js

// Global variables
let allPrompts = [];

document.addEventListener('DOMContentLoaded', () => {
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
        const response = await fetch('http://localhost:3030/api/prompts', {
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
        console.error('Error:', error);
        showNotification('Error adding prompt', 'error');
      }
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
});

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

// Fetch custom prompts from localhost API
async function fetchCustomPrompts(showNotifications = false) {
  try {
    if (showNotifications) {
      showNotification('Fetching prompts from local API...');
    }
    
    console.log('Attempting to fetch custom prompts from http://localhost:3030/api/prompts');
    
    // Simple fetch approach
    const response = await fetch('http://localhost:3030/api/prompts');
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
      let errorMessage = 'Could not connect to local API';
      
      // Provide more specific error messages
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage = 'API server not running on localhost:3030';
      } else if (error.message.includes('timed out')) {
        errorMessage = 'Connection to API timed out';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'CORS policy blocking request';
      }
      
      showNotification(errorMessage, 'error');
    }
    
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

// Clear any existing custom prompts
function clearCustomPrompts() {
  // This is now handled by clearAllContent() and renderAllPrompts()
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
    console.log('Testing API connection to http://localhost:3030/api/prompts');
    
    // Add debug information to console
    console.log('Sending fetch request...');
    
    const response = await fetch('http://localhost:3030/api/prompts');
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