// nostr-profile.js - Profilmanagement für den Nostr-Chat

// Initialisiere das NostrProfile-Objekt, falls es noch nicht existiert
window.NostrProfile = window.NostrProfile || {};

// Initialize profile cache
window.profileCache = window.profileCache || {};

// Function to request profile information for a pubkey
window.NostrProfile.requestProfileInfo = function(pubkey, relayPool, relays) {
    // Skip if we don't have a relay pool yet
    if (!relayPool) {
        console.warn("Cannot request profile info: relayPool is not initialized");
        return;
    }

    if (!pubkey) {
        console.warn("Cannot request profile info: pubkey is undefined");
        return;
    }

    if (!relays || !Array.isArray(relays) || relays.length === 0) {
        console.warn("Cannot request profile info: relays are not properly defined", relays);
        return;
    }

    console.log("Requesting profile info for:", pubkey, "from relays:", relays);

    // Check if we already have this profile in cache
    if (window.profileCache && window.profileCache[pubkey]) {
        console.log("Profile already in cache:", window.profileCache[pubkey]);
        // Still request fresh data but don't block on it
    }

    try {
        // Try to get profile information from multiple sources

        // 1. First try to get profile metadata (kind=0)
        console.log("Subscribing to profile events with filter:", {
            kinds: [0],
            authors: [pubkey]
        });

        const sub1 = relayPool.subscribe(
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
                        console.log("Received profile event (kind=0):", event);

                        // Parse the profile information
                        const profile = JSON.parse(event.content);
                        console.log("Parsed profile:", profile);

                        // Store in cache
                        window.profileCache[pubkey] = profile;

                        console.log("Updated profile cache for:", pubkey, profile);
                        console.log("Current profile cache:", window.profileCache);

                        // Update any existing messages from this pubkey
                        window.NostrProfile.updateMessagesForPubkey(pubkey, profile);

                        // Also update the username display if this is the current user
                        if (window.userPublicKey === pubkey && typeof window.NostrUI.updateUsernameDisplay === 'function') {
                            console.log("Updating username display for current user");
                            window.NostrUI.updateUsernameDisplay(pubkey);
                        }
                    } catch (error) {
                        console.error("Error processing profile event:", error);
                    }
                },
                oneose() {
                    console.log("End of stored profile events (kind=0) for pubkey:", pubkey);
                }
            }
        );

        // 2. Also try to get NIP-05 verification events (kind=30008)
        console.log("Subscribing to NIP-05 verification events with filter:", {
            kinds: [30008],
            authors: [pubkey]
        });

        const sub2 = relayPool.subscribe(
            relays,
            [
                {
                    kinds: [30008], // NIP-05 verification
                    authors: [pubkey]
                }
            ],
            {
                onevent(event) {
                    try {
                        console.log("Received NIP-05 verification event (kind=30008):", event);

                        // Check if we already have a profile in cache
                        if (!window.profileCache[pubkey]) {
                            window.profileCache[pubkey] = {};
                        }

                        // Extract NIP-05 identifier from the event
                        if (event.tags) {
                            for (const tag of event.tags) {
                                if (tag[0] === 'nip05' && tag[1]) {
                                    console.log("Found NIP-05 identifier in tags:", tag[1]);
                                    window.profileCache[pubkey].nip05 = tag[1];
                                    break;
                                }
                            }
                        }

                        // Try to parse content as JSON
                        try {
                            const content = JSON.parse(event.content);
                            if (content.nip05) {
                                console.log("Found NIP-05 identifier in content:", content.nip05);
                                window.profileCache[pubkey].nip05 = content.nip05;
                            }
                        } catch (parseError) {
                            // Content is not JSON, check if it's a NIP-05 identifier
                            if (event.content && event.content.includes('@')) {
                                console.log("Found potential NIP-05 identifier in content:", event.content);
                                window.profileCache[pubkey].nip05 = event.content;
                            }
                        }

                        console.log("Updated profile cache with NIP-05 info for:", pubkey, window.profileCache[pubkey]);

                        // Update any existing messages from this pubkey
                        window.NostrProfile.updateMessagesForPubkey(pubkey, window.profileCache[pubkey]);

                        // Also update the username display if this is the current user
                        if (window.userPublicKey === pubkey && typeof window.NostrUI.updateUsernameDisplay === 'function') {
                            console.log("Updating username display for current user");
                            window.NostrUI.updateUsernameDisplay(pubkey);
                        }
                    } catch (error) {
                        console.error("Error processing NIP-05 verification event:", error);
                    }
                },
                oneose() {
                    console.log("End of stored NIP-05 verification events for pubkey:", pubkey);
                }
            }
        );

        // 3. Also try to get metadata from regular notes (kind=1) that might contain profile info in tags
        console.log("Subscribing to regular notes with filter:", {
            kinds: [1],
            authors: [pubkey],
            limit: 10
        });

        const sub3 = relayPool.subscribe(
            relays,
            [
                {
                    kinds: [1], // Regular notes
                    authors: [pubkey],
                    limit: 10 // Limit to 10 most recent notes
                }
            ],
            {
                onevent(event) {
                    try {
                        console.log("Received note event (kind=1):", event);

                        // Check if we already have a profile in cache
                        if (!window.profileCache[pubkey]) {
                            window.profileCache[pubkey] = {};
                        }

                        // Extract profile info from tags
                        if (event.tags) {
                            for (const tag of event.tags) {
                                if (tag[0] === 'nip05' && tag[1] && !window.profileCache[pubkey].nip05) {
                                    console.log("Found NIP-05 identifier in note tags:", tag[1]);
                                    window.profileCache[pubkey].nip05 = tag[1];
                                }

                                if (tag[0] === 'name' && tag[1] && !window.profileCache[pubkey].name) {
                                    console.log("Found name in note tags:", tag[1]);
                                    window.profileCache[pubkey].name = tag[1];
                                }

                                if ((tag[0] === 'display_name' || tag[0] === 'displayName') && tag[1] &&
                                    !window.profileCache[pubkey].display_name && !window.profileCache[pubkey].displayName) {
                                    console.log("Found display name in note tags:", tag[1]);
                                    window.profileCache[pubkey].display_name = tag[1];
                                }
                            }
                        }

                        // Update any existing messages from this pubkey if we found new info
                        if (window.profileCache[pubkey].nip05 || window.profileCache[pubkey].name ||
                            window.profileCache[pubkey].display_name || window.profileCache[pubkey].displayName) {
                            console.log("Updated profile cache with info from notes for:", pubkey, window.profileCache[pubkey]);
                            window.NostrProfile.updateMessagesForPubkey(pubkey, window.profileCache[pubkey]);

                            // Also update the username display if this is the current user
                            if (window.userPublicKey === pubkey && typeof window.NostrUI.updateUsernameDisplay === 'function') {
                                console.log("Updating username display for current user");
                                window.NostrUI.updateUsernameDisplay(pubkey);
                            }
                        }
                    } catch (error) {
                        console.error("Error processing note event:", error);
                    }
                },
                oneose() {
                    console.log("End of stored note events for pubkey:", pubkey);
                }
            }
        );

        // Set a timeout to close all subscriptions after a while
        setTimeout(() => {
            try {
                if (sub1 && typeof sub1.close === 'function') {
                    console.log("Closing profile subscription (kind=0) for pubkey:", pubkey);
                    sub1.close();
                }

                if (sub2 && typeof sub2.close === 'function') {
                    console.log("Closing NIP-05 verification subscription (kind=30008) for pubkey:", pubkey);
                    sub2.close();
                }

                if (sub3 && typeof sub3.close === 'function') {
                    console.log("Closing note subscription (kind=1) for pubkey:", pubkey);
                    sub3.close();
                }
            } catch (closeError) {
                console.error("Error closing profile subscriptions:", closeError);
            }
        }, 15000); // 15 seconds timeout

        return [sub1, sub2, sub3];
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
    if (!event || !event.pubkey) {
        console.warn("Cannot get display name: event or pubkey is missing", event);
        return "unknown";
    }

    // Default to first 6 characters of pubkey
    const shortenPubkey = (pubkey) => pubkey.substring(0, 6);
    let displayName = shortenPubkey(event.pubkey);
    console.log(`Initial display name for ${event.id}: ${displayName} (pubkey: ${event.pubkey})`);

    try {
        // Check for handle name in the event content (might contain profile info)
        if (event.kind === 0 && event.content) {
            console.log(`Event ${event.id} is a profile event, parsing content`);
            // Try to parse profile info from kind=0 events
            try {
                const profile = JSON.parse(event.content);
                console.log(`Parsed profile from event ${event.id}:`, profile);

                // Prioritize NIP-05 identifier if available
                if (profile.nip05) {
                    displayName = profile.nip05;
                    console.log(`Using nip05 from event: ${displayName}`);
                } else if (profile.display_name) {
                    displayName = profile.display_name;
                    console.log(`Using display_name from event: ${displayName}`);
                } else if (profile.displayName) {
                    displayName = profile.displayName;
                    console.log(`Using displayName from event: ${displayName}`);
                } else if (profile.name) {
                    displayName = profile.name;
                    console.log(`Using name from event: ${displayName}`);
                }
            } catch (e) {
                console.warn(`Could not parse profile info from event ${event.id}:`, e);
            }
        }

        // Check for handle name in the event tags
        if (event.tags && Array.isArray(event.tags)) {
            console.log(`Checking tags in event ${event.id}:`, event.tags);

            // Look for various tag types that might contain identity info
            for (const tag of event.tags) {
                // NIP-05 identifier
                if (tag[0] === 'nip05' && tag[1]) {
                    displayName = tag[1];
                    console.log(`Using nip05 from tag: ${displayName}`);
                    break;
                }

                // Name tag
                if (tag[0] === 'name' && tag[1]) {
                    displayName = tag[1];
                    console.log(`Using name from tag: ${displayName}`);
                    // Don't break here, continue to check for better identifiers
                }

                // Display name tag
                if ((tag[0] === 'display_name' || tag[0] === 'displayName') && tag[1]) {
                    displayName = tag[1];
                    console.log(`Using display_name from tag: ${displayName}`);
                    // Don't break here, continue to check for better identifiers
                }
            }
        }

        // Check if we already have this profile in cache
        if (window.profileCache && window.profileCache[event.pubkey]) {
            const profile = window.profileCache[event.pubkey];
            console.log(`Found profile in cache for ${event.pubkey}:`, profile);

            // Prioritize NIP-05 identifier if available
            if (profile.nip05) {
                displayName = profile.nip05;
                console.log(`Using nip05 from cache: ${displayName}`);
            } else if (profile.display_name) {
                displayName = profile.display_name;
                console.log(`Using display_name from cache: ${displayName}`);
            } else if (profile.displayName) {
                displayName = profile.displayName;
                console.log(`Using displayName from cache: ${displayName}`);
            } else if (profile.name) {
                displayName = profile.name;
                console.log(`Using name from cache: ${displayName}`);
            }
        } else {
            console.log(`No profile found in cache for ${event.pubkey}`);

            // Request profile information if not in cache
            if (window.relayPool && window.relays && event.pubkey) {
                console.log(`Requesting profile info for ${event.pubkey} from getDisplayName`);
                window.NostrProfile.requestProfileInfo(event.pubkey, window.relayPool, window.relays);
            }
        }

        console.log(`Final display name for ${event.id}: ${displayName}`);
    } catch (error) {
        console.error(`Error processing display name for ${event.id}:`, error);
    }

    return displayName;
};

// Add profile tags to an event
window.NostrProfile.addProfileTags = function(event, userPublicKey) {
    if (!event.tags) {
        event.tags = [];
    }

    // We don't need to add any profile-related tags to the event
    // This ensures consistent behavior for all users, regardless of whether they have NIP-05 or not
    console.log("Not adding any profile tags to event to ensure consistent behavior");

    // Just make sure we have the required tag for the channel
    let hasChannelTag = false;
    for (const tag of event.tags) {
        if (tag[0] === 't') {
            hasChannelTag = true;
            break;
        }
    }

    // If no channel tag is found, add a default one
    if (!hasChannelTag) {
        console.log("No channel tag found, adding default channel tag");
        event.tags.push(['t', 'ottobrunner-hofflohmarkt']);
    }

    return event;
};
