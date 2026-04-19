document.addEventListener('DOMContentLoaded', function() {
    const loading = document.getElementById('loading');
    const successMessage = document.getElementById('success-message');
    const errorMessage = document.getElementById('error-message');
    const errorDetails = document.getElementById('error-details');

    // Worker API endpoint (no API key in frontend!)
    const API_URL = 'https://ottofloh-api.kneunert.workers.dev';

    // Token aus der URL extrahieren
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        showError('Kein Bestätigungstoken gefunden. Bitte überprüfen Sie den Link in Ihrer E-Mail.');
        return;
    }

    confirmRegistration(token);

    async function confirmRegistration(token) {
        try {
            const response = await fetch(`${API_URL}/confirm?token=${encodeURIComponent(token)}`);
            const result = await response.json();

            if (response.ok && result.ok) {
                showSuccess();
            } else {
                showError(result.error || 'Der Bestätigungslink ist ungültig oder wurde bereits verwendet.');
            }
        } catch (error) {
            console.error('Confirmation error:', error);
            showError('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.');
        }
    }

    function hideAllMessages() {
        loading.style.display = 'none';
        successMessage.style.display = 'none';
        errorMessage.style.display = 'none';
    }

    function showSuccess() {
        hideAllMessages();
        successMessage.style.display = 'block';
        successMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function showError(message) {
        hideAllMessages();
        errorMessage.style.display = 'block';
        if (message) errorDetails.textContent = message;
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});
