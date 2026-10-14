// Feste Schlüssel für Web-Push erzeugen (einmalig) und in Render eintragen:
//   npm run vapid-schluessel
// Danach APOPULSE_VAPID_PUBLIC_KEY und APOPULSE_VAPID_PRIVATE_KEY in
// Render → Environment setzen. Den privaten Schlüssel wie ein Passwort behandeln.
// Ohne feste Schlüssel erzeugt der Server selbst welche und sichert sie mit dem
// Datenstand — gehen die Daten verloren, müssen alle Geräte neu einschalten.
import { vapidSchluesselErzeugen } from '../src/services/webPush.js';

const k = vapidSchluesselErzeugen();
console.log(`APOPULSE_VAPID_PUBLIC_KEY=${k.publicKey}`);
console.log(`APOPULSE_VAPID_PRIVATE_KEY=${k.privateKey}`);
