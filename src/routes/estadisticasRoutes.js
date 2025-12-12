import express from "express";
import { auth } from "../middlewares/authMiddleware.js";
import { soloAdmin } from "../middlewares/adminMiddleware.js";
import { obtenerEstadisticasReservas } from "../controllers/estadisticasController.js";

const router = express.Router();

router.get("/reservas", auth, soloAdmin, obtenerEstadisticasReservas);

export default router;
