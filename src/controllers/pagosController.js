import Stripe from "stripe";
import db from "../db/connection.js";
import { enviarCorreoReservaGoogle } from "../utils/googleEmail.js";
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
    console.error("Error validando webhook:", err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true });
  }

  const session = event.data.object;
  const md = session.metadata || {};
  const paymentIntentId = session.payment_intent;

  if (!paymentIntentId) {
    console.error("Webhook sen payment_intent");
    return res.json({ received: true });
  }

  try {
    const [reservasExistentes] = await db.query(
      "SELECT id FROM reservas WHERE pago_intent = ?",
      [paymentIntentId]
    );

    if (reservasExistentes.length > 0) {
      console.log("Webhook repetido: reserva xa creada para este payment_intent");
      return res.json({ received: true });
    }

    const precio = Number(md.precio || 0);
    const duracion = Number(md.duracion || 0);

    let id_pago;
    const [pagosExistentes] = await db.query(
      "SELECT id FROM pagos WHERE id_transacion = ?",
      [paymentIntentId]
    );

    if (pagosExistentes.length > 0) {
      id_pago = pagosExistentes[0].id;
    } else {
      const [pagoResult] = await db.query(
        `INSERT INTO pagos (estado, importe, id_transacion, data_pago)
         VALUES ('pagado', ?, ?, NOW())`,
        [precio, paymentIntentId]
      );
      id_pago = pagoResult.insertId;
    }

    const codigo_reserva =
      "NP-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const [reservaResult] = await db.query(
      `INSERT INTO reservas
       (id_cliente, id_servizo, fecha, hora, codigo_reserva, estado, id_pago, importe_final, pago_intent)
       VALUES (?, ?, ?, ?, ?, 'pagada', ?, ?, ?)`,
      [
        md.id_cliente,
        md.id_servizo,
        md.fecha,
        md.hora,
        codigo_reserva,
        id_pago,
        precio,
        paymentIntentId,
      ]
    );

    const id_reserva = reservaResult.insertId;

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...(session.metadata || {}),
        id_reserva,
      },
    });

    if (md.fecha && md.hora && duracion > 0) {
      const inicioStr = `${md.fecha}T${md.hora}:00`;
      const inicioDate = new Date(inicioStr);
      const finDate = new Date(inicioDate.getTime() + duracion * 60000);
      const finStr = finDate.toISOString().slice(0, 19);

      const eventId = await crearEventoGoogle({
        resumen: `Reserva - ${md.nombre_servizo}`,
        descripcion: `Cliente: ${md.nombre_cliente}\nCódigo: ${codigo_reserva}`,
        inicio: inicioStr,
        fin: finStr,
        correoCliente: session.customer_email,
      });

      if (eventId) {
        await db.query(
          "UPDATE reservas SET google_event_id = ? WHERE id = ?",
          [eventId, id_reserva]
        );
      }
    }

    await enviarCorreoReservaGoogle({
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
        mensaje: "O pago aínda non terminou",
      });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const id_reserva = paymentIntent.metadata?.id_reserva;

    if (!id_reserva) {
      return res.status(202).json({
        estado: "pendente",
        mensaje: "A reserva aínda non está lista",
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
        mensaje: "A reserva está rexistrada pero aínda non accesible",
      });
    }

    const reserva = rows[0];

    return res.json({
      id_reserva,
      servizo: reserva.servizo,
      fecha:
        reserva.fecha instanceof Date
          ? reserva.fecha.toISOString().split("T")[0]
          : reserva.fecha,
      hora: reserva.hora ? reserva.hora.slice(0, 5) : null,
      codigo_reserva: reserva.codigo_reserva,
      importe: reserva.importe_final,
    });
  } catch (error) {
    console.log("Erro ao obter a reserva dende session:", error);
    return res.status(500).json({ error: "Erro ao obter a reserva" });
  }
};
