// nostr-events.js - Event-Erstellung, -Signierung und -Verarbeitung für den Nostr-Chat

// Initialisiere das NostrEvents-Objekt, falls es noch nicht existiert
window.NostrEvents = window.NostrEvents || {};

// Verarbeite und veröffentliche ein signiertes Event
window.NostrEvents.processAndPublishSignedEvent = async function(signedEvent, userPublicKey, relayPool, relays) {
    console.log("Processing signed event for publishing:", signedEvent);

    // Prüfe, ob wir ein korrekt signiertes Event mit allen erforderlichen Feldern haben
    if (!signedEvent || !signedEvent.sig || !signedEvent.id || !signedEvent.pubkey ||
        !signedEvent.kind || !signedEvent.created_at || !signedEvent.content) {
        console.error("Cannot publish invalid event:", signedEvent);
        alert("Fehler: Die Nachricht ist ungültig und kann nicht gesendet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        return;
    }

    // Überprüfe, ob die Event-ID korrekt ist
    if (window.NostrTools && window.NostrTools.getEventHash) {
        const calculatedId = window.NostrTools.getEventHash(signedEvent);
        if (calculatedId !== signedEvent.id) {
            console.error("Event ID mismatch:", {
                providedId: signedEvent.id,
                calculatedId: calculatedId
            });

            // Korrigiere die ID
            console.log("Fixing event ID before publishing");
            signedEvent.id = calculatedId;
        } else {
            console.log("Event ID verified correctly");
        }
    }

    // Veröffentliche an Relays
    if (relayPool && typeof relayPool.publish === 'function') {
        console.log("Publishing to relays:", relays);
        console.log("Event:", signedEvent);

        try {
            // Füge eine kleine Verzögerung vor dem Veröffentlichen hinzu, um Rate-Limiting zu vermeiden
            setTimeout(() => {
                try {
                    // Versuche zu veröffentlichen und behandle verschiedene Rückgabetypen
                    const pubResult = relayPool.publish(relays, signedEvent);

                    // Prüfe, ob pubResult ein Promise ist
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

    // Zeige unsere eigene Nachricht sofort an
    // Erstelle eine Kopie des Events mit einer speziellen lokalen ID, um sicherzustellen, dass es angezeigt wird
    const localEvent = { ...signedEvent };

    // Ändere die ID zu einer lokalen Version, um sicherzustellen, dass sie angezeigt wird
    localEvent.id = 'local-sent-' + (signedEvent.id || Date.now() + '-' + Math.random().toString(36).substring(2, 15));

    // Stelle sicher, dass wir ein Tags-Array haben
    if (!localEvent.tags) {
        localEvent.tags = [];
    }

    // Wir müssen keine profilbezogenen Tags zum Event hinzufügen
    // Dies stellt ein konsistentes Verhalten für alle Benutzer sicher, unabhängig davon, ob sie NIP-05 haben oder nicht
    console.log("Not adding any profile tags to local event to ensure consistent behavior");

    // Stelle sicher, dass wir die erforderlichen Tags für den Kanal haben
    // Für Kind 42 (Kanal-Nachricht) benötigen wir ein 'e'-Tag mit der Kanal-ID und 'root'-Marker

    // Hole die Kanal-ID - verwende die gespeicherte, falls verfügbar, ansonsten verwende einen Standard
    const channelId = window.NostrRelay.channelInfo.id || 'ottobrunner-hofflohmarkt-2025';

    // Prüfe, ob wir ein 'e'-Tag mit 'root'-Marker haben
    let hasChannelRootTag = false;
    for (const tag of localEvent.tags) {
        if (tag[0] === 'e' && tag[3] === 'root') {
            hasChannelRootTag = true;
            break;
        }
    }

    // Wenn kein Kanal-Root-Tag gefunden wird, füge einen hinzu
    if (!hasChannelRootTag) {
        console.log("No channel root tag found, adding channel root tag to local event");
        localEvent.tags.push(['e', channelId, '', 'root']);
    }

    // Prüfe auch auf 't'-Tag für Abwärtskompatibilität
    let hasChannelTag = false;
    for (const tag of localEvent.tags) {
        if (tag[0] === 't') {
            hasChannelTag = true;
            break;
        }
    }

    // Wenn kein 't'-Tag gefunden wird, füge einen Standard hinzu
    if (!hasChannelTag) {
        console.log("No 't' tag found, adding default 't' tag to local event");
        localEvent.tags.push(['t', 'ottobrunner-hofflohmarkt']);
    }

    // Protokolliere das lokale Event für Debugging
    console.log("Displaying local event with handle:", localEvent);

    // Zeige die Nachricht mit unserer lokalen ID an der richtigen Position an
    window.NostrUI.displayMessageInOrder(localEvent, userPublicKey, relayPool, relays);

    // Füge die ursprüngliche Event-ID zum Set der verarbeiteten Events hinzu, damit sie nicht erneut angezeigt wird, wenn sie vom Relay zurückkommt
    if (signedEvent.id) {
        window.NostrCore.processedEvents.add(signedEvent.id);
        console.log("Added our message ID to processed events:", signedEvent.id);
    }
};

// Sende eine Nachricht
window.NostrEvents.sendMessage = async function(content, userPublicKey, userPrivateKey, CHANNEL_ID, relayPool, relays) {
    if (!content || !content.trim()) return;

    try {
        console.log("Sending message:", content);

        // Hole die Kanal-ID - verwende die gespeicherte, falls verfügbar, ansonsten verwende die CHANNEL_ID
        const channelId = window.NostrRelay.channelInfo.id || CHANNEL_ID;
        console.log("Using channel ID for message:", channelId);

        // Erstelle Event mit Tags gemäß NIP-28
        // Für Kanal-Nachrichten benötigen wir ein 'e'-Tag mit der Kanal-ID und 'root'-Marker
        const eventTags = [
            ['e', channelId, '', 'root'], // Verweis auf den Kanal mit 'root'-Marker
            ['t', CHANNEL_ID] // Behalte das 't'-Tag für Abwärtskompatibilität bei
        ];

        // Erstelle ein korrekt formatiertes Event-Objekt
        const event = {
            kind: 42, // Kanal-Nachricht (NIP-28)
            created_at: Math.floor(Date.now() / 1000),
            tags: eventTags,
            content: content,
            pubkey: userPublicKey // Füge pubkey zum Event hinzu
        };

        // Füge Profil-Tags hinzu - dies modifiziert das Event-Objekt
        window.NostrProfile.addProfileTags(event);

        console.log("Created event template:", event);

        // Stelle sicher, dass wir alle erforderlichen Felder für ein gültiges Nostr-Event haben
        if (!event.pubkey || !event.created_at || !event.kind || !event.tags || !event.content) {
            console.error("Invalid event object:", event);
            alert("Fehler: Die Nachricht ist ungültig und kann nicht gesendet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
            return;
        }

        let signedEvent;

        // Signiere mit Erweiterung oder mit unserem privaten Schlüssel
        if (window.nostr && !userPrivateKey) {
            console.log("Signing with Nostr extension");

            // Berechne zuerst die Event-ID, wenn wir die Funktion haben
            if (window.NostrTools && window.NostrTools.getEventHash) {
                event.id = window.NostrTools.getEventHash(event);
            }

            signedEvent = await window.nostr.signEvent(event);
        } else if (userPrivateKey) {
            // Signiere mit privatem Schlüssel
            signedEvent = await window.NostrCrypto.signEvent(event, userPrivateKey);
        } else {
            console.error("No private key or extension available for signing");
            alert("Fehler: Kein privater Schlüssel oder Erweiterung zum Signieren verfügbar. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
            return;
        }

        console.log("Signed event:", signedEvent);

        // Verarbeite und veröffentliche das signierte Event
        await window.NostrEvents.processAndPublishSignedEvent(signedEvent, userPublicKey, relayPool, relays);

        // Leere das Eingabefeld
        document.getElementById('chat-input').value = '';

        return true;
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Fehler beim Senden der Nachricht. Bitte versuchen Sie es erneut.");
        return false;
    }
};
