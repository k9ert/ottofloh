// nostr-connection.js - Relay-Verbindung und Kommunikation für den Nostr-Chat

// Initialisiere das NostrConnection-Objekt, falls es noch nicht existiert
window.NostrConnection = window.NostrConnection || {};

// Store channel information
window.NostrConnection.channelInfo = {
    id: null,
    created: false
};

// Initialize relay pool using SimplePool from nostr-tools v2
window.NostrConnection.initRelayPool = function() {
    console.log("Initializing SimplePool for relay connections");

    // Create a SimplePool instance
    const pool = new window.NostrTools.SimplePool();

    // Create a relay pool object with our custom methods
    const relayPool = {
        pool: pool,
        relays: [],
        activeRelays: [],

        // Subscribe to events
        subscribe: function(relayUrls, filters, callbacks) {
            console.log("Subscribing to relays:", relayUrls);
            console.log("With filters:", filters);

            // Track active relays
            for (const url of relayUrls) {
                if (!this.activeRelays.includes(url)) {
                    this.activeRelays.push(url);
                }
            }

            // Subscribe to events using SimplePool
            const sub = this.pool.subscribeMany(
                relayUrls,
                filters,
                {
                    onevent(event) {
                        console.log(`Received event:`, event);
                        callbacks.onevent(event);
                    },
                    oneose() {
                        console.log("End of stored events");
                        if (callbacks.oneose) {
                            callbacks.oneose();
                        }
                    }
                }
            );

            // Store the subscription for potential cleanup
            this.relays.push(sub);

            return sub;
        },

        // Publish an event to relays
        publish: function(relayUrls, event) {
            console.log("Publishing to relays:", relayUrls);
            console.log("Event:", event);

            // Publish the event using SimplePool
            return this.pool.publish(relayUrls, event);
        },

        // Close all connections
        close: function() {
            console.log("Closing all relay connections");
            this.pool.close();
            this.activeRelays = [];
        }
    };

    return relayPool;
};

// Create or find a channel
window.NostrConnection.createOrFindChannel = async function(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey) {
    console.log("Creating or finding channel:", CHANNEL_ID);

    return new Promise((resolve, reject) => {
        // First, check if a channel with this ID already exists
        console.log("Checking for existing channel with ID:", CHANNEL_ID);

        // Flag to track if we've found a channel
        let foundChannel = false;

        // Subscribe to kind 40 events (channel creation) with our channel ID
        const sub = relayPool.subscribe(
            relays,
            [
                {
                    kinds: [40], // Channel creation
                    '#t': [CHANNEL_ID] // Tag for our channel
                }
            ],
            {
                onevent(event) {
                    console.log("Found existing channel:", event);
                    foundChannel = true;

                    // Store the channel ID
                    window.NostrConnection.channelInfo.id = event.id;
                    window.NostrConnection.channelInfo.created = true;

                    // Close the subscription
                    if (sub && typeof sub.close === 'function') {
                        sub.close();
                    }

                    // Resolve with the channel ID
                    resolve(event.id);
                },
                oneose() {
                    console.log("End of stored channel events");

                    // If we didn't find a channel, create one
                    if (!foundChannel) {
                        console.log("No existing channel found, creating new channel");

                        // Create a new channel
                        window.NostrConnection.createChannel(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey)
                            .then(channelId => {
                                resolve(channelId);
                            })
                            .catch(error => {
                                console.error("Error creating channel:", error);
                                // Even if we fail to create a channel, we can still use a default ID
                                window.NostrConnection.channelInfo.id = CHANNEL_ID;
                                resolve(CHANNEL_ID);
                            });
                    }
                }
            }
        );

        // Set a timeout to avoid hanging if the relay doesn't respond
        setTimeout(() => {
            if (!foundChannel && !window.NostrConnection.channelInfo.created) {
                console.log("Timeout waiting for channel response, using default channel ID");

                // Close the subscription
                if (sub && typeof sub.close === 'function') {
                    sub.close();
                }

                // Use the CHANNEL_ID as a fallback
                window.NostrConnection.channelInfo.id = CHANNEL_ID;
                resolve(CHANNEL_ID);
            }
        }, 5000); // 5 second timeout
    });
};

// Create a new channel
window.NostrConnection.createChannel = async function(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey) {
    console.log("Creating new channel:", CHANNEL_ID);

    // Create channel metadata
    const channelMetadata = {
        name: "Ottobrunner Hofflohmarkt Chat",
        about: "Chat für den Ottobrunner Hofflohmarkt",
        picture: "https://ottofloh.de/images/logo.png",
        relays: relays
    };

    // Create event with basic tags
    const eventTags = [['t', CHANNEL_ID]];

    // Create a properly formatted event object for channel creation (kind 40)
    const event = {
        kind: 40, // Channel creation
        created_at: Math.floor(Date.now() / 1000),
        tags: eventTags,
        content: JSON.stringify(channelMetadata),
        pubkey: userPublicKey
    };

    try {
        let signedEvent;

        // Sign with extension or with our private key
        if (window.nostr && !userPrivateKey) {
            console.log("Signing channel creation with Nostr extension");

            // Calculate event ID first if we have the function
            if (window.NostrTools && window.NostrTools.getEventHash) {
                event.id = window.NostrTools.getEventHash(event);
            }

            signedEvent = await window.nostr.signEvent(event);
        } else {
            // Sign with private key
            signedEvent = await window.NostrCrypto.signEvent(event, userPrivateKey);
        }

        console.log("Signed channel creation event:", signedEvent);

        // Publish to relays
        await relayPool.publish(relays, signedEvent);

        // Store the channel ID
        window.NostrConnection.channelInfo.id = signedEvent.id;
        window.NostrConnection.channelInfo.created = true;

        console.log("Channel created with ID:", signedEvent.id);

        return signedEvent.id;
    } catch (error) {
        console.error("Error creating channel:", error);
        throw error;
    }
};

// Subscribe to channel messages
window.NostrConnection.subscribeToChannel = async function(relayPool, relays, CHANNEL_ID, userPublicKey, isInitialLoad) {
    // First, create or find the channel
    try {
        const channelId = await window.NostrConnection.createOrFindChannel(
            relayPool,
            relays,
            CHANNEL_ID,
            userPublicKey,
            window.userPrivateKey
        );

        console.log("Using channel with ID:", channelId);

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
                        kinds: [42], // Channel messages (NIP-28)
                        '#e': [channelId], // Reference to the channel event
                        since: oneDayAgo // Only get messages from the last 24 hours
                    }
                ],
                {
                    onevent(event) {
                        // Mark that we've received at least one event
                        receivedEvents = true;

                        // Log the event
                        console.log("Received channel message:", {
                            id: event.id,
                            content: event.content.substring(0, 30) + "...",
                            created_at: new Date(event.created_at * 1000).toLocaleString(),
                            pubkey: event.pubkey
                        });

                        // Display the event immediately, but in the correct position
                        window.NostrUI.displayMessageInOrder(event, userPublicKey, relayPool, relays);

                        // If this is the first event, hide the loading indicator
                        if (isInitialLoad) {
                            isInitialLoad = false;
                            window.NostrUI.hideLoadingIndicator();
                        }
                    },
                    oneose() {
                        // End of stored events
                        console.log("End of stored channel messages");

                        // If we didn't receive any events, hide the loading indicator
                        if (!receivedEvents) {
                            console.log("No channel messages received, hiding loading indicator");
                            if (isInitialLoad) {
                                isInitialLoad = false;
                                window.NostrUI.hideLoadingIndicator();
                            }
                        }

                        // Scroll to bottom to show newest messages
                        document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;
                    }
                }
            );
        }, 2000); // 2 second delay before subscribing
    } catch (error) {
        console.error("Error setting up channel:", error);

        // Fall back to the old method if channel creation fails
        console.log("Falling back to tag-based subscription");

        setTimeout(() => {
            const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

            let receivedEvents = false;

            relayPool.subscribe(
                relays,
                [
                    {
                        kinds: [1, 42], // Try both regular notes and channel messages
                        '#t': [CHANNEL_ID], // Tag for our channel
                        since: oneDayAgo
                    }
                ],
                {
                    onevent(event) {
                        receivedEvents = true;
                        console.log("Received event (fallback):", event);
                        window.NostrUI.displayMessageInOrder(event, userPublicKey, relayPool, relays);

                        if (isInitialLoad) {
                            isInitialLoad = false;
                            window.NostrUI.hideLoadingIndicator();
                        }
                    },
                    oneose() {
                        console.log("End of stored events (fallback)");

                        if (!receivedEvents && isInitialLoad) {
                            isInitialLoad = false;
                            window.NostrUI.hideLoadingIndicator();
                        }

                        document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;
                    }
                }
            );
        }, 2000);
    }
};

// Process and publish a signed event
window.NostrConnection.processAndPublishSignedEvent = async function(signedEvent, userPublicKey, relayPool, relays) {
    console.log("Processing signed event for publishing:", signedEvent);

    // Check if we have a properly signed event with all required fields
    if (!signedEvent || !signedEvent.sig || !signedEvent.id || !signedEvent.pubkey ||
        !signedEvent.kind || !signedEvent.created_at || !signedEvent.content) {
        console.error("Cannot publish invalid event:", signedEvent);
        alert("Fehler: Die Nachricht ist ungültig und kann nicht gesendet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        return;
    }

    // Double-check that the event ID is correct
    if (window.NostrTools && window.NostrTools.getEventHash) {
        const calculatedId = window.NostrTools.getEventHash(signedEvent);
        if (calculatedId !== signedEvent.id) {
            console.error("Event ID mismatch:", {
                providedId: signedEvent.id,
                calculatedId: calculatedId
            });

            // Fix the ID
            console.log("Fixing event ID before publishing");
            signedEvent.id = calculatedId;
        } else {
            console.log("Event ID verified correctly");
        }
    }

    // Publish to relays
    if (relayPool && typeof relayPool.publish === 'function') {
        console.log("Publishing to relays:", relays);
        console.log("Event:", signedEvent);

        try {
            // Add a small delay before publishing to avoid rate limiting
            setTimeout(() => {
                try {
                    // Try to publish and handle different return types
                    const pubResult = relayPool.publish(relays, signedEvent);

                    // Check if pubResult is a Promise
                    if (pubResult && typeof pubResult.then === 'function') {
                        pubResult.then(
                            () => console.log("Published to relays successfully"),
                            (err) => console.error("Error publishing to relays:", err)
                        );
                    } else {
                        console.log("Publication request sent to relays");
                    }
                } catch (pubError) {
                    console.error("Error publishing with relayPool:", pubError);
                }
            }, 500);
        } catch (pubError) {
            console.error("Error setting up publish with relayPool:", pubError);
        }
    } else {
        console.error("relayPool.publish is not a function");
    }

    // Display our own message immediately
    // Create a copy of the event with a special local ID to ensure it's displayed
    const localEvent = { ...signedEvent };

    // Change the ID to a local version to ensure it's displayed
    localEvent.id = 'local-sent-' + (signedEvent.id || Date.now() + '-' + Math.random().toString(36).substring(2, 15));

    // Make sure we have tags array
    if (!localEvent.tags) {
        localEvent.tags = [];
    }

    // We don't need to add any profile-related tags to the event
    // This ensures consistent behavior for all users, regardless of whether they have NIP-05 or not
    console.log("Not adding any profile tags to local event to ensure consistent behavior");

    // Make sure we have the required tags for the channel
    // For kind 42 (channel message), we need an 'e' tag with the channel ID and 'root' marker

    // Get the channel ID - use the stored one if available, otherwise use a default
    const channelId = window.NostrConnection.channelInfo.id || 'ottobrunner-hofflohmarkt-2025';

    // Check if we have an 'e' tag with 'root' marker
    let hasChannelRootTag = false;
    for (const tag of localEvent.tags) {
        if (tag[0] === 'e' && tag[3] === 'root') {
            hasChannelRootTag = true;
            break;
        }
    }

    // If no channel root tag is found, add one
    if (!hasChannelRootTag) {
        console.log("No channel root tag found, adding channel root tag to local event");
        localEvent.tags.push(['e', channelId, '', 'root']);
    }

    // Also check for 't' tag for backward compatibility
    let hasChannelTag = false;
    for (const tag of localEvent.tags) {
        if (tag[0] === 't') {
            hasChannelTag = true;
            break;
        }
    }

    // If no 't' tag is found, add a default one
    if (!hasChannelTag) {
        console.log("No 't' tag found, adding default 't' tag to local event");
        localEvent.tags.push(['t', 'ottobrunner-hofflohmarkt']);
    }

    // Log the local event for debugging
    console.log("Displaying local event with handle:", localEvent);

    // Display the message with our local ID in the correct position
    window.NostrUI.displayMessageInOrder(localEvent, userPublicKey, relayPool, relays);

    // Add the original event ID to the processed events set so when it comes back from the relay, it won't be displayed again
    if (signedEvent.id) {
        window.NostrUI.processedEvents.add(signedEvent.id);
        console.log("Added our message ID to processed events:", signedEvent.id);
    }
};

// Send a message
window.NostrConnection.sendMessage = async function(content, userPublicKey, userPrivateKey, CHANNEL_ID, relayPool, relays) {
    if (!content || !content.trim()) return;

    try {
        console.log("Sending message:", content);

        // Get the channel ID - use the stored one if available, otherwise use the CHANNEL_ID
        const channelId = window.NostrConnection.channelInfo.id || CHANNEL_ID;
        console.log("Using channel ID for message:", channelId);

        // Create event with tags according to NIP-28
        // For channel messages, we need an 'e' tag with the channel ID and 'root' marker
        const eventTags = [
            ['e', channelId, '', 'root'], // Reference to the channel with 'root' marker
            ['t', CHANNEL_ID] // Keep the 't' tag for backward compatibility
        ];

        // Create a properly formatted event object
        const event = {
            kind: 42, // Channel message (NIP-28)
            created_at: Math.floor(Date.now() / 1000),
            tags: eventTags,
            content: content,
            pubkey: userPublicKey // Add pubkey to the event
        };

        // Add profile tags - this modifies the event object
        window.NostrProfile.addProfileTags(event);

        console.log("Created event template:", event);

        // Ensure we have all required fields for a valid Nostr event
        if (!event.kind || !event.created_at || !event.pubkey || !event.content) {
            console.error("Event is missing required fields:", event);
            alert("Fehler: Die Nachricht enthält nicht alle erforderlichen Felder. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
            return;
        }

        let signedEvent;

        // Sign with extension or with our private key
        if (window.nostr && !userPrivateKey) {
            console.log("Signing with Nostr extension");
            try {
                // Try to use the newer NIP-07 method first
                if (window.nostr.signEvent) {
                    // Calculate event ID first if we have the function
                    if (window.NostrTools && window.NostrTools.getEventHash) {
                        event.id = window.NostrTools.getEventHash(event);
                        console.log("Calculated event ID before extension signing:", event.id);
                    }

                    signedEvent = await window.nostr.signEvent(event);
                } else {
                    throw new Error("Nostr extension does not support signEvent");
                }

                console.log("Event signed with extension:", signedEvent);

                // Verify that we have all required fields after signing
                if (!signedEvent || !signedEvent.sig || !signedEvent.id) {
                    console.error("Event is missing critical fields after extension signing:", signedEvent);
                    alert("Fehler: Die Nachricht wurde nicht korrekt signiert. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
                    return;
                }
            } catch (signError) {
                console.error("Error signing with extension:", signError);
                alert("Fehler beim Signieren mit der Nostr-Erweiterung. Bitte versuchen Sie es erneut.");
                return;
            }
        } else {
            // Sign with private key
            try {
                // Use our custom signing function that calculates the event ID
                signedEvent = await window.NostrCrypto.signEvent(event, userPrivateKey);
                console.log("Signed event with private key:", signedEvent);

                // Verify that the event has all required fields
                if (!signedEvent || !signedEvent.sig || !signedEvent.id) {
                    console.error("Event is missing critical fields after signing:", signedEvent);
                    alert("Fehler: Die Nachricht wurde nicht korrekt signiert. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
                    return;
                }

                // Verify the signature if possible
                if (window.NostrTools && window.NostrTools.verifyEvent) {
                    const isValid = window.NostrTools.verifyEvent(signedEvent);
                    if (!isValid) {
                        console.warn("Event signature verification failed");
                        alert("Warnung: Die Signatur der Nachricht konnte nicht verifiziert werden. Die Nachricht wird trotzdem gesendet.");
                    } else {
                        console.log("Event signature verified successfully");
                    }
                }
            } catch (signError) {
                console.error("Error signing event:", signError);
                alert("Fehler beim Signieren der Nachricht. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
                return;
            }
        }

        // Process and publish the signed event
        await window.NostrConnection.processAndPublishSignedEvent(signedEvent, userPublicKey, relayPool, relays);

        // Clear input
        document.getElementById('chat-input').value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Fehler beim Senden der Nachricht. Bitte versuchen Sie es erneut.');
    }
};
