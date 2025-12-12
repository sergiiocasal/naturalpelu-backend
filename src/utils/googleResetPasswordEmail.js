import { gmail } from "./gmailClient.js";

function crearMensajeRaw({ to, subject, html }) {
  const mensaje = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\n");

  return Buffer.from(mensaje)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export const enviarCorreoResetPasswordGoogle = async ({
  destinatario,
  nombre,
  resetUrl,
}) => {
  try {
    const subject = "Restablecer contraseña - NaturalPeluquería";

    const html = `
      <div style="font-family: Arial; color: #333;">
        <h2 style="color:#D694A3;">Restablecer contraseña</h2>

        <p>Hola <strong>${nombre}</strong>,</p>

        <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>

        <p style="margin: 24px 0;">
          <a 
            href="${resetUrl}"
            style="
              background:#D694A3;
              color:white;
              padding:12px 18px;
              border-radius:6px;
              text-decoration:none;
              font-weight:bold;
              display:inline-block;
            "
          >
            Restablecer contraseña
          </a>
        </p>

        <p>Este enlace caduca en <strong>1 hora</strong>.</p>

        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>

        <p style="margin-top:24px;">NaturalPeluquería</p>
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

  } catch (error) {
    console.error("Error enviando correo de reset:", error);
  }
};
