document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('garage-sale-form');
    const errorMessage = document.getElementById('error-message');
    const loading = document.getElementById('loading');
    const registrationForm = document.getElementById('registration-form');
    const successMessage = document.getElementById('success-message');

    // Überprüfen, ob alle erforderlichen Elemente vorhanden sind
    if (!form) {
        console.error('Formular-Element nicht gefunden!');
    }
    if (!errorMessage) {
        console.error('Fehlermeldungs-Element nicht gefunden!');
    }
    if (!loading) {
        console.error('Lade-Element nicht gefunden!');
    }
    if (!registrationForm) {
        console.error('Registrierungsformular-Element nicht gefunden!');
    }
    if (!successMessage) {
        console.error('Erfolgsmeldungs-Element nicht gefunden!');
    }

    // Airtable API Konfiguration
    const AIRTABLE_API_KEY = 'paty2y0DYoHVlsuGS.328721587bb2b92322515563b681a3a30b486254e99f177f765e421d0c06bbc5'; // Ersetzen Sie dies mit Ihrem Airtable API-Schlüssel
    const AIRTABLE_BASE_ID = 'appbtLFYW5FJqeDj2'; // Ersetzen Sie dies mit Ihrer Airtable Base ID
    const AIRTABLE_TABLE_NAME = 'Registrations'; // Der Name Ihrer Tabelle in Airtable

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        console.log('Formular wurde abgesendet');

        // Formularvalidierung
        if (!validateForm()) {
            console.log('Formularvalidierung fehlgeschlagen');
            return;
        }

        // Formular ausblenden und Ladeindikator anzeigen
        loading.style.display = 'block';
        errorMessage.style.display = 'none';

        try {
            console.log('Sammle Formulardaten...');

            // Formulardaten sammeln
            const formData = {
                name: document.getElementById('name').value,
                address: document.getElementById('address').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                notes: document.getElementById('notes').value || '',
                status: 'new', // Initialstatus
                confirmationToken: generateToken(), // Eindeutiger Token für die E-Mail-Bestätigung
                registrationDate: formatDateForAirtable(new Date())
            };

            console.log('Formulardaten:', formData);
            console.log('Sende Daten an Airtable...');

            // Daten an Airtable senden
            const response = await submitToAirtable(formData);

            console.log('Airtable-Antwort:', response);

            if (response.ok) {
                console.log('Anmeldung erfolgreich!');
                // Erfolgsanzeige - E-Mail wird automatisch durch Airtable-Automatisierung gesendet
                registrationForm.style.display = 'none';
                successMessage.style.display = 'block';

                // Formular zurücksetzen
                form.reset();
            } else {
                console.error('Airtable-Fehler:', await response.text().catch(() => 'Keine Fehlerdetails verfügbar'));
                throw new Error('Fehler beim Speichern der Daten');
            }
        } catch (error) {
            console.error('Fehler bei der Anmeldung:', error);
            errorMessage.textContent = 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt.';
            errorMessage.style.display = 'block';
        } finally {
            loading.style.display = 'none';
        }
    });

    // Formularvalidierung
    function validateForm() {
        const name = document.getElementById('name').value.trim();
        const address = document.getElementById('address').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const privacy = document.getElementById('privacy').checked;

        let isValid = true;
        let errorText = '';

        if (!name) {
            errorText += 'Bitte geben Sie Ihren Namen ein. ';
            isValid = false;
        }

        if (!address) {
            errorText += 'Bitte geben Sie Ihre Adresse ein. ';
            isValid = false;
        }

        if (!email) {
            errorText += 'Bitte geben Sie Ihre E-Mail-Adresse ein. ';
            isValid = false;
        } else if (!isValidEmail(email)) {
            errorText += 'Bitte geben Sie eine gültige E-Mail-Adresse ein. ';
            isValid = false;
        }

        if (!phone) {
            errorText += 'Bitte geben Sie Ihre Telefonnummer ein. ';
            isValid = false;
        }

        if (!privacy) {
            errorText += 'Bitte stimmen Sie der Datenschutzerklärung zu. ';
            isValid = false;
        }

        if (!isValid) {
            errorMessage.textContent = errorText;
            errorMessage.style.display = 'block';
        } else {
            errorMessage.style.display = 'none';
        }

        return isValid;
    }

    // E-Mail-Validierung
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Generiert einen zufälligen Token für die E-Mail-Bestätigung
    function generateToken() {
        return Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }

    // Formatiert ein Datum für Airtable
    function formatDateForAirtable(date) {
        // Airtable akzeptiert Datumsangaben im Format YYYY-MM-DD
        return date.toISOString().split('T')[0];
    }

    // Sendet Daten an Airtable
    async function submitToAirtable(formData) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

        const data = {
            fields: {
                Name: formData.name,
                Address: formData.address,
                Email: formData.email,
                Phone: formData.phone,
                Notes: formData.notes,
                Status: formData.status,
                ConfirmationToken: formData.confirmationToken,
                RegistrationDate: formData.registrationDate
            }
        };

        try {
            return fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data),
                mode: 'cors' // Explizit CORS-Modus aktivieren
            });
        } catch (error) {
            console.error('Fehler beim Senden der Daten an Airtable:', error);

            // Für Entwicklungszwecke: Wenn die API nicht erreichbar ist, simulieren wir eine erfolgreiche Antwort
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('Entwicklungsmodus: Simuliere erfolgreiche Antwort');
                return { ok: true };
            }

            throw error;
        }
    }

    // Hinweis: Der E-Mail-Versand erfolgt automatisch durch Airtable-Automatisierung
});
