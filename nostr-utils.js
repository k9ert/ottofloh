// nostr-utils.js - Hilfsfunktionen für den Nostr-Chat

// Initialisiere das NostrUtils-Objekt, falls es noch nicht existiert
window.NostrUtils = window.NostrUtils || {};

// Helper functions for hex conversion
window.NostrUtils.bytesToHex = function(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

window.NostrUtils.hexToBytes = function(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
};

// Helper function to shorten pubkey for display
window.NostrUtils.shortenPubkey = function(pubkey) {
    return pubkey.substring(0, 6) + '...' + pubkey.substring(pubkey.length - 4);
};

// Helper function to format timestamp
window.NostrUtils.formatTimestamp = function(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
