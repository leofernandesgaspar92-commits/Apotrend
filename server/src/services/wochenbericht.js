// ============================================================================
//  Wochenbericht per E-Mail (Premium)
// ============================================================================
//  Einmal pro Woche, montags früh: was sich bei den beobachteten Wirkstoffen
//  getan hat, welche davon im Ausland knapp sind (Frühwarnung) und welche
//  Engpässe im Heimatland neu dazukamen oder endeten. Das ist das Produkt,
//  für das Einkauf und Großhandel regelmäßig zahlen: Sie müssen nicht selbst
//  nachsehen, die Lage kommt zu ihnen.
//
//  Regeln:
//   1. NUR TATSACHEN MIT QUELLE. Jede Zeile nennt die Behörde. Keine Prognose.
//   2. EHRLICHE GRUNDLAGE. „Aufzeichnung seit …" steht im Bericht; fehlen für
//      das Heimatland Behördendaten, sagt der Bericht das, statt „ruhig" zu
//      melden.
//   3. HÖCHSTENS EINMAL JE KALENDERWOCHE, auch über Neustarts (gemerkt im
//      gesicherten Zustand). Fiel der Montag aus, kommt er später in derselben
//      Woche — nicht doppelt.
//   4. ABMELDEN mit einem Klick (Zweck-Token, taugt nicht als Anmeldung) und
//      per Schalter in der App.
//   5. ALLES ESCAPEN. Wirkstoffnamen und Gründe stammen aus Behördendateien
//      und Community-Meldungen — in einer HTML-Mail ist das Fremdinhalt.
// ============================================================================

const T = {
  de: {
    betreff: (land, kw, n, f) => `ApoPulse Wochenbericht ${land} · KW ${kw}: ${n} neu${f ? `, ${f} Frühwarnung${f > 1 ? 'en' : ''}` : ''}`,
    hallo: (n) => `Guten Morgen${n ? ' ' + n : ''},`,
    intro: (land) => `hier ist die Engpass-Lage der letzten 7 Tage für ${land}.`,
    beob: 'Ihre beobachteten Wirkstoffe', keineBeob: 'Sie beobachten noch keine Wirkstoffe. In der App mit „Beobachten" hinzufügen — dann stehen sie hier.',
    knapp: (t) => `knapp seit ${t} Tagen`, nichtKnapp: 'derzeit nicht auf der Engpassliste', ausland: 'im Ausland knapp',
    fw: 'Frühwarnung aus dem Ausland', fwHinweis: 'Tatsache aus der Liste der jeweiligen Behörde, keine Prognose für Ihr Land.',
    neu: 'Neu auf der Engpassliste', beendet: 'Nicht mehr auf der Liste', keinNeu: 'Keine neuen Einträge diese Woche.',
    offen: (n) => `Derzeit ${n} Wirkstoff${n === 1 ? '' : 'e'} auf der Liste.`,
    tage: (n) => `${n} Tage`, keineDaten: (land) => `Für ${land} liegen noch keine Behördendaten vor — dieser Teil bleibt leer, statt eine ruhige Lage vorzutäuschen.`,
    grundlage: (s) => `Grundlage: Behördenlisten, von ApoPulse bei jedem Abruf mitgeschrieben (Aufzeichnung seit ${s}).`,
    oeffnen: 'In ApoPulse öffnen', abmelden: 'Wochenbericht abbestellen',
    status: { kritisch: 'kritisch', eingeschraenkt: 'eingeschränkt', verfuegbar: 'verfügbar' },
  },
  en: {
    betreff: (land, kw, n, f) => `ApoPulse weekly report ${land} · week ${kw}: ${n} new${f ? `, ${f} early warning${f > 1 ? 's' : ''}` : ''}`,
    hallo: (n) => `Good morning${n ? ' ' + n : ''},`,
    intro: (land) => `here is the shortage situation of the last 7 days for ${land}.`,
    beob: 'Substances you watch', keineBeob: 'You are not watching any substances yet. Add them in the app with “Watch” and they will appear here.',
    knapp: (t) => `short for ${t} days`, nichtKnapp: 'currently not on the shortage list', ausland: 'short abroad',
    fw: 'Early warning from abroad', fwHinweis: 'Fact from the respective authority’s list, not a forecast for your country.',
    neu: 'New on the shortage list', beendet: 'No longer on the list', keinNeu: 'No new entries this week.',
    offen: (n) => `Currently ${n} substance${n === 1 ? '' : 's'} on the list.`,
    tage: (n) => `${n} days`, keineDaten: (land) => `No authority data for ${land} yet — this part stays empty rather than suggesting a calm situation.`,
    grundlage: (s) => `Basis: authority lists, recorded by ApoPulse on every fetch (records since ${s}).`,
    oeffnen: 'Open in ApoPulse', abmelden: 'Unsubscribe from the weekly report',
    status: { kritisch: 'critical', eingeschraenkt: 'limited', verfuegbar: 'available' },
  },
  pt: {
    betreff: (land, kw, n, f) => `ApoPulse relatório semanal ${land} · semana ${kw}: ${n} novas${f ? `, ${f} alerta${f > 1 ? 's' : ''} antecipado${f > 1 ? 's' : ''}` : ''}`,
    hallo: (n) => `Bom dia${n ? ' ' + n : ''},`,
    intro: (land) => `eis a situação de ruturas dos últimos 7 dias para ${land}.`,
    beob: 'Substâncias que segue', keineBeob: 'Ainda não segue nenhuma substância. Adicione-as na app com “Seguir” e aparecerão aqui.',
    knapp: (t) => `em rutura há ${t} dias`, nichtKnapp: 'atualmente fora da lista de ruturas', ausland: 'em rutura no estrangeiro',
    fw: 'Alerta antecipado do estrangeiro', fwHinweis: 'Facto da lista da respetiva autoridade, não uma previsão para o seu país.',
    neu: 'Novo na lista de ruturas', beendet: 'Saiu da lista', keinNeu: 'Sem novas entradas esta semana.',
    offen: (n) => `Atualmente ${n} substância${n === 1 ? '' : 's'} na lista.`,
    tage: (n) => `${n} dias`, keineDaten: (land) => `Ainda não há dados da autoridade para ${land} — esta parte fica vazia em vez de sugerir uma situação calma.`,
    grundlage: (s) => `Base: listas das autoridades, registadas pela ApoPulse em cada consulta (registo desde ${s}).`,
    oeffnen: 'Abrir na ApoPulse', abmelden: 'Cancelar o relatório semanal',
    status: { kritisch: 'crítico', eingeschraenkt: 'limitado', verfuegbar: 'disponível' },
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const datum = (iso, loc) => { const t = Date.parse(String(iso || '') + 'T00:00:00Z'); return Number.isNaN(t) ? String(iso || '') : new Date(t).toLocaleDateString(loc === 'en' ? 'en-GB' : loc === 'pt' ? 'pt-PT' : 'de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }); };

/** ISO-Kalenderwoche als { jahr, kw, schluessel: '2026-W42' }. */
export function isoWoche(ms) {
  const d = new Date(ms); const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const tag = (new Date(t).getUTCDay() + 6) % 7; // Mo=0
  const donnerstag = new Date(t - tag * 86400000 + 3 * 86400000);
  const jahr = donnerstag.getUTCFullYear();
  // Die Woche gehört zu dem Jahr, in dem ihr Donnerstag liegt (ISO 8601).
  const kw = 1 + Math.floor((donnerstag - Date.UTC(jahr, 0, 1)) / 604800000);
  return { jahr, kw, schluessel: `${jahr}-W${String(kw).padStart(2, '0')}` };
}

/** Ist der Bericht dieser Woche fällig? Ab Montag 05:00 UTC (≈ 6–7 Uhr MEZ). */
export function faellig(ms) {
  const d = new Date(ms); const tag = (d.getUTCDay() + 6) % 7;
  return tag > 0 || d.getUTCHours() >= 5;
}

/** Text- und HTML-Fassung aus den Daten eines Berichts. */
export function rendereWochenbericht(d) {
  const t = T[d.locale] || T.de;
  const st = (s) => t.status[s] || s;
  const fw = d.beobachtet.filter((b) => !b.hier && b.ausland.length);
  const neuN = d.bilanz ? d.bilanz.neu.length : 0;
  const betreff = t.betreff(d.landName, d.kw, neuN, fw.length);
  const z = []; // Text
  const h = []; // HTML
  const abschnitt = (titel) => { z.push('', titel.toUpperCase(), '-'.repeat(titel.length)); h.push(`<h2 style="font-size:17px;margin:22px 0 8px;color:#0b7f28">${esc(titel)}</h2>`); };
  const zeile = (text, html) => { z.push('• ' + text); h.push(`<div style="padding:6px 0;border-top:1px solid #e3e8e5;font-size:15px">${html}</div>`); };

  z.push(t.hallo(d.name), t.intro(d.landName));
  h.push(`<p style="font-size:15px">${esc(t.hallo(d.name))}<br>${esc(t.intro(d.landName))}</p>`);

  abschnitt(t.beob);
  if (!d.beobachtet.length) { z.push(t.keineBeob); h.push(`<p style="font-size:15px">${esc(t.keineBeob)}</p>`); }
  for (const b of d.beobachtet) {
    const hier = b.hier ? `${t.knapp(b.hier.tage)} (${st(b.hier.status)}, ${b.hier.quelle || '—'})` : t.nichtKnapp;
    const aus = b.ausland.length ? ` · ${t.ausland}: ${b.ausland.map((a) => `${a.landName} (${t.tage(a.dauer_tage)}, ${a.quelle || '—'})`).join(', ')}` : '';
    zeile(`${b.wirkstoff}: ${hier}${aus}`, `<b>${esc(b.wirkstoff)}</b>: <span style="color:${b.hier ? '#c0392b' : '#4c5d55'}">${esc(hier)}</span>${aus ? `<br><span style="color:#945900">${esc(aus.slice(3))}</span>` : ''}`);
  }

  if (fw.length) {
    abschnitt(t.fw);
    for (const b of fw) zeile(`${b.wirkstoff}: ${b.ausland.map((a) => `${a.landName}, ${t.tage(a.dauer_tage)}, ${a.quelle || '—'}`).join(' · ')}`,
      `<b>${esc(b.wirkstoff)}</b>: ${esc(b.ausland.map((a) => `${a.landName}, ${t.tage(a.dauer_tage)}, ${a.quelle || '—'}`).join(' · '))}`);
    z.push(t.fwHinweis); h.push(`<p style="font-size:13px;color:#4c5d55">${esc(t.fwHinweis)}</p>`);
  }

  abschnitt(t.neu);
  if (!d.bilanz) { z.push(t.keineDaten(d.landName)); h.push(`<p style="font-size:15px">${esc(t.keineDaten(d.landName))}</p>`); }
  else {
    if (!d.bilanz.neu.length) { z.push(t.keinNeu); h.push(`<p style="font-size:15px">${esc(t.keinNeu)}</p>`); }
    for (const e of d.bilanz.neu.slice(0, 15)) zeile(`${e.wirkstoff} — ${st(e.schwerster_status)}, ${e.quelle || '—'}`, `<b>${esc(e.wirkstoff)}</b> — ${esc(st(e.schwerster_status))} · <span style="color:#4c5d55">${esc(e.quelle || '—')}</span>`);
    if (d.bilanz.beendet.length) {
      abschnitt(t.beendet);
      for (const e of d.bilanz.beendet.slice(0, 15)) zeile(`${e.wirkstoff} — ${t.tage(e.dauer_tage)}`, `<b>${esc(e.wirkstoff)}</b> — ${esc(t.tage(e.dauer_tage))}`);
    }
    z.push('', t.offen(d.bilanz.offen), t.grundlage(datum(d.bilanz.aufzeichnung_seit, d.locale)));
    h.push(`<p style="font-size:15px">${esc(t.offen(d.bilanz.offen))}</p><p style="font-size:13px;color:#4c5d55">${esc(t.grundlage(datum(d.bilanz.aufzeichnung_seit, d.locale)))}</p>`);
  }

  z.push('', `${t.oeffnen}: ${d.appUrl}`, `${t.abmelden}: ${d.abmeldeUrl}`);
  h.push(`<p style="margin-top:22px"><a href="${esc(d.appUrl)}" style="background:#0b7f28;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">${esc(t.oeffnen)}</a></p>`
    + `<p style="font-size:12px;color:#4c5d55;margin-top:18px"><a href="${esc(d.abmeldeUrl)}" style="color:#4c5d55">${esc(t.abmelden)}</a></p>`);
  const html = `<!doctype html><html lang="${esc(d.locale)}"><body style="font-family:Arial,Helvetica,sans-serif;color:#1a2420;max-width:620px;margin:0 auto;padding:16px">`
    + `<div style="font-weight:800;font-size:20px;color:#0b7f28;margin-bottom:8px">ApoPulse</div>${h.join('')}</body></html>`;
  return { betreff, text: z.join('\n'), html };
}

export function createWochenbericht({ repo, social, chronik, fruehwarnung, shortagesRepo, istPremium, mailer, laender, appUrl, zweckToken, jetzt = () => Date.now(), log = console }) {
  const gesendet = new Map();   // userId -> '2026-W42'
  const abbestellt = new Set(); // userId

  function daten(userId) {
    const p = social.getProfile(userId) || {};
    const land = String(p.country || 'AT').toUpperCase();
    const locale = ['de', 'en', 'pt'].includes(p.locale) ? p.locale : 'de';
    // Ländernamen in der Sprache des Berichts (die Länderliste führt sie
    // gemischt: „Österreich", aber „United States").
    let namen = null;
    try { namen = new Intl.DisplayNames([locale], { type: 'region' }); } catch { /* ohne ICU: Liste */ }
    const ln = (cc) => (namen && namen.of(cc)) || (laender[cc] && laender[cc].name) || cc;
    const landName = ln(land);
    const beobachtet = shortagesRepo.listWatch(userId).map((w) => {
      const k = chronik.kurz(w, land);
      const offen = chronik.offenIn(w, land);
      const f = offen ? chronik.fuer(w, land) : null;
      return {
        wirkstoff: w,
        hier: offen && f && f.offen ? { tage: f.offen.dauer_tage, status: f.offen.schwerster_status, quelle: f.offen.quelle } : null,
        ausland: fruehwarnung.imAusland(w, land).map((a) => ({ ...a, landName: ln(a.land) })),
        anzahl: k ? k.anzahl : 0,
      };
    });
    return {
      userId, land, landName, name: p.display_name || '', locale,
      kw: isoWoche(jetzt()).kw, beobachtet, bilanz: chronik.wochenbilanz(land),
      appUrl, abmeldeUrl: `${appUrl}/?wb_abmelden=${encodeURIComponent(zweckToken(userId))}`,
    };
  }

  return {
    vorschau(userId) { return { ...rendereWochenbericht(daten(userId)), mail_aktiv: mailer.aktiv, mail_grund: mailer.grund, abbestellt: abbestellt.has(userId) }; },
    abbestellen(userId) { abbestellt.add(userId); },
    bestellen(userId) { abbestellt.delete(userId); },
    istAbbestellt(userId) { return abbestellt.has(userId); },

    /** Stündlich aufgerufen; versendet, was in dieser Woche noch fehlt. */
    async lauf() {
      if (!mailer.aktiv) return { aus: mailer.grund };
      const ms = jetzt();
      if (!faellig(ms)) return { noch_nicht: true };
      const woche = isoWoche(ms).schluessel;
      const r = { gesendet: 0, fehler: 0, uebersprungen: 0 };
      for (const uid of repo.listUsersWithEntitlement('premium')) {
        if (!istPremium(uid) || abbestellt.has(uid) || gesendet.get(uid) === woche) { r.uebersprungen++; continue; }
        const u = repo.getUserById(uid);
        if (!u || !u.email) { r.uebersprungen++; continue; }
        try {
          const b = rendereWochenbericht(daten(uid));
          await mailer.sende({ an: u.email, betreff: b.betreff, text: b.text, html: b.html });
          gesendet.set(uid, woche);
          r.gesendet++;
        } catch (e) {
          r.fehler++;
          log.warn?.(`ApoPulse Wochenbericht: Versand fehlgeschlagen (${(e && e.message) || e})`);
        }
      }
      return r;
    },

    __dump() { return { gesendet: [...gesendet], abbestellt: [...abbestellt] }; },
    __load(d) {
      gesendet.clear(); abbestellt.clear();
      if (!d) return;
      for (const [k, v] of d.gesendet || []) gesendet.set(k, v);
      for (const u of d.abbestellt || []) abbestellt.add(u);
    },
  };
}
