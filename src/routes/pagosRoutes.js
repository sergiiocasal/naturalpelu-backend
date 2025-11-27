import express from "express";
import { pagosWebhook, obtenerReservaDesdeSession } from "../controllers/pagosController.js";

const router = express.Router();

router.post("/webhook",express.raw({ type: "application/json" }),pagosWebhook);

router.get("/session/:id", obtenerReservaDesdeSession);

export default router;
