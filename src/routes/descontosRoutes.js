import express from "express";
import { auth } from "../middlewares/authMiddleware.js";
import { soloAdmin } from "../middlewares/adminMiddleware.js";
import { validarDesconto, crearDesconto, borrarDesconto, obtenerDescontos } from "../controllers/descontosController.js";

const router = express.Router();

// obter os descontos
router.get("/", auth, soloAdmin, obtenerDescontos);

// validar desconto
router.post("/validar", validarDesconto);

// crear un desconto (solo admin)
router.post("/", auth, soloAdmin, crearDesconto);

// eliminar un desconto
router.delete("/:id", auth, soloAdmin, borrarDesconto);

export default router;
