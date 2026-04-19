// nostr-ui-messages.js - Nachrichtenanzeige und -verarbeitung für den Nostr-Chat

// Erweitere das NostrUI-Objekt, falls es noch nicht existiert
window.NostrUI = window.NostrUI || {};

// Zeige eine Nachricht in der richtigen Reihenfolge an
window.NostrUI.displayMessageInOrder = function(event, currentUserPubkey, relayPool, relays) {
    // Prüfe, ob wir dieses Event bereits verarbeitet haben
    if (window.NostrCore.processedEvents.has(event.id)) {
        console.log("Skipping already processed event:", event.id);
        return;
    }

    // Füge das Event zur Liste der verarbeiteten Events hinzu
    window.NostrCore.processedEvents.add(event.id);

    // Hole den Chat-Container
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) {
        console.error("Chat container not found");
        return;
    }

    // Erstelle das Nachrichtenelement
    const messageElement = window.NostrUI.createMessageElement(event, currentUserPubkey);

    // Füge Klassen für Tile-Layout hinzu
    messageElement.classList.add('message-tile');

    // Finde die richtige Position basierend auf dem Zeitstempel
    const messages = chatContainer.querySelectorAll('.chat-message');
    let inserted = false;

    // Wenn es keine Nachrichten gibt oder die neue Nachricht neuer ist als die letzte Nachricht,
    // füge sie am Ende hinzu
    if (messages.length === 0 ||
        parseInt(event.created_at) >= parseInt(messages[messages.length - 1].dataset.createdAt)) {
        chatContainer.appendChild(messageElement);
        inserted = true;
    } else {
        // Durchlaufe alle Nachrichten und finde die richtige Position
        for (let i = 0; i < messages.length; i++) {
            const currentMessage = messages[i];
            const currentTimestamp = parseInt(currentMessage.dataset.createdAt);

            if (parseInt(event.created_at) < currentTimestamp) {
                chatContainer.insertBefore(messageElement, currentMessage);
                inserted = true;
                break;
            }
        }
    }

    // Wenn die Nachricht nicht eingefügt wurde (sollte nicht passieren), füge sie am Ende hinzu
    if (!inserted) {
        chatContainer.appendChild(messageElement);
    }

    // Scrolle nach unten, wenn die Nachricht am Ende eingefügt wurde
    if (inserted && parseInt(event.created_at) >= parseInt(messages[messages.length - 1]?.dataset.createdAt || 0)) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Lade Profilinformationen für den Benutzer
    window.NostrProfile.loadProfileInfo(event.pubkey, relayPool, relays, (profile) => {
        if (profile) {
            // Aktualisiere den Anzeigenamen in der Nachricht
            const usernameElement = messageElement.querySelector('.username');
            if (usernameElement) {
                usernameElement.textContent = window.NostrProfile.getDisplayName(event, profile);
            }

            // Füge das Profilbild hinzu, wenn verfügbar
            if (profile.picture) {
                // Finde den Avatar-Platzhalter
                const avatarPlaceholder = messageElement.querySelector('.avatar');
                if (avatarPlaceholder) {
                    // Leere den Platzhalter
                    avatarPlaceholder.innerHTML = '';

                    // Erstelle das Profilbild-Element
                    const avatarImage = document.createElement('img');
                    avatarImage.className = 'avatar-img';
                    avatarImage.src = profile.picture;
                    avatarImage.alt = 'Avatar';
                    avatarImage.onerror = function() {
                        // Wenn das Bild nicht geladen werden kann, zeige den ersten Buchstaben des Benutzernamens
                        this.style.display = 'none';
                        avatarPlaceholder.textContent = window.NostrProfile.getDisplayName(event, profile).charAt(0).toUpperCase();
                    };

                    // Füge das Profilbild zum Avatar-Platzhalter hinzu
                    avatarPlaceholder.appendChild(avatarImage);
                }
            } else {
                // Wenn kein Profilbild verfügbar ist, zeige den ersten Buchstaben des Benutzernamens
                const avatarPlaceholder = messageElement.querySelector('.avatar');
                if (avatarPlaceholder) {
                    avatarPlaceholder.textContent = window.NostrProfile.getDisplayName(event, profile).charAt(0).toUpperCase();
                }
            }
        }
    });
};

// Erstelle einen Emoji-Picker
window.NostrUI.createEmojiPicker = function(targetElement, eventId, pubkey) {
    // Entferne vorhandene Emoji-Picker
    const existingPickers = document.querySelectorAll('.emoji-picker');
    existingPickers.forEach(picker => picker.remove());

    // Erstelle den Emoji-Picker
    const emojiPicker = document.createElement('div');
    emojiPicker.className = 'emoji-picker';

    // Füge gängige Emojis hinzu
    const commonEmojis = ['👍', '❤️', '😂', '🎉', '🔥', '👏', '😍', '🙏', '👌', '😊'];

    commonEmojis.forEach(emoji => {
        const emojiButton = document.createElement('button');
        emojiButton.className = 'emoji-button';
        emojiButton.textContent = emoji;

        emojiButton.addEventListener('click', function(e) {
            e.stopPropagation();
            // Hier würde die Reaktionsfunktion aufgerufen werden
            // window.NostrEvents.sendReaction(eventId, pubkey, emoji);
            emojiPicker.remove();
        });

        emojiPicker.appendChild(emojiButton);
    });

    // Positioniere den Picker relativ zum Ziel-Element
    const rect = targetElement.getBoundingClientRect();
    emojiPicker.style.position = 'absolute';
    emojiPicker.style.top = `${rect.bottom + window.scrollY}px`;
    emojiPicker.style.left = `${rect.left + window.scrollX}px`;

    // Füge den Picker zum Dokument hinzu
    document.body.appendChild(emojiPicker);

    // Schließe den Picker, wenn außerhalb geklickt wird
    document.addEventListener('click', function closeEmojiPicker(e) {
        if (!emojiPicker.contains(e.target) && e.target !== targetElement) {
            emojiPicker.remove();
            document.removeEventListener('click', closeEmojiPicker);
        }
    });

    return emojiPicker;
};

// Füge Reaktions-Buttons zu Nachrichten hinzu
window.NostrUI.addReactionButtons = function() {
    // Finde alle Nachrichten
    const messages = document.querySelectorAll('.chat-message:not(.system-message)');

    messages.forEach(message => {
        // Prüfe, ob bereits ein Reaktions-Button vorhanden ist
        if (message.querySelector('.reaction-button')) {
            return;
        }

        // Hole die Event-ID und den Pubkey
        const eventId = message.dataset.eventId;
        const pubkey = message.dataset.pubkey;

        // Erstelle den Reaktions-Button
        const reactionButton = document.createElement('button');
        reactionButton.className = 'reaction-button';
        reactionButton.innerHTML = '😀'; // Emoji als Button-Text
        reactionButton.title = 'Reaktion hinzufügen';

        // Füge den Event-Listener hinzu
        reactionButton.addEventListener('click', function(e) {
            e.stopPropagation();
            window.NostrUI.createEmojiPicker(this, eventId, pubkey);
        });

        // Füge den Button zur Nachricht hinzu
        const messageContent = message.querySelector('.message-content');
        if (messageContent) {
            messageContent.appendChild(reactionButton);
        }
    });
};

// Füge eine Reaktion zu einer Nachricht hinzu
window.NostrUI.addReactionToMessage = function(messageElement, reactionEvent) {
    // Hole den Reaktionsinhalt
    const content = reactionEvent.content;

    // Hole den Reaktions-Container
    const reactionsContainer = messageElement.querySelector('.message-reactions');
    if (!reactionsContainer) {
        console.error("Reactions container not found");
        return;
    }

    // Prüfe, ob bereits eine Reaktion mit diesem Inhalt vorhanden ist
    let reactionElement = reactionsContainer.querySelector(`.reaction[data-content="${content}"]`);

    if (reactionElement) {
        // Erhöhe den Zähler
        const countElement = reactionElement.querySelector('.reaction-count');
        if (countElement) {
            const count = parseInt(countElement.textContent) + 1;
            countElement.textContent = count;
        }

        // Füge den Pubkey zur Liste der Reaktionen hinzu
        const pubkeys = reactionElement.dataset.pubkeys ?
            new Set(reactionElement.dataset.pubkeys.split(',')) :
            new Set();

        pubkeys.add(reactionEvent.pubkey);
        reactionElement.dataset.pubkeys = Array.from(pubkeys).join(',');

        // Aktualisiere den Tooltip
        const displayName = window.NostrProfile.getDisplayName(reactionEvent);
        reactionElement.title = reactionElement.title ?
            `${reactionElement.title}, ${displayName}` :
            displayName;
    } else {
        // Erstelle ein neues Reaktions-Element
        reactionElement = document.createElement('div');
        reactionElement.className = 'reaction';
        reactionElement.dataset.content = content;
        reactionElement.dataset.pubkeys = reactionEvent.pubkey;

        // Setze den Tooltip mit Benutzerinfo
        const displayName = window.NostrProfile.getDisplayName(reactionEvent);
        reactionElement.title = `${displayName}`;

        // Füge den Emoji-Inhalt hinzu
        reactionElement.textContent = content;

        // Füge einen Zähler hinzu
        const countElement = document.createElement('span');
        countElement.className = 'reaction-count';
        countElement.textContent = '1';
        reactionElement.appendChild(countElement);

        // Füge die Reaktion zum Container hinzu
        reactionsContainer.appendChild(reactionElement);
    }
};

// Aktualisiere die Anzeige der Reaktionen
window.NostrUI.updateReactionsDisplay = function(messageElement) {
    // Hole den Reaktions-Container
    const reactionsContainer = messageElement.querySelector('.message-reactions');
    if (!reactionsContainer) {
        console.error("Reactions container not found");
        return;
    }

    // Hole alle Reaktionen
    const reactions = reactionsContainer.querySelectorAll('.reaction');

    reactions.forEach(reaction => {
        // Hole die Pubkeys
        const pubkeysString = reaction.dataset.pubkeys;
        if (!pubkeysString) return;

        const pubkeys = new Set(pubkeysString.split(','));
        const content = reaction.dataset.content;

        // Aktualisiere den Zähler
        const countElement = reaction.querySelector('.reaction-count');
        if (countElement) {
            countElement.textContent = pubkeys.size;
        }

        // Aktualisiere den Tooltip
        if (pubkeys.size > 1) {
            // Mehrere Reaktionen
            // Erstelle Tooltip mit allen Benutzernamen
            const usernames = Array.from(pubkeys).map(pubkey => {
                // Erstelle ein Fake-Event-Objekt mit dem Pubkey
                const fakeEvent = { pubkey: pubkey };
                return window.NostrProfile.getDisplayName(fakeEvent);
            }).join(', ');

            reaction.title = usernames || 'Unbekannte Benutzer';
        } else {
            // Einzelne Reaktion
            reaction.textContent = content;
            const pubkey = Array.from(pubkeys)[0];

            if (pubkey) {
                // Erstelle ein Fake-Event-Objekt mit dem Pubkey
                const fakeEvent = { pubkey: pubkey };
                reaction.title = window.NostrProfile.getDisplayName(fakeEvent);
            } else {
                reaction.title = 'Unbekannter Benutzer';
            }
        }
    });
};
