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
                    if (window.NostrTools && typeof window.NostrTools.getPublicKey === 'function') {
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
            if (window.NostrTools && window.NostrTools.generateSecretKey) {
                console.log("Using NostrTools.generateSecretKey");
                secretKey = window.NostrTools.generateSecretKey();
            } else if (window.nostrTools && window.nostrTools.generateSecretKey) {
                console.log("Using nostrTools.generateSecretKey");
                secretKey = window.nostrTools.generateSecretKey();
            } else {
                console.log("Generating random key with crypto API");
                // Generate a random key if the library function isn't available
                secretKey = new Uint8Array(32);
                window.crypto.getRandomValues(secretKey);
            }

            userPrivateKey = bytesToHex(secretKey);

            // Try different ways to get public key based on available API
            if (window.NostrTools && window.NostrTools.getPublicKey) {
                console.log("Using NostrTools.getPublicKey");
                userPublicKey = window.NostrTools.getPublicKey(secretKey);
            } else if (window.nostrTools && window.nostrTools.getPublicKey) {
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
                userPublicKey = await window.nostr.getPublicKey();
                showChatInterface();
                initNostrConnection();
            } catch (error) {
                console.error('Error connecting to Nostr extension:', error);
                alert('Fehler beim Verbinden mit der Nostr-Erweiterung. Bitte versuchen Sie es erneut oder erstellen Sie einen neuen Schlüssel.');
            }
        } else {
            alert('Keine Nostr-Erweiterung gefunden. Bitte installieren Sie eine Nostr-Erweiterung oder erstellen Sie einen neuen Schlüssel.');
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
                            const pub = relay.publish(event);
                            promises.push(
                                pub.then(
                                    () => console.log(`Published to ${url} successfully`),
                                    (err) => console.error(`Failed to publish to ${url}:`, err)
                                )
                            );
                        } catch (e) {
                            console.error(`Error publishing to relay ${url}:`, e);
                        }
                    }

                    return Promise.allSettled(promises);
                }
            };

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
                        displayMessage(event);
                    }
                }
            );

            // Send a welcome message after a delay to ensure connections are established
            setTimeout(() => {
                console.log("Sending welcome message");
                sendMessage('Hallo! Ich bin dem Ottobrunner Hofflohmarkt Chat beigetreten.');
            }, 3000);

        } catch (error) {
            console.error("Error initializing Nostr connection:", error);
            alert("Fehler beim Verbinden mit Nostr-Relays. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        }
    }

    // Display a message in the chat
    function displayMessage(event) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';

        // Check if this is our own message
        if (event.pubkey === userPublicKey) {
            messageDiv.classList.add('self');
        } else {
            messageDiv.classList.add('others');
        }

        // Create header with username (shortened pubkey) and timestamp
        const header = document.createElement('div');
        header.className = 'chat-header';

        const username = document.createElement('span');
        username.className = 'chat-username';
        username.textContent = shortenPubkey(event.pubkey);

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

            // Create event
            const event = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['t', CHANNEL_ID]],
                content: content,
                pubkey: userPublicKey // Add pubkey to the event
            };

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
                    if (window.NostrTools && typeof window.NostrTools.finalizeEvent === 'function') {
                        console.log("Signing with NostrTools.finalizeEvent");
                        signedEvent = window.NostrTools.finalizeEvent(
                            event,
                            hexToBytes(userPrivateKey)
                        );
                    } else if (window.nostrTools && typeof window.nostrTools.finalizeEvent === 'function') {
                        console.log("Signing with nostrTools.finalizeEvent");
                        signedEvent = window.nostrTools.finalizeEvent(
                            event,
                            hexToBytes(userPrivateKey)
                        );
                    } else {
                        // Try to manually sign the event
                        console.log("Attempting manual event signing");

                        // Create event ID (sha256 hash of the serialized event)
                        const eventData = JSON.stringify([
                            0,
                            event.pubkey,
                            event.created_at,
                            event.kind,
                            event.tags,
                            event.content
                        ]);

                        // Use SubtleCrypto if available
                        if (window.crypto && window.crypto.subtle) {
                            const encoder = new TextEncoder();
                            const data = encoder.encode(eventData);
                            const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
                            const hashArray = Array.from(new Uint8Array(hashBuffer));
                            const id = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                            event.id = id;

                            // We can't sign without the proper libraries, so we'll just use the event as is
                            console.warn("Unable to properly sign the event, using unsigned event");
                            signedEvent = event;
                        } else {
                            throw new Error("No method found to create event ID");
                        }
                    }

                    console.log("Signed event:", signedEvent);
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
                    await relayPool.publish(relays, signedEvent);
                } catch (pubError) {
                    console.error("Error publishing with relayPool:", pubError);
                    // We'll still display the message locally even if publishing fails
                }
            } else {
                console.error("relayPool.publish is not a function");
            }

            // Display our own message immediately
            displayMessage(signedEvent);

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
