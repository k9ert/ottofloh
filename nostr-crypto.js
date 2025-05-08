// nostr-crypto.js - Kryptografische Funktionen für den Nostr-Chat

// Initialisiere das NostrCrypto-Objekt, falls es noch nicht existiert
window.NostrCrypto = window.NostrCrypto || {};

// Generate a new key pair
window.NostrCrypto.generateKeyPair = function() {
    try {
        // Generate a private key using nostr-tools
        const secretKey = window.NostrTools.generateSecretKey();
        const privateKey = window.NostrTools.bytesToHex(secretKey);
        
        console.log("Generated key pair with nostr-tools v2");
        
        return { privateKey, secretKey };
    } catch (error) {
        console.error("Error generating key:", error);
        throw error;
    }
};

// Get public key from private key
window.NostrCrypto.getPublicKey = function(secretKey) {
    try {
        // Get public key using nostr-tools
        return window.NostrTools.getPublicKey(secretKey);
    } catch (error) {
        console.error("Error getting public key:", error);
        throw error;
    }
};

// Sign an event
window.NostrCrypto.signEvent = async function(event, privateKey) {
    try {
        // Calculate event ID
        const eventId = window.NostrTools.getEventHash(event);
        
        // Sign the event
        const sig = window.NostrTools.signEvent(event, privateKey);
        
        // Return the complete signed event
        return {
            ...event,
            id: eventId,
            sig: sig
        };
    } catch (error) {
        console.error("Error signing event:", error);
        throw error;
    }
};

// Sign an event with extension
window.NostrCrypto.signEventWithExtension = async function(event) {
    try {
        if (window.nostr && typeof window.nostr.signEvent === 'function') {
            console.log("Signing with Nostr extension");
            return await window.nostr.signEvent(event);
        } else {
            throw new Error("No Nostr extension found");
        }
    } catch (error) {
        console.error("Error signing with extension:", error);
        throw error;
    }
};

// Verify an event
window.NostrCrypto.verifyEvent = function(event) {
    try {
        // Verify the event using nostr-tools
        return window.NostrTools.verifyEvent(event);
    } catch (error) {
        console.error("Error verifying event:", error);
        return false;
    }
};
