import express from "express";
import { registerUsuario, loginUsuario } from "../controllers/usuariosController.js";
import { solicitarRecuperacionPassword, resetearPassword } from "../controllers/usuariosController.js";


const router = express.Router();

// rexistro dun usuario
router.post("/register", registerUsuario);

// login dun usuario
router.post("/login", loginUsuario);

// recuperacion de password
router.post("/recuperar", solicitarRecuperacionPassword);
router.post("/reset-password/:token", resetearPassword);

export default router;
