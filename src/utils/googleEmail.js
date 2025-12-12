import { gmail } from "./gmailClient.js";

function crearMensajeRaw({ to, subject, html, text }) {
  const mensaje = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html || text,
  ].join("\n");

  return Buffer.from(mensaje)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}


export const enviarCorreoReservaGoogle = async ({
  destinatario,
  nombre_cliente,
  codigo,
  servicio,
  fecha,
  hora,
  duracion,
  importe,
}) => {
  try {
    const subject = `Confirmación de reserva - ${servicio}`;

    const html = `
      <div style="font-family: Arial; color: #333;">
        <h2 style="color: #D694A3;">Reserva confirmada</h2>

        <p>Hola <strong>${nombre_cliente}</strong>,</p>
        <p>Tu reserva ha sido confirmada. Aquí están los detalles:</p>

        <ul>
          <li><strong>Código:</strong> ${codigo}</li>
          <li><strong>Servicio:</strong> ${servicio}</li>
          <li><strong>Fecha:</strong> ${fecha}</li>
          <li><strong>Hora:</strong> ${hora}</li>
          <li><strong>Duración:</strong> ${duracion} minutos</li>
          <li><strong>Importe:</strong> ${importe} €</li>
        </ul>

        <p>Gracias por confiar en nosotros.</p>
        <p>NaturalPeluquería</p>
      </div>
    `;

    const raw = crearMensajeRaw({
      to: destinatario,
      subject,
      html,
    });

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    console.log("Correo enviado por Gmail API");
  } catch (error) {
    console.error("Error enviando correo con Gmail API:", error);
  }
};
