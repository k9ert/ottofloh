// nostr-chat.js - Hauptdatei für den Nostr-Chat
document.addEventListener('DOMContentLoaded', function() {
    // Import modules
    const { hexToBytes } = window.NostrUtils;
    const { generateKeyPair, getPublicKey } = window.NostrCrypto;
    const { initUI, showChatInterface, hideLoadingIndicator, addWelcomeMessage, resetIdentity } = window.NostrUI;
    const { sendMessage } = window.NostrConnection;

    // Relays to connect to - using multiple relays to increase the chances of finding profile information
    const relays = [
        'wss://relay.damus.io',
        'wss://relay.nostr.band',
        'wss://nos.lol',
        'wss://relay.snort.social'
    ];

    // Chat channel identifier (using a specific tag for this event)
    const CHANNEL_ID = 'ottobrunner-hofflohmarkt-2025';

    // State variables
    window.userPrivateKey = null;
    window.userPublicKey = null;
    window.relayPool = null;
    window.relays = relays; // Make relays globally available
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
    initUI();

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
            const savedKey = localStorage.getItem('nostr_private_key');
            if (savedKey) {
                console.log("Found saved key in localStorage");

                // Validate the key format
                if (!/^[0-9a-f]{64}$/i.test(savedKey)) {
                    console.error("Invalid key format in localStorage");
                    localStorage.removeItem('nostr_private_key');
                    return;
                }

                window.userPrivateKey = savedKey;

                // Try different ways to get public key based on available API
                try {
                    window.userPublicKey = getPublicKey(hexToBytes(savedKey));
                    console.log("Loaded key pair:", { publicKey: window.userPublicKey });

                    // Validate the public key
                    if (!/^[0-9a-f]{64}$/i.test(window.userPublicKey)) {
                        console.error("Invalid public key format:", window.userPublicKey);
                        throw new Error("Invalid public key format");
                    }

                    // We'll get the handle from profile events later
                    console.log("User handle will be set from profile events");

                    showChatInterface();

                    // Initialize connection with a slight delay to ensure libraries are fully loaded
                    setTimeout(() => {
                        initNostrConnection();
                    }, 500);
                } catch (keyError) {
                    console.error("Error deriving public key:", keyError);
                    alert("Fehler beim Laden des gespeicherten Schlüssels. Ein neuer Schlüssel wird benötigt.");
                    localStorage.removeItem('nostr_private_key');
                }
            }
        } catch (error) {
            console.error("Error checking for saved key:", error);
        }
    }

    // Generate a new key pair
    generateKeyButton.addEventListener('click', () => {
        try {
            const { privateKey, secretKey } = generateKeyPair();
            window.userPrivateKey = privateKey;
            window.userPublicKey = getPublicKey(secretKey);

            console.log("Generated key pair:", { privateKey: window.userPrivateKey, publicKey: window.userPublicKey });

            // Save to localStorage
            localStorage.setItem('nostr_private_key', window.userPrivateKey);

            showChatInterface();
            initNostrConnection();
        } catch (error) {
            console.error("Error generating key:", error);
            alert("Fehler beim Erstellen eines neuen Schlüssels. Bitte laden Sie die Seite neu und versuchen Sie es erneut.");
        }
    });

    // Login with extension (NIP-07)
    loginExtensionButton.addEventListener('click', async () => {
        if (window.nostr) {
            try {
                // Try to get the public key from the extension
                window.userPublicKey = await window.nostr.getPublicKey();

                // Check if we got a valid public key
                if (!window.userPublicKey) {
                    throw new Error("No public key returned from extension");
                }

                console.log("Successfully connected to Nostr extension, public key:", window.userPublicKey);
                showChatInterface();
                initNostrConnection();
            } catch (error) {
                console.error('Error connecting to Nostr extension:', error);

                // Check for specific error messages
                const errorMessage = error?.message || String(error);

                if (errorMessage.includes("no private key found") ||
                    errorMessage.includes("No key") ||
                    errorMessage.includes("not found")) {
                    // This is a common error when the extension is installed but no key is configured
                    alert('Die Nostr-Erweiterung ist installiert, aber es wurde kein Schlüssel gefunden. ' +
                          'Bitte konfigurieren Sie zuerst einen Schlüssel in Ihrer Erweiterung oder ' +
                          'erstellen Sie einen neuen Schlüssel für diesen Chat.');
                } else if (errorMessage.includes("user rejected")) {
                    // User rejected the request
                    alert('Sie haben die Verbindung abgelehnt. Bitte erlauben Sie den Zugriff, ' +
                          'wenn Sie die Erweiterung verwenden möchten, oder erstellen Sie einen neuen Schlüssel.');
                } else {
                    // Generic error
                    alert('Fehler beim Verbinden mit der Nostr-Erweiterung. Bitte versuchen Sie es erneut oder erstellen Sie einen neuen Schlüssel.');
                }
            }
        } else {
            alert('Keine Nostr-Erweiterung gefunden. Bitte installieren Sie eine Nostr-Erweiterung (wie nos2x oder Alby) oder erstellen Sie einen neuen Schlüssel.');
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

        if (!nsecValue) {
            alert('Bitte geben Sie einen nsec-Schlüssel ein.');
            return;
        }

        try {
            // Handle both nsec and hex formats
            let privateKeyHex;

            if (nsecValue.startsWith('nsec1')) {
                // Convert from bech32 to hex
                try {
                    // Use NostrTools bech32 conversion if available
                    if (window.NostrTools && window.NostrTools.nip19) {
                        const decoded = window.NostrTools.nip19.decode(nsecValue);
                        console.log("Decoded nsec:", decoded);

                        // Check the type of decoded.data
                        if (typeof decoded.data === 'string') {
                            privateKeyHex = decoded.data;
                        } else if (decoded.data instanceof Uint8Array) {
                            // Convert Uint8Array to hex string
                            privateKeyHex = window.NostrUtils.bytesToHex(decoded.data);
                        } else {
                            // Try to handle other formats
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
                    return;
                }
            } else if (/^[0-9a-f]{64}$/i.test(nsecValue)) {
                // Already in hex format
                privateKeyHex = nsecValue;
            } else {
                alert('Ungültiges Schlüsselformat. Bitte geben Sie einen gültigen nsec-Schlüssel ein.');
                return;
            }

            // Derive public key from private key
            window.userPrivateKey = privateKeyHex;
            window.userPublicKey = getPublicKey(hexToBytes(privateKeyHex));

            console.log("Loaded key from nsec input:", { publicKey: window.userPublicKey });

            // Save to localStorage
            localStorage.setItem('nostr_private_key', window.userPrivateKey);

            // Hide the dialog and clear the input
            nsecInputDialog.style.display = 'none';
            nsecInput.value = '';

            // Show chat interface and initialize connection
            showChatInterface();
            initNostrConnection();

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
            window.relayPool = window.NostrConnection.initRelayPool();
            console.log("Relay pool initialized:", window.relayPool);

            // Set a maximum loading time
            setTimeout(() => {
                if (isInitialLoad) {
                    console.log("Maximum loading time reached, hiding loading indicator");
                    isInitialLoad = false;
                    hideLoadingIndicator();
                }
            }, 5000); // 5 seconds maximum loading time

            // Subscribe to channel messages
            window.NostrConnection.subscribeToChannel(window.relayPool, window.relays, CHANNEL_ID, window.userPublicKey, isInitialLoad);

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
                addWelcomeMessage(window.userPublicKey, CHANNEL_ID, false);
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
        sendMessage(chatInput.value, window.userPublicKey, window.userPrivateKey, CHANNEL_ID, window.relayPool, window.relays);
    });

    // Enter key to send
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(chatInput.value, window.userPublicKey, window.userPrivateKey, CHANNEL_ID, window.relayPool, window.relays);
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
                resetIdentity();
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
