// nostr-ui-core.js - Grundlegende UI-Funktionen für den Nostr-Chat

// Initialisiere das NostrUI-Objekt, falls es noch nicht existiert
window.NostrUI = window.NostrUI || {};

// Initialisiere die UI
window.NostrUI.initUI = function() {
    console.log("Initializing UI");

    // Verstecke den Chat-Interface zunächst
    const chatInterface = document.getElementById('nostr-chat-interface');
    if (chatInterface) {
        chatInterface.style.display = 'none';
    }

    // Zeige den Login-Container
    const loginContainer = document.getElementById('nostr-login-container');
    if (loginContainer) {
        loginContainer.style.display = 'block';
    }

    // Verstecke den Ladeindikator
    window.NostrUI.hideLoadingIndicator();
};

// Zeige das Chat-Interface an
window.NostrUI.showChatInterface = function() {
    console.log("Showing chat interface");

    // Verstecke den Login-Container
    const loginContainer = document.getElementById('nostr-login-container');
    if (loginContainer) {
        loginContainer.style.display = 'none';
    }

    // Zeige das Chat-Interface
    const chatInterface = document.getElementById('nostr-chat-interface');
    if (chatInterface) {
        chatInterface.style.display = 'block';
    }

    // Zeige den Ladeindikator
    window.NostrUI.showLoadingIndicator();
};

// Zeige den Ladeindikator an
window.NostrUI.showLoadingIndicator = function() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
};

// Verstecke den Ladeindikator
window.NostrUI.hideLoadingIndicator = function() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
};

// Füge eine Willkommensnachricht hinzu
window.NostrUI.addWelcomeMessage = function(userPublicKey, channelId, isFirstTime) {
    console.log("Adding welcome message");

    // Erstelle ein Willkommens-Event
    const welcomeEvent = {
        id: 'welcome-' + Date.now(),
        pubkey: 'system',
        created_at: Math.floor(Date.now() / 1000),
        content: isFirstTime
            ? 'Willkommen im Ottobrunner Hofflohmarkt Chat! Sie können jetzt Nachrichten senden und empfangen.'
            : 'Willkommen zurück im Ottobrunner Hofflohmarkt Chat!',
        tags: [['e', channelId, '', 'root']],
        kind: 42,
        isSystemMessage: true
    };

    // Zeige die Willkommensnachricht an
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        const messageElement = window.NostrUI.createMessageElement(welcomeEvent, userPublicKey);
        chatContainer.appendChild(messageElement);

        // Scrolle nach unten
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
};

// Setze die Identität zurück
window.NostrUI.resetIdentity = function() {
    // Rufe die Core-Funktion auf, um die Identität zurückzusetzen
    window.NostrCore.resetIdentity();

    // Aktualisiere die UI
    const loginContainer = document.getElementById('nostr-login-container');
    const chatInterface = document.getElementById('nostr-chat-interface');
    const resetIdentityTrigger = document.getElementById('reset-identity-trigger');

    // Zeige den Login-Container und verstecke das Chat-Interface
    if (loginContainer && chatInterface) {
        loginContainer.style.display = 'block';
        chatInterface.style.display = 'none';
    }

    // Setze die Benutzernamensanzeige auf Standard zurück
    if (resetIdentityTrigger) {
        resetIdentityTrigger.textContent = '------';
    }

    // Benachrichtige den Benutzer
    alert("Ihre Nostr-Identität wurde zurückgesetzt. Sie können nun einen neuen Schlüssel erstellen.");
};

// Erstelle ein Nachrichtenelement
window.NostrUI.createMessageElement = function(event, currentUserPubkey) {
    // Erstelle das Nachrichtenelement
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.dataset.eventId = event.id;
    messageElement.dataset.pubkey = event.pubkey;
    messageElement.dataset.createdAt = event.created_at;

    // Bestimme, ob dies eine Systemnachricht ist
    const isSystemMessage = event.isSystemMessage || event.pubkey === 'system';

    // Bestimme, ob dies eine Nachricht vom aktuellen Benutzer ist
    const isCurrentUser = event.pubkey === currentUserPubkey;

    // Füge zusätzliche Klassen hinzu
    if (isSystemMessage) {
        messageElement.classList.add('system-message');
    } else if (isCurrentUser) {
        messageElement.classList.add('self');
    } else {
        messageElement.classList.add('others');
    }

    // Erstelle einen Container für die Nachricht mit Avatar und Inhalt
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';

    // Erstelle einen Container für den Avatar
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'avatar-container';

    // Erstelle einen Platzhalter für den Avatar
    // (Das tatsächliche Bild wird später in loadProfileInfo hinzugefügt)
    const avatarPlaceholder = document.createElement('div');
    avatarPlaceholder.className = 'avatar';

    // Füge den Avatar-Platzhalter zum Avatar-Container hinzu
    avatarContainer.appendChild(avatarPlaceholder);

    // Erstelle einen Container für den Inhalt
    const contentContainer = document.createElement('div');
    contentContainer.className = 'content-container';

    // Erstelle den Nachrichteninhalt
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    // Füge den Nachrichtentext hinzu
    const messageText = document.createElement('div');
    messageText.className = 'message-text';

    // Verarbeite den Inhalt
    if (isSystemMessage) {
        // Für Systemnachrichten, zeige einfach den Text an
        messageText.textContent = event.content;
    } else {
        // Für reguläre Nachrichten, verarbeite den Inhalt
        messageText.innerHTML = window.NostrUI.processMessageContent(event.content);
    }

    messageContent.appendChild(messageText);

    // Erstelle den Nachrichtenkopf mit Benutzername und Zeitstempel
    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';

    // Füge den Benutzernamen hinzu
    const username = document.createElement('span');
    username.className = 'username';

    if (isSystemMessage) {
        username.textContent = 'System';
    } else {
        // Verwende die getDisplayName-Funktion, um den Anzeigenamen zu erhalten
        username.textContent = window.NostrProfile.getDisplayName(event);
    }

    messageHeader.appendChild(username);

    // Füge den Zeitstempel hinzu
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date(event.created_at * 1000).toLocaleTimeString();
    messageHeader.appendChild(timestamp);

    // Füge den Nachrichtenkopf zum Inhalts-Container hinzu
    contentContainer.appendChild(messageHeader);

    // Füge den Nachrichteninhalt zum Inhalts-Container hinzu
    contentContainer.appendChild(messageContent);

    // Erstelle einen Container für Reaktionen
    const reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    contentContainer.appendChild(reactionsContainer);

    // Füge den Avatar-Container und den Inhalts-Container zum Nachrichten-Container hinzu
    if (isCurrentUser) {
        // Für eigene Nachrichten: Inhalt links, Avatar rechts
        messageContainer.appendChild(contentContainer);
        messageContainer.appendChild(avatarContainer);
    } else {
        // Für andere Nachrichten: Avatar links, Inhalt rechts
        messageContainer.appendChild(avatarContainer);
        messageContainer.appendChild(contentContainer);
    }

    // Füge den Nachrichten-Container zum Nachrichtenelement hinzu
    messageElement.appendChild(messageContainer);

    return messageElement;
};

// Verarbeite den Nachrichteninhalt
window.NostrUI.processMessageContent = function(content) {
    if (!content) return '';

    // Ersetze Zeilenumbrüche durch <br>
    let processedContent = content.replace(/\n/g, '<br>');

    // Ersetze URLs durch klickbare Links
    processedContent = processedContent.replace(
        /(https?:\/\/[^\s]+)/g,
        function(url) {
            // Prüfe, ob es sich um ein Bild handelt
            if (window.NostrUI.isImageUrl(url)) {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a><br><img src="${url}" alt="Bild" class="message-image">`;
            } else {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            }
        }
    );

    return processedContent;
};

// Prüfe, ob eine URL ein Bild ist
window.NostrUI.isImageUrl = function(url) {
    try {
        // Prüfe zuerst, ob der String wie eine URL aussieht
        if (!url || typeof url !== 'string') {
            return false;
        }

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return false;
        }

        // Prüfe, ob die URL Leerzeichen enthält (ungültige URL)
        if (url.includes(' ')) {
            return false;
        }

        // Prüfe auf weitere ungültige Zeichen oder Muster
        if (url.includes('..') || url.includes('\\')) {
            return false;
        }

        // Prüfe, ob die URL ein gültiges Format hat
        const urlRegex = /^(https?:\/\/)([\da-z.-]+)\.([a-z.]{2,6})([/\w.-]*)*\/?$/i;
        if (!urlRegex.test(url)) {
            return false;
        }

        // Versuche, ein URL-Objekt zu erstellen
        try {
            const urlObj = new URL(url);

            // Prüfe die Dateiendung
            const pathname = urlObj.pathname.toLowerCase();
            return pathname.endsWith('.jpg') ||
                   pathname.endsWith('.jpeg') ||
                   pathname.endsWith('.png') ||
                   pathname.endsWith('.gif') ||
                   pathname.endsWith('.webp');
        } catch (urlError) {
            // Wenn die URL nicht geparst werden kann, ist es keine gültige URL
            return false;
        }
    } catch (error) {
        // Allgemeine Fehlerbehandlung
        console.log("Error checking if URL is an image:", error);
        return false;
    }
};
