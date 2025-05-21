// nostr-relay.js - Relay-Verbindung und Kommunikation für den Nostr-Chat

// Initialisiere das NostrRelay-Objekt, falls es noch nicht existiert
window.NostrRelay = window.NostrRelay || {};

// Speichere Kanal-Informationen
window.NostrRelay.channelInfo = {
    id: null,
    created: false
};

// Initialisiere den Relay-Pool mit SimplePool aus nostr-tools v2
window.NostrRelay.initRelayPool = function() {
    console.log("Initializing SimplePool for relay connections");

    // Erstelle eine SimplePool-Instanz
    const pool = new window.NostrTools.SimplePool();

    // Erstelle ein Relay-Pool-Objekt mit unseren benutzerdefinierten Methoden
    const relayPool = {
        pool: pool,
        relays: [],
        activeRelays: [],

        // Abonniere Events
        subscribe: function(relayUrls, filters, callbacks) {
            console.log("Subscribing to relays:", relayUrls);
            console.log("With filters:", filters);

            // Verfolge aktive Relays
            for (const url of relayUrls) {
                if (!this.activeRelays.includes(url)) {
                    this.activeRelays.push(url);
                }
            }

            // Abonniere Events mit SimplePool
            const sub = this.pool.subscribeMany(
                relayUrls,
                filters,
                {
                    onevent(event) {
                        console.log(`Received event:`, event);
                        callbacks.onevent(event);
                    },
                    oneose() {
                        console.log("End of stored events");
                        if (callbacks.oneose) {
                            callbacks.oneose();
                        }
                    }
                }
            );

            // Speichere das Abonnement für mögliche Bereinigung
            this.relays.push(sub);

            return sub;
        },

        // Veröffentliche ein Event an Relays
        publish: function(relayUrls, event) {
            console.log("Publishing to relays:", relayUrls);
            console.log("Event:", event);

            // Veröffentliche das Event mit SimplePool
            return this.pool.publish(relayUrls, event);
        },

        // Schließe alle Verbindungen
        close: function() {
            console.log("Closing all relay connections");
            this.pool.close();
            this.activeRelays = [];
        }
    };

    return relayPool;
};

// Erstelle oder finde einen Kanal
window.NostrRelay.createOrFindChannel = async function(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey) {
    console.log("Creating or finding channel:", CHANNEL_ID);

    return new Promise((resolve, reject) => {
        // Prüfe zuerst, ob ein Kanal mit dieser ID bereits existiert
        console.log("Checking for existing channel with ID:", CHANNEL_ID);

        // Flag, um zu verfolgen, ob wir einen Kanal gefunden haben
        let foundChannel = false;

        // Abonniere Kind 40 Events (Kanal-Erstellung) mit unserer Kanal-ID
        const sub = relayPool.subscribe(
            relays,
            [
                {
                    kinds: [40], // Kanal-Erstellung
                    '#t': [CHANNEL_ID] // Tag für unseren Kanal
                }
            ],
            {
                onevent(event) {
                    console.log("Found existing channel:", event);
                    foundChannel = true;

                    // Speichere die Kanal-ID
                    window.NostrRelay.channelInfo.id = event.id;
                    window.NostrRelay.channelInfo.created = true;

                    // Schließe das Abonnement
                    if (sub && typeof sub.close === 'function') {
                        sub.close();
                    }

                    // Löse mit der Kanal-ID auf
                    resolve(event.id);
                },
                oneose() {
                    console.log("End of stored channel events");

                    // Wenn wir keinen Kanal gefunden haben, erstelle einen
                    if (!foundChannel) {
                        console.log("No existing channel found, creating new channel");

                        // Erstelle einen neuen Kanal
                        window.NostrRelay.createChannel(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey)
                            .then(channelId => {
                                resolve(channelId);
                            })
                            .catch(error => {
                                console.error("Error creating channel:", error);
                                // Auch wenn wir keinen Kanal erstellen können, können wir immer noch eine Standard-ID verwenden
                                window.NostrRelay.channelInfo.id = CHANNEL_ID;
                                resolve(CHANNEL_ID);
                            });
                    }
                }
            }
        );

        // Setze ein Timeout, um zu vermeiden, dass wir hängen bleiben, wenn das Relay nicht antwortet
        setTimeout(() => {
            if (!foundChannel && !window.NostrRelay.channelInfo.created) {
                console.log("Timeout waiting for channel response, using default channel ID");

                // Schließe das Abonnement
                if (sub && typeof sub.close === 'function') {
                    sub.close();
                }

                // Verwende die CHANNEL_ID als Fallback
                window.NostrRelay.channelInfo.id = CHANNEL_ID;
                resolve(CHANNEL_ID);
            }
        }, 5000); // 5 Sekunden Timeout
    });
};

// Erstelle einen neuen Kanal
window.NostrRelay.createChannel = async function(relayPool, relays, CHANNEL_ID, userPublicKey, userPrivateKey) {
    console.log("Creating new channel:", CHANNEL_ID);

    // Erstelle Kanal-Metadaten
    const channelMetadata = {
        name: "Ottobrunner Hofflohmarkt Chat",
        about: "Chat für den Ottobrunner Hofflohmarkt",
        picture: "https://ottofloh.de/images/logo.png",
        relays: relays
    };

    // Erstelle Event mit grundlegenden Tags
    const eventTags = [['t', CHANNEL_ID]];

    // Erstelle ein korrekt formatiertes Event-Objekt für die Kanal-Erstellung (Kind 40)
    const event = {
        kind: 40, // Kanal-Erstellung
        created_at: Math.floor(Date.now() / 1000),
        tags: eventTags,
        content: JSON.stringify(channelMetadata),
        pubkey: userPublicKey
    };

    try {
        let signedEvent;

        // Signiere mit Erweiterung oder mit unserem privaten Schlüssel
        if (window.nostr && !userPrivateKey) {
            console.log("Signing channel creation with Nostr extension");

            // Berechne zuerst die Event-ID, wenn wir die Funktion haben
            if (window.NostrTools && window.NostrTools.getEventHash) {
                event.id = window.NostrTools.getEventHash(event);
            }

            signedEvent = await window.nostr.signEvent(event);
        } else {
            // Signiere mit privatem Schlüssel
            signedEvent = await window.NostrCrypto.signEvent(event, userPrivateKey);
        }

        console.log("Signed channel creation event:", signedEvent);

        // Veröffentliche an Relays
        await relayPool.publish(relays, signedEvent);

        // Speichere die Kanal-ID
        window.NostrRelay.channelInfo.id = signedEvent.id;
        window.NostrRelay.channelInfo.created = true;

        console.log("Channel created with ID:", signedEvent.id);

        return signedEvent.id;
    } catch (error) {
        console.error("Error creating channel:", error);
        throw error;
    }
};

// Abonniere Kanal-Nachrichten
window.NostrRelay.subscribeToChannel = async function(relayPool, relays, CHANNEL_ID, userPublicKey, isInitialLoad) {
    // Erstelle oder finde zuerst den Kanal
    try {
        const channelId = await window.NostrRelay.createOrFindChannel(
            relayPool,
            relays,
            CHANNEL_ID,
            userPublicKey,
            window.userPrivateKey
        );

        console.log("Using channel with ID:", channelId);

        // Abonniere Kanal-Nachrichten - nur aus den letzten 24 Stunden
        // Aber mit einer kleinen Verzögerung, um das Relay nicht zu überlasten
        setTimeout(() => {
            const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // Aktuelle Zeit minus 24 Stunden in Sekunden

            // Begrenze nicht die Anzahl der Events, um sicherzustellen, dass wir alle Nachrichten erhalten
            console.log("Starting subscription with delay to avoid relay spam protection");

            // Flag, um zu verfolgen, ob wir Events erhalten haben
            let receivedEvents = false;

            // Zeige Nachrichten an, wenn sie ankommen, aber füge sie an der richtigen Position ein
            relayPool.subscribe(
                relays,
                [
                    {
                        kinds: [42], // Kanal-Nachrichten (NIP-28)
                        '#e': [channelId], // Verweis auf das Kanal-Event
                        since: oneDayAgo // Nur Nachrichten aus den letzten 24 Stunden
                    }
                ],
                {
                    onevent(event) {
                        // Markiere, dass wir mindestens ein Event erhalten haben
                        receivedEvents = true;

                        // Protokolliere das Event
                        console.log("Received channel message:", {
                            id: event.id,
                            content: event.content.substring(0, 30) + "...",
                            created_at: new Date(event.created_at * 1000).toLocaleString(),
                            pubkey: event.pubkey
                        });

                        // Zeige das Event sofort an, aber an der richtigen Position
                        window.NostrUI.displayMessageInOrder(event, userPublicKey, relayPool, relays);

                        // Wenn dies das erste Event ist, verstecke den Ladeindikator
                        if (isInitialLoad) {
                            isInitialLoad = false;
                            window.NostrUI.hideLoadingIndicator();
                        }
                    },
                    oneose() {
                        // Ende der gespeicherten Events
                        console.log("End of stored channel messages");

                        // Wenn wir keine Events erhalten haben, verstecke den Ladeindikator
                        if (!receivedEvents) {
                            console.log("No channel messages received, hiding loading indicator");
                            if (isInitialLoad) {
                                isInitialLoad = false;
                                window.NostrUI.hideLoadingIndicator();
                            }
                        }

                        // Scrolle nach unten, um die neuesten Nachrichten anzuzeigen
                        document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;
                    }
                }
            );
        }, 2000); // 2 Sekunden Verzögerung vor dem Abonnieren
    } catch (error) {
        console.error("Error setting up channel:", error);

        // Falle zurück auf die alte Methode, wenn die Kanal-Erstellung fehlschlägt
        console.log("Falling back to tag-based subscription");

        setTimeout(() => {
            const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

            let receivedEvents = false;

            relayPool.subscribe(
                relays,
                [
                    {
                        kinds: [1, 42], // Versuche sowohl reguläre Notizen als auch Kanal-Nachrichten
                        '#t': [CHANNEL_ID], // Tag für unseren Kanal
                        since: oneDayAgo
                    }
                ],
                {
                    onevent(event) {
                        receivedEvents = true;
                        console.log("Received event (fallback):", event);
                        window.NostrUI.displayMessageInOrder(event, userPublicKey, relayPool, relays);

                        if (isInitialLoad) {
                            isInitialLoad = false;
                            window.NostrUI.hideLoadingIndicator();
                        }
                    },
                    oneose() {
                        console.log("End of stored events (fallback)");

                        if (!receivedEvents && isInitialLoad) {
                            isInitialLoad = false;
                            window.NostrUI.hideLoadingIndicator();
                        }

                        document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;
                    }
                }
            );
        }, 2000);
    }
};
