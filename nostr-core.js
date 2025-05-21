// nostr-core.js - Grundlegende Funktionen und Initialisierung für den Nostr-Chat

// Initialisiere die globalen Objekte, falls sie noch nicht existieren
window.NostrCore = window.NostrCore || {};

// Konstanten
window.NostrCore.CHANNEL_ID = 'ottobrunner-hofflohmarkt-2025';

// Globale Variablen
window.userPrivateKey = null;
window.userPublicKey = null;
window.relayPool = null;
window.relays = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.snort.social'
];

// Speichert verarbeitete Events, um Duplikate zu vermeiden
window.NostrCore.processedEvents = new Set();

// Prüft, ob die Nostr-Bibliothek geladen und bereit ist
window.isNostrReady = function() {
    return (
        window.NostrTools &&
        window.NostrTools.SimplePool &&
        window.NostrCrypto &&
        window.NostrCrypto.signEvent &&
        window.NostrUtils
    );
};

// Prüft, ob ein gespeicherter Schlüssel vorhanden ist
window.NostrCore.checkForSavedKey = function(callback) {
    try {
        const savedKey = localStorage.getItem('nostr_private_key');
        if (savedKey) {
            console.log("Found saved key in localStorage");

            // Validiere das Schlüsselformat
            if (!/^[0-9a-f]{64}$/i.test(savedKey)) {
                console.error("Invalid key format in localStorage");
                localStorage.removeItem('nostr_private_key');
                return false;
            }

            window.userPrivateKey = savedKey;

            // Versuche, den öffentlichen Schlüssel zu erhalten
            try {
                window.userPublicKey = window.NostrCrypto.getPublicKey(
                    window.NostrUtils.hexToBytes(savedKey)
                );
                console.log("Loaded key pair:", { publicKey: window.userPublicKey });

                // Validiere den öffentlichen Schlüssel
                if (!/^[0-9a-f]{64}$/i.test(window.userPublicKey)) {
                    console.error("Invalid public key format:", window.userPublicKey);
                    throw new Error("Invalid public key format");
                }

                // Wir werden den Handle später aus Profil-Events abrufen
                console.log("User handle will be set from profile events");

                if (callback && typeof callback === 'function') {
                    callback(true);
                }
                return true;
            } catch (keyError) {
                console.error("Error deriving public key:", keyError);
                alert("Fehler beim Laden des gespeicherten Schlüssels. Ein neuer Schlüssel wird benötigt.");
                localStorage.removeItem('nostr_private_key');
                return false;
            }
        }
    } catch (error) {
        console.error("Error checking for saved key:", error);
    }
    return false;
};

// Generiert ein neues Schlüsselpaar
window.NostrCore.generateKeyPair = function(callback) {
    try {
        const { privateKey, secretKey } = window.NostrCrypto.generateKeyPair();
        window.userPrivateKey = privateKey;
        window.userPublicKey = window.NostrCrypto.getPublicKey(secretKey);

        console.log("Generated key pair:", { privateKey: window.userPrivateKey, publicKey: window.userPublicKey });

        // Speichere in localStorage
        localStorage.setItem('nostr_private_key', window.userPrivateKey);

        if (callback && typeof callback === 'function') {
            callback(true);
        }
        return true;
    } catch (error) {
        console.error("Error generating key:", error);
        alert("Fehler beim Erstellen eines neuen Schlüssels. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        return false;
    }
};

// Verbindet mit einer Nostr-Erweiterung (NIP-07)
window.NostrCore.connectWithExtension = async function(callback) {
    if (window.nostr) {
        try {
            // Versuche, den öffentlichen Schlüssel von der Erweiterung zu erhalten
            window.userPublicKey = await window.nostr.getPublicKey();

            // Prüfe, ob wir einen gültigen öffentlichen Schlüssel erhalten haben
            if (!window.userPublicKey) {
                throw new Error("No public key returned from extension");
            }

            console.log("Successfully connected to Nostr extension, public key:", window.userPublicKey);
            
            if (callback && typeof callback === 'function') {
                callback(true);
            }
            return true;
        } catch (error) {
            console.error('Error connecting to Nostr extension:', error);

            // Prüfe auf spezifische Fehlermeldungen
            const errorMessage = error?.message || String(error);

            if (errorMessage.includes("no private key found") ||
                errorMessage.includes("No key") ||
                errorMessage.includes("not found")) {
                // Dies ist ein häufiger Fehler, wenn die Erweiterung installiert ist, aber kein Schlüssel konfiguriert ist
                alert('Die Nostr-Erweiterung ist installiert, aber es wurde kein Schlüssel gefunden. ' +
                      'Bitte konfigurieren Sie zuerst einen Schlüssel in Ihrer Erweiterung oder ' +
                      'erstellen Sie einen neuen Schlüssel für diesen Chat.');
            } else if (errorMessage.includes("user rejected")) {
                // Benutzer hat die Anfrage abgelehnt
                alert('Sie haben die Verbindung abgelehnt. Bitte erlauben Sie den Zugriff, ' +
                      'wenn Sie die Erweiterung verwenden möchten, oder erstellen Sie einen neuen Schlüssel.');
            } else {
                // Allgemeiner Fehler
                alert('Fehler beim Verbinden mit der Nostr-Erweiterung. Bitte versuchen Sie es erneut oder erstellen Sie einen neuen Schlüssel.');
            }
            return false;
        }
    } else {
        alert('Keine Nostr-Erweiterung gefunden. Bitte installieren Sie eine Nostr-Erweiterung (wie nos2x oder Alby) oder erstellen Sie einen neuen Schlüssel.');
        return false;
    }
};

// Verarbeitet einen nsec-Schlüssel
window.NostrCore.processNsecKey = function(nsecValue, callback) {
    if (!nsecValue) {
        alert('Bitte geben Sie einen nsec-Schlüssel ein.');
        return false;
    }

    try {
        // Behandle sowohl nsec- als auch Hex-Formate
        let privateKeyHex;

        if (nsecValue.startsWith('nsec1')) {
            // Konvertiere von bech32 zu hex
            try {
                // Verwende NostrTools bech32-Konvertierung, falls verfügbar
                if (window.NostrTools && window.NostrTools.nip19) {
                    const decoded = window.NostrTools.nip19.decode(nsecValue);
                    console.log("Decoded nsec:", decoded);

                    // Prüfe den Typ von decoded.data
                    if (typeof decoded.data === 'string') {
                        privateKeyHex = decoded.data;
                    } else if (decoded.data instanceof Uint8Array) {
                        // Konvertiere Uint8Array zu Hex-String
                        privateKeyHex = window.NostrUtils.bytesToHex(decoded.data);
                    } else {
                        // Versuche, andere Formate zu behandeln
                        console.log("Unexpected data type:", typeof decoded.data);
                        privateKeyHex = decoded.data.toString();
                    }

                    console.log("Converted privateKeyHex:", privateKeyHex);
                } else {
                    throw new Error("Bech32 conversion not available");
                }
            } catch (bech32Error) {
                console.error("Error decoding nsec:", bech32Error);
                alert('Ungültiger nsec-Schlüssel. Bitte überprüfen Sie das Format und versuchen Sie es erneut.');
                return false;
            }
        } else if (/^[0-9a-f]{64}$/i.test(nsecValue)) {
            // Bereits im Hex-Format
            privateKeyHex = nsecValue;
        } else {
            alert('Ungültiges Schlüsselformat. Bitte geben Sie einen gültigen nsec-Schlüssel ein.');
            return false;
        }

        // Leite den öffentlichen Schlüssel vom privaten Schlüssel ab
        window.userPrivateKey = privateKeyHex;
        window.userPublicKey = window.NostrCrypto.getPublicKey(
            window.NostrUtils.hexToBytes(privateKeyHex)
        );

        console.log("Loaded key from nsec input:", { publicKey: window.userPublicKey });

        // Speichere in localStorage
        localStorage.setItem('nostr_private_key', window.userPrivateKey);

        if (callback && typeof callback === 'function') {
            callback(true);
        }
        return true;
    } catch (error) {
        console.error("Error processing nsec key:", error);
        alert('Fehler beim Verarbeiten des nsec-Schlüssels. Bitte überprüfen Sie das Format und versuchen Sie es erneut.');
        return false;
    }
};

// Setzt die Identität zurück
window.NostrCore.resetIdentity = function() {
    // Entferne den Schlüssel aus dem localStorage
    localStorage.removeItem('nostr_private_key');
    
    // Setze die globalen Variablen zurück
    window.userPrivateKey = null;
    window.userPublicKey = null;
    
    console.log("Identity reset complete");
    
    return true;
};
