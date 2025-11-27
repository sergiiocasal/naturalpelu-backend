import app from "./src/app.js";
import cors from "cors";

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "https://naturalpeluqueria1.netlify.app/", 
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization"
}));

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
