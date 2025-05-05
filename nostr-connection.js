// nostr-connection.js - Relay-Verbindung und Kommunikation für den Nostr-Chat

// Initialisiere das NostrConnection-Objekt, falls es noch nicht existiert
window.NostrConnection = window.NostrConnection || {};

// Initialize relay pool
window.NostrConnection.initRelayPool = function() {
    console.log("Initializing direct relay connections");

    // Create a direct implementation using individual relays
    const relayPool = {
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
                                if (callbacks.oneose) {
                                    callbacks.oneose();
                                }
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
                                    console.error(`Error closing relay connection:`, closeError);
                                }

                                // Try to reconnect with a new instance
                                this.subscribe([url], filters, callbacks);
                            } catch (timeoutError) {
                                console.error(`Error handling connection timeout:`, timeoutError);
                            }
                        }, 10000); // 10 second timeout

                        // Store the timeout so we can clear it on successful connection
                        relay._connectionTimeout = connectionTimeout;

                        // Connect to the relay
                        relay.connect();
                    } catch (connectError) {
                        console.error(`Error connecting to ${url}:`, connectError);
                    }
                } catch (error) {
                    console.error(`Error setting up relay ${url}:`, error);
                }
            }
        },

        // Publish an event to relays
        publish: function(relayUrls, event) {
            console.log("Publishing to relays:", relayUrls);
            console.log("Event:", event);

            const promises = [];

            for (const url of relayUrls) {
                // Find the relay in our list
                const relay = this.relays.find(r => r.url === url);
                if (!relay) {
                    console.warn(`Relay ${url} not found in pool, skipping publish`);
                    continue;
                }

                try {
                    // Check if the relay is connected
                    if (relay.status !== 1) { // 1 = OPEN
                        console.warn(`Relay ${url} is not connected, skipping publish`);
                        continue;
                    }

                    // Publish the event
                    console.log(`Publishing to ${url}`);
                    const pub = relay.publish(event);

                    // Add to promises if it returns a promise
                    if (pub && typeof pub.then === 'function') {
                        promises.push(pub);
                    }
                } catch (error) {
                    console.error(`Error publishing to ${url}:`, error);
                }
            }

            // Return a promise that resolves when all publish operations are complete
            if (promises.length > 0) {
                return Promise.all(promises);
            }

            // Return a resolved promise if no promises were created
            return Promise.resolve();
        }
    };

    return relayPool;
}

// Subscribe to channel messages
window.NostrConnection.subscribeToChannel = function(relayPool, relays, CHANNEL_ID, userPublicKey, isInitialLoad) {
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
                    window.NostrUI.displayMessageInOrder(event, userPublicKey, relayPool, relays);

                    // If this is the first event, hide the loading indicator
                    if (isInitialLoad) {
                        isInitialLoad = false;
                        window.NostrUI.hideLoadingIndicator();
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
                            window.NostrUI.hideLoadingIndicator();
                        }
                    }

                    // Scroll to bottom to show newest messages
                    document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;
                }
            }
        );
    }, 2000); // 2 second delay before subscribing
}

// Process and publish a signed event
window.NostrConnection.processAndPublishSignedEvent = async function(signedEvent, userPublicKey, relayPool, relays) {
    console.log("Processing signed event for publishing:", signedEvent);

    // Check if we have a properly signed event
    if (!signedEvent || !signedEvent.sig) {
        console.error("Cannot publish unsigned event:", signedEvent);
        alert("Fehler: Die Nachricht wurde nicht korrekt signiert und kann nicht gesendet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        return;
    }

    // Publish to relays
    if (relayPool && typeof relayPool.publish === 'function') {
        console.log("Publishing with relayPool.publish");
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

    // Add handle name tags if we have profile info
    if (!localEvent.tags) {
        localEvent.tags = [];
    }

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
    window.NostrUI.displayMessageInOrder(localEvent, userPublicKey, relayPool, relays);

    // Add the original event ID to the processed events set so when it comes back from the relay, it won't be displayed again
    if (signedEvent.id) {
        window.NostrUI.processedEvents.add(signedEvent.id);
        console.log("Added our message ID to processed events:", signedEvent.id);
    }
}

// Send a message
window.NostrConnection.sendMessage = async function(content, userPublicKey, userPrivateKey, CHANNEL_ID, relayPool, relays) {
    if (!content || !content.trim()) return;

    try {
        console.log("Sending message:", content);

        // Create event with basic tags
        const eventTags = [['t', CHANNEL_ID]];

        // Add profile tags
        const event = {
            kind: 1, // Only send kind=1 events as requested
            created_at: Math.floor(Date.now() / 1000),
            tags: eventTags,
            content: content,
            pubkey: userPublicKey // Add pubkey to the event
        };

        // Add profile tags
        window.NostrProfile.addProfileTags(event, userPublicKey);

        console.log("Created event template with handle name:", event);

        let signedEvent;

        // Sign with extension or with our private key
        if (window.nostr && !userPrivateKey) {
            console.log("Signing with Nostr extension");
            try {
                signedEvent = await window.NostrCrypto.signEventWithExtension(event);
                console.log("Event signed with extension:", signedEvent);
            } catch (signError) {
                console.error("Error signing with extension:", signError);
                alert("Fehler beim Signieren mit der Nostr-Erweiterung. Bitte versuchen Sie es erneut.");
                return;
            }
        } else {
            // Sign with private key
            try {
                signedEvent = await window.NostrCrypto.signEvent(event, userPrivateKey);
                console.log("Signed event:", signedEvent);

                // Verify that the event has all required fields
                if (!signedEvent || !signedEvent.sig) {
                    console.error("Event is missing critical fields (sig):", signedEvent);
                    alert("Fehler: Die Nachricht wurde nicht korrekt signiert und kann nicht gesendet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
                    return;
                }

                // Verify the signature if possible
                const isValid = window.NostrCrypto.verifyEvent(signedEvent);
                if (!isValid) {
                    console.warn("Event signature verification failed");
                }
            } catch (signError) {
                console.error("Error signing event:", signError);
                alert("Fehler beim Signieren der Nachricht. Bitte versuchen Sie es erneut.");
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
