// content.js

// Constants
const CHATGPT_INPUT_SELECTOR = '#prompt-textarea';
const CLAUDE_INPUT_SELECTOR = 'div[contenteditable="true"]';
const POLLING_INTERVAL = 100;
const MAX_RETRIES = 50;
const DEBUG = true;

// ChatGPT message selectors
const CHATGPT_QUESTION_SELECTOR = '[data-message-author-role="user"]';
const CHATGPT_ANSWER_SELECTOR = '[data-message-author-role="assistant"]';
const CHATGPT_CONVERSATION_TURN = 'article';

// Claude message selectors - preserved for future implementation
const CLAUDE_QUESTION_SELECTOR = '[data-message-author-role="user"]';
const CLAUDE_ANSWER_SELECTOR = '[data-message-author-role="assistant"]';
const CLAUDE_CONVERSATION_TURN = 'article';

// State
let retryCount = 0;
let pollingInterval = null;
let lastSubmittedQuestion = '';
let lastQuestionTimestamp = null;
let questionId = null;
let isWaitingForAnswer = false;
let answerObserver = null;

// Get current platform
function getCurrentPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes('chat.openai.com')) return 'chatgpt';
  if (hostname.includes('chatgpt.com')) return 'chatgpt';
  if (hostname.includes('claude.ai')) return 'claude';
  return null;
}

// Toggle search button state (enabled/disabled)
function toggleSearchButton(enabled) {
  console.log("Setting search button state to:", enabled ? "enabled" : "disabled");
  
  const platform = getCurrentPlatform();
  if (!platform) return;
  
  // Find search button
  let searchButton = document.querySelector('button[aria-label="Search"]');
  
  if (!searchButton) {
    console.log("Search button not found, will try again later");
    // Schedule a retry if button not found
    setTimeout(() => toggleSearchButton(enabled), 2000);
    return;
  }
  
  console.log("Found search button:", searchButton);
  
  // Check current state
  const ariaPressed = searchButton.getAttribute('aria-pressed');
  const isCurrentlyEnabled = ariaPressed === 'true';
  console.log("Current search button state:", isCurrentlyEnabled ? "enabled" : "disabled");
  
  // Only change state if different from current
  if (isCurrentlyEnabled !== enabled) {
    console.log("Changing search button state");
    
    // Click the button to toggle state if needed
    searchButton.click();
    
    // Schedule verification to ensure it worked
    setTimeout(() => {
      const nowPressed = searchButton.getAttribute('aria-pressed');
      console.log("Verification - button state now:", nowPressed === 'true' ? "enabled" : "disabled");
      
      // If state doesn't match expected state, try again
      if ((nowPressed === 'true') !== enabled) {
        console.log("Button state still doesn't match desired state, trying again");
        searchButton.click();
      }
    }, 300);
  } else {
    console.log("Search button already in desired state");
  }
}

// Start monitoring for answers
function startAnswerMonitoring(questionText) {
  console.log("Starting to monitor for answers to:", questionText);
  
  const platform = getCurrentPlatform();
  if (!platform) return;
  
  // Only proceed if we're on ChatGPT for now (keeping Claude code for future)
  if (platform !== 'chatgpt') {
    console.log("Q&A tracking currently implemented only for ChatGPT");
    return;
  }
  
  // Check if tracking is enabled in settings
  chrome.storage.sync.get(['trackQA'], function(result) {
    const trackQA = result.trackQA === undefined ? false : result.trackQA;
    console.log("Q&A tracking enabled:", trackQA); // Move the console log here
    
    if (!trackQA) {
      console.log("Q&A tracking is disabled in settings");
      return;
    }
    
    lastSubmittedQuestion = questionText;
    lastQuestionTimestamp = new Date().toISOString();
    isWaitingForAnswer = true;
    
    // Generate a unique ID for this question
    questionId = `q_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Store the question in background page cache
    storeQuestionData({
      id: questionId,
      platform: platform,
      question: questionText,
      timestamp: lastQuestionTimestamp,
      answered: false
    });
    
    // Start observing for new answer elements
    setupAnswerObserver(platform);
  });
}

function scanForExistingAnswers() {
  // Use the appropriate selector based on platform; here, we assume ChatGPT
  const answerElements = document.querySelectorAll(CHATGPT_ANSWER_SELECTOR);
  answerElements.forEach(answer => {
    // Check if this answer has already been processed to avoid duplicate work
    if (!answer.dataset.qaProcessed) {
      // Ensure the answer is complete
      if (!answer.querySelector('[aria-busy="true"]')) {
        console.log("Found existing complete answer; processing now.");
        processAnswer(answer);
        // Mark the answer as processed
        answer.dataset.qaProcessed = "true";
      }
    }
  });
}


// Helper to process a found answer element
// Existing processAnswer function, possibly updated as needed
function processAnswer(latestAnswer) {
  // Skip if this answer element was already processed.
  if (latestAnswer.dataset.qaProcessed === "true") {
    console.log("Answer already processed, skipping duplicate.");
    return;
  }
  
  // Mark this element as processed.
  latestAnswer.dataset.qaProcessed = "true";
  
  // Extract answer text using your existing logic.
  const answerText = extractAnswerText(latestAnswer);
  // If answerText is empty or only a zero‑width space, do not proceed.
  if (answerText.trim() === "" || answerText.trim() === "​") {
    console.log("Extracted answer text is empty or invalid, skipping.");
    return;
  }
  
  const modelInfo = extractModelInfo(latestAnswer, getCurrentPlatform());
  const answerTimestamp = new Date().toISOString();
  
  // Get the conversation turn element to extract turn number.
  const turnElement = latestAnswer.closest(CHATGPT_CONVERSATION_TURN);
  const turnNumber = turnElement
    ? turnElement.getAttribute('data-testid')?.replace('conversation-turn-', '')
    : null;
  
  // Store the answer data.
  storeAnswerData({
    id: `a_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    question_id: questionId,
    message_id: latestAnswer.getAttribute('data-message-id'),
    platform: getCurrentPlatform(),
    answer: answerText,
    model: modelInfo.model,
    timestamp: answerTimestamp,
    turn_number: turnNumber ? parseInt(turnNumber) : null,
    metadata: JSON.stringify({
      messageAttributes: extractMessageAttributes(latestAnswer),
      modelSlug: modelInfo.modelSlug
    })
  });
  
  isWaitingForAnswer = false;
  
  // Disconnect observer if needed.
  if (answerObserver) {
    answerObserver.disconnect();
  }
}


// Set up an initial scan after the page loads
window.addEventListener('load', () => {
  // Give the page a moment to render all existing answers (adjust delay as needed)
  setTimeout(() => {
    console.log("Scanning for pre-rendered answers after page load...");
    scanForExistingAnswers();
  }, 2000);
});


// Adjusted answer monitoring with fallback check
function setupAnswerObserver(platform) {
  // Disconnect any existing observer
  if (answerObserver) {
    answerObserver.disconnect();
  }
  
  const answerSelector = platform === 'claude' ? CLAUDE_ANSWER_SELECTOR : CHATGPT_ANSWER_SELECTOR;
  
  // Find the conversation container
  const conversationContainer = document.querySelector('main') || document;
  
  // Create a mutation observer to watch for new answers
  answerObserver = new MutationObserver((mutations) => {
    if (!isWaitingForAnswer) return;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'subtree') {
        const answerElements = document.querySelectorAll(answerSelector);
        if (answerElements.length > 0) {
          const latestAnswer = answerElements[answerElements.length - 1];
          // Check if answer is complete
          if (!latestAnswer.querySelector('[aria-busy="true"]') && isWaitingForAnswer) {
            console.log("Mutation observer found complete answer; processing after delay");
            setTimeout(() => processAnswer(latestAnswer), 500);
            break;
          }
        }
      }
    }
  });
  
  answerObserver.observe(conversationContainer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-message-id', 'aria-busy']
  });
  
  console.log("Answer observer set up for platform:", platform);
  
  // Fallback: Check after a short delay in case the answer was already present
  setTimeout(() => {
    if (isWaitingForAnswer) {
      const answerElements = document.querySelectorAll(answerSelector);
      if (answerElements.length > 0) {
        const latestAnswer = answerElements[answerElements.length - 1];
        if (!latestAnswer.querySelector('[aria-busy="true"]')) {
          console.log("Fallback check: found an answer element; processing now");
          processAnswer(latestAnswer);
        }
      }
    }
  }, 1000);
}


// Extract text from an answer element
function extractAnswerText(answerElement) {
  const markdownElement = answerElement.querySelector('.markdown.prose') ||
                          answerElement.querySelector('.markdown') ||
                          answerElement.querySelector('.prose');

  if (markdownElement) {
    const paragraphs = Array.from(markdownElement.querySelectorAll('p, table'));
    if (paragraphs.length > 0) {
      // Try using innerText first
      let combinedText = paragraphs.map(p => p.innerText.trim()).join('\n\n').trim();
      // If innerText yields nothing, fall back to textContent
      if (!combinedText) {
        combinedText = paragraphs.map(p => p.textContent.trim()).join('\n\n').trim();
      }
      return combinedText;
    }
    // Fallback for markdown element
    let text = markdownElement.innerText.trim();
    if (!text) {
      text = markdownElement.textContent.trim();
    }
    return text;
  }
  
  // Check for alternative text containers
  const textContainer = answerElement.querySelector('[data-is-last-node]') ||
                        answerElement.querySelector('[data-is-only-node]');
  if (textContainer) {
    let text = textContainer.innerText.trim();
    if (!text) {
      text = textContainer.textContent.trim();
    }
    return text;
  }
  
  // Last resort: try the answerElement itself
  let text = answerElement.innerText.trim();
  if (!text) {
    text = answerElement.textContent.trim();
  }
  return text;
}

// Fallback polling to capture the answer element if not caught by the observer
function pollForAnswer(answerSelector, maxPollTime = 5000, pollInterval = 500) {
  let elapsed = 0;
  const intervalId = setInterval(() => {
    const answerElements = document.querySelectorAll(answerSelector);
    if (answerElements.length > 0) {
      const latestAnswer = answerElements[answerElements.length - 1];
      // Check if the answer is complete (no child with aria-busy="true")
      if (!latestAnswer.querySelector('[aria-busy="true"]')) {
        console.log("Polling found a complete answer element; processing now");
        processAnswer(latestAnswer);
        clearInterval(intervalId);
        return;
      }
    }
    elapsed += pollInterval;
    if (elapsed >= maxPollTime) {
      console.log("Polling timeout reached without finding a complete answer element");
      clearInterval(intervalId);
    }
  }, pollInterval);
}

// Fallback polling to capture the answer element if not caught by the observer
function pollForAnswer(answerSelector, maxPollTime = 5000, pollInterval = 500) {
  let elapsed = 0;
  const intervalId = setInterval(() => {
    const answerElements = document.querySelectorAll(answerSelector);
    if (answerElements.length > 0) {
      const latestAnswer = answerElements[answerElements.length - 1];
      // Check if the answer is complete (no child with aria-busy="true")
      if (!latestAnswer.querySelector('[aria-busy="true"]')) {
        console.log("Polling found a complete answer element; processing now");
        processAnswer(latestAnswer);
        clearInterval(intervalId);
        return;
      }
    }
    elapsed += pollInterval;
    if (elapsed >= maxPollTime) {
      console.log("Polling timeout reached without finding a complete answer element");
      clearInterval(intervalId);
    }
  }, pollInterval);
}

// Wait until the answer element's text remains unchanged for a set number of polls
function waitForStableText(answerElement, callback, stabilityDelay = 300, maxAttempts = 5) {
  let lastText = answerElement.innerText.trim();
  let stableCount = 0;
  const intervalId = setInterval(() => {
    const currentText = answerElement.innerText.trim();
    if (currentText === lastText && currentText !== "") {
      stableCount++;
      if (stableCount >= maxAttempts) {
        clearInterval(intervalId);
        callback(currentText);
      }
    } else {
      // Reset the counter if the text has changed
      lastText = currentText;
      stableCount = 0;
    }
  }, stabilityDelay);
}


// Updated setupAnswerObserver with fallback polling
function setupAnswerObserver(platform) {
  if (answerObserver) {
    answerObserver.disconnect();
  }
  
  const answerSelector = platform === 'claude' ? CLAUDE_ANSWER_SELECTOR : CHATGPT_ANSWER_SELECTOR;
  const conversationContainer = document.querySelector('main') || document;
  
  answerObserver = new MutationObserver((mutations) => {
    if (!isWaitingForAnswer) return;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'subtree') {
        const answerElements = document.querySelectorAll(answerSelector);
        if (answerElements.length > 0) {
          const latestAnswer = answerElements[answerElements.length - 1];
          if (!latestAnswer.querySelector('[aria-busy="true"]') && isWaitingForAnswer) {
            console.log("Observer found a complete answer; processing after delay");
            setTimeout(() => processAnswer(latestAnswer), 500);
            break;
          }
        }
      }
    }
  });
  
  answerObserver.observe(conversationContainer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-message-id', 'aria-busy']
  });
  
  console.log("Answer observer set up for platform:", platform);
  
  // Start fallback polling in case observer misses the answer element
  pollForAnswer(answerSelector);
}


// Extract model information
function extractModelInfo(answerElement, platform) {
  let model = 'unknown';
  let modelSlug = null;
  
  if (platform === 'chatgpt') {
    try {
      // First attempt - get model from attribute
      modelSlug = answerElement.getAttribute('data-message-model-slug');
      if (modelSlug && modelSlug !== 'null') {
        model = modelSlug; // Use the slug as model if available
      }
      
      // Second attempt - look for the model in the o3-mini span
      if (model === 'unknown') {
        const modelSpan = document.querySelector('.overflow-hidden.text-clip.whitespace-nowrap.text-sm');
        if (modelSpan && modelSpan.textContent) {
          model = modelSpan.textContent.trim();
        }
      }
      
      // Third attempt - look for button with model info
      if (model === 'unknown') {
        const modelButton = document.querySelector('[id^="radix-"] .overflow-hidden');
        if (modelButton && modelButton.textContent) {
          model = modelButton.textContent.trim();
        }
      }
      
      // Fourth attempt - check for o3-mini directly in the DOM
      if (model === 'unknown') {
        const modelMenuButton = document.querySelector('button[aria-haspopup="menu"]');
        if (modelMenuButton && modelMenuButton.textContent.includes('o3-mini')) {
          model = 'o3-mini';
        }
      }
    } catch (error) {
      console.error("Error extracting model info:", error);
    }
  } else if (platform === 'claude') {
    // Claude code preserved for future implementation
    try {
      const modelElement = document.querySelector('[aria-label^="Claude"]');
      if (modelElement) {
        model = modelElement.getAttribute('aria-label') || 'Claude';
      }
    } catch (error) {
      console.error("Error extracting Claude model info:", error);
    }
  }
  
  return { model, modelSlug };
}

function logElementDiagnostics(element, label) {
  console.log(`--- ${label} Diagnostics ---`);
  console.log("Element:", element);
  
  if (!element) {
    console.log("Element is null or undefined");
    return;
  }
  
  console.log("Classes:", element.className);
  console.log("Attributes:", Array.from(element.attributes).map(a => `${a.name}="${a.value}"`).join(', '));
  
  // Check for specific elements
  console.log("Contains .markdown.prose:", !!element.querySelector('.markdown.prose'));
  console.log("Contains .markdown:", !!element.querySelector('.markdown'));
  console.log("Contains [data-is-last-node]:", !!element.querySelector('[data-is-last-node]'));
  
  // Add model-specific checks
  const modelSlug = element.getAttribute('data-message-model-slug');
  console.log("data-message-model-slug:", modelSlug);
  
  // Get a sample of text
  const textSample = element.textContent.substring(0, 200) + (element.textContent.length > 200 ? '...' : '');
  console.log("Text Content Sample:", textSample);
}

// Extract all available message attributes
function extractMessageAttributes(element) {
  const attributes = {};
  
  // Get all data attributes
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-')) {
      attributes[attr.name] = attr.value;
    }
  }
  
  return attributes;
}

// Store question data via background script
function storeQuestionData(questionData) {
  chrome.runtime.sendMessage({
    action: "storeQuestionData",
    data: questionData
  }, response => {
    console.log("Background response to question data:", response);
  });
}

// Store answer data via background script
function storeAnswerData(answerData) {
  chrome.runtime.sendMessage({
    action: "storeAnswerData",
    data: answerData
  }, response => {
    console.log("Background response to answer data:", response);
  });
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);

  if (request.action === "insertPrompt") {
    // Get current platform
    const platform = getCurrentPlatform();
    if (!platform) {
      console.error("Unsupported platform");
      sendResponse({ success: false, error: "Unsupported platform" });
      return;
    }

    // Clear any existing polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Reset retry count
    retryCount = 0;

    // Poll for input element
    pollingInterval = setInterval(() => {
      // Select appropriate input selector based on platform
      const selector = platform === 'claude' ? CLAUDE_INPUT_SELECTOR : CHATGPT_INPUT_SELECTOR;
      const inputBox = document.querySelector(selector);
      console.log("Trying to find input box:", inputBox, "for platform:", platform);

      if (inputBox) {
        // Clear the interval once element is found
        clearInterval(pollingInterval);

        // Insert the prompt
        if (platform === 'claude') {
          // Claude.ai specific handling
          inputBox.textContent = request.prompt;
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // ChatGPT handling
          inputBox.value = request.prompt;
          inputBox.innerHTML = request.prompt;
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Focus the input
        inputBox.focus();

        // Start monitoring for answers
        startAnswerMonitoring(request.prompt);

        // Send success response
        sendResponse({ success: true });
        
        // Only call the background script if autoSubmit is enabled
        if (request.autoSubmit) {
          // Get current tab ID and call the background script to execute the click
          console.log("Auto-submit is enabled, will attempt to submit prompt");
          // Get current tab ID and call the background script to execute the click
          setTimeout(() => {
            console.log("Sending clickSubmitButton message to background script");
            chrome.runtime.sendMessage({
              action: "clickSubmitButton",
              platform: platform
            }, response => {
              console.log("Background script response to clickSubmitButton:", response);
            });
          }, 500);
        }
      } else if (retryCount >= MAX_RETRIES) {
        // Clear interval if max retries reached
        clearInterval(pollingInterval);
        console.error("Failed to find input element after max retries");
        sendResponse({ success: false, error: "Input element not found" });
      }

      retryCount++;
    }, POLLING_INTERVAL);

    // Keep message channel open for async response
    return true;
  }
  
  // Handle toggle search button message
  if (request.action === "toggleSearch") {
    toggleSearchButton(request.enabled);
    sendResponse({ success: true });
    return true;
  }
});

// When content script loads, check if search should be enabled/disabled
chrome.storage.sync.get(['searchEnabled'], function(result) {
  if (typeof result.searchEnabled !== 'undefined') {
    const searchEnabled = result.searchEnabled;
    console.log('Initial search button setting:', searchEnabled);
    
    // Apply the setting after a delay to ensure page has loaded
    setTimeout(() => {
      toggleSearchButton(searchEnabled);
    }, 2000);
  }
});

// Setup page load handler to start monitoring the conversation
window.addEventListener('load', () => {
  console.log("Page loaded, setting up conversation monitoring");
  
  // Get current platform
  const platform = getCurrentPlatform();
  if (!platform) return;
  
  // Check if tracking is enabled and only apply for ChatGPT for now
  if (platform !== 'chatgpt') return;
  
  chrome.storage.sync.get(['trackQA'], function(result) {
    const trackQA = result.trackQA === undefined ? false : result.trackQA;
    
    if (!trackQA) {
      console.log("Q&A tracking is disabled in settings");
      return;
    }
    
    // Set up mutation observer to detect when new messages are added
    const conversationContainer = document.querySelector('main') || document;
    
    const conversationObserver = new MutationObserver((mutations) => {
      // Check if user just submitted a message (not through our extension)
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const userMessages = document.querySelectorAll(CHATGPT_QUESTION_SELECTOR);
          
          if (userMessages.length > 0) {
            const latestMessage = userMessages[userMessages.length - 1];
            
            // Only track if it's a new message and we're not already waiting for an answer
            if (!isWaitingForAnswer) {
              const messageText = latestMessage.innerText.trim();
              
              // Make sure it's not our last recorded message
              if (messageText && messageText !== lastSubmittedQuestion) {
                // Start monitoring for the answer
                startAnswerMonitoring(messageText);
              }
            }
          }
        }
      }
    });
    
    // Start observing for new messages
    conversationObserver.observe(conversationContainer, {
      childList: true,
      subtree: true
    });
    
    console.log("Conversation observer started for ChatGPT");
  });
});

// Cleanup on page unload
window.addEventListener('unload', () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  if (answerObserver) {
    answerObserver.disconnect();
  }
});