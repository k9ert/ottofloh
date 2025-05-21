// nostr-connection.js - Kompatibilitätsschicht für die modularisierte Version
// Diese Datei ist nur für die Kompatibilität mit älteren Code-Teilen vorhanden
// und verweist auf die neuen, modularisierten Dateien.

// Stelle sicher, dass die NostrConnection-Objekte existieren
window.NostrConnection = window.NostrConnection || {};

// Kopiere Funktionen von NostrRelay zu NostrConnection
window.NostrConnection.initRelayPool = function() {
    console.log("Using modularized version: NostrRelay.initRelayPool");
    return window.NostrRelay.initRelayPool();
};

window.NostrConnection.createOrFindChannel = function(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey) {
    console.log("Using modularized version: NostrRelay.createOrFindChannel");
    return window.NostrRelay.createOrFindChannel(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey);
};

window.NostrConnection.createChannel = function(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey) {
    console.log("Using modularized version: NostrRelay.createChannel");
    return window.NostrRelay.createChannel(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey);
};

window.NostrConnection.subscribeToChannel = function(relayPool, relays, CHANNEL_ID, userPublicKey, isInitialLoad) {
    console.log("Using modularized version: NostrRelay.subscribeToChannel");
    return window.NostrRelay.subscribeToChannel(relayPool, relays, CHANNEL_ID, userPublicKey, isInitialLoad);
};

window.NostrConnection.processAndPublishSignedEvent = function(signedEvent, userPublicKey, relayPool, relays) {
    console.log("Using modularized version: NostrEvents.processAndPublishSignedEvent");
    return window.NostrEvents.processAndPublishSignedEvent(signedEvent, userPublicKey, relayPool, relays);
};

window.NostrConnection.sendMessage = function(content, userPublicKey, userPrivateKey, CHANNEL_ID, relayPool, relays) {
    console.log("Using modularized version: NostrEvents.sendMessage");
    return window.NostrEvents.sendMessage(content, userPublicKey, userPrivateKey, CHANNEL_ID, relayPool, relays);
};

// Kopiere die channelInfo von NostrRelay zu NostrConnection
Object.defineProperty(window.NostrConnection, 'channelInfo', {
    get: function() {
        return window.NostrRelay.channelInfo;
    },
    set: function(value) {
        window.NostrRelay.channelInfo = value;
    }
});
