// Fehler mit i18n-Code. Das Frontend übersetzt anhand des Codes (Schlüssel
// `e_<code>`), mit der deutschen message als Fallback. Rein additiv: bestehende
// Fehler ohne Code zeigen weiterhin ihre (deutsche) message.
export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}
