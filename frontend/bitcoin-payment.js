// bitcoin-payment.js - Skript für den Blink Pay Button

// Initialize widget when script is loaded
function initBlinkWidget() {
  if (typeof BlinkPayButton !== 'undefined') {
    BlinkPayButton.init({
      username: 'ottofloh',
      containerId: 'blink-pay-button-container',
      buttonText: 'Donate Bitcoin',
      themeMode: 'light',
      defaultAmount: 1000,
      debug: false
    });
  } else {
    // Try again in 100ms if BlinkPayButton isn't loaded yet
    setTimeout(initBlinkWidget, 100);
  }
}

// Initialize when DOM is ready or now if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlinkWidget);
} else {
  initBlinkWidget();
}
