// DSGVO-Löschung über den GANZEN Server: Ein Konto erzeugt Daten in möglichst vielen Bereichen,
// löscht sich — danach darf seine ID nirgends mehr in der Sicherung stehen.
// Fund 11/2026: Proforma-Anfragen (mit Freitext-Notiz), Fachgebiets-Abos, Frühwarnungs-Schalter,
// Wochenbericht-Einstellung, Werbe-Firmenangaben und Widersprüche (mit Freitext-Grund) blieben
// liegen, obwohl die Löschung „ok" meldete. Dieser Test findet auch jeden KÜNFTIGEN Speicher,
// der in /api/me/delete vergessen wird — er durchsucht die ganze Sicherung, nicht eine Liste.
//
// Bewusst erlaubt (Aufbewahrungspflicht / Geschäftsunterlagen): ausgestellte Rechnungen und
// gebuchte Werbekampagnen (siehe rechnungen.nutzerEntfernen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ERLAUBT = [/^rechnungen\.rechnungen\./, /^anzeigen\.kampagnen\./];

/** Alle Pfade in einem Objekt, an denen `nadel` vorkommt (als Wert oder Schlüssel-Bestandteil). */
function fundstellen(wert, nadel, pfad = '', out = []) {
  if (typeof wert === 'string') { if (wert.includes(nadel)) out.push(pfad); return out; }
  if (Array.isArray(wert)) { wert.forEach((x, i) => fundstellen(x, nadel, `${pfad}.${i}`, out)); return out; }
  if (wert && typeof wert === 'object') for (const [k, v] of Object.entries(wert)) { if (k.includes(nadel)) out.push(`${pfad}.${k}`); fundstellen(v, nadel, `${pfad}.${k}`, out); }
  return out;
}

test('Konto löschen: keine Spur der Konto-ID mehr in der Sicherung (außer Rechnungen/Kampagnen)', { timeout: 90000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'apo-del-'));
  const datei = join(dir, 'stand.json');
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'del-1', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1', APOPULSE_RXNORM: 'off', DATABASE_URL: '', APOPULSE_DATA_FILE: datei,
    APOPULSE_ADMIN_EMAIL: 'red@del.test', APOPULSE_ADMIN_PASSWORD: 'del-redaktion-PW-1' };
  const kind = spawn(process.execPath, [join(ROOT, 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const l = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', l); kind.stderr.on('data', l);
    });
    const B = `http://localhost:${port}`;
    const j = async (m, p, tok, body) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json().catch(() => ({}))]; };
    const reg = async (n, art) => (await j('POST', '/api/register', null, { name: n, email: `${n}@del.test`, password: 'Passwort-1234', country: 'KE', locale: 'en', accountType: art }))[1].token;
    const x = await reg('xgross', 'wholesale'), y = await reg('yapo', 'pharmacy');
    const xid = (await j('GET', '/api/me', x))[1].user.id;
    assert.ok(xid && xid.length >= 8, 'Konto-ID nicht ermittelt');
    // Verifiziert (Logistik-Meldungen sind verifizierten Betrieben vorbehalten).
    const red = (await j('POST', '/api/login', null, { email: 'red@del.test', password: 'del-redaktion-PW-1' }))[1].token;
    assert.equal((await j('POST', '/api/verify/request', x, { note: 'Großhandel Nairobi', licenseNumber: 'PPB-W-123' }))[0], 200);
    assert.equal((await j('POST', `/api/verify/${xid}/resolve`, red, { approve: true }))[0], 200);
    const [, yp] = await j('POST', '/api/posts', y, { body: 'Oxytocin bei euch lieferbar?', visibility: 'public' });
    const ypid = yp.id || (yp.post && yp.post.id);

    // Daten in möglichst vielen Bereichen
    const [, m] = await j('POST', '/api/shortages/report', y, { wirkstoff: 'Oxytocin', status: 'kritisch', country: 'KE' });
    const sid = m.id || (m.shortage && m.shortage.id);
    assert.ok(sid, 'Meldung nicht angelegt: ' + JSON.stringify(m));
    const schritte = [
      ['POST', `/api/shortages/${sid}/widerspruch`, { grund: 'bei_uns_lieferbar', text: 'Bei uns in Nairobi lieferbar' }],
      ['POST', '/api/sourcing/anfrage', { produkt: 'Amoxicillin 500 mg', menge: '1000', herkunft: 'IN', ziel: 'KE', notiz: 'Bitte an Lager Mombasa' }],
      ['POST', '/api/medint/abo', { bereiche: ['onkologie'] }],
      ['POST', '/api/ausbruch/alarm', { an: false }],
      ['POST', '/api/wochenbericht/einstellung', { an: false }],
      ['POST', '/api/werbung/firma', { firma: 'X Gross Ltd', strasse: 'Moi Ave 1', ort: 'Nairobi', land: 'KE', email: 'x@del.test' }],
      ['POST', '/api/watchlist', { wirkstoff: 'Metformin' }],
      ['POST', '/api/push/abo', { abo: { endpoint: 'https://fcm.googleapis.com/fcm/send/del1', keys: { p256dh: (() => { const e = crypto.createECDH('prime256v1'); e.generateKeys(); return e.getPublicKey().toString('base64url'); })(), auth: crypto.randomBytes(16).toString('base64url') } } }],
      ['POST', '/api/rechnungen/angaben', { firma: 'X Gross', strasse: 'Kenyatta Ave 9', plz: '00100', ort: 'Nairobi', land: 'KE', email: 'x@del.test' }],
      ['POST', '/api/payments/crypto/start', { productId: 'premium_monthly', walletId: 'sol_phantom' }],
      ['POST', '/api/werbung/kampagnen', { titel: 'Kühlkette Nairobi', text: 'Temperaturgeführte Lagerung für Apotheken.', link: 'https://example.com', platz: 'start', laender: ['KE'], zielgruppen: ['pharmacy'], wochen: 1, start: new Date().toISOString().slice(0, 10) }],
      ['GET', '/api/einladung', null],
      // Fund 11/2026: eigene Meldungen von Inhalten (mit Begründung) und Logistik-Meldungen fehlten in der Auskunft.
      ['POST', '/api/posts', { body: 'Eigener Beitrag aus Nairobi', visibility: 'public' }],
      ['POST', `/api/posts/${ypid}/comments`, { body: 'Bei uns auch knapp' }],
      ['POST', `/api/posts/${ypid}/report`, { reason: 'Werbung für ein nicht zugelassenes Präparat' }],
      ['POST', '/api/logistik', { art: 'transport', titel: 'Grenzstau Malaba', beschreibung: 'Wartezeit 2 Tage', region: 'Malaba' }],
    ];
    for (const [meth, pfad, body] of schritte) { const [st, r] = await j(meth, pfad, x, body); assert.ok(st < 300, `${pfad}: ${st} ${JSON.stringify(r)}`); }

    // Auskunft (DSGVO Art. 15/20): der Export enthält diese Daten VOR dem Löschen.
    const [se, ex] = await j('GET', '/api/me/export', x);
    assert.equal(se, 200, JSON.stringify(ex));
    assert.deepEqual(ex.watchlist.map((w) => w.wirkstoff), ['Metformin']);
    assert.deepEqual(ex.shortage_disputes.map((w) => [w.grund, w.text]), [['bei_uns_lieferbar', 'Bei uns in Nairobi lieferbar']]);
    assert.deepEqual(ex.sourcing_requests.map((a) => [a.produkt, a.notiz, a.userId]), [['Amoxicillin 500 mg', 'Bitte an Lager Mombasa', undefined]]);
    assert.deepEqual([ex.medint_subscriptions, ex.outbreak_alerts_on, ex.weekly_report_unsubscribed, ex.advertiser_company && ex.advertiser_company.strasse], [['onkologie'], false, true, 'Moi Ave 1']);
    // Fund 11/2026: Zahlungen, Rechnungsangaben, Anzeigen, Handys, Einladungscode, Benachrichtigungen und die
    // Konto-Grunddaten (E-Mail) standen gespeichert, aber NICHT in der Auskunft.
    assert.equal(ex.account.email, 'xgross@del.test');
    assert.ok(!('password_hash' in ex.account) && !('twofa_secret' in ex.account), 'Geheimnisse in der Auskunft');
    assert.deepEqual(ex.payments.map((z) => [z.product_id, z.method]), [['premium_monthly', 'crypto_direct']]);
    assert.equal(ex.invoice_details && ex.invoice_details.strasse, 'Kenyatta Ave 9');
    assert.deepEqual(ex.ad_campaigns.map((k) => k.titel), ['Kühlkette Nairobi']);
    assert.deepEqual(ex.push_devices.map((g) => g.dienst), ['fcm.googleapis.com']);
    assert.ok(!JSON.stringify(ex.push_devices).includes('p256dh'), 'Geräteschlüssel in der Auskunft');
    assert.match(ex.invitation.code, /^[\w-]{6,}$/);
    assert.ok(Array.isArray(ex.notifications));
    assert.deepEqual(ex.content_reports.map((r) => [r.target_type, r.reason]), [['post', 'Werbung für ein nicht zugelassenes Präparat']]);
    assert.deepEqual(ex.logistics_reports.map((r) => [r.titel, r.region]), [['Grenzstau Malaba', 'Malaba']]);
    // Wächter: Jeder Speicher, in dem die Konto-ID steht, hat einen Abschnitt in der Auskunft.
    await new Promise((ok) => setTimeout(ok, 700));
    const vorher = JSON.parse(readFileSync(datei, 'utf8'));
    const speicher = [...new Set(fundstellen(vorher, xid).map((p) => p.replace(/^\./, '').split('.').slice(0, 2).join('.').replace(/\.\d+$/, '')))];
    const AUSKUNFT = {
      'foundation.users': 'account', 'foundation.usersByEmail': 'account', 'foundation.payments': 'payments', 'foundation.memberships': 'account',
      'social.profiles': 'profile', 'social.profilesByHandle': 'profile', 'social.notifications': 'notifications',
      'shortages.watch': 'watchlist', 'shortages.shortages': 'shortage_disputes', 'sourcing': 'sourcing_requests',
      'medintAbos.abos': 'medint_subscriptions', 'ausbruch.abbestellt': 'outbreak_alerts_on', 'wochenbericht.abbestellt': 'weekly_report_unsubscribed',
      'anzeigen.kunden': 'advertiser_company', 'anzeigen.kampagnen': 'ad_campaigns', 'rechnungen.angaben': 'invoice_details',
      'webPush.abos': 'push_devices', 'einladungen.codes': 'invitation',
      'social.posts': 'posts', 'social.comments': 'comments', 'social.verifications': 'verification',
      'social.reports': 'content_reports', 'logistik': 'logistics_reports',
    };
    const ohne = speicher.filter((k) => !AUSKUNFT[k] || !(AUSKUNFT[k] in ex));
    assert.deepEqual(ohne, [], 'Gespeichert, aber nicht in der Auskunft (DSGVO Art. 15) — Abschnitt in /api/me/export ergänzen:\n' + ohne.join('\n'));
    const exY = (await j('GET', '/api/me/export', y))[1];
    assert.deepEqual(exY.shortage_reports.map((r) => r.wirkstoff), ['Oxytocin'], 'eigene Engpassmeldung fehlt im Export');
    assert.deepEqual(exY.shortage_disputes, [], 'fremder Widerspruch im Export');
    // Unverifiziertes Konto: Auskunft funktioniert (logistik.mine() hätte 403 geworfen) und enthält nichts Fremdes.
    assert.deepEqual([exY.logistics_reports, exY.content_reports], [[], []], 'Auskunft eines unverifizierten Kontos');

    const [sd, d] = await j('POST', '/api/me/delete', x, { password: 'Passwort-1234' });
    assert.deepEqual([sd, d.ok], [200, true]);
    await new Promise((ok) => setTimeout(ok, 700)); // Sicherung schreiben lassen
    await new Promise((ok) => { kind.once('exit', ok); kind.kill(); });

    const stand = JSON.parse(readFileSync(datei, 'utf8'));
    const reste = fundstellen(stand, xid).map((p) => p.replace(/^\./, '')).filter((p) => !ERLAUBT.some((rx) => rx.test(p)));
    assert.deepEqual(reste, [], 'Nach der Löschung noch personenbezogen gespeichert:\n' + reste.join('\n'));
    // Freitexte des Kontos sind ebenfalls weg.
    const roh = JSON.stringify(stand);
    for (const t of ['Bitte an Lager Mombasa', 'Bei uns in Nairobi lieferbar', 'Moi Ave 1']) assert.ok(!roh.includes(t), `Freitext „${t}" noch gespeichert`);
  } finally {
    if (kind.exitCode === null) await new Promise((ok) => { kind.once('exit', ok); kind.kill(); });
    rmSync(dir, { recursive: true, force: true });
  }
});
