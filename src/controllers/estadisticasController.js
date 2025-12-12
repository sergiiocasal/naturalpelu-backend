import db from "../db/connection.js";

export const obtenerEstadisticasReservas = async (req, res) => {
  try {
    const { mes, year } = req.query;

    let query = `
      SELECT 
        s.nombre AS servicio,
        COUNT(*) AS total
      FROM reservas r
      JOIN servizos s ON r.id_servizo = s.id
      WHERE r.estado = 'pagada'
    `;

    const params = [];

    if (mes && mes !== "all") {
      query += " AND MONTH(r.fecha) = ? ";
      params.push(Number(mes));
    }

    if (year) {
      query += " AND YEAR(r.fecha) = ? ";
      params.push(Number(year));
    }

    query += " GROUP BY s.nombre ORDER BY total DESC ";

    const [rows] = await db.query(query, params);

    res.json(rows);
  } catch (error) {
    console.error("Error estadísticas:", error);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
};
