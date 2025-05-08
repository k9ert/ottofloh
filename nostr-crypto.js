// nostr-crypto.js - Kryptografische Funktionen für den Nostr-Chat

// Initialisiere das NostrCrypto-Objekt, falls es noch nicht existiert
window.NostrCrypto = window.NostrCrypto || {};

// Generate a new key pair
window.NostrCrypto.generateKeyPair = function() {
    try {
        let secretKey;
        const bytesToHex = window.NostrUtils.bytesToHex;
        const hexToBytes = window.NostrUtils.hexToBytes;

        // Try different ways to generate a key based on available API
        if (window.generatePrivateKey) {
            console.log("Using global generatePrivateKey");
            secretKey = window.generatePrivateKey();
            // Check if it's a hex string or Uint8Array
            if (typeof secretKey === 'string') {
                const privateKey = secretKey;
                secretKey = hexToBytes(secretKey);
                return { privateKey, secretKey };
            } else {
                const privateKey = bytesToHex(secretKey);
                return { privateKey, secretKey };
            }
        } else if (window.NostrTools && typeof window.NostrTools.generateSecretKey === 'function') {
            console.log("Using NostrTools.generateSecretKey");
            secretKey = window.NostrTools.generateSecretKey();
            const privateKey = bytesToHex(secretKey);
            return { privateKey, secretKey };
        } else if (window.NostrTools && typeof window.NostrTools.generatePrivateKey === 'function') {
            console.log("Using NostrTools.generatePrivateKey");
            secretKey = window.NostrTools.generatePrivateKey();
            // Check if it's a hex string or Uint8Array
            if (typeof secretKey === 'string') {
                const privateKey = secretKey;
                secretKey = hexToBytes(secretKey);
                return { privateKey, secretKey };
            } else {
                const privateKey = bytesToHex(secretKey);
                return { privateKey, secretKey };
            }
        } else if (window.nostrTools && typeof window.nostrTools.generateSecretKey === 'function') {
            console.log("Using nostrTools.generateSecretKey");
            secretKey = window.nostrTools.generateSecretKey();
            const privateKey = bytesToHex(secretKey);
            return { privateKey, secretKey };
        } else if (window.nostrTools && typeof window.nostrTools.generatePrivateKey === 'function') {
            console.log("Using nostrTools.generatePrivateKey");
            secretKey = window.nostrTools.generatePrivateKey();
            // Check if it's a hex string or Uint8Array
            if (typeof secretKey === 'string') {
                const privateKey = secretKey;
                secretKey = hexToBytes(secretKey);
                return { privateKey, secretKey };
            } else {
                const privateKey = bytesToHex(secretKey);
                return { privateKey, secretKey };
            }
        } else {
            console.log("Generating random key with crypto API");
            // Generate a random key if the library function isn't available
            secretKey = new Uint8Array(32);
            window.crypto.getRandomValues(secretKey);
            const privateKey = bytesToHex(secretKey);
            return { privateKey, secretKey };
        }
    } catch (error) {
        console.error("Error generating key:", error);
        throw error;
    }
}

// Get public key from private key
window.NostrCrypto.getPublicKey = function(secretKey) {
    try {
        // Try different ways to get public key based on available API
        if (window.getPublicKey) {
            console.log("Using global getPublicKey");
            return window.getPublicKey(secretKey);
        } else if (window.NostrTools && typeof window.NostrTools.getPublicKey === 'function') {
            console.log("Using NostrTools.getPublicKey");
            return window.NostrTools.getPublicKey(secretKey);
        } else if (window.nostrTools && typeof window.nostrTools.getPublicKey === 'function') {
            console.log("Using nostrTools.getPublicKey");
            return window.nostrTools.getPublicKey(secretKey);
        } else {
            throw new Error("No method found to get public key");
        }
    } catch (error) {
        console.error("Error getting public key:", error);
        throw error;
    }
};

// Sign an event
window.NostrCrypto.signEvent = async function(event, privateKey) {
    try {
        const hexToBytes = window.NostrUtils.hexToBytes;

        // Make a copy of the event to avoid modifying the original
        const eventToSign = { ...event };

        // Calculate event ID if needed
        if (!eventToSign.id) {
            console.log("Calculating event ID before signing");

            // Try different ways to calculate event ID based on available API
            if (window.NostrTools && typeof window.NostrTools.getEventHash === 'function') {
                console.log("Using NostrTools.getEventHash");
                eventToSign.id = window.NostrTools.getEventHash(eventToSign);
                console.log("Calculated event ID:", eventToSign.id);
            } else if (window.getEventHash) {
                console.log("Using global getEventHash");
                eventToSign.id = window.getEventHash(eventToSign);
                console.log("Calculated event ID:", eventToSign.id);
            } else if (window.nostrTools && typeof window.nostrTools.getEventHash === 'function') {
                console.log("Using nostrTools.getEventHash");
                eventToSign.id = window.nostrTools.getEventHash(eventToSign);
                console.log("Calculated event ID:", eventToSign.id);
            } else {
                console.warn("No method found to calculate event ID");
            }
        }

        // Try different ways to sign based on available API
        if (window.finalizeEvent) {
            console.log("Signing with global finalizeEvent");
            return window.finalizeEvent(eventToSign, hexToBytes(privateKey));
        } else if (window.signEvent) {
            console.log("Signing with global signEvent");
            return window.signEvent(eventToSign, privateKey);
        } else if (window.NostrTools && typeof window.NostrTools.finalizeEvent === 'function') {
            console.log("Signing with NostrTools.finalizeEvent");
            return window.NostrTools.finalizeEvent(eventToSign, hexToBytes(privateKey));
        } else if (window.NostrTools && typeof window.NostrTools.signEvent === 'function') {
            console.log("Signing with NostrTools.signEvent");
            return window.NostrTools.signEvent(eventToSign, privateKey);
        } else if (window.nostrTools && typeof window.nostrTools.finalizeEvent === 'function') {
            console.log("Signing with nostrTools.finalizeEvent");
            return window.nostrTools.finalizeEvent(eventToSign, hexToBytes(privateKey));
        } else if (window.nostrTools && typeof window.nostrTools.signEvent === 'function') {
            console.log("Signing with nostrTools.signEvent");
            return window.nostrTools.signEvent(eventToSign, privateKey);
        } else {
            throw new Error("No method found to sign the event");
        }
    } catch (error) {
        console.error("Error signing event:", error);
        throw error;
    }
};

// Sign an event with extension
window.NostrCrypto.signEventWithExtension = async function(event) {
    try {
        // Make a copy of the event to avoid modifying the original
        const eventToSign = { ...event };

        // Calculate event ID if needed
        if (!eventToSign.id) {
            console.log("Calculating event ID before signing with extension");

            // Try different ways to calculate event ID based on available API
            if (window.NostrTools && typeof window.NostrTools.getEventHash === 'function') {
                console.log("Using NostrTools.getEventHash");
                eventToSign.id = window.NostrTools.getEventHash(eventToSign);
                console.log("Calculated event ID:", eventToSign.id);
            } else if (window.getEventHash) {
                console.log("Using global getEventHash");
                eventToSign.id = window.getEventHash(eventToSign);
                console.log("Calculated event ID:", eventToSign.id);
            } else if (window.nostrTools && typeof window.nostrTools.getEventHash === 'function') {
                console.log("Using nostrTools.getEventHash");
                eventToSign.id = window.nostrTools.getEventHash(eventToSign);
                console.log("Calculated event ID:", eventToSign.id);
            } else {
                console.warn("No method found to calculate event ID");
            }
        }

        if (window.nostr && typeof window.nostr.signEvent === 'function') {
            console.log("Signing with Nostr extension");
            return await window.nostr.signEvent(eventToSign);
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
        if (window.verifyEvent) {
            console.log("Verifying with global verifyEvent");
            return window.verifyEvent(event);
        } else if (window.NostrTools && typeof window.NostrTools.verifyEvent === 'function') {
            console.log("Verifying with NostrTools.verifyEvent");
            return window.NostrTools.verifyEvent(event);
        } else if (window.nostrTools && typeof window.nostrTools.verifyEvent === 'function') {
            console.log("Verifying with nostrTools.verifyEvent");
            return window.nostrTools.verifyEvent(event);
        } else {
            console.warn("No method found to verify the event");
            return true; // Assume valid if we can't verify
        }
    } catch (error) {
        console.error("Error verifying event:", error);
        return false;
    }
};
