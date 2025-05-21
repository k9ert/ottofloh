// nostr-chat.js - Hauptdatei für den Nostr-Chat
document.addEventListener('DOMContentLoaded', function() {
    // State variables
    let isInitialLoad = true;

    // DOM Elements
    const loginContainer = document.getElementById('nostr-login-container');
    const chatInterface = document.getElementById('nostr-chat-interface');
    const chatContainer = document.getElementById('chat-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('chat-send-button');
    const generateKeyButton = document.getElementById('generate-key-button');
    const loginExtensionButton = document.getElementById('login-extension-button');
    const loginNsecButton = document.getElementById('login-nsec-button');
    const nsecInputDialog = document.getElementById('nsec-input-dialog');
    const nsecInput = document.getElementById('nsec-input');
    const nsecSubmitButton = document.getElementById('nsec-submit-button');
    const nsecCancelButton = document.getElementById('nsec-cancel-button');

    // Initialize UI
    if (typeof initUI === 'function') {
        initUI();
    } else if (window.initUI && typeof window.initUI === 'function') {
        window.initUI();
    } else if (window.NostrUI && typeof window.NostrUI.initUI === 'function') {
        window.NostrUI.initUI();
    } else {
        console.error("initUI function not found");
    }

    // Debug: Check if DOM elements are found
    console.log("DOM Elements found:", {
        loginContainer: !!loginContainer,
        chatInterface: !!chatInterface,
        loginNsecButton: !!loginNsecButton,
        nsecInputDialog: !!nsecInputDialog,
        nsecInput: !!nsecInput,
        nsecSubmitButton: !!nsecSubmitButton,
        nsecCancelButton: !!nsecCancelButton
    });

    // Check if we have a saved key in localStorage
    function checkForSavedKey() {
        try {
            const success = window.NostrCore.checkForSavedKey(() => {
                window.NostrUI.showChatInterface();

                // Initialize connection with a slight delay to ensure libraries are fully loaded
                setTimeout(() => {
                    initNostrConnection();
                }, 500);
            });

            if (!success) {
                console.log("No valid saved key found");
            }
        } catch (error) {
            console.error("Error checking for saved key:", error);
        }
    }

    // Generate a new key pair
    generateKeyButton.addEventListener('click', () => {
        try {
            const success = window.NostrCore.generateKeyPair(() => {
                window.NostrUI.showChatInterface();
                initNostrConnection();
            });

            if (!success) {
                console.error("Failed to generate key pair");
                alert("Fehler beim Erstellen eines neuen Schlüssels. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
            }
        } catch (error) {
            console.error("Error generating key:", error);
            alert("Fehler beim Erstellen eines neuen Schlüssels. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        }
    });

    // Login with extension (NIP-07)
    loginExtensionButton.addEventListener('click', async () => {
        try {
            const success = await window.NostrCore.connectWithExtension(() => {
                window.NostrUI.showChatInterface();
                initNostrConnection();
            });

            if (!success) {
                console.log("Failed to connect with extension");
            }
        } catch (error) {
            console.error("Error connecting with extension:", error);
        }
    });

    // Setup nsec input dialog handlers
    function setupNsecHandlers() {
        console.log("Setting up nsec handlers");

        // Get DOM elements again to ensure they exist
        const loginNsecButton = document.getElementById('login-nsec-button');
        const nsecInputDialog = document.getElementById('nsec-input-dialog');
        const nsecInput = document.getElementById('nsec-input');
        const nsecSubmitButton = document.getElementById('nsec-submit-button');
        const nsecCancelButton = document.getElementById('nsec-cancel-button');

        // Debug: Check if DOM elements are found now
        console.log("NSEC DOM Elements found:", {
            loginNsecButton: !!loginNsecButton,
            nsecInputDialog: !!nsecInputDialog,
            nsecInput: !!nsecInput,
            nsecSubmitButton: !!nsecSubmitButton,
            nsecCancelButton: !!nsecCancelButton
        });

        if (!loginNsecButton || !nsecInputDialog || !nsecInput || !nsecSubmitButton || !nsecCancelButton) {
            console.error("Some nsec DOM elements not found, retrying in 500ms");
            setTimeout(setupNsecHandlers, 500);
            return;
        }

        // Show nsec input dialog
        loginNsecButton.addEventListener('click', () => {
            console.log("NSEC button clicked");
            nsecInputDialog.style.display = 'block';
            nsecInput.focus();
        });

        // Hide nsec input dialog
        nsecCancelButton.addEventListener('click', () => {
            nsecInputDialog.style.display = 'none';
            nsecInput.value = '';
        });

        // Process nsec key input
        nsecSubmitButton.addEventListener('click', () => {
            processNsecInput();
        });

        // Allow Enter key to submit nsec
        nsecInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                processNsecInput();
            }
        });

        console.log("NSEC handlers setup complete");
    }

    // Call the setup function
    setupNsecHandlers();

    // Process the nsec key input
    function processNsecInput() {
        // Get DOM elements again to ensure they exist
        const nsecInputDialog = document.getElementById('nsec-input-dialog');
        const nsecInput = document.getElementById('nsec-input');

        const nsecValue = nsecInput.value.trim();

        try {
            const success = window.NostrCore.processNsecKey(nsecValue, () => {
                // Hide the dialog and clear the input
                nsecInputDialog.style.display = 'none';
                nsecInput.value = '';

                // Show chat interface and initialize connection
                window.NostrUI.showChatInterface();
                initNostrConnection();
            });

            if (!success) {
                console.log("Failed to process nsec key");
            }
        } catch (error) {
            console.error("Error processing nsec key:", error);
            alert('Fehler beim Verarbeiten des nsec-Schlüssels. Bitte überprüfen Sie das Format und versuchen Sie es erneut.');
        }
    }

    // Initialize Nostr connection
    function initNostrConnection() {
        try {
            console.log("Initializing Nostr connection with SimplePool");

            // Initialize relay pool
            window.relayPool = window.NostrRelay.initRelayPool();
            console.log("Relay pool initialized:", window.relayPool);

            // Set a maximum loading time
            setTimeout(() => {
                if (isInitialLoad) {
                    console.log("Maximum loading time reached, hiding loading indicator");
                    isInitialLoad = false;
                    window.NostrUI.hideLoadingIndicator();
                }
            }, 5000); // 5 seconds maximum loading time

            // Subscribe to channel messages
            window.NostrRelay.subscribeToChannel(
                window.relayPool,
                window.relays,
                window.NostrCore.CHANNEL_ID,
                window.userPublicKey,
                isInitialLoad
            );

            // Add a welcome message after the initial load is complete
            let welcomeMessageAdded = false;
            const addWelcomeMessageWrapper = () => {
                // Check if initial load is complete
                if (isInitialLoad) {
                    // Still loading, check again in a bit
                    console.log("Still loading events, delaying welcome message");
                    setTimeout(addWelcomeMessageWrapper, 500);
                    return;
                }

                // Check if we've already added a welcome message
                if (welcomeMessageAdded) {
                    console.log("Welcome message already added, skipping");
                    return;
                }

                // Mark as added to prevent duplicates
                welcomeMessageAdded = true;

                // Add the welcome message
                window.NostrUI.addWelcomeMessage(window.userPublicKey, window.NostrCore.CHANNEL_ID, false);
            };

            // Start the welcome message process
            setTimeout(addWelcomeMessageWrapper, 1000);

        } catch (error) {
            console.error("Error initializing Nostr connection:", error);
            alert("Fehler beim Verbinden mit Nostr-Relays. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        }
    }

    // Send button click handler
    sendButton.addEventListener('click', () => {
        window.NostrEvents.sendMessage(
            chatInput.value,
            window.userPublicKey,
            window.userPrivateKey,
            window.NostrCore.CHANNEL_ID,
            window.relayPool,
            window.relays
        );
    });

    // Enter key to send
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            window.NostrEvents.sendMessage(
                chatInput.value,
                window.userPublicKey,
                window.userPrivateKey,
                window.NostrCore.CHANNEL_ID,
                window.relayPool,
                window.relays
            );
        }
    });

    // Set up the hidden reset identity feature
    const resetTrigger = document.getElementById('reset-identity-trigger');
    if (resetTrigger) {
        resetTrigger.style.cursor = 'pointer';
        resetTrigger.title = 'Identität zurücksetzen (versteckte Funktion)';

        // Add a subtle style to indicate it's clickable (only visible on hover)
        resetTrigger.addEventListener('mouseover', function() {
            this.style.textDecoration = 'underline';
            this.style.color = '#0056b3';
        });

        resetTrigger.addEventListener('mouseout', function() {
            this.style.textDecoration = 'none';
            this.style.color = '';
        });

        // Add click event to reset identity
        resetTrigger.addEventListener('click', function() {
            // Ask for confirmation
            if (confirm('Möchten Sie Ihre Nostr-Identität wirklich zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                window.NostrUI.resetIdentity();
            }
        });
    }

    // Initialize when the library is loaded
    window.addEventListener('load', function() {
        console.log("Page loaded, checking for Nostr library");

        // Function to check if Nostr is ready and initialize
        function initializeWhenReady() {
            if (window.isNostrReady && window.isNostrReady()) {
                console.log("Nostr library is ready, initializing chat");
                checkForSavedKey();
            } else {
                console.log("Nostr library not ready yet, waiting...");
                setTimeout(initializeWhenReady, 500);
            }
        }

        // Start checking
        initializeWhenReady();
    });
});
