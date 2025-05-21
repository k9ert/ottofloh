// nostr-ui.js - Kompatibilitätsschicht für die modularisierte Version
// Diese Datei ist nur für die Kompatibilität mit älteren Code-Teilen vorhanden
// und verweist auf die neuen, modularisierten Dateien.

// Stelle sicher, dass das NostrUI-Objekt existiert
window.NostrUI = window.NostrUI || {};

// Kopiere die processedEvents von NostrCore zu NostrUI
Object.defineProperty(window.NostrUI, 'processedEvents', {
    get: function() {
        return window.NostrCore.processedEvents;
    },
    set: function(value) {
        window.NostrCore.processedEvents = value;
    }
});

// Stelle sicher, dass alle Funktionen aus nostr-ui-core.js und nostr-ui-messages.js verfügbar sind
// Diese Funktionen werden automatisch durch die Einbindung der neuen Dateien verfügbar gemacht

// Füge eine Kompatibilitätsfunktion für initUI hinzu, falls sie direkt aufgerufen wird
window.initUI = function() {
    console.log("Using modularized version: window.NostrUI.initUI");
    return window.NostrUI.initUI();
};

// Füge eine Kompatibilitätsfunktion für showChatInterface hinzu, falls sie direkt aufgerufen wird
window.showChatInterface = function() {
    console.log("Using modularized version: window.NostrUI.showChatInterface");
    return window.NostrUI.showChatInterface();
};

// Füge eine Kompatibilitätsfunktion für hideLoadingIndicator hinzu, falls sie direkt aufgerufen wird
window.hideLoadingIndicator = function() {
    console.log("Using modularized version: window.NostrUI.hideLoadingIndicator");
    return window.NostrUI.hideLoadingIndicator();
};

// Füge eine Kompatibilitätsfunktion für addWelcomeMessage hinzu, falls sie direkt aufgerufen wird
window.addWelcomeMessage = function(userPublicKey, channelId, isFirstTime) {
    console.log("Using modularized version: window.NostrUI.addWelcomeMessage");
    return window.NostrUI.addWelcomeMessage(userPublicKey, channelId, isFirstTime);
};

// Füge eine Kompatibilitätsfunktion für resetIdentity hinzu, falls sie direkt aufgerufen wird
window.resetIdentity = function() {
    console.log("Using modularized version: window.NostrUI.resetIdentity");
    return window.NostrUI.resetIdentity();
};
