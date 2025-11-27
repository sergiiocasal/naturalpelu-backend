import express from "express";
import { auth } from "../middlewares/authMiddleware.js";
import { soloAdmin } from "../middlewares/adminMiddleware.js";
import { obtenerServizos, crearServizo, borrarServizo } from "../controllers/servizosController.js";

const router = express.Router();

// ver todos os servizos (público)
router.get("/", obtenerServizos);

// crear un servizo (solo admin)
router.post("/", auth, soloAdmin, crearServizo);

// borrar un servizo (solo admin)
router.delete("/:id", auth, soloAdmin, borrarServizo);

export default router;
