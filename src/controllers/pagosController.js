import Stripe from "stripe";
import db from "../db/connection.js";
import { enviarCorreoReserva } from "../utils/email.js";
import { crearEventoGoogle } from "../utils/googleCalendar.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const pagosWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const md = session.metadata;

    try {
      const [pagoResult] = await db.query(
        `INSERT INTO pagos (estado, importe, id_transacion, data_pago)
         VALUES ('pagado', ?, ?, NOW())`,
        [md.precio, session.payment_intent]
      );

      const id_pago = pagoResult.insertId;

      const codigo_reserva =
        "NP-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      const [reservaResult] = await db.query(
        `INSERT INTO reservas
         (id_cliente, id_servizo, fecha, hora, codigo_reserva, estado, id_pago, importe_final)
         VALUES (?, ?, ?, ?, ?, 'pagada', ?, ?)`,
        [
          md.id_cliente,
          md.id_servizo,
          md.fecha,
          md.hora,
          codigo_reserva,
          id_pago,
          md.precio
        ]
      );

      const id_reserva = reservaResult.insertId;

      await stripe.paymentIntents.update(session.payment_intent, {
        metadata: { id_reserva },
      });

      // calcular o inicio e o fin do evento
      const inicio = `${md.fecha}T${md.hora}:00`;
      const fin = new Date(
        new Date(inicio).getTime() + md.duracion * 60000
      ).toISOString();

      // creamos o evento en Google Calendar
      const eventId = await crearEventoGoogle({
        resumen: `Reserva - ${md.nombre_servizo}`,
        descripcion: `Cliente: ${md.nombre_cliente}\nCódigo: ${codigo_reserva}`,
        inicio,
        fin,
        correoCliente: session.customer_email
      });

      if (eventId) {
        await db.query(
          "UPDATE reservas SET google_event_id = ? WHERE id = ?",
          [eventId, id_reserva]
        );
      }

      // enviamos o correo
      await enviarCorreoReserva({
        destinatario: session.customer_email,
        nombre_cliente: md.nombre_cliente,
        codigo: codigo_reserva,
        servicio: md.nombre_servizo,
        fecha: md.fecha,
        hora: md.hora,
        duracion: md.duracion,
        importe: md.precio
      });

    } catch (error) {
      console.error("Error procesando webhook:", error);
    }
  }

  res.json({ received: true });
};
export const obtenerReservaDesdeSession = async (req, res) => {
  try {
    const session_id = req.params.id;

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return res.status(404).json({ error: "Sesión non atopada" });
    }

    const paymentIntentId = session.payment_intent;

    if (!paymentIntentId) {
      return res.status(202).json({
        estado: "pendente",
        mensaje: "O pago aínda non terminou"
      });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const id_reserva = paymentIntent.metadata?.id_reserva;

    if (!id_reserva) {
      return res.status(202).json({
        estado: "pendente",
        mensaje: "A reserva aínda non está lista"
      });
    }

    const [rows] = await db.query(
      `SELECT r.*, s.nombre AS servizo 
       FROM reservas r
       JOIN servizos s ON r.id_servizo = s.id
       WHERE r.id = ?`,
      [id_reserva]
    );

    if (rows.length === 0) {
      return res.status(202).json({
        estado: "pendente",
        mensaje: "A reserva está rexistrada pero aínda non accesible"
      });
    }

    const reserva = rows[0];

    return res.json({
      id_reserva,
      servizo: reserva.servizo,
      fecha: reserva.fecha.toISOString().split("T")[0],
      hora: reserva.hora.slice(0, 5),
      codigo_reserva: reserva.codigo_reserva,
      importe: reserva.importe_final
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro ao obter a reserva" });
  }
};
