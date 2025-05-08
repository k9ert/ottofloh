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

    // Use global userPublicKey if available
    const useUserPublicKey = window.userPublicKey || userPublicKey;

    // Use global relay pool and relays if available
    const useRelayPool = window.relayPool || relayPool;
    const useRelays = window.relays || relays;

    // Create the message element
    const messageDiv = window.NostrUI.createMessageElement(event, useUserPublicKey, useRelayPool, useRelays);

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
    const displayName = window.NostrProfile.getDisplayName(event);

    // Store the pubkey as a data attribute for potential future use
    username.dataset.pubkey = event.pubkey;

    // If not in cache, request profile information
    if (!window.profileCache[event.pubkey]) {
        // Use global relay pool and relays if available, otherwise use the ones passed as parameters
        const useRelayPool = window.relayPool || relayPool;
        const useRelays = window.relays || relays;

        if (useRelayPool) {
            console.log(`Requesting profile info for ${event.pubkey} from createMessageElement`);
            window.NostrProfile.requestProfileInfo(event.pubkey, useRelayPool, useRelays);
        } else {
            console.warn(`Cannot request profile for ${event.pubkey}: no relay pool available`);
        }
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

    // Create tags for the welcome message - only include the channel tag
    const welcomeTags = [['t', CHANNEL_ID]];

    // We don't need to add any profile-related tags to the event
    // This ensures consistent behavior for all users, regardless of whether they have NIP-05 or not
    console.log("Not adding any profile tags to welcome message to ensure consistent behavior");

    // We still request profile info for display purposes, but we don't add it to the event tags
    if (window.relayPool && window.relays && userPublicKey) {
        console.log("Requesting profile info for display purposes only");
        window.NostrProfile.requestProfileInfo(userPublicKey, window.relayPool, window.relays);
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
    // Use global userPublicKey if available
    const useUserPublicKey = window.userPublicKey || userPublicKey;

    // Use global relay pool and relays if available
    const useRelayPool = window.relayPool;
    const useRelays = window.relays;

    window.NostrUI.displayMessageInOrder(welcomeEvent, useUserPublicKey, useRelayPool, useRelays);

    // Scroll to bottom to ensure the welcome message is visible
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 50);
};

// Update the username in the chat info
window.NostrUI.updateUsernameDisplay = function(userPublicKey) {
    console.log("Updating username display for pubkey:", userPublicKey);

    const resetIdentityTrigger = document.getElementById('reset-identity-trigger');
    if (!resetIdentityTrigger) {
        console.warn("Cannot update username display: reset-identity-trigger element not found");
        return;
    }

    if (!userPublicKey) {
        console.warn("Cannot update username display: userPublicKey is undefined");
        resetIdentityTrigger.textContent = '------';
        return;
    }

    // Default to first 6 characters of pubkey
    let displayName = userPublicKey.substring(0, 6);
    console.log("Initial display name:", displayName);

    // Check if we have a profile for this user
    if (window.profileCache && window.profileCache[userPublicKey]) {
        const profile = window.profileCache[userPublicKey];
        console.log("Found profile in cache:", profile);

        // Prioritize NIP-05 identifier if available
        if (profile.nip05) {
            displayName = profile.nip05;
            console.log("Using nip05 from profile:", displayName);
        } else if (profile.display_name) {
            displayName = profile.display_name;
            console.log("Using display_name from profile:", displayName);
        } else if (profile.displayName) {
            displayName = profile.displayName;
            console.log("Using displayName from profile:", displayName);
        } else if (profile.name) {
            displayName = profile.name;
            console.log("Using name from profile:", displayName);
        } else {
            console.log("No usable name fields found in profile, using pubkey:", displayName);
        }
    } else {
        console.log("No profile found in cache for pubkey:", userPublicKey);

        // Request profile information if not in cache
        if (window.NostrProfile && typeof window.NostrProfile.requestProfileInfo === 'function') {
            console.log("Requesting profile info for pubkey:", userPublicKey);

            // Get the relay pool and relays from the global scope
            const relayPool = window.relayPool;
            const relays = window.relays || ['wss://relay.damus.io'];

            if (relayPool) {
                window.NostrProfile.requestProfileInfo(userPublicKey, relayPool, relays);
            } else {
                console.warn("Cannot request profile: relayPool not available");
            }
        }
    }

    // Update the display
    resetIdentityTrigger.textContent = displayName;
    console.log("Updated username display to:", displayName);
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

    // Reset the username display to default
    if (resetIdentityTrigger) {
        resetIdentityTrigger.textContent = '------';
    }

    // Alert the user
    alert("Ihre Nostr-Identität wurde zurückgesetzt. Sie können nun einen neuen Schlüssel erstellen.");
};
