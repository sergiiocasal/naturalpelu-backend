import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

try {
  const conn = await pool.getConnection();
  console.log("Conectado correctamente a la base de datos natural peluqueria");
  conn.release();
} catch (err) {
  console.error("Error al conectar a la base de datos:", err.message);
}

export default pool;
