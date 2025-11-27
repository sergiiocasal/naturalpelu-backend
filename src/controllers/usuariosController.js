import db from "../db/connection.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { transporter } from "../utils/email.js";

export const registerUsuario = async (req, res) => {
  try {
    const { nombre, correo, telefono, contrasinal } = req.body;

    // comprobar si ya existe el correo (usuario existente)
    const [existe] = await db.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);
    if (existe.length > 0) {
      return res.status(400).json({ error: "Ya existe un usuario con ese correo" });
    }

    // si no existe, encriptamos la contraseña con bcrypt
    const hashedPass = await bcrypt.hash(contrasinal, 10);

    // despues, insertamos el usuario en la bd
    await db.query(
      "INSERT INTO usuarios (nombre, correo, telefono, contrasinal) VALUES (?, ?, ?, ?)",
      [nombre, correo, telefono, hashedPass]
    );

    res.json({ mensaje: "Usuario registrado correctamente" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const loginUsuario = async (req, res) => {
  try {
    const { correo, contrasinal } = req.body;

    // buscamos usuario na bd
    const [rows] = await db.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);
    if (rows.length === 0) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const usuario = rows[0];

    // comprobamos si coinciden as contraseñas
    const match = await bcrypt.compare(contrasinal, usuario.contrasinal);
    if (!match) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    // xeramos token con JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        rol: usuario.id_rol,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      mensaje: "Login correcto",
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.id_rol,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// solicitude de reestablecimiento
export const solicitarRecuperacionPassword = async (req, res) => {
  try {
    const { correo } = req.body;

    const [rows] = await db.query(
      "SELECT id, nombre FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        mensaje: "Se enviará un correo si la cuenta existe"
      }); 
    }

    const usuario = rows[0];

    const token = crypto.randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db.query(
      "UPDATE usuarios SET reset_token = ?, reset_token_expira = ? WHERE id = ?",
      [token, expira, usuario.id]
    );

    const link = `${process.env.FRONTEND_URL}/restablecer/${token}`;

    await transporter.sendMail({
      from: `"Natural Peluquería" <no-reply@naturalpeluqueria.test>`,
      to: correo,
      subject: "Restablecer tu contraseña",
      html: `
        <h2>Recuperación de contraseña</h2>
        <p>Hola ${usuario.nombre},</p>
        <p>Pulsa el siguiente enlace para restablecer tu contraseña:</p>
        <a href="${link}" 
           style="background:#D694A3;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
           Restablecer contraseña
        </a>
        <p>Este enlace caduca en 15 minutos.</p>
      `
    });

    res.json({ mensaje: "Correo de recuperación enviado" });

  } catch (error) {
    console.error("Error en recuperación:", error);
    res.status(500).json({ error: "Erro enviando recuperación" });
  }
};

// reestablecimiento de password
export const resetearPassword = async (req, res) => {

  try {
    const tokenOriginal = req.params.token;
    const token = decodeURIComponent(tokenOriginal);

    // verificar token válido
    const [rows] = await db.query(
      "SELECT id, reset_token, reset_token_expira FROM usuarios WHERE reset_token = ?",
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Token inválido" });
    }

    const usuario = rows[0];

    // verificar expiración
    if (!usuario.reset_token_expira || new Date() > usuario.reset_token_expira) {
      return res.status(400).json({ error: "Token expirado" });
    }

    const { nueva_password } = req.body;

    const hash = await bcrypt.hash(nueva_password, 10);

    await db.query(
      `UPDATE usuarios 
       SET contrasinal = ?, reset_token = NULL, reset_token_expira = NULL 
       WHERE id = ?`,
      [hash, usuario.id]
    );

    res.json({ mensaje: "Contraseña actualizada correctamente" });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao resetear contraseña" });
  }
};

