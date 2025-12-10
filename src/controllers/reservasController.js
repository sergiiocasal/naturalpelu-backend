import Stripe from "stripe";
import db from "../db/connection.js";
import { eliminarEventoGoogle } from "../utils/googleCalendar.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const formatearReserva = (r) => ({
  ...r,
  fecha:
    r.fecha instanceof Date
      ? r.fecha.toLocaleDateString("sv-SE")
      : r.fecha,
  hora: r.hora ? r.hora.slice(0, 5) : null,
});

export const crearCheckoutReserva = async (req, res) => {
  try {
    const { id_servizo, fecha, hora, precio_final, codigo_desconto } = req.body;
    const id_cliente = req.usuario.id;

    if (!id_servizo || !fecha || !hora) {
      return res.status(400).json({ error: "Faltan datos obrigatorios" });
    }

    const [serv] = await db.query("SELECT * FROM servizos WHERE id = ?", [
      id_servizo,
    ]);

    if (serv.length === 0) {
      return res.status(404).json({ error: "O servizo non existe" });
    }

    const nombre_servizo = serv[0].nombre;
    const duracion = serv[0].duracion;

    const [userRows] = await db.query(
      "SELECT nombre, correo FROM usuarios WHERE id = ?",
      [id_cliente]
    );

    const nombre_cliente = userRows[0]?.nombre || "Cliente";
    const correo_cliente = userRows[0]?.correo;
    const precio = Number(precio_final ?? serv[0].precio);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: correo_cliente,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: nombre_servizo },
            unit_amount: Math.round(precio * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/pago-exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pago-cancelado`,
      metadata: {
        id_cliente: String(id_cliente),
        id_servizo: String(id_servizo),
        fecha,
        hora,
        precio: String(precio),
        descuento: codigo_desconto || "",
        duracion: String(duracion),
        nombre_servizo,
        nombre_cliente,
        correo_cliente,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.log("Erro creando checkout:", error);
    res.status(500).json({ error: "Erro creando checkout" });
  }
};

export const obtenerReservasCompletas = async (req, res) => {
  try {
    const id_cliente = req.usuario.id;
    const rol = req.usuario.rol;

    let query = `
      SELECT 
        r.id,
        r.codigo_reserva,
        r.fecha,
        r.hora,
        r.estado,
        r.importe_final,
        r.google_event_id,
        r.pago_intent,
        s.nombre AS servizo,
        u.correo AS cliente_correo,
        u.nombre AS cliente_nombre,
        u.telefono AS cliente_telefono,
        p.estado AS estado_pago,
        p.importe AS pago_importe
      FROM reservas r
      JOIN servizos s ON r.id_servizo = s.id
      JOIN usuarios u ON r.id_cliente = u.id
      LEFT JOIN pagos p ON r.id_pago = p.id
    `;

    const params = [];

    if (rol !== 1) {
      query += ` WHERE r.id_cliente = ? `;
      params.push(id_cliente);
    }

    query += ` ORDER BY r.fecha, r.hora `;

    const [rows] = await db.query(query, params);

    res.json(rows.map(formatearReserva));
  } catch (error) {
    console.log("Erro ao obter reservas completas:", error);
    res.status(500).json({ error: "Erro ao obter as reservas completas" });
  }
};

export const obtenerReservasCanceladas = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        rc.id,
        rc.id_reserva_original,
        rc.fecha,
        rc.hora,
        rc.codigo_reserva,
        rc.importe_final,
        rc.estado_pago_final,
        rc.cancelada_por,
        rc.fecha_cancelacion,
        u.nombre AS cliente_nombre,
        u.correo AS cliente_correo,
        u.telefono AS cliente_telefono,
        s.nombre AS servizo
      FROM reservas_canceladas rc
      JOIN usuarios u ON rc.id_cliente = u.id
      JOIN servizos s ON rc.id_servizo = s.id
      ORDER BY rc.fecha DESC, rc.hora DESC`
    );

    const final = rows.map((r) => ({
      ...r,
      fecha:
        r.fecha instanceof Date
          ? r.fecha.toLocaleDateString("sv-SE")
          : r.fecha,
      hora: r.hora?.slice(0, 5),
      fecha_cancelacion: r.fecha_cancelacion
        ? new Date(r.fecha_cancelacion).toLocaleDateString("es-ES")
        : "",
      hora_cancelacion: r.fecha_cancelacion
        ? new Date(r.fecha_cancelacion).toTimeString().slice(0, 5)
        : "",
    }));

    res.json(final);
  } catch (error) {
    console.log("Erro ao obter reservas canceladas:", error);
    res.status(500).json({ error: "Erro ao obter as reservas canceladas" });
  }
};

export const cancelarReservaAdmin = async (req, res) => {
  try {
    const id_reserva = req.params.id;

    const [rows] = await db.query(
      `SELECT r.*, p.estado AS estado_pago, p.importe, p.id_transacion 
       FROM reservas r
       LEFT JOIN pagos p ON r.id_pago = p.id
       WHERE r.id = ?`,
      [id_reserva]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "A reserva non existe" });
    }

    const r = rows[0];

    if (r.google_event_id) {
      await eliminarEventoGoogle(r.google_event_id);
    }

    let estado_pago_final = "reembolsado";

    if (r.id_pago && r.id_transacion) {
      try {
        await stripe.refunds.create({ payment_intent: r.id_transacion });
        await db.query(
          "UPDATE pagos SET estado='reembolsado', data_reembolso = NOW() WHERE id = ?",
          [r.id_pago]
        );
      } catch (error) {
        console.log("Erro reembolsando:", error);
        estado_pago_final = "error_reembolso";
      }
    } else {
      estado_pago_final = "sen_pago";
    }

    await db.query(
      `INSERT INTO reservas_canceladas 
        (id_reserva_original, id_cliente, id_servizo, fecha, hora, codigo_reserva,
         id_pago, importe_final, estado_pago_final, id_transaccion, cancelada_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.id_cliente,
        r.id_servizo,
        r.fecha,
        r.hora,
        r.codigo_reserva,
        r.id_pago,
        r.importe_final,
        estado_pago_final,
        r.id_transacion,
        "admin",
      ]
    );

    await db.query("DELETE FROM reservas WHERE id = ?", [id_reserva]);

    res.json({ mensaje: "Reserva cancelada" });
  } catch (error) {
    console.log("Erro cancelar reserva admin:", error);
    res.status(500).json({ error: "Erro ao cancelar a reserva" });
  }
};

export const cancelarReservaCliente = async (req, res) => {
  try {
    const id_reserva = req.params.id;
    const id_cliente = req.usuario.id;

    const [rows] = await db.query(
      `SELECT r.*, p.estado AS estado_pago, p.importe, p.id_transacion 
       FROM reservas r
       LEFT JOIN pagos p ON r.id_pago = p.id
       WHERE r.id = ?`,
      [id_reserva]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "A reserva non existe" });
    }

    const r = rows[0];

    if (r.id_cliente !== id_cliente) {
      return res
        .status(403)
        .json({ error: "Non tes permiso para cancelar esta reserva" });
    }

    if (r.google_event_id) {
      await eliminarEventoGoogle(r.google_event_id);
    }

    let estado_pago_final = "reembolsado";

    if (!r.id_pago || !r.id_transacion) {
      estado_pago_final = "sen_pago";
    } else if (r.estado_pago !== "reembolsado") {
      try {
        await stripe.refunds.create({ payment_intent: r.id_transacion });
        await db.query(
          "UPDATE pagos SET estado='reembolsado', data_reembolso = NOW() WHERE id = ?",
          [r.id_pago]
        );
      } catch (error) {
        console.log("Erro reembolsando:", error);
        estado_pago_final = "error_reembolso";
      }
    }

    await db.query(
      `INSERT INTO reservas_canceladas
      (id_reserva_original, id_cliente, id_servizo, fecha, hora, codigo_reserva,
       id_pago, importe_final, estado_pago_final, id_transaccion, cancelada_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.id_cliente,
        r.id_servizo,
        r.fecha,
        r.hora,
        r.codigo_reserva,
        r.id_pago,
        r.importe_final,
        estado_pago_final,
        r.id_transacion,
        "cliente",
      ]
    );

    await db.query("DELETE FROM reservas WHERE id = ?", [id_reserva]);

    res.json({ mensaje: "Reserva cancelada" });
  } catch (error) {
    console.log("Erro cancelar reserva cliente:", error);
    res.status(500).json({ error: "Erro ao cancelar a reserva" });
  }
};

export const obtenerHorasDisponibles = async (req, res) => {
  try {
    const { fecha, id_servizo } = req.query;

    if (!fecha || !id_servizo) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    const [rowServ] = await db.query(
      "SELECT duracion FROM servizos WHERE id = ?",
      [id_servizo]
    );

    if (rowServ.length === 0) {
      return res.status(404).json({ error: "O servizo non existe" });
    }

    const duracion = rowServ[0].duracion;

    const dia = new Date(fecha).getDay();
    let bloques = [];

    if (dia >= 2 && dia <= 5) {
      bloques = [
        { inicio: "10:15", fin: "13:30" },
        { inicio: "16:00", fin: "19:30" },
      ];
    } else if (dia === 6) {
      bloques = [{ inicio: "09:00", fin: "17:00" }];
    } else {
      return res.json({ horas: [] });
    }

    const horasPosibles = [];

    const generarSlots = (inicio, fin) => {
      let [h, m] = inicio.split(":").map(Number);
      const finDate = new Date(`${fecha}T${fin}:00`);

      while (true) {
        const slot = new Date(
          `${fecha}T${String(h).padStart(2, "0")}:${String(
            m
          ).padStart(2, "0")}:00`
        );
        if (slot >= finDate) break;

        horasPosibles.push(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
        );

        m += 15;
        if (m >= 60) {
          m -= 60;
          h++;
        }
      }
    };

    for (const b of bloques) generarSlots(b.inicio, b.fin);

    const [reservas] = await db.query(
      `SELECT r.hora, s.duracion
       FROM reservas r
       JOIN servizos s ON r.id_servizo = s.id
       WHERE r.fecha = ?`,
      [fecha]
    );

    const estaOcupada = (horaSlot) => {
      const inicioSlot = new Date(`${fecha}T${horaSlot}:00`);
      const finSlot = new Date(inicioSlot.getTime() + duracion * 60000);

      for (const r of reservas) {
        const inicioReserva = new Date(`${fecha}T${r.hora}:00`);
        const finReserva = new Date(
          inicioReserva.getTime() + r.duracion * 60000
        );

        if (inicioSlot < finReserva && finSlot > inicioReserva) {
          return true;
        }
      }
      return false;
    };

    const horasLibres = horasPosibles.filter((h) => !estaOcupada(h));

    res.json({ horas: horasLibres });
  } catch (error) {
    console.log("Erro horas dispoñibles:", error);
    res.status(500).json({ error: "Erro ao obter horas dispoñibles" });
  }
};

export const obtenerReservaClientePorId = async (req, res) => {
  try {
    const id_cliente = req.usuario.id;
    const id_reserva = req.params.id;

    const [rows] = await db.query(
      `SELECT 
          r.id,
          r.codigo_reserva,
          r.fecha,
          r.hora,
          r.estado AS estado_reserva,
          r.id_pago,
          r.id_servizo,
          r.google_event_id,
          r.pago_intent,
          s.nombre AS servizo,
          s.duracion,
          s.precio,
          p.estado AS estado_pago,
          p.importe AS importe_final,
          p.id_transacion
       FROM reservas r
       JOIN servizos s ON r.id_servizo = s.id
       LEFT JOIN pagos p ON r.id_pago = p.id
       WHERE r.id = ? AND r.id_cliente = ?`,
      [id_reserva, id_cliente]
    );

    if (rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Non tes permiso para ver esta reserva" });
    }

    res.json(formatearReserva(rows[0]));
  } catch (error) {
    console.log("Erro obter reserva cliente:", error);
    res.status(500).json({ error: "Erro ao obter a reserva" });
  }
};

export const actualizarReservaCliente = async (req, res) => {
  try {
    const id_reserva = req.params.id;
    const id_cliente = req.usuario.id;
    const { id_servizo, fecha, hora } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM reservas WHERE id = ? AND id_cliente = ?",
      [id_reserva, id_cliente]
    );

    if (rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Non tes permiso para editar esta reserva" });
    }

    await db.query(
      "UPDATE reservas SET id_servizo=?, fecha=?, hora=? WHERE id=?",
      [id_servizo, fecha, hora, id_reserva]
    );

    res.json({ mensaje: "Reserva actualizada correctamente" });
  } catch (error) {
    console.log("Erro actualizar reserva:", error);
    res.status(500).json({ error: "Erro ao actualizar reserva" });
  }
};
