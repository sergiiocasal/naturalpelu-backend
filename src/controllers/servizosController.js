import db from "../db/connection.js"

// obtemos os servizos da bd
export const obtenerServizos = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM servizos")
    res.json(rows)
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Error al obtener servicios" })
  }
}

// creamos un servizo e engadimolo á bd
export const crearServizo = async (req, res) => {
  try {
    const { nombre, precio } = req.body

    await db.query(
      "INSERT INTO servizos (nombre, precio) VALUES (?, ?)",
      [nombre, precio]
    )

    res.json({ mensaje: "Servicio creado correctamente" })

  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Error al crear servicio" })
  }
}

// elimimnamos un servizo da bd
export const borrarServizo = async (req, res) => {
  try {
    const id = req.params.id

    await db.query("DELETE FROM servizos WHERE id = ?", [id])

    res.json({ mensaje: "Servicio eliminado correctamente" })

  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Error al borrar servicio" })
  }
}
