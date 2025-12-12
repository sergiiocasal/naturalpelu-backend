import db from "../db/connection.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { enviarCorreoResetPasswordGoogle } from "../utils/googleResetPasswordEmail.js";

export const registerUsuario = async (req, res) => {
  try {
    const { nombre, correo, telefono, contrasinal } = req.body;

    const [existe] = await db.query(
      "SELECT id FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (existe.length > 0) {
      return res.status(400).json({ error: "Ya existe un usuario con ese correo" });
    }

    const hashedPass = await bcrypt.hash(contrasinal, 10);

    await db.query(
      "INSERT INTO usuarios (nombre, correo, telefono, contrasinal) VALUES (?, ?, ?, ?)",
      [nombre, correo, telefono, hashedPass]
    );

    res.json({ mensaje: "Usuario registrado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const loginUsuario = async (req, res) => {
  try {
    const { correo, contrasinal } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const usuario = rows[0];

    const match = await bcrypt.compare(contrasinal, usuario.contrasinal);

    if (!match) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.id_rol },
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
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const solicitarRecuperacionPassword = async (req, res) => {
  try {
    const { correo } = req.body;

    const [rows] = await db.query(
      "SELECT id, nombre FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        mensaje: "Se enviará un correo si la cuenta existe",
      });
    }

    const usuario = rows[0];

    const token = crypto.randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      "UPDATE usuarios SET reset_token = ?, reset_token_expira = ? WHERE id = ?",
      [token, expira, usuario.id]
    );

    const link = `${process.env.FRONTEND_URL}/restablecer/${token}`;

    await enviarCorreoResetPasswordGoogle({
      destinatario: correo,
      nombre: usuario.nombre,
      enlace: link,
    });

    res.json({ mensaje: "Correo de recuperación enviado" });
  } catch (error) {
    res.status(500).json({ error: "Erro enviando recuperación" });
  }
};

export const resetearPassword = async (req, res) => {
  try {
    const token = decodeURIComponent(req.params.token);

    const [rows] = await db.query(
      "SELECT id, reset_token_expira FROM usuarios WHERE reset_token = ?",
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Token inválido" });
    }

    const usuario = rows[0];

    if (!usuario.reset_token_expira || new Date() > usuario.reset_token_expira) {
      return res.status(400).json({ error: "Token expirado" });
    }

    const { nueva_password } = req.body;

    const hash = await bcrypt.hash(nueva_password, 10);

    await db.query(
      "UPDATE usuarios SET contrasinal = ?, reset_token = NULL, reset_token_expira = NULL WHERE id = ?",
      [hash, usuario.id]
    );

    res.json({ mensaje: "Contraseña actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao resetear contraseña" });
  }
};
