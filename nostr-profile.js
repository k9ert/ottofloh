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
};

// Get display name for a pubkey
window.NostrProfile.getDisplayName = function(event, userPublicKey) {
    // Default to shortened pubkey
    const shortenPubkey = window.NostrUtils.shortenPubkey;
    let displayName = shortenPubkey(event.pubkey);

    try {
        // Check for handle name in the event content (might contain profile info)
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

        if (profile.name) {
            event.tags.push(['name', profile.name]);
        }

        if (profile.display_name) {
            event.tags.push(['display_name', profile.display_name]);
        } else if (profile.displayName) {
            event.tags.push(['display_name', profile.displayName]);
        }

        // Add a default handle if we don't have one
        if (!profile.name && !profile.display_name && !profile.displayName) {
            const defaultHandle = 'Benutzer';
            event.tags.push(['name', defaultHandle]);
            event.tags.push(['display_name', defaultHandle]);
        }
    } else {
        // If no profile cache, add a default handle
        const defaultHandle = 'Benutzer';
        event.tags.push(['name', defaultHandle]);
        event.tags.push(['display_name', defaultHandle]);
    }

    return event;
};
