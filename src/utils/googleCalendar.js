import { google } from "googleapis";

// Cliente OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// establecemos o refreshToken
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

// creamos o evento en Google Calendar
export const crearEventoGoogle = async ({
  resumen,
  descripcion,
  inicio,
  fin,
  correoCliente,
}) => {
  try {
    const evento = {
      summary: resumen,
      description: descripcion,
      start: {
        dateTime: inicio,
        timeZone: "Europe/Madrid",
      },
      end: {
        dateTime: fin,
        timeZone: "Europe/Madrid",
      },
      attendees: [
        {
          email: correoCliente,
          responseStatus: "needsAction"
        },
        {
          email: "a25sergiocg@iessanclemente.net",
          organizer: true
        }
      ],
    };

    const res = await calendar.events.insert({
      calendarId: "primary",
      resource: evento,
      sendUpdates: "all",
    });

    return res.data.id;

  } catch (error) {
    console.error("Error creando evento en Google Calendar:", error);
    return null;
  }
};


// eliminamos o evento de Google Calendar 
export const eliminarEventoGoogle = async (eventId) => {
  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });
  } catch (error) {
    console.error("Error eliminando evento de Google Calendar:", error);
  }
};
