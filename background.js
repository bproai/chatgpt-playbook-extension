// background.js

// Caches for storing Q&A data until it can be uploaded
let questionCache = [];
let answerCache = [];
let uploadInProgress = false;
const UPLOAD_INTERVAL = 30000; // Upload every 30 seconds
const MAX_CACHE_SIZE = 100;

let wsConnection = null;
let wsReconnectTimer = null;
const WS_RECONNECT_INTERVAL = 5000; // Reconnect every 5 seconds if connection fails
const WS_DEFAULT_PORT = 3031; // Default WebSocket port


// Load cached data from storage on startup
function initializeState() {
  chrome.storage.local.get(['questionCache', 'answerCache'], function(result) {
    if (result.questionCache) {
      questionCache = result.questionCache;
      console.log(`Loaded ${questionCache.length} cached questions`);
    }
    
    if (result.answerCache) {
      answerCache = result.answerCache;
      console.log(`Loaded ${answerCache.length} cached answers`);
    }
  });
}

// Initialize the extension
initializeState();

// Store question data in cache
function storeQuestionData(data) {
  console.log("Storing question data:", data);
  
  // Make sure question cache is initialized
  if (!Array.isArray(questionCache)) {
    questionCache = [];
  }
  
  // Add to cache
  questionCache.push(data);
  
  // Limit cache size
  if (questionCache.length > MAX_CACHE_SIZE) {
    questionCache.shift(); // Remove oldest item
  }
  
  // Save to local storage as backup
  chrome.storage.local.set({ 'questionCache': questionCache });
  
  // Schedule upload
  scheduleUpload();
}

// Store answer data in cache
function storeAnswerData(data) {
  console.log("Storing answer data:", data);
  
  // Make sure answer cache is initialized
  if (!Array.isArray(answerCache)) {
    answerCache = [];
  }
  
  // Add to cache
  answerCache.push(data);
  
  // Limit cache size
  if (answerCache.length > MAX_CACHE_SIZE) {
    answerCache.shift(); // Remove oldest item
  }
  
  // Save to local storage as backup
  chrome.storage.local.set({ 'answerCache': answerCache });
  
  // Update question's answered status
  const questionIndex = questionCache.findIndex(q => q.id === data.question_id);
  if (questionIndex !== -1) {
    questionCache[questionIndex].answered = true;
    chrome.storage.local.set({ 'questionCache': questionCache });
  }
  
  // Since we now have a complete question-answer pair, trigger immediate upload
  // instead of just scheduling it
  uploadCachedData(true);
}

// Schedule data upload
let uploadTimeout = null;
function scheduleUpload() {
  // Clear any existing timeout
  if (uploadTimeout) {
    clearTimeout(uploadTimeout);
  }
  
  // Set new timeout
  uploadTimeout = setTimeout(() => {
    uploadCachedData();
  }, 5000); // Wait 5 seconds after last change before uploading
}

// Upload cached data to API
async function uploadCachedData() {
  console.log("Attempting to upload cached Q&A data");
  
  // If no data to upload, skip
  if (questionCache.length === 0 && answerCache.length === 0) {
    console.log("No data to upload");
    return;
  }
  
  // If upload already in progress, skip
  if (uploadInProgress) {
    console.log("Upload already in progress, skipping");
    return;
  }
  
  uploadInProgress = true;
  
  try {
    // Get API URL from storage
    const apiUrl = await new Promise(resolve => {
      chrome.storage.sync.get(['apiUrl'], function(result) {
        resolve(result.apiUrl || 'http://localhost:3030');
      });
    });
    
    // Format questions for API
    const questions = questionCache.map(q => ({
      id: q.id,
      platform: q.platform,
      question: q.question,
      timestamp: q.timestamp,
      answered: q.answered
    }));
    
    // Format answers for API
    const answers = answerCache.map(a => ({
      id: a.id,
      question_id: a.question_id,
      message_id: a.message_id,
      platform: a.platform,
      answer: a.answer,
      model: a.model,
      timestamp: a.timestamp,
      turn_number: a.turn_number,
      metadata: a.metadata
    }));
    
    // Filter out answers with null question_ids
    const validAnswers = answers.filter(a => a.question_id !== null);

    console.log(`Uploading ${questions.length} questions and ${answers.length} answers to ${apiUrl}/api/qa`);
    
    // Send to API
    const response = await fetch(`${apiUrl}/api/qa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ questions, answers })
    });
    
    if (!response.ok) {
      throw new Error(`API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      console.log("Q&A data uploaded successfully:", data.message);
      
      // Clear caches
      questionCache = [];
      answerCache = [];
      
      // Update local storage
      chrome.storage.local.set({
        'questionCache': questionCache,
        'answerCache': answerCache
      });
    } else {
      console.error("API error:", data.message || "Unknown error");
    }
  } catch (error) {
    console.error("Error uploading Q&A data:", error);
    // We'll keep the data in cache and try again later
  } finally {
    uploadInProgress = false;
  }
}

// Set up periodic upload attempt
setInterval(uploadCachedData, UPLOAD_INTERVAL);

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
  
  // Handle storing question data
  if (request.action === "storeQuestionData") {
    storeQuestionData(request.data);
    
    // Add debug logging here
    console.log("After storing question, current caches:", {
      questions: questionCache.length,
      answers: answerCache.length
    });
    chrome.storage.local.get(['questionCache', 'answerCache'], result => {
      console.log("Storage caches after storing question:", {
        questions: result.questionCache?.length || 0,
        answers: result.answerCache?.length || 0
      });
    });
    
    sendResponse({ success: true });
    return true;
  }

  // Handle storing answer data
  if (request.action === "storeAnswerData") {
    storeAnswerData(request.data);
    
    // Add debug logging here
    console.log("After storing answer, current caches:", {
      questions: questionCache.length,
      answers: answerCache.length
    });
    chrome.storage.local.get(['questionCache', 'answerCache'], result => {
      console.log("Storage caches after storing answer:", {
        questions: result.questionCache?.length || 0,
        answers: result.answerCache?.length || 0
      });
    });
    
    sendResponse({ success: true });
    return true;
  }

  // Handle reconnecting WebSocket with new URL
  if (request.action === "reconnectWebSocket") {
    console.log("Reconnecting WebSocket with new URL:", request.wsUrl);
    connectToWebSocket(request.wsUrl);
    sendResponse({ success: true });
    return true;
  }

  console.log("Current caches:", {
    questions: questionCache.length,
    answers: answerCache.length
  });
  chrome.storage.local.get(['questionCache', 'answerCache'], result => {
    console.log("Storage caches:", {
      questions: result.questionCache?.length || 0,
      answers: result.answerCache?.length || 0
    });
  });
  
  // Handle testing API connection
  if (request.action === "testApiConnection") {
    testApiConnection()
      .then(result => sendResponse(result))
      .catch(error => {
        console.error("Error testing API connection:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  }

  // Handle sending WebSocket messages
  if (request.action === "sendWebSocketMessage") {
    console.log("[DEBUG] Background script received WebSocket message request:", {
      type: request.data.type,
      messageId: request.data.messageId,
      contentLength: request.data.content ? request.data.content.length : 0,
      timestamp: request.data.timestamp
    });
    
    // Check WebSocket status before attempting to send
    if (!wsConnection) {
      console.error("[DEBUG] WebSocket connection is null");
      sendResponse({ success: false, error: "WebSocket connection is null" });
      return true;
    }
    
    console.log("[DEBUG] WebSocket readyState:", wsConnection.readyState);
    console.log("[DEBUG] WebSocket connection URL:", wsConnection.url);
    
    if (wsConnection.readyState === WebSocket.OPEN) {
      try {
        const messageString = JSON.stringify(request.data);
        console.log("[DEBUG] Sending to WebSocket, message length:", messageString.length);
        wsConnection.send(messageString);
        console.log("[DEBUG] Message sent successfully to WebSocket");
        sendResponse({ success: true });
      } catch (error) {
        console.error("[DEBUG] Error sending message to WebSocket:", error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.error("[DEBUG] WebSocket not connected, readyState:", wsConnection.readyState);
      sendResponse({ success: false, error: "WebSocket not connected" });
    }
    return true;
  }

  if (request.action === "clickCopyButton") {
    // Get the tab ID from the sender
    const tabId = sender.tab.id;
    
    console.log("Received clickCopyButton request");
    
    // Execute a script in the tab to click the copy button
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: clickCopyButton
    })
    .then(results => {
      console.log("Copy button click script executed:", results);
      
      if (results && results[0] && results[0].result && results[0].result.success) {
        // If copy was successful and we got the content directly
        const extractedContent = results[0].result.content;
        const messageId = results[0].result.messageId;
        
        // Send the content via WebSocket
        if (extractedContent) {
          sendWebSocketMessage({
            type: 'aiContent',
            content: extractedContent,
            messageId: messageId,
            timestamp: new Date().toISOString(),
            platform: request.platform || 'unknown'
          });
          
          sendResponse({ 
            success: true, 
            contentExtracted: true,
            contentLength: extractedContent.length
          });
        } else {
          sendResponse({ success: true, contentExtracted: false });
        }
      } else {
        sendResponse({ 
          success: false, 
          error: results && results[0] && results[0].result ? results[0].result.error : "Unknown error" 
        });
      }
    })
    .catch(error => {
      console.error("Error executing copy button click script:", error);
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

// Function that will be injected into the page to click the copy button
function clickCopyButton() {
  console.log(`Attempting to click copy button`);
  
  // Find all copy buttons on the page
  const copyButtons = document.querySelectorAll('button[aria-label="Copy"]');
  
  if (copyButtons.length === 0) {
    console.log("No copy buttons found");
    return {success: false, error: "No copy buttons found"};
  }
  
  // Get the last/most recent copy button (likely for the latest response)
  const lastCopyButton = copyButtons[copyButtons.length - 1];
  
  if (lastCopyButton && !lastCopyButton.disabled) {
    console.log("Found copy button, ensuring it has focus before clicking");
    
    // First, get the text content from the message element
    const messageElement = lastCopyButton.closest('article');
    let messageContent = "";
    
    if (messageElement) {
      // Try to find the actual content within the article
      const contentElement = messageElement.querySelector('.markdown');
      if (contentElement) {
        messageContent = contentElement.outerHTML || contentElement.innerText;
      } else {
        messageContent = messageElement.innerText || messageElement.textContent;
      }
      console.log("Extracted content length:", messageContent.length);
    }
    
    try {
      // Make sure the button is visible in the viewport
      lastCopyButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Focus the button first
      lastCopyButton.focus();
      
      // Try to click the button but catch any errors
      try {
        lastCopyButton.click();
      } catch (clickError) {
        console.warn("Copy button click failed, but continuing:", clickError);
        // Just log the error but don't let it stop execution
      }
      
      // Return success with the content we extracted directly,
      // even if the clipboard operation might have failed
      return {
        success: true, 
        content: messageContent,
        messageId: messageElement ? messageElement.getAttribute('data-message-id') : null,
        clipboardError: false
      };
    } catch (error) {
      console.error("Error during copy button operation:", error);
      // Even if there was an error, still return the content if we have it
      if (messageContent) {
        return {
          success: true,
          content: messageContent,
          messageId: messageElement ? messageElement.getAttribute('data-message-id') : null,
          clipboardError: true
        };
      }
      return {success: false, error: error.message};
    }
  } else {
    console.log("Copy button not found or is disabled");
    return {success: false, error: "Copy button not found or disabled"};
  }
}

// Test API connection
async function testApiConnection() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['apiUrl'], async function(result) {
      const apiUrl = result.apiUrl || 'http://localhost:3030';
      
      try {
        console.log(`Testing API connection to ${apiUrl}/api/prompts`);
        
        const response = await fetch(`${apiUrl}/api/prompts`);
        
        if (!response.ok) {
          resolve({ success: false, error: `Status: ${response.status}` });
          return;
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: 'Invalid response format' });
        }
      } catch (error) {
        resolve({ success: false, error: error.message });
      }
    });
  });
}

// Extended keep-alive mechanism
function setupExtendedKeepAlive() {
  // Keep service worker alive for extended periods
  const shortInterval = 15000; // 15 seconds
  const longInterval = 45000;  // 45 seconds
  
  // Fast pings when we have pending data
  const shortPing = setInterval(() => {
    const hasPendingData = questionCache.length > 0 || answerCache.length > 0;
    
    if (hasPendingData) {
      console.log("Short ping: Data pending, keeping worker alive");
      
      // If waiting too long with pending data, try upload again
      if (questionCache.length > 0 || answerCache.length > 0) {
        uploadCachedData();
      }
    }
  }, shortInterval);
  
  // Slower heartbeat for general keep-alive
  const longPing = setInterval(() => {
    console.log("Long ping: Service worker heartbeat");
    
    // Check for any interrupted uploads
    chrome.storage.local.get(['lastUploadAttempt'], function(result) {
      const lastAttempt = result.lastUploadAttempt || 0;
      const now = Date.now();
      
      // If it's been more than 2 minutes since last upload attempt and we have data
      if ((now - lastAttempt) > 120000 && (questionCache.length > 0 || answerCache.length > 0)) {
        console.log("Detected stalled upload, retrying...");
        uploadCachedData();
      }
    });
  }, longInterval);
  
  // Record upload attempts
  const originalUploadFn = uploadCachedData;
  uploadCachedData = function() {
    chrome.storage.local.set({'lastUploadAttempt': Date.now()});
    return originalUploadFn.apply(this, arguments);
  };
}

// Call the extended keep-alive setup
setupExtendedKeepAlive();

// Set up connection listener to keep the service worker active
chrome.runtime.onConnect.addListener(port => {
  console.log("Port connected:", port.name);
  
  port.onDisconnect.addListener(() => {
    console.log("Port disconnected");
  });
});


// Add this function to initialize WebSocket connection
function initWebSocketConnection() {
  // Get WebSocket URL from storage, default to localhost:3031
  chrome.storage.sync.get(['wsUrl'], function(result) {
    const wsUrl = result.wsUrl || 'ws://localhost:3031';
    connectToWebSocket(wsUrl);
  });
}

// Add function to connect to WebSocket
function connectToWebSocket(wsUrl) {
  // Clear any existing connection
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  
  // Clear any reconnect timer
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  
  try {
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = function() {
      console.log('WebSocket connection established');
      
      // Send a hello message
      sendWebSocketMessage({
        type: 'hello',
        clientType: 'chrome-extension',
        version: '1.0.2'
      });
    };
    
    wsConnection.onmessage = function(event) {
      console.log('WebSocket message received:', event.data);
      
      try {
        const message = JSON.parse(event.data);
        
        // Handle insertPrompt message
        if (message.type === 'insertPrompt') {
          // Send to all tabs to find the one with ChatGPT or Claude open
          chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, {
                action: 'insertPrompt',
                prompt: message.prompt,
                autoSubmit: message.autoSubmit !== false // Default to autoSubmit true if not specified
              }).catch(error => {
                // This is expected to fail for tabs that don't have our content script
                // console.log("Failed to send message to tab", tab.id, error);
              });
            });
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    wsConnection.onclose = function(event) {
      console.log('WebSocket connection closed:', event.code, event.reason);
      scheduleReconnect(wsUrl);
    };
    
    wsConnection.onerror = function(error) {
      console.error('WebSocket error:', error);
      // The onclose handler will be called after this
    };
  } catch (error) {
    console.error('Error setting up WebSocket:', error);
    scheduleReconnect(wsUrl);
  }
}

// Function to schedule WebSocket reconnection
function scheduleReconnect(wsUrl) {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
  }
  
  wsReconnectTimer = setTimeout(() => {
    console.log('Attempting to reconnect WebSocket...');
    connectToWebSocket(wsUrl);
  }, WS_RECONNECT_INTERVAL);
}

// Function to send message to WebSocket
function sendWebSocketMessage(message) {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    const messageString = typeof message === 'string' ? message : JSON.stringify(message);
    wsConnection.send(messageString);
    return true;
  }
  
  console.log('WebSocket not connected, cannot send message');
  return false;
}

// Initialize the extension - add WebSocket initialization
function initializeState() {
  chrome.storage.local.get(['questionCache', 'answerCache'], function(result) {
    if (result.questionCache) {
      questionCache = result.questionCache;
      console.log(`Loaded ${questionCache.length} cached questions`);
    }
    
    if (result.answerCache) {
      answerCache = result.answerCache;
      console.log(`Loaded ${answerCache.length} cached answers`);
    }
  });
  
  // Initialize WebSocket connection
  initWebSocketConnection();
}