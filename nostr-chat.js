// Nostr Chat Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Relays to connect to
    const relays = [
        'wss://relay.damus.io',
        'wss://relay.nostr.band'
    ];

    // Chat channel identifier (using a specific tag for this event)
    const CHANNEL_ID = 'ottobrunner-hofflohmarkt-2025';

    // State variables
    let userPrivateKey = null;
    let userPublicKey = null;
    let relayPool = null;
    let processedEvents = new Set(); // Set to track processed event IDs for deduplication
    let userHandle = null; // Store the user's handle name

    // Function to request profile information for a pubkey
    function requestProfileInfo(pubkey) {
        // Skip if we don't have a relay pool yet
        if (!relayPool) return;

        console.log("Requesting profile info for:", pubkey);

        try {
            // Subscribe to profile events for this pubkey
            relayPool.subscribe(
                relays,
                [
                    {
                        kinds: [0], // Profile metadata
                        authors: [pubkey]
                    }
                ],
                {
                    onevent(event) {
                        try {
                            console.log("Received profile event:", event);

                            // Parse the profile information
                            const profile = JSON.parse(event.content);

                            // Store in cache
                            window.profileCache[pubkey] = profile;

                            console.log("Updated profile cache for:", pubkey, profile);

                            // Update any existing messages from this pubkey
                            updateMessagesForPubkey(pubkey, profile);
                        } catch (error) {
                            console.error("Error processing profile event:", error);
                        }
                    }
                }
            );
        } catch (error) {
            console.error("Error requesting profile info:", error);
        }
    }

    // Function to update existing messages with new profile information
    function updateMessagesForPubkey(pubkey, profile) {
        // Find all message elements for this pubkey
        const messages = document.querySelectorAll(`.chat-message[data-pubkey="${pubkey}"]`);

        if (messages.length === 0) return;

        console.log(`Updating ${messages.length} messages for pubkey:`, pubkey);

        // Determine display name from profile
        let displayName = null;
        if (profile.name) {
            displayName = profile.name;
        } else if (profile.display_name) {
            displayName = profile.display_name;
        } else if (profile.displayName) {
            displayName = profile.displayName;
        } else if (profile.nip05) {
            displayName = profile.nip05;
        }

        if (!displayName) return;

        // Update each message
        messages.forEach(message => {
            const usernameElement = message.querySelector('.chat-username');
            if (usernameElement) {
                usernameElement.textContent = displayName;
            }
        });
    }

    // Function to reset identity
    function resetIdentity() {
        console.log("Resetting Nostr identity");

        // Clear localStorage
        localStorage.removeItem('nostr_private_key');

        // Reset state variables
        userPrivateKey = null;
        userPublicKey = null;

        // Clear processed events set
        processedEvents.clear();

        // Clear chat container
        if (chatContainer) {
            chatContainer.innerHTML = '';
        }

        // Show login container and hide chat interface
        if (loginContainer && chatInterface) {
            loginContainer.style.display = 'block';
            chatInterface.style.display = 'none';
        }

        // Alert the user
        alert("Ihre Nostr-Identität wurde zurückgesetzt. Sie können nun einen neuen Schlüssel erstellen.");
    }

    // DOM Elements
    const loginContainer = document.getElementById('nostr-login-container');
    const chatInterface = document.getElementById('nostr-chat-interface');
    const chatContainer = document.getElementById('chat-container');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('chat-send-button');
    const generateKeyButton = document.getElementById('generate-key-button');
    const loginExtensionButton = document.getElementById('login-extension-button');

    // Helper functions for hex conversion
    function bytesToHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes;
    }

    // Check if we have a saved key in localStorage
    function checkForSavedKey() {
        try {
            const savedKey = localStorage.getItem('nostr_private_key');
            if (savedKey) {
                console.log("Found saved key in localStorage");

                // Validate the key format
                if (!/^[0-9a-f]{64}$/i.test(savedKey)) {
                    console.error("Invalid key format in localStorage");
                    localStorage.removeItem('nostr_private_key');
                    return;
                }

                userPrivateKey = savedKey;

                // Try different ways to get public key based on available API
                try {
                    if (window.getPublicKey) {
                        console.log("Using global getPublicKey for saved key");
                        userPublicKey = window.getPublicKey(hexToBytes(savedKey));
                    } else if (window.NostrTools && typeof window.NostrTools.getPublicKey === 'function') {
                        console.log("Using NostrTools.getPublicKey for saved key");
                        userPublicKey = window.NostrTools.getPublicKey(hexToBytes(savedKey));
                    } else if (window.nostrTools && typeof window.nostrTools.getPublicKey === 'function') {
                        console.log("Using nostrTools.getPublicKey for saved key");
                        userPublicKey = window.nostrTools.getPublicKey(hexToBytes(savedKey));
                    } else {
                        throw new Error("No method found to get public key");
                    }

                    console.log("Loaded key pair:", { publicKey: userPublicKey });

                    // Validate the public key
                    if (!/^[0-9a-f]{64}$/i.test(userPublicKey)) {
                        console.error("Invalid public key format:", userPublicKey);
                        throw new Error("Invalid public key format");
                    }

                    // We'll get the handle from profile events later
                    userHandle = null;
                    console.log("User handle will be set from profile events");

                    showChatInterface();

                    // Initialize connection with a slight delay to ensure libraries are fully loaded
                    setTimeout(() => {
                        initNostrConnection();
                    }, 500);
                } catch (keyError) {
                    console.error("Error deriving public key:", keyError);
                    alert("Fehler beim Laden des gespeicherten Schlüssels. Ein neuer Schlüssel wird benötigt.");
                    localStorage.removeItem('nostr_private_key');
                }
            }
        } catch (error) {
            console.error("Error checking for saved key:", error);
        }
    }

    // Generate a new key pair
    generateKeyButton.addEventListener('click', () => {
        try {
            let secretKey;

            // Try different ways to generate a key based on available API
            if (window.generatePrivateKey) {
                console.log("Using global generatePrivateKey");
                secretKey = window.generatePrivateKey();
                // Check if it's a hex string or Uint8Array
                if (typeof secretKey === 'string') {
                    userPrivateKey = secretKey;
                    secretKey = hexToBytes(secretKey);
                } else {
                    userPrivateKey = bytesToHex(secretKey);
                }
            } else if (window.NostrTools && typeof window.NostrTools.generateSecretKey === 'function') {
                console.log("Using NostrTools.generateSecretKey");
                secretKey = window.NostrTools.generateSecretKey();
                userPrivateKey = bytesToHex(secretKey);
            } else if (window.NostrTools && typeof window.NostrTools.generatePrivateKey === 'function') {
                console.log("Using NostrTools.generatePrivateKey");
                secretKey = window.NostrTools.generatePrivateKey();
                // Check if it's a hex string or Uint8Array
                if (typeof secretKey === 'string') {
                    userPrivateKey = secretKey;
                    secretKey = hexToBytes(secretKey);
                } else {
                    userPrivateKey = bytesToHex(secretKey);
                }
            } else if (window.nostrTools && typeof window.nostrTools.generateSecretKey === 'function') {
                console.log("Using nostrTools.generateSecretKey");
                secretKey = window.nostrTools.generateSecretKey();
                userPrivateKey = bytesToHex(secretKey);
            } else if (window.nostrTools && typeof window.nostrTools.generatePrivateKey === 'function') {
                console.log("Using nostrTools.generatePrivateKey");
                secretKey = window.nostrTools.generatePrivateKey();
                // Check if it's a hex string or Uint8Array
                if (typeof secretKey === 'string') {
                    userPrivateKey = secretKey;
                    secretKey = hexToBytes(secretKey);
                } else {
                    userPrivateKey = bytesToHex(secretKey);
                }
            } else {
                console.log("Generating random key with crypto API");
                // Generate a random key if the library function isn't available
                secretKey = new Uint8Array(32);
                window.crypto.getRandomValues(secretKey);
                userPrivateKey = bytesToHex(secretKey);
            }

            console.log("Generated private key:", userPrivateKey);

            // Try different ways to get public key based on available API
            if (window.getPublicKey) {
                console.log("Using global getPublicKey");
                userPublicKey = window.getPublicKey(secretKey);
            } else if (window.NostrTools && typeof window.NostrTools.getPublicKey === 'function') {
                console.log("Using NostrTools.getPublicKey");
                userPublicKey = window.NostrTools.getPublicKey(secretKey);
            } else if (window.nostrTools && typeof window.nostrTools.getPublicKey === 'function') {
                console.log("Using nostrTools.getPublicKey");
                userPublicKey = window.nostrTools.getPublicKey(secretKey);
            } else {
                throw new Error("No method found to get public key");
            }

            console.log("Generated key pair:", { privateKey: userPrivateKey, publicKey: userPublicKey });

            // Save to localStorage
            localStorage.setItem('nostr_private_key', userPrivateKey);

            showChatInterface();
            initNostrConnection();
        } catch (error) {
            console.error("Error generating key:", error);
            alert("Fehler beim Erstellen eines neuen Schlüssels. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        }
    });

    // Login with extension (NIP-07)
    loginExtensionButton.addEventListener('click', async () => {
        if (window.nostr) {
            try {
                // Try to get the public key from the extension
                userPublicKey = await window.nostr.getPublicKey();

                // Check if we got a valid public key
                if (!userPublicKey) {
                    throw new Error("No public key returned from extension");
                }

                console.log("Successfully connected to Nostr extension, public key:", userPublicKey);
                showChatInterface();
                initNostrConnection();
            } catch (error) {
                console.error('Error connecting to Nostr extension:', error);

                // Check for specific error messages
                const errorMessage = error?.message || String(error);

                if (errorMessage.includes("no private key found") ||
                    errorMessage.includes("No key") ||
                    errorMessage.includes("not found")) {
                    // This is a common error when the extension is installed but no key is configured
                    alert('Die Nostr-Erweiterung ist installiert, aber es wurde kein Schlüssel gefunden. ' +
                          'Bitte konfigurieren Sie zuerst einen Schlüssel in Ihrer Erweiterung oder ' +
                          'erstellen Sie einen neuen Schlüssel für diesen Chat.');
                } else if (errorMessage.includes("user rejected")) {
                    // User rejected the request
                    alert('Sie haben die Verbindung abgelehnt. Bitte erlauben Sie den Zugriff, ' +
                          'wenn Sie die Erweiterung verwenden möchten, oder erstellen Sie einen neuen Schlüssel.');
                } else {
                    // Generic error
                    alert('Fehler beim Verbinden mit der Nostr-Erweiterung. Bitte versuchen Sie es erneut oder erstellen Sie einen neuen Schlüssel.');
                }
            }
        } else {
            alert('Keine Nostr-Erweiterung gefunden. Bitte installieren Sie eine Nostr-Erweiterung (wie nos2x oder Alby) oder erstellen Sie einen neuen Schlüssel.');
        }
    });

    // Show chat interface and hide login
    function showChatInterface() {
        loginContainer.style.display = 'none';
        chatInterface.style.display = 'block';
    }

    // Initialize Nostr connection
    function initNostrConnection() {
        try {
            console.log("Initializing direct relay connections");

            // Initialize profile cache if not already done
            if (!window.profileCache) {
                window.profileCache = {};
            }

            // Create a direct implementation using individual relays
            relayPool = {
                relays: [],
                activeRelays: [],

                // Subscribe to events
                subscribe: function(relayUrls, filters, callbacks) {
                    console.log("Subscribing to relays:", relayUrls);
                    console.log("With filters:", filters);

                    for (const url of relayUrls) {
                        try {
                            let relay;
                            // Try to initialize relay
                            if (window.NostrTools && typeof window.NostrTools.relayInit === 'function') {
                                console.log(`Initializing relay ${url} with NostrTools.relayInit`);
                                relay = window.NostrTools.relayInit(url);
                            } else if (window.nostrTools && typeof window.nostrTools.relayInit === 'function') {
                                console.log(`Initializing relay ${url} with nostrTools.relayInit`);
                                relay = window.nostrTools.relayInit(url);
                            } else {
                                console.error("No relay initialization function found");
                                continue;
                            }

                            // Set up connection handlers
                            relay.on('connect', () => {
                                console.log(`Connected to ${url}`);
                                this.activeRelays.push(url);

                                // Subscribe to events
                                try {
                                    const sub = relay.sub(filters);
                                    console.log(`Subscribed to ${url}`, sub);

                                    sub.on('event', event => {
                                        console.log(`Received event from ${url}:`, event);
                                        callbacks.onevent(event);
                                    });

                                    sub.on('eose', () => {
                                        console.log(`End of stored events from ${url}`);
                                    });
                                } catch (subError) {
                                    console.error(`Error subscribing to ${url}:`, subError);
                                }
                            });

                            relay.on('error', (err) => {
                                console.error(`Error with relay ${url}:`, err);
                                // Remove from active relays
                                const index = this.activeRelays.indexOf(url);
                                if (index > -1) {
                                    this.activeRelays.splice(index, 1);
                                }
                            });

                            relay.on('disconnect', () => {
                                console.log(`Disconnected from ${url}`);
                                // Remove from active relays
                                const index = this.activeRelays.indexOf(url);
                                if (index > -1) {
                                    this.activeRelays.splice(index, 1);
                                }

                                // Try to reconnect after a delay
                                setTimeout(() => {
                                    console.log(`Attempting to reconnect to ${url}`);
                                    relay.connect();
                                }, 5000);
                            });

                            // Connect to relay
                            console.log(`Connecting to ${url}`);
                            relay.connect();
                            this.relays.push(relay);
                        } catch (e) {
                            console.error(`Error setting up relay ${url}:`, e);
                        }
                    }
                },

                // Publish event to relays
                publish: async function(relayUrls, event) {
                    console.log("Publishing event to relays:", relayUrls);
                    console.log("Event:", event);

                    const promises = [];

                    for (const url of relayUrls) {
                        try {
                            // Find existing relay or create new one
                            let relay = this.relays.find(r => r.url === url);

                            if (!relay) {
                                if (window.NostrTools && typeof window.NostrTools.relayInit === 'function') {
                                    console.log(`Initializing new relay ${url} for publishing`);
                                    relay = window.NostrTools.relayInit(url);
                                } else if (window.nostrTools && typeof window.nostrTools.relayInit === 'function') {
                                    console.log(`Initializing new relay ${url} for publishing`);
                                    relay = window.nostrTools.relayInit(url);
                                } else {
                                    console.error("No relay initialization function found");
                                    continue;
                                }

                                relay.on('connect', () => {
                                    console.log(`Connected to ${url} for publishing`);
                                    this.activeRelays.push(url);
                                });

                                relay.connect();
                                this.relays.push(relay);
                            }

                            // Publish event
                            console.log(`Publishing to ${url}`);
                            try {
                                // Try to publish and handle different return types
                                const pub = relay.publish(event);

                                // Check if pub is a Promise
                                if (pub && typeof pub.then === 'function') {
                                    promises.push(
                                        pub.then(
                                            () => console.log(`Published to ${url} successfully`),
                                            (err) => console.error(`Failed to publish to ${url}:`, err)
                                        )
                                    );
                                } else {
                                    // If not a Promise, just log success
                                    console.log(`Publication request sent to ${url}`);
                                }
                            } catch (pubError) {
                                console.error(`Error during publish to ${url}:`, pubError);
                            }
                        } catch (e) {
                            console.error(`Error publishing to relay ${url}:`, e);
                        }
                    }

                    return Promise.allSettled(promises);
                }
            };

            // Create a buffer to store events for sorting
            const eventBuffer = [];
            let isInitialLoad = true;
            let initialLoadTimeout = null;

            // Subscribe to channel messages
            relayPool.subscribe(
                relays,
                [
                    {
                        kinds: [1], // Regular notes
                        '#t': [CHANNEL_ID] // Tag for our channel
                    }
                ],
                {
                    onevent(event) {
                        if (isInitialLoad) {
                            // During initial load, add to buffer for sorting
                            eventBuffer.push(event);

                            // Clear any existing timeout
                            if (initialLoadTimeout) {
                                clearTimeout(initialLoadTimeout);
                            }

                            // Set a timeout to process the buffer
                            initialLoadTimeout = setTimeout(() => {
                                console.log(`Processing ${eventBuffer.length} buffered events`);

                                // Sort events by timestamp
                                eventBuffer.sort((a, b) => a.created_at - b.created_at);

                                // Display events in order
                                eventBuffer.forEach(e => displayMessage(e));

                                // Clear buffer and mark initial load as complete
                                eventBuffer.length = 0;
                                isInitialLoad = false;
                                console.log("Initial load complete, now displaying events in real-time");
                            }, 2000); // Wait 2 seconds to collect initial events
                        } else {
                            // After initial load, display events immediately
                            displayMessage(event);
                        }
                    },
                    oneose() {
                        // End of stored events, process any remaining in buffer
                        if (isInitialLoad && eventBuffer.length > 0) {
                            console.log(`End of stored events, processing ${eventBuffer.length} buffered events`);

                            // Sort events by timestamp
                            eventBuffer.sort((a, b) => a.created_at - b.created_at);

                            // Display events in order
                            eventBuffer.forEach(e => displayMessage(e));

                            // Clear buffer and mark initial load as complete
                            eventBuffer.length = 0;
                            isInitialLoad = false;
                            console.log("Initial load complete, now displaying events in real-time");
                        }
                    }
                }
            );

            // We only send kind=1 events as requested
            // Add a welcome message after the initial load is complete
            const addWelcomeMessage = () => {
                // Check if initial load is complete
                if (isInitialLoad) {
                    // Still loading, check again in a bit
                    console.log("Still loading events, delaying welcome message");
                    setTimeout(addWelcomeMessage, 500);
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

                // Create a local event for display only
                const welcomeEvent = {
                    kind: 1,
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: userPublicKey,
                    content: '... betritt den Chat.',
                    id: 'local-welcome-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15),
                    tags: welcomeTags
                };

                // Display the welcome message locally
                displayMessage(welcomeEvent);
            };

            // Start the welcome message process
            setTimeout(addWelcomeMessage, 1000);

        } catch (error) {
            console.error("Error initializing Nostr connection:", error);
            alert("Fehler beim Verbinden mit Nostr-Relays. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        }
    }

    // Display a message in the chat
    function displayMessage(event) {
        // Skip if this is a local event without an ID
        if (!event.id) {
            console.log("Skipping event without ID:", event);
            return;
        }

        // Check if we've already processed this event to avoid duplicates
        if (event.id.startsWith('local-')) {
            // Always display local events (they have special IDs starting with 'local-')
            console.log("Displaying local event:", event.id);
        } else if (processedEvents.has(event.id)) {
            // Skip duplicate events
            console.log("Skipping duplicate event:", event.id);
            return;
        } else {
            // Add to processed events set
            console.log("Processing new event:", event.id);
            processedEvents.add(event.id);
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.dataset.eventId = event.id; // Store event ID for reference
        messageDiv.dataset.pubkey = event.pubkey; // Store pubkey for profile updates

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

        // Check if the event has metadata with a display name or nip05 identifier
        let displayName = shortenPubkey(event.pubkey); // Default to shortened pubkey

        // Store the pubkey as a data attribute for potential future use
        username.dataset.pubkey = event.pubkey;

        // Check for handle name in the event content (might contain profile info)
        try {
            // In Nostr, profile info might be in kind=0 events or in the content of regular events
            if (event.kind === 0 && event.content) {
                // Try to parse profile info from kind=0 events
                try {
                    const profile = JSON.parse(event.content);
                    if (profile.name) {
                        displayName = profile.name;
                    } else if (profile.display_name) {
                        displayName = profile.display_name;
                    } else if (profile.displayName) {
                        displayName = profile.displayName;
                    } else if (profile.nip05) {
                        displayName = profile.nip05;
                    }
                } catch (e) {
                    console.log("Could not parse profile info:", e);
                }
            }

            // Check for handle name in the event tags
            if (event.tags && Array.isArray(event.tags)) {
                // Look for various tag types that might contain identity info
                for (const tag of event.tags) {
                    // Special tag for our handle name
                    if (tag[0] === 'p' && tag[1] === 'sattler') {
                        displayName = 'sattler';
                        break;
                    }

                    // NIP-05 identifier
                    if (tag[0] === 'nip05' && tag[1]) {
                        displayName = tag[1];
                        break;
                    }

                    // Name tag
                    if (tag[0] === 'name' && tag[1]) {
                        displayName = tag[1];
                        break;
                    }

                    // Display name tag
                    if ((tag[0] === 'display_name' || tag[0] === 'displayName') && tag[1]) {
                        displayName = tag[1];
                        break;
                    }

                    // Some clients use 'd' tag for display name
                    if (tag[0] === 'd' && tag[1]) {
                        displayName = tag[1];
                        break;
                    }
                }
            }

            // We'll use a cache for profile information to avoid repeated lookups
            if (!window.profileCache) {
                window.profileCache = {};
            }

            // Check if we already have this profile in cache
            if (window.profileCache[event.pubkey]) {
                const profile = window.profileCache[event.pubkey];
                if (profile.name) {
                    displayName = profile.name;
                } else if (profile.display_name) {
                    displayName = profile.display_name;
                } else if (profile.displayName) {
                    displayName = profile.displayName;
                } else if (profile.nip05) {
                    displayName = profile.nip05;
                }
            } else {
                // If not in cache, request profile information
                requestProfileInfo(event.pubkey);
            }
        } catch (error) {
            console.log("Error processing display name:", error);
        }

        // If this is our own message and we haven't already set a handle name via tags
        // Only use "Sie" if we don't have a better name already
        if (event.pubkey === userPublicKey && displayName === shortenPubkey(event.pubkey)) {
            // Check if this is a local event with our special tag
            let hasSpecialTag = false;
            if (event.tags && Array.isArray(event.tags)) {
                for (const tag of event.tags) {
                    if ((tag[0] === 'name' || tag[0] === 'display_name' || tag[0] === 'displayName') && tag[1]) {
                        hasSpecialTag = true;
                        break;
                    }
                }
            }

            // If it doesn't have our special tag, use "Sie"
            if (!hasSpecialTag) {
                displayName = 'Sie'; // Default for own messages
            }
        }

        username.textContent = displayName;

        // Add tooltip with full pubkey for reference
        username.title = event.pubkey;

        const timestamp = document.createElement('span');
        timestamp.className = 'chat-timestamp';
        timestamp.textContent = formatTimestamp(event.created_at);

        header.appendChild(username);
        header.appendChild(timestamp);

        // Create message content
        const content = document.createElement('div');
        content.textContent = event.content;

        // Add to message div
        messageDiv.appendChild(header);
        messageDiv.appendChild(content);

        // Add to chat container and scroll to bottom
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Send a message
    async function sendMessage(content) {
        if (!content || !content.trim()) return;

        try {
            console.log("Sending message:", content);

            // Create event with basic tags
            const eventTags = [['t', CHANNEL_ID]];

            // Add handle name tags only if we have a handle
            if (userHandle) {
                eventTags.push(['name', userHandle]);
                eventTags.push(['display_name', userHandle]);
                eventTags.push(['d', userHandle]);
            }

            // Create the event
            const event = {
                kind: 1, // Only send kind=1 events as requested
                created_at: Math.floor(Date.now() / 1000),
                tags: eventTags,
                content: content,
                pubkey: userPublicKey // Add pubkey to the event
            };

            console.log("Created event template with handle name:", event);

            let signedEvent;

            // Sign with extension or with our private key
            if (window.nostr && !userPrivateKey) {
                console.log("Signing with Nostr extension");
                try {
                    signedEvent = await window.nostr.signEvent(event);
                    console.log("Event signed with extension:", signedEvent);
                } catch (signError) {
                    console.error("Error signing with extension:", signError);
                    alert("Fehler beim Signieren mit der Nostr-Erweiterung. Bitte versuchen Sie es erneut.");
                    return;
                }
            } else {
                // Try different ways to sign based on available API
                try {
                    // Try all possible signing methods
                    if (window.finalizeEvent) {
                        console.log("Signing with global finalizeEvent");
                        signedEvent = window.finalizeEvent(
                            event,
                            hexToBytes(userPrivateKey)
                        );
                    } else if (window.signEvent) {
                        console.log("Signing with global signEvent");
                        signedEvent = window.signEvent(
                            event,
                            userPrivateKey
                        );
                    } else if (window.NostrTools && typeof window.NostrTools.finalizeEvent === 'function') {
                        console.log("Signing with NostrTools.finalizeEvent");
                        signedEvent = window.NostrTools.finalizeEvent(
                            event,
                            hexToBytes(userPrivateKey)
                        );
                    } else if (window.NostrTools && typeof window.NostrTools.signEvent === 'function') {
                        console.log("Signing with NostrTools.signEvent");
                        signedEvent = window.NostrTools.signEvent(
                            event,
                            userPrivateKey
                        );
                    } else if (window.nostrTools && typeof window.nostrTools.finalizeEvent === 'function') {
                        console.log("Signing with nostrTools.finalizeEvent");
                        signedEvent = window.nostrTools.finalizeEvent(
                            event,
                            hexToBytes(userPrivateKey)
                        );
                    } else if (window.nostrTools && typeof window.nostrTools.signEvent === 'function') {
                        console.log("Signing with nostrTools.signEvent");
                        signedEvent = window.nostrTools.signEvent(
                            event,
                            userPrivateKey
                        );
                    } else {
                        // We can't sign the event properly
                        console.error("No method found to sign the event");
                        alert("Fehler: Die Nachricht konnte nicht signiert werden. Die Nostr-Bibliothek wurde nicht korrekt geladen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
                        return; // Exit the function without sending
                    }

                    console.log("Signed event:", signedEvent);

                    // Verify that the event has all required fields or try to fix it
                    console.log("Checking signed event:", signedEvent);

                    // If the event is just a string (which can happen with some libraries), it might be just the signature
                    if (typeof signedEvent === 'string') {
                        try {
                            // First try to parse it as JSON
                            try {
                                signedEvent = JSON.parse(signedEvent);
                                console.log("Parsed event from JSON string:", signedEvent);
                            } catch (parseError) {
                                console.log("Not a JSON string, might be just the signature");

                                // If it's not JSON, it might be just the signature
                                // Check if it looks like a hex string (signature)
                                if (/^[0-9a-f]{64,}$/i.test(signedEvent)) {
                                    console.log("String appears to be a signature, reconstructing event");

                                    // Create a new event with the signature
                                    const originalEvent = { ...event };

                                    // Generate an ID if we can
                                    let id = '';
                                    if (window.NostrTools && typeof window.NostrTools.getEventHash === 'function') {
                                        id = window.NostrTools.getEventHash(originalEvent);
                                    } else if (window.nostrTools && typeof window.nostrTools.getEventHash === 'function') {
                                        id = window.nostrTools.getEventHash(originalEvent);
                                    } else if (window.getEventHash) {
                                        id = window.getEventHash(originalEvent);
                                    }

                                    // Reconstruct the event
                                    signedEvent = {
                                        ...originalEvent,
                                        id: id || 'missing-id', // Use generated ID or placeholder
                                        sig: signedEvent // Use the string as the signature
                                    };

                                    console.log("Reconstructed event:", signedEvent);
                                } else {
                                    console.error("Failed to parse event string and it doesn't look like a signature");
                                    throw new Error("Invalid event format");
                                }
                            }
                        } catch (error) {
                            console.error("Failed to handle event string:", error);
                            alert("Fehler: Die Nachricht wurde nicht korrekt signiert und kann nicht gesendet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
                            return;
                        }
                    }

                    // Check if we have a valid event object
                    if (!signedEvent || typeof signedEvent !== 'object') {
                        console.error("Invalid event object:", signedEvent);
                        alert("Fehler: Die Nachricht wurde nicht korrekt signiert und kann nicht gesendet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
                        return;
                    }

                    // Try to fix missing fields if possible
                    if (!signedEvent.pubkey && userPublicKey) {
                        console.log("Adding missing pubkey to event");
                        signedEvent.pubkey = userPublicKey;
                    }

                    if (!signedEvent.created_at) {
                        console.log("Adding missing created_at to event");
                        signedEvent.created_at = Math.floor(Date.now() / 1000);
                    }

                    if (!signedEvent.kind) {
                        console.log("Adding missing kind to event");
                        signedEvent.kind = 1;
                    }

                    if (!signedEvent.tags) {
                        console.log("Adding missing tags to event");
                        signedEvent.tags = [['t', CHANNEL_ID]];
                    }

                    // Final check for critical fields
                    if (!signedEvent.id || !signedEvent.sig) {
                        console.error("Event is missing critical fields (id or sig):", signedEvent);
                        alert("Fehler: Die Nachricht wurde nicht korrekt signiert und kann nicht gesendet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
                        return;
                    }

                    // Verify the signature if possible
                    let signatureVerified = false;

                    try {
                        if (window.verifyEvent) {
                            console.log("Verifying with global verifyEvent");
                            const isValid = window.verifyEvent(signedEvent);
                            if (isValid) {
                                console.log("Event signature verified successfully with global verifyEvent");
                                signatureVerified = true;
                            } else {
                                console.warn("Event signature verification failed with global verifyEvent");
                            }
                        }

                        if (!signatureVerified && window.NostrTools && typeof window.NostrTools.verifyEvent === 'function') {
                            console.log("Verifying with NostrTools.verifyEvent");
                            const isValid = window.NostrTools.verifyEvent(signedEvent);
                            if (isValid) {
                                console.log("Event signature verified successfully with NostrTools.verifyEvent");
                                signatureVerified = true;
                            } else {
                                console.warn("Event signature verification failed with NostrTools.verifyEvent");
                            }
                        }

                        if (!signatureVerified && window.nostrTools && typeof window.nostrTools.verifyEvent === 'function') {
                            console.log("Verifying with nostrTools.verifyEvent");
                            const isValid = window.nostrTools.verifyEvent(signedEvent);
                            if (isValid) {
                                console.log("Event signature verified successfully with nostrTools.verifyEvent");
                                signatureVerified = true;
                            } else {
                                console.warn("Event signature verification failed with nostrTools.verifyEvent");
                            }
                        }

                        // If we couldn't verify the signature with any method, but we have id and sig fields,
                        // we'll still try to send the event
                        if (!signatureVerified) {
                            console.warn("Could not verify event signature with any available method, but event has id and sig fields");
                            console.warn("Will attempt to send the event anyway");
                        }
                    } catch (verifyError) {
                        console.error("Error during signature verification:", verifyError);
                        // Continue anyway since we have id and sig fields
                    }
                } catch (signError) {
                    console.error("Error signing event:", signError);
                    alert("Fehler beim Signieren der Nachricht. Bitte versuchen Sie es erneut.");
                    return;
                }
            }

            // Publish to relays
            if (relayPool && typeof relayPool.publish === 'function') {
                console.log("Publishing with relayPool.publish");
                try {
                    // Try to publish and handle different return types
                    const pubResult = relayPool.publish(relays, signedEvent);

                    // Check if pubResult is a Promise
                    if (pubResult && typeof pubResult.then === 'function') {
                        try {
                            await pubResult;
                            console.log("Published to relays successfully");
                        } catch (awaitError) {
                            console.error("Error awaiting publish result:", awaitError);
                            // We'll still display the message locally even if publishing fails
                        }
                    } else {
                        console.log("Publication request sent to relays");
                    }
                } catch (pubError) {
                    console.error("Error publishing with relayPool:", pubError);
                    // We'll still display the message locally even if publishing fails
                }
            } else {
                console.error("relayPool.publish is not a function");
            }

            // Display our own message immediately
            // Create a copy of the event with a special local ID to ensure it's displayed
            const localEvent = { ...signedEvent };

            // Change the ID to a local version to ensure it's displayed
            localEvent.id = 'local-sent-' + (signedEvent.id || Date.now() + '-' + Math.random().toString(36).substring(2, 15));

            // Add a special tag to indicate this is our message with our preferred handle
            if (!localEvent.tags) {
                localEvent.tags = [];
            }

            // Add handle name tags if we have profile info
            if (window.profileCache && window.profileCache[userPublicKey]) {
                const profile = window.profileCache[userPublicKey];

                if (profile.name) {
                    localEvent.tags.push(['name', profile.name]);
                }

                if (profile.display_name) {
                    localEvent.tags.push(['display_name', profile.display_name]);
                } else if (profile.displayName) {
                    localEvent.tags.push(['display_name', profile.displayName]);
                }
            }

            // Log the local event for debugging
            console.log("Displaying local event with handle:", localEvent);

            // Display the message with our local ID
            displayMessage(localEvent);

            // Add the original event ID to the processed events set so when it comes back from the relay, it won't be displayed again
            if (signedEvent.id) {
                processedEvents.add(signedEvent.id);
                console.log("Added our message ID to processed events:", signedEvent.id);
            }

            // Clear input
            chatInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Fehler beim Senden der Nachricht. Bitte versuchen Sie es erneut.');
        }
    }

    // Send button click handler
    sendButton.addEventListener('click', () => {
        sendMessage(chatInput.value);
    });

    // Enter key to send
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(chatInput.value);
        }
    });

    // Helper function to shorten pubkey for display
    function shortenPubkey(pubkey) {
        return pubkey.substring(0, 6) + '...' + pubkey.substring(pubkey.length - 4);
    }

    // Helper function to format timestamp
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Set up the hidden reset identity feature
    const resetTrigger = document.getElementById('reset-identity-trigger');
    if (resetTrigger) {
        resetTrigger.style.cursor = 'pointer';
        resetTrigger.title = 'Identität zurücksetzen (versteckte Funktion)';

        // Add a subtle style to indicate it's clickable (only visible on hover)
        resetTrigger.addEventListener('mouseover', function() {
            this.style.textDecoration = 'underline';
            this.style.color = '#0056b3';
        });

        resetTrigger.addEventListener('mouseout', function() {
            this.style.textDecoration = 'none';
            this.style.color = '';
        });

        // Add click event to reset identity
        resetTrigger.addEventListener('click', function() {
            // Ask for confirmation
            if (confirm('Möchten Sie Ihre Nostr-Identität wirklich zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                resetIdentity();
            }
        });
    }

    // Initialize when the library is loaded
    window.addEventListener('load', function() {
        console.log("Page loaded, checking for Nostr library");

        // Function to check if Nostr is ready and initialize
        function initializeWhenReady() {
            if (window.isNostrReady && window.isNostrReady()) {
                console.log("Nostr library is ready, initializing chat");
                checkForSavedKey();
            } else {
                console.log("Nostr library not ready yet, waiting...");
                setTimeout(initializeWhenReady, 500);
            }
        }

        // Start checking
        initializeWhenReady();
    });
});
