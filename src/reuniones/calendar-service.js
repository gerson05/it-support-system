// src/reuniones/calendar-service.js
import { google } from 'googleapis';
import crypto from 'node:crypto';
import fs from 'node:fs';

function getAuth() {
  try {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    let credentials;
    if (keyJson)      credentials = JSON.parse(keyJson);
    else if (keyPath) credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    else return null;
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  } catch (e) {
    console.error('[Calendar] Auth setup error:', e.message);
    return null;
  }
}

export async function crearEventoConMeet({ titulo, inicio, fin, participantes = [], descripcion = '' }) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const auth = getAuth();
  if (!calendarId || !auth) {
    console.warn('[Calendar] GOOGLE_CALENDAR_ID or credentials not set — skipping Meet link');
    return { meetLink: null, eventId: null };
  }
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      requestBody: {
        summary: titulo,
        description: descripcion,
        start: { dateTime: inicio, timeZone: 'America/Bogota' },
        end:   { dateTime: fin,   timeZone: 'America/Bogota' },
        attendees: participantes
          .filter(p => typeof p === 'string' && p.includes('@'))
          .map(p => ({ email: p.trim() })),
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });
    const event = res.data;
    const meetLink = event.conferenceData?.entryPoints
      ?.find(e => e.entryPointType === 'video')?.uri || null;
    return { meetLink, eventId: event.id };
  } catch (e) {
    console.error('[Calendar] Error creating event:', e.message);
    return { meetLink: null, eventId: null };
  }
}

export async function cancelarEvento(eventId) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const auth = getAuth();
  if (!calendarId || !auth || !eventId) return;
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId, eventId });
  } catch (e) {
    console.error('[Calendar] Error deleting event:', e.message);
  }
}
