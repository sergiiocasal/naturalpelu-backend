import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* enviar correo de reserva */
export const enviarCorreoReserva = async (datos) => {
  try {
    const html = `
      <div style="font-family: Arial; padding: 20px;">
        <h2 style="color:#D694A3;">Reserva confirmada</h2>
        <p>Hola ${datos.nombre_cliente || "cliente"},</p>
        <p>Tu reserva se ha confirmado correctamente.</p>

        <h3>Detalles de la reserva</h3>
        <ul>
          <li><strong>Código:</strong> ${datos.codigo || ""}</li>
          <li><strong>Servicio:</strong> ${datos.servicio || ""}</li>
          <li><strong>Fecha:</strong> ${datos.fecha || ""}</li>
          <li><strong>Hora:</strong> ${datos.hora || ""}</li>
          <li><strong>Duración:</strong> ${datos.duracion || ""} min</li>
          <li><strong>Importe:</strong> ${datos.importe || ""} €</li>
        </ul>

        <p>Puedes ver tus reservas aquí:</p>
        <a href="${process.env.FRONTEND_URL}/mis-reservas" 
          style="display:inline-block; padding:10px 20px; background:#D694A3; color:white; text-decoration:none; border-radius:6px;">
          Mis reservas
        </a>

        <p style="margin-top:20px;">Gracias por confiar en Natural Peluquería.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Natural Peluquería" <no-reply@naturalpeluqueria.test>`,
      to: datos.destinatario,
      subject: "Reserva confirmada",
      html,
    });

  } catch (err) {
    console.error("Error enviando correo:", err);
  }
};
