import express from "express"
import cors from "cors"

import { auth } from "./middlewares/authMiddleware.js"
import { soloAdmin } from "./middlewares/adminMiddleware.js"
import { pagosWebhook }  from "./controllers/pagosController.js"

// import Rutas
import usuariosRoutes from "./routes/usuariosRoutes.js"
import reservasRoutes from "./routes/reservasRoutes.js"
import servizosRoutes from "./routes/servizosRoutes.js"
import descontosRoutes from "./routes/descontosRoutes.js"
import pagosRoutes from "./routes/pagosRoutes.js"

const app = express()

app.post(
  "/api/pagos/webhook",
  express.raw({ type: "application/json" }),
  pagosWebhook
);

app.use(cors())
app.use(express.json())

app.use("/api/reservas", reservasRoutes)
app.use("/api/servizos", servizosRoutes)
app.use("/api/descontos", descontosRoutes)
app.use("/api/pagos", pagosRoutes)

// ruta / para probas
app.get("/", (req, res) => {
  res.send("Servidor NaturalPeluquería funcionando")
})


// rutas reais
app.use("/api/usuarios", usuariosRoutes)
app.get("/api/protegida", auth, (req, res) => {
  res.json({ mensaje: "Acceso autorizado", usuario: req.usuario })
})
app.get("/api/admin/test", auth, soloAdmin, (req, res) => {
    res.json({ mensaje: "Acceso solo admin permitido" })
})



export default app
