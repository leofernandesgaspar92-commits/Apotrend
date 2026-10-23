// Platzhalter-Adressen: Konten ohne echte E-Mail (Anmeldung per Telefonnummer
// „tel_<Ziffern>@telefon.local", per Anbieter ohne E-Mail „<anbieter>_<id>@oauth.local").
// An sie geht nie eine Mail, und angezeigt wird statt ihrer die Nummer bzw. nichts.
export const istPlatzhalterAdresse = (email) => /@(telefon|oauth)\.local$/i.test(String(email || '').trim());
