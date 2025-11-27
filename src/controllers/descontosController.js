import db from "../db/connection.js"

// funcion para validar un desconto existente na bd
export const validarDesconto = async (req, res) => {
  try {
    const { codigo, id_servizo } = req.body;

    if (!codigo || !id_servizo) {
      return res.status(400).json({ 
        valido: false,
        mensaje: "Faltan datos: codigo o id_servizo"
      });
    }

    // buscamos o desconto por código
    const [rows] = await db.query(
      "SELECT * FROM descontos WHERE codigo = ?",
      [codigo]
    );

    if (rows.length === 0) {
      return res.json({ valido: false, mensaje: "Código no válido" });
    }

    const desconto = rows[0];

    // comprobamos si aplica ao servicio seleccionado:
    // si desconto.id_servizo é NULL → é global, aplica a todos
    // si ten un id_servizo concreto → debe coincidir
    if (desconto.id_servizo && desconto.id_servizo !== id_servizo) {
      return res.json({
        valido: false,
        mensaje: "El descuento no aplica a este servicio"
      });
    }

    // obtemos o prezo do servizo desde a bd
    const [servRows] = await db.query(
      "SELECT precio FROM servizos WHERE id = ?",
      [id_servizo]
    );

    if (servRows.length === 0) {
      return res.status(400).json({
        valido: false,
        mensaje: "Servicio no encontrado"
      });
    }

    const precio = servRows[0].precio;

    // calculamos o prezo final
    let precio_final = precio;

    if (desconto.tipo_descuento === "porcentaje") {
      precio_final = precio - (precio * desconto.descuento / 100);
    } else {
      precio_final = precio - desconto.descuento;
      if (precio_final < 0) precio_final = 0;
    }

    res.json({
      valido: true,
      tipo: desconto.tipo_descuento,
      descuento: desconto.descuento,
      precio_original: precio,
      precio_final
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error al validar descuento" });
  }
};

// funcion para crear un desconto
export const crearDesconto = async (req, res) => {
  try {
    const { codigo, descuento, tipo_descuento, id_servizo } = req.body

    await db.query(
      "INSERT INTO descontos (codigo, descuento, tipo_descuento, id_servizo) VALUES (?, ?, ?, ?)",
      [codigo, descuento, tipo_descuento, id_servizo || null]
    )

    res.json({ mensaje: "Descuento creado correctamente" })

  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Error al crear descuento" })
  }
}

// funcion para eliminar un desconto da bd
export const borrarDesconto = async (req, res) => {
  try {
    const id = req.params.id

    await db.query("DELETE FROM descontos WHERE id = ?", [id])

    res.json({ mensaje: "Descuento eliminado correctamente" })

  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Error al borrar descuento" })
  }
}

// funcion para recoller os descontos da bd
export const obtenerDescontos = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM descontos ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error al obtener los descuentos" });
  }
};
