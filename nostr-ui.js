// nostr-ui.js - UI-Komponenten und Nachrichtenanzeige für den Nostr-Chat

// Initialisiere das NostrUI-Objekt, falls es noch nicht existiert
window.NostrUI = window.NostrUI || {};

// Set of processed event IDs to avoid duplicates
window.NostrUI.processedEvents = new Set();

// DOM Elements
let chatContainer;
let loadingIndicator;

// Initialize UI elements
window.NostrUI.initUI = function() {
    chatContainer = document.getElementById('chat-container');
    loadingIndicator = document.getElementById('loading-indicator');
};

// Show chat interface and hide login
window.NostrUI.showChatInterface = function() {
    const loginContainer = document.getElementById('nostr-login-container');
    const chatInterface = document.getElementById('nostr-chat-interface');

    loginContainer.style.display = 'none';
    chatInterface.style.display = 'block';

    // Show loading indicator and hide chat container initially
    loadingIndicator.style.display = 'flex';
    chatContainer.style.display = 'none';
};

// Hide loading indicator and show chat container
window.NostrUI.hideLoadingIndicator = function() {
    loadingIndicator.style.display = 'none';
    chatContainer.style.display = 'block';
};

// Display a message in the correct chronological order
window.NostrUI.displayMessageInOrder = function(event, userPublicKey, relayPool, relays) {
    // Skip if this is a local event without an ID
    if (!event.id) {
        console.log("Skipping event without ID:", event);
        return;
    }

    // Log the event we're trying to display
    console.log("Attempting to display event in order:", {
        id: event.id,
        content: event.content,
        created_at: event.created_at,
        pubkey: event.pubkey
    });

    // Check if we've already processed this event to avoid duplicates
    if (event.id.startsWith('local-')) {
        // Always display local events (they have special IDs starting with 'local-')
        console.log("Displaying local event:", event.id);
    } else if (window.NostrUI.processedEvents.has(event.id)) {
        // Skip duplicate events
        console.log("Skipping duplicate event:", event.id);
        return;
    } else {
        // Add to processed events set
        console.log("Processing new event:", event.id);
        window.NostrUI.processedEvents.add(event.id);
    }

    // Create the message element
    const messageDiv = window.NostrUI.createMessageElement(event, userPublicKey, relayPool, relays);

    // Find the correct position to insert the message based on timestamp
    window.NostrUI.insertMessageInOrder(messageDiv, event.created_at);
};

// Create a message element without adding it to the DOM
window.NostrUI.createMessageElement = function(event, userPublicKey, relayPool, relays) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.dataset.eventId = event.id; // Store event ID for reference
    messageDiv.dataset.pubkey = event.pubkey; // Store pubkey for profile updates
    messageDiv.dataset.timestamp = event.created_at; // Store timestamp for ordering

    // Check if this is our own message
    if (event.pubkey === userPublicKey) {
        messageDiv.classList.add('self');
    } else {
        messageDiv.classList.add('others');
    }

    // Create header with username (handle name or shortened pubkey) and timestamp
    const header = document.createElement('div');
    header.className = 'chat-header';

    const username = document.createElement('span');
    username.className = 'chat-username';

    // Get display name for this event
    const displayName = window.NostrProfile.getDisplayName(event, userPublicKey);

    // Store the pubkey as a data attribute for potential future use
    username.dataset.pubkey = event.pubkey;

    // If not in cache, request profile information
    if (!window.profileCache[event.pubkey]) {
        window.NostrProfile.requestProfileInfo(event.pubkey, relayPool, relays);
    }

    username.textContent = displayName;

    // Add tooltip with full pubkey for reference
    username.title = event.pubkey;

    const timestamp = document.createElement('span');
    timestamp.className = 'chat-timestamp';
    timestamp.textContent = window.NostrUtils.formatTimestamp(event.created_at);

    header.appendChild(username);
    header.appendChild(timestamp);

    // Create message content
    const content = document.createElement('div');
    content.textContent = event.content;

    // Add to message div
    messageDiv.appendChild(header);
    messageDiv.appendChild(content);

    return messageDiv;
};

// Insert a message element in the correct chronological order
window.NostrUI.insertMessageInOrder = function(messageDiv, timestamp) {
    // Get all existing message elements
    const existingMessages = chatContainer.querySelectorAll('.chat-message');

    // If there are no messages yet, just append
    if (existingMessages.length === 0) {
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return;
    }

    // Find the correct position to insert the message
    let inserted = false;
    for (let i = 0; i < existingMessages.length; i++) {
        const existingTimestamp = parseInt(existingMessages[i].dataset.timestamp || '0');

        // If the new message is older than the current message, insert before it
        if (timestamp < existingTimestamp) {
            chatContainer.insertBefore(messageDiv, existingMessages[i]);
            inserted = true;
            break;
        }
    }

    // If we didn't find a place to insert, append at the end
    if (!inserted) {
        chatContainer.appendChild(messageDiv);
    }

    // Scroll to bottom if we're already near the bottom
    const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
    if (isNearBottom) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
};

// Add a welcome message to the chat
window.NostrUI.addWelcomeMessage = function(userPublicKey, CHANNEL_ID, isInitialLoad) {
    // Check if initial load is complete
    if (isInitialLoad) {
        // Still loading, check again in a bit
        console.log("Still loading events, delaying welcome message");
        setTimeout(() => window.NostrUI.addWelcomeMessage(userPublicKey, CHANNEL_ID, isInitialLoad), 500);
        return;
    }

    // Add a welcome message to the chat locally without sending it to relays
    console.log("Initial load complete, adding welcome message locally");

    // Create tags for the welcome message
    const welcomeTags = [['t', CHANNEL_ID]];

    // Add handle name tags if we have profile info
    if (window.profileCache && window.profileCache[userPublicKey]) {
        const profile = window.profileCache[userPublicKey];

        if (profile.name) {
            welcomeTags.push(['name', profile.name]);
        }

        if (profile.display_name) {
            welcomeTags.push(['display_name', profile.display_name]);
        } else if (profile.displayName) {
            welcomeTags.push(['display_name', profile.displayName]);
        }
    }

    // Create a local event for display only with a timestamp that ensures it appears at the end
    const welcomeEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000) + 1, // Add 1 second to ensure it's the newest
        pubkey: userPublicKey,
        content: '... betritt den Chat.',
        id: 'local-welcome-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15),
        tags: welcomeTags
    };

    // Display the welcome message locally
    window.NostrUI.displayMessageInOrder(welcomeEvent, userPublicKey);

    // Scroll to bottom to ensure the welcome message is visible
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 50);
};

// Reset identity
window.NostrUI.resetIdentity = function() {
    console.log("Resetting Nostr identity");

    // Clear localStorage
    localStorage.removeItem('nostr_private_key');

    // Reset state variables
    window.userPrivateKey = null;
    window.userPublicKey = null;

    // Clear processed events set
    window.NostrUI.processedEvents.clear();

    // Clear chat container
    if (chatContainer) {
        chatContainer.innerHTML = '';
    }

    // Show login container and hide chat interface
    const loginContainer = document.getElementById('nostr-login-container');
    const chatInterface = document.getElementById('nostr-chat-interface');

    if (loginContainer && chatInterface) {
        loginContainer.style.display = 'block';
        chatInterface.style.display = 'none';
    }

    // Alert the user
    alert("Ihre Nostr-Identität wurde zurückgesetzt. Sie können nun einen neuen Schlüssel erstellen.");
};
