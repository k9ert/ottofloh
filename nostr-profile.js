// nostr-profile.js - Profilmanagement für den Nostr-Chat

// Initialisiere das NostrProfile-Objekt, falls es noch nicht existiert
window.NostrProfile = window.NostrProfile || {};

// Initialize profile cache
window.profileCache = window.profileCache || {};

// Function to request profile information for a pubkey
window.NostrProfile.requestProfileInfo = function(pubkey, relayPool, relays) {
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
                        window.NostrProfile.updateMessagesForPubkey(pubkey, profile);
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
window.NostrProfile.updateMessagesForPubkey = function(pubkey, profile) {
    // Find all message elements for this pubkey
    const messages = document.querySelectorAll(`.chat-message[data-pubkey="${pubkey}"]`);

    if (messages.length === 0) return;

    console.log(`Updating ${messages.length} messages for pubkey:`, pubkey);

    // Default to first 6 characters of pubkey
    let displayName = pubkey.substring(0, 6);

    // Prioritize NIP-05 identifier if available
    if (profile.nip05) {
        displayName = profile.nip05;
    } else if (profile.display_name) {
        displayName = profile.display_name;
    } else if (profile.displayName) {
        displayName = profile.displayName;
    } else if (profile.name) {
        displayName = profile.name;
    }

    // Update each message
    messages.forEach(message => {
        const usernameElement = message.querySelector('.chat-username');
        if (usernameElement) {
            usernameElement.textContent = displayName;
        }
    });
};

// Get display name for a pubkey
window.NostrProfile.getDisplayName = function(event) {
    // Default to first 6 characters of pubkey
    const shortenPubkey = (pubkey) => pubkey.substring(0, 6);
    let displayName = shortenPubkey(event.pubkey);
    console.log("Displayname for event 1:", displayName);

    try {
        // Check for handle name in the event content (might contain profile info)
        if (event.kind === 0 && event.content) {
            // Try to parse profile info from kind=0 events
            try {
                const profile = JSON.parse(event.content);
                // Prioritize NIP-05 identifier if available
                if (profile.nip05) {
                    displayName = profile.nip05;
                } else if (profile.display_name) {
                    displayName = profile.display_name;
                } else if (profile.displayName) {
                    displayName = profile.displayName;
                } else if (profile.name) {
                    displayName = profile.name;
                }
            } catch (e) {
                console.log("Could not parse profile info:", e);
            }
        }
        console.log("Displayname for event 2:", displayName);

        // Check if we already have this profile in cache
        if (window.profileCache[event.pubkey]) {
            const profile = window.profileCache[event.pubkey];
            // Prioritize NIP-05 identifier if available
            if (profile.nip05) {
                displayName = profile.nip05;
            } else if (profile.display_name) {
                displayName = profile.display_name;
            } else if (profile.displayName) {
                displayName = profile.displayName;
            } else if (profile.name) {
                displayName = profile.name;
            }
        }
        console.log("Displayname for event 4:", displayName);

        // No special handling for own messages anymore - always use the same display name logic
        // This ensures consistency across all messages
    } catch (error) {
        console.log("Error processing display name:", error);
    }

    return displayName;
};

// Add profile tags to an event
window.NostrProfile.addProfileTags = function(event, userPublicKey) {
    if (!event.tags) {
        event.tags = [];
    }

    // Add handle name tags from profile cache if available
    if (window.profileCache && window.profileCache[userPublicKey]) {
        const profile = window.profileCache[userPublicKey];

        // Add NIP-05 identifier if available
        if (profile.nip05) {
            event.tags.push(['nip05', profile.nip05]);
        }

        if (profile.name) {
            event.tags.push(['name', profile.name]);
        }

        if (profile.display_name) {
            event.tags.push(['display_name', profile.display_name]);
        } else if (profile.displayName) {
            event.tags.push(['display_name', profile.displayName]);
        }

        // No need to add default tags if we don't have any identifier
        // We'll use the first 6 characters of the pubkey instead
    } else {
        // If no profile cache, we don't need to add any tags
        // We'll use the first 6 characters of the pubkey instead
    }

    return event;
};
