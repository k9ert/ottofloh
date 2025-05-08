// nostr-connection.js - Relay-Verbindung und Kommunikation für den Nostr-Chat

// Initialisiere das NostrConnection-Objekt, falls es noch nicht existiert
window.NostrConnection = window.NostrConnection || {};

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
};

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

        // Create the event object
        const event = {
            kind: 1, // Regular note
            created_at: Math.floor(Date.now() / 1000),
            tags: eventTags,
            content: content,
            pubkey: userPublicKey
        };

        // Add profile tags
        window.NostrProfile.addProfileTags(event, userPublicKey);

        console.log("Created event template:", event);

        let signedEvent;

        // Sign with extension or with our private key
        if (window.nostr && !userPrivateKey) {
            console.log("Signing with Nostr extension");
            try {
                // Use NIP-07 extension to sign
                signedEvent = await window.nostr.signEvent(event);
                console.log("Event signed with extension:", signedEvent);
            } catch (signError) {
                console.error("Error signing with extension:", signError);
                alert("Fehler beim Signieren mit der Nostr-Erweiterung. Bitte versuchen Sie es erneut.");
                return;
            }
        } else {
            // Sign with private key using nostr-tools
            try {
                // Use nostr-tools to sign the event
                const eventId = window.NostrTools.getEventHash(event);
                const sig = window.NostrTools.signEvent(event, userPrivateKey);

                signedEvent = {
                    ...event,
                    id: eventId,
                    sig: sig
                };

                console.log("Signed event:", signedEvent);

                // Verify that the event has all required fields
                if (!signedEvent || !signedEvent.sig) {
                    console.error("Event is missing critical fields (sig):", signedEvent);
                    alert("Fehler: Die Nachricht wurde nicht korrekt signiert und kann nicht gesendet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
                    return;
                }

                // Verify the signature
                const isValid = window.NostrTools.verifyEvent(signedEvent);
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
};;
