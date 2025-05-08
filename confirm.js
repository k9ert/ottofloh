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
                loading.style.display = 'none';
                successMessage.style.display = 'block';
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

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Fehler beim Abrufen der Daten');
            }

            const data = await response.json();

            // Überprüfen, ob ein Eintrag gefunden wurde
            if (data.records && data.records.length > 0) {
                return data.records[0];
            }

            return null;
        } catch (error) {
            console.error('Fehler beim Suchen des Eintrags:', error);
            throw error;
        }
    }

    // Aktualisiert den Status eines Eintrags auf "confirmed"
    async function updateRecordStatus(recordId) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${recordId}`;

        const data = {
            fields: {
                Status: 'confirmed',
                ConfirmationDate: formatDateForAirtable(new Date())
            }
        };

        return fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    }

    // Formatiert ein Datum für Airtable
    function formatDateForAirtable(date) {
        // Airtable akzeptiert Datumsangaben im Format YYYY-MM-DD
        return date.toISOString().split('T')[0];
    }

    // Zeigt eine Fehlermeldung an
    function showError(message) {
        loading.style.display = 'none';
        errorMessage.style.display = 'block';

        if (message) {
            errorDetails.textContent = message;
        }
    }
});
