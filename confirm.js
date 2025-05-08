document.addEventListener('DOMContentLoaded', function() {
    const loading = document.getElementById('loading');
    const successMessage = document.getElementById('success-message');
    const errorMessage = document.getElementById('error-message');
    const errorDetails = document.getElementById('error-details');

    // Airtable API Konfiguration
    const AIRTABLE_API_KEY = 'paty2y0DYoHVlsuGS.328721587bb2b92322515563b681a3a30b486254e99f177f765e421d0c06bbc5'; // Ersetzen Sie dies mit Ihrem Airtable API-Schlüssel
    const AIRTABLE_BASE_ID = 'appbtLFYW5FJqeDj2'; // Ersetzen Sie dies mit Ihrer Airtable Base ID
    const AIRTABLE_TABLE_NAME = 'Registrations'; // Der Name Ihrer Tabelle in Airtable

    // Token aus der URL extrahieren
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        showError('Kein Bestätigungstoken gefunden. Bitte überprüfen Sie den Link in Ihrer E-Mail.');
        return;
    }

    // Anmeldung bestätigen
    console.log('Starte Bestätigungsprozess mit Token:', token);
    confirmRegistration(token);

    // Funktion zur Bestätigung der Anmeldung
    async function confirmRegistration(token) {
        try {
            // Suche nach dem Eintrag mit dem entsprechenden Token
            const record = await findRecordByToken(token);

            if (!record) {
                showError('Der Bestätigungslink ist ungültig oder wurde bereits verwendet.');
                return;
            }

            // Status auf "confirmed" aktualisieren
            const updateResult = await updateRecordStatus(record.id);

            if (updateResult.ok) {
                // Erfolgsanzeige
                showSuccess();
            } else {
                throw new Error('Fehler beim Aktualisieren des Status');
            }
        } catch (error) {
            console.error('Fehler bei der Bestätigung:', error);
            showError('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt.');
        }
    }

    // Sucht nach einem Eintrag mit dem angegebenen Token
    async function findRecordByToken(token) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?filterByFormula={ConfirmationToken}="${token}"`;
        console.log('Suche nach Eintrag mit Token:', token);

        try {
            console.log('Sende Anfrage an Airtable API:', url);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors' // Explizit CORS-Modus aktivieren
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Keine Fehlerdetails verfügbar');
                console.error('API-Fehler:', response.status, errorText);
                throw new Error(`Fehler beim Abrufen der Daten: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Airtable-Antwort erhalten:', data);

            // Überprüfen, ob ein Eintrag gefunden wurde
            if (data.records && data.records.length > 0) {
                console.log('Eintrag gefunden:', data.records[0].id);
                return data.records[0];
            }

            console.log('Kein Eintrag mit diesem Token gefunden');
            return null;
        } catch (error) {
            console.error('Fehler beim Suchen des Eintrags:', error);
            throw error;
        }
    }

    // Aktualisiert den Status eines Eintrags auf "confirmed"
    async function updateRecordStatus(recordId) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${recordId}`;
        console.log('Aktualisiere Status für Eintrag:', recordId);

        const data = {
            fields: {
                Status: 'confirmed',
                ConfirmationDate: formatDateForAirtable(new Date())
            }
        };

        console.log('Sende Update-Anfrage an Airtable:', data);

        try {
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data),
                mode: 'cors' // Explizit CORS-Modus aktivieren
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Keine Fehlerdetails verfügbar');
                console.error('Update-Fehler:', response.status, errorText);
            } else {
                console.log('Status erfolgreich aktualisiert');
            }

            return response;
        } catch (error) {
            console.error('Fehler beim Aktualisieren des Status:', error);
            throw error;
        }
    }

    // Formatiert ein Datum für Airtable
    function formatDateForAirtable(date) {
        // Airtable akzeptiert Datumsangaben im Format YYYY-MM-DD
        return date.toISOString().split('T')[0];
    }

    // Blendet alle Meldungen aus
    function hideAllMessages() {
        console.log('Blende alle Meldungen aus');
        loading.style.display = 'none';
        successMessage.style.display = 'none';
        errorMessage.style.display = 'none';
    }

    // Zeigt eine Erfolgsmeldung an
    function showSuccess() {
        console.log('Zeige Erfolgsmeldung an');
        // Alle Meldungen ausblenden
        hideAllMessages();

        // Nur die Erfolgsmeldung anzeigen
        successMessage.style.display = 'block';

        // Scroll zur Meldung
        successMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Zeigt eine Fehlermeldung an
    function showError(message) {
        console.log('Zeige Fehlermeldung an:', message);
        // Alle Meldungen ausblenden
        hideAllMessages();

        // Nur die Fehlermeldung anzeigen
        errorMessage.style.display = 'block';

        if (message) {
            errorDetails.textContent = message;
        }

        // Scroll zur Meldung
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});
