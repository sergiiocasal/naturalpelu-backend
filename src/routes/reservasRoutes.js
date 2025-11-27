import express from "express";
import { auth } from "../middlewares/authMiddleware.js";
import { soloAdmin } from "../middlewares/adminMiddleware.js";
import { crearCheckoutReserva, obtenerReservasCompletas, cancelarReservaAdmin, cancelarReservaCliente, obtenerHorasDisponibles, 
  obtenerReservaClientePorId, obtenerReservasCanceladas } from "../controllers/reservasController.js";

const router = express.Router();

router.get("/disponibilidad", obtenerHorasDisponibles);
router.get("/canceladas", auth, soloAdmin, obtenerReservasCanceladas);
router.get("/mia/:id", auth, obtenerReservaClientePorId);
router.get("/completo", auth, obtenerReservasCompletas);

router.post("/checkout", auth, crearCheckoutReserva);

router.delete("/mia/:id", auth, cancelarReservaCliente);

router.delete("/:id", auth, soloAdmin, cancelarReservaAdmin);

export default router;
