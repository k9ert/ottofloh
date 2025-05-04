// Nostr Chat Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Relays to connect to - using only one reliable relay for now
    const relays = [
        'wss://relay.damus.io'
    ];

    // Chat channel identifier (using a specific tag for this event)
    const CHANNEL_ID = 'ottobrunner-hofflohmarkt-2025';

    // State variables
    let userPrivateKey = null;
    let userPublicKey = null;
    let relayPool = null;
    let processedEvents = new Set(); // Set to track processed event IDs for deduplication

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
    const loadingIndicator = document.getElementById('loading-indicator');
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

        // Show loading indicator and hide chat container initially
        loadingIndicator.style.display = 'flex';
        chatContainer.style.display = 'none';
    }

    // Hide loading indicator and show chat container
    function hideLoadingIndicator() {
        loadingIndicator.style.display = 'none';
        chatContainer.style.display = 'block';
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
                            // Try to initialize relay with additional options
                            if (window.NostrTools && typeof window.NostrTools.relayInit === 'function') {
                                console.log(`Initializing relay ${url} with NostrTools.relayInit`);
                                // Add options for better reliability
                                const options = {
                                    reconnect: true,
                                    maxRetries: 10,
                                    retryTimeout: 5000
                                };
                                relay = window.NostrTools.relayInit(url, options);
                            } else if (window.nostrTools && typeof window.nostrTools.relayInit === 'function') {
                                console.log(`Initializing relay ${url} with nostrTools.relayInit`);
                                // Add options for better reliability
                                const options = {
                                    reconnect: true,
                                    maxRetries: 10,
                                    retryTimeout: 5000
                                };
                                relay = window.nostrTools.relayInit(url, options);
                            } else {
                                console.error("No relay initialization function found");
                                continue;
                            }

                            // Set up connection handlers
                            relay.on('connect', () => {
                                console.log(`Connected to ${url}`);

                                // Clear connection timeout if it exists
                                if (relay._connectionTimeout) {
                                    clearTimeout(relay._connectionTimeout);
                                    relay._connectionTimeout = null;
                                }

                                // Add to active relays if not already there
                                if (!this.activeRelays.includes(url)) {
                                    this.activeRelays.push(url);
                                }

                                // Now the WebSocket should be defined - add error handler
                                if (relay.ws) {
                                    relay.ws.onerror = (wsError) => {
                                        console.error(`WebSocket error with ${url}:`, wsError);
                                    };
                                }

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
                                // If the error is undefined, just log it but don't take any action
                                if (err === undefined) {
                                    console.log(`Ignoring undefined error with relay ${url} - this is likely a harmless WebSocket event`);
                                    return; // Exit early without doing anything
                                }

                                // Handle defined errors
                                const errorMessage = err ? (err.message || String(err)) : 'Unknown WebSocket error';
                                console.error(`Error with relay ${url}: ${errorMessage}`);

                                // Remove from active relays
                                const index = this.activeRelays.indexOf(url);
                                if (index > -1) {
                                    this.activeRelays.splice(index, 1);
                                }

                                // Try to reconnect after a delay
                                setTimeout(() => {
                                    console.log(`Attempting to reconnect to ${url} after error`);
                                    try {
                                        // Check if the WebSocket is already connecting or open
                                        if (relay.status !== 1 && relay.status !== 2) { // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
                                            relay.connect();
                                        } else {
                                            console.log(`Relay ${url} is already connecting or open, no need to reconnect`);
                                        }
                                    } catch (reconnectError) {
                                        console.error(`Failed to reconnect to ${url}:`, reconnectError);
                                    }
                                }, 5000);
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

                            // WebSocket error handling is now in the main connect handler

                            // Connect to relay with timeout
                            console.log(`Connecting to ${url}`);
                            try {
                                // Add the relay to our list before connecting
                                this.relays.push(relay);

                                // Set a connection timeout
                                const connectionTimeout = setTimeout(() => {
                                    console.warn(`Connection timeout for ${url}, creating new relay instance`);
                                    try {
                                        // Remove this relay from our list
                                        const relayIndex = this.relays.indexOf(relay);
                                        if (relayIndex > -1) {
                                            this.relays.splice(relayIndex, 1);
                                        }

                                        // Force close the connection
                                        try {
                                            if (relay.ws) {
                                                relay.ws.close();
                                            }
                                        } catch (closeError) {
                                            console.error(`Error closing timed out connection to ${url}:`, closeError);
                                        }

                                        // Create a completely new relay instance
                                        setTimeout(() => {
                                            try {
                                                console.log(`Creating new relay instance for ${url}`);
                                                let newRelay;

                                                // Initialize with the same options as before
                                                if (window.NostrTools && typeof window.NostrTools.relayInit === 'function') {
                                                    const options = {
                                                        reconnect: true,
                                                        maxRetries: 10,
                                                        retryTimeout: 5000
                                                    };
                                                    newRelay = window.NostrTools.relayInit(url, options);
                                                } else if (window.nostrTools && typeof window.nostrTools.relayInit === 'function') {
                                                    const options = {
                                                        reconnect: true,
                                                        maxRetries: 10,
                                                        retryTimeout: 5000
                                                    };
                                                    newRelay = window.nostrTools.relayInit(url, options);
                                                } else {
                                                    console.error("No relay initialization function found for reconnect");
                                                    return;
                                                }

                                                // Set up the same event handlers
                                                newRelay.on('connect', () => {
                                                    console.log(`Connected to ${url} (new instance)`);

                                                    // Add to active relays if not already there
                                                    if (!this.activeRelays.includes(url)) {
                                                        this.activeRelays.push(url);
                                                    }

                                                    // Now the WebSocket should be defined - add error handler
                                                    if (newRelay.ws) {
                                                        newRelay.ws.onerror = (wsError) => {
                                                            console.error(`WebSocket error with ${url} (new instance):`, wsError);
                                                        };
                                                    }

                                                    // Re-subscribe to the same filters if we have them
                                                    if (filters) {
                                                        try {
                                                            const sub = newRelay.sub(filters);
                                                            console.log(`Re-subscribed to ${url} (new instance)`, sub);

                                                            // Set up the same event handlers
                                                            if (callbacks) {
                                                                if (callbacks.onevent) {
                                                                    sub.on('event', callbacks.onevent);
                                                                }
                                                                if (callbacks.oneose) {
                                                                    sub.on('eose', callbacks.oneose);
                                                                }
                                                            }
                                                        } catch (subError) {
                                                            console.error(`Error re-subscribing to ${url} (new instance):`, subError);
                                                        }
                                                    }
                                                });

                                                // Set up error handler
                                                newRelay.on('error', (err) => {
                                                    // If the error is undefined, just log it but don't take any action
                                                    if (err === undefined) {
                                                        console.log(`Ignoring undefined error with relay ${url} (new instance) - this is likely a harmless WebSocket event`);
                                                        return; // Exit early without doing anything
                                                    }

                                                    // Handle defined errors
                                                    const errorMessage = err ? (err.message || String(err)) : 'Unknown WebSocket error';
                                                    console.error(`Error with relay ${url} (new instance): ${errorMessage}`);

                                                    // Remove from active relays
                                                    const index = this.activeRelays.indexOf(url);
                                                    if (index > -1) {
                                                        this.activeRelays.splice(index, 1);
                                                    }
                                                });

                                                // Set up disconnect handler
                                                newRelay.on('disconnect', () => {
                                                    console.log(`Disconnected from ${url} (new instance)`);

                                                    // Remove from active relays
                                                    const index = this.activeRelays.indexOf(url);
                                                    if (index > -1) {
                                                        this.activeRelays.splice(index, 1);
                                                    }
                                                });

                                                // Connect to the new relay
                                                newRelay.connect();

                                                // Add to our list of relays
                                                this.relays.push(newRelay);
                                            } catch (newRelayError) {
                                                console.error(`Failed to create new relay instance for ${url}:`, newRelayError);
                                            }
                                        }, 2000); // Wait 2 seconds before creating a new instance
                                    } catch (reconnectError) {
                                        console.error(`Error during relay recreation for ${url}:`, reconnectError);
                                    }
                                }, 10000); // 10 second timeout

                                // Store the connection timeout for later clearing
                                relay._connectionTimeout = connectionTimeout;

                                relay.connect();
                            } catch (connectError) {
                                console.error(`Error connecting to ${url}:`, connectError);
                                // Try to reconnect after a delay
                                setTimeout(() => {
                                    console.log(`Attempting to reconnect to ${url} after connection error`);
                                    try {
                                        relay.connect();
                                    } catch (reconnectError) {
                                        console.error(`Failed to reconnect to ${url}:`, reconnectError);
                                    }
                                }, 5000);
                            }
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
                                    // Add options for better reliability
                                    const options = {
                                        reconnect: true,
                                        maxRetries: 10,
                                        retryTimeout: 5000
                                    };
                                    relay = window.NostrTools.relayInit(url, options);
                                } else if (window.nostrTools && typeof window.nostrTools.relayInit === 'function') {
                                    console.log(`Initializing new relay ${url} for publishing`);
                                    // Add options for better reliability
                                    const options = {
                                        reconnect: true,
                                        maxRetries: 10,
                                        retryTimeout: 5000
                                    };
                                    relay = window.nostrTools.relayInit(url, options);
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

                            // Add a small delay before publishing to avoid rate limiting
                            setTimeout(() => {
                                console.log(`Publishing to ${url}`);
                                try {
                                    // Try to publish and handle different return types
                                    const pub = relay.publish(event);

                                    // Check if pub is a Promise
                                    if (pub && typeof pub.then === 'function') {
                                        promises.push(
                                            pub.then(
                                                () => console.log(`Published to ${url} successfully`),
                                                (err) => {
                                                    console.error(`Failed to publish to ${url}:`, err);
                                                    // If we get a rate limit error, try again with a longer delay
                                                    if (err && (
                                                        String(err).includes('rate') ||
                                                        String(err).includes('limit') ||
                                                        String(err).includes('spam')
                                                    )) {
                                                        console.log(`Detected possible rate limiting, retrying with longer delay`);
                                                        setTimeout(() => {
                                                            try {
                                                                console.log(`Retrying publish to ${url}`);
                                                                relay.publish(event);
                                                            } catch (retryError) {
                                                                console.error(`Error during retry publish to ${url}:`, retryError);
                                                            }
                                                        }, 5000); // 5 second delay for retry
                                                    }
                                                }
                                            )
                                        );
                                    } else {
                                        // If not a Promise, just log success
                                        console.log(`Publication request sent to ${url}`);
                                    }
                                } catch (pubError) {
                                    console.error(`Error during publish to ${url}:`, pubError);
                                }
                            }, 500); // Small delay before publishing
                        } catch (e) {
                            console.error(`Error publishing to relay ${url}:`, e);
                        }
                    }

                    return Promise.allSettled(promises);
                }
            };

            // Flag to track if we're still in initial loading state
            let isInitialLoad = true;

            // Set a maximum timeout for loading indicator
            setTimeout(() => {
                if (isInitialLoad) {
                    console.log("Maximum loading time reached, hiding loading indicator");

                    // Mark initial load as complete
                    isInitialLoad = false;

                    // Hide loading indicator and show chat container
                    hideLoadingIndicator();
                }
            }, 5000); // 5 seconds maximum loading time

            // Subscribe to channel messages - only from the last 24 hours
            // But with a small delay to avoid hammering the relay
            setTimeout(() => {
                const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // Current time minus 24 hours in seconds

                // Don't limit the number of events to make sure we get all messages
                console.log("Starting subscription with delay to avoid relay spam protection");

                // Flag to track if we've received any events
                let receivedEvents = false;

                // Display messages as they arrive but insert them in the correct position
                relayPool.subscribe(
                    relays,
                    [
                        {
                            kinds: [1], // Regular notes
                            '#t': [CHANNEL_ID], // Tag for our channel
                            since: oneDayAgo // Only get messages from the last 24 hours
                        }
                    ],
                    {
                        onevent(event) {
                            // Mark that we've received at least one event
                            receivedEvents = true;

                            // Log the event
                            console.log("Received event:", {
                                id: event.id,
                                content: event.content.substring(0, 30) + "...",
                                created_at: new Date(event.created_at * 1000).toLocaleString(),
                                pubkey: event.pubkey
                            });

                            // Display the event immediately, but in the correct position
                            displayMessageInOrder(event);

                            // If this is the first event, hide the loading indicator
                            if (isInitialLoad) {
                                isInitialLoad = false;
                                hideLoadingIndicator();
                            }
                        },
                        oneose() {
                            // End of stored events
                            console.log("End of stored events");

                            // If we didn't receive any events, hide the loading indicator
                            if (!receivedEvents) {
                                console.log("No events received, hiding loading indicator");
                                if (isInitialLoad) {
                                    isInitialLoad = false;
                                    hideLoadingIndicator();
                                }
                            }

                            // Scroll to bottom to show newest messages
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    }
                );
            }, 2000); // 2 second delay before subscribing

            // We only send kind=1 events as requested
            // Add a welcome message after the initial load is complete
            let welcomeMessageAdded = false;
            const addWelcomeMessage = () => {
                // Check if initial load is complete
                if (isInitialLoad) {
                    // Still loading, check again in a bit
                    console.log("Still loading events, delaying welcome message");
                    setTimeout(addWelcomeMessage, 500);
                    return;
                }

                // Check if we've already added a welcome message
                if (welcomeMessageAdded) {
                    console.log("Welcome message already added, skipping");
                    return;
                }

                // Mark as added to prevent duplicates
                welcomeMessageAdded = true;

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

                // Display the welcome message locally in the correct position
                displayMessageInOrder(welcomeEvent);

                // Scroll to bottom to ensure the welcome message is visible
                setTimeout(() => {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }, 50);
            };

            // Start the welcome message process
            setTimeout(addWelcomeMessage, 1000);

        } catch (error) {
            console.error("Error initializing Nostr connection:", error);
            alert("Fehler beim Verbinden mit Nostr-Relays. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        }
    }

    // Display a message in the correct chronological order
    function displayMessageInOrder(event) {
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
        } else if (processedEvents.has(event.id)) {
            // Skip duplicate events
            console.log("Skipping duplicate event:", event.id);
            return;
        } else {
            // Add to processed events set
            console.log("Processing new event:", event.id);
            processedEvents.add(event.id);
        }

        // Create the message element
        const messageDiv = createMessageElement(event);

        // Find the correct position to insert the message based on timestamp
        insertMessageInOrder(messageDiv, event.created_at);
    }

    // Create a message element without adding it to the DOM
    function createMessageElement(event) {
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

        return messageDiv;
    }

    // Insert a message element in the correct chronological order
    function insertMessageInOrder(messageDiv, timestamp) {
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
    }

    // Display a message in the chat (legacy function for compatibility)
    function displayMessage(event) {
        // Just use the new function for all message display
        displayMessageInOrder(event);
    }

    // Send a message
    async function sendMessage(content) {
        if (!content || !content.trim()) return;

        try {
            console.log("Sending message:", content);

            // Create event with basic tags
            const eventTags = [['t', CHANNEL_ID]];

            // Add handle name tags from profile cache if available
            if (window.profileCache && window.profileCache[userPublicKey]) {
                const profile = window.profileCache[userPublicKey];

                if (profile.name) {
                    eventTags.push(['name', profile.name]);
                }

                if (profile.display_name) {
                    eventTags.push(['display_name', profile.display_name]);
                } else if (profile.displayName) {
                    eventTags.push(['display_name', profile.displayName]);
                }

                // Add a default handle if we don't have one
                if (!profile.name && !profile.display_name && !profile.displayName) {
                    const defaultHandle = 'Benutzer';
                    eventTags.push(['name', defaultHandle]);
                    eventTags.push(['display_name', defaultHandle]);
                }
            } else {
                // If no profile cache, add a default handle
                const defaultHandle = 'Benutzer';
                eventTags.push(['name', defaultHandle]);
                eventTags.push(['display_name', defaultHandle]);
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

            // Display the message with our local ID in the correct position
            displayMessageInOrder(localEvent);

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
