/* =========================
   MARKETPLACE - SERVIDOR

   Este archivo ya solo monta la aplicacion. Cada grupo de rutas vive
   en su propio archivo dentro de routes/, y todo el acceso a datos
   pasa por lib/store.js.

   Arranque:
     1) copia .env.example a .env y rellena JWT_SECRET
     2) npm install
     3) npm run migrar   (solo la primera vez, ordena los datos viejos)
     4) npm start
========================= */

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const fs = require("fs");

const { PUBLIC_DIR, UPLOADS_DIR, DATA_DIR } = require("./lib/paths");

const app = express();

/* =========================
   COMPROBACIONES DE ARRANQUE

   Antes el servidor arrancaba igual aunque faltara configuracion y el
   fallo aparecia despues, a mitad de uso. Mejor fallar aqui.
========================= */

const SECRETO_EJEMPLO = "cambia-esto-por-una-cadena-larga-y-aleatoria";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error(
    "\nFALTA CONFIGURACION\n" +
      "No hay JWT_SECRET (o es demasiado corto).\n" +
      "Copia .env.example a .env y pon un valor largo y aleatorio.\n" +
      "Puedes generar uno con:\n" +
      "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"\n"
  );
  process.exit(1);
}

if (process.env.JWT_SECRET === SECRETO_EJEMPLO) {
  console.error(
    "\nJWT_SECRET sigue siendo el valor de ejemplo. Cambialo antes de publicar.\n"
  );
  process.exit(1);
}

[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const PRODUCCION = process.env.NODE_ENV === "production";

/* Detras de un proxy (Nginx, Render, Railway...) hay que confiar en la
   cabecera para que el limite por IP y las cookies seguras funcionen */
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

/* =========================
   SEGURIDAD

   helmet y cors estaban instalados pero no se usaban.
========================= */

app.use(
  helmet({
    contentSecurityPolicy: false, // el HTML actual usa estilos y scripts en linea
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

/* Solo se permite el propio sitio; si algun dia hay una app aparte se
   anaden sus dominios en CORS_ORIGIN separados por coma */
const origenes = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

if (origenes.length > 0) {
  app.use(cors({ origin: origenes, credentials: true }));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

/* Limite general, para que nadie martillee la API.

   Solo se aplica a la API: las paginas, el CSS y las imagenes no
   gastan cupo. Si se contara todo, abrir cuatro paginas seguidas con
   sus imagenes ya rozaba el limite y el sitio empezaba a devolver
   "Demasiadas peticiones" a un usuario normal. */
const limiteGeneral = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_MAX_PETICIONES) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas peticiones. Espera un momento." }
});

app.use((req, res, next) => {
  /* Archivos estaticos: fuera del limite */
  if (/\.(html|css|js|png|jpe?g|webp|gif|avif|svg|ico|woff2?)$/i.test(req.path)) {
    return next();
  }

  return limiteGeneral(req, res, next);
});

/* =========================
   ARCHIVOS ESTATICOS

   Rutas absolutas: antes eran relativas a la carpeta desde la que
   arrancaras node.
========================= */

app.use(express.static(PUBLIC_DIR));

app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    maxAge: PRODUCCION ? "7d" : 0,
    /* Que el navegador nunca ejecute nada servido desde aqui */
    setHeaders: res => res.setHeader("X-Content-Type-Options", "nosniff")
  })
);

/* =========================
   RUTAS
========================= */

app.use(require("./routes/auth"));
app.use(require("./routes/users"));
app.use(require("./routes/ads"));
app.use(require("./routes/orders"));
app.use(require("./routes/misc"));

/* Comprobacion rapida de que el servidor esta vivo */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, fecha: new Date().toISOString() });
});

/* =========================
   404 DE API
========================= */

app.use((req, res) => {
  if (req.accepts("json") && !req.accepts("html")) {
    return res.status(404).json({ message: "Ruta no encontrada" });
  }

  res.status(404).sendFile("index.html", { root: PUBLIC_DIR });
});

/* =========================
   ERRORES

   Antes, un error dentro de una ruta devolvia la pagina de error de
   Express con la traza completa. Ahora se registra en el servidor y al
   navegador solo le llega un mensaje.
========================= */

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  /* Errores de subida de archivos: el mensaje si es util para el usuario */
  if (error && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      message: "Cada imagen debe pesar menos de 5 MB"
    });
  }

  if (error && error.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({ message: "Demasiadas imagenes" });
  }

  if (error && /Solo se admiten imagenes/.test(error.message || "")) {
    return res.status(400).json({ message: error.message });
  }

  console.error("Error no controlado:", error);

  res.status(500).json({
    message: "Error interno del servidor",
    ...(PRODUCCION ? {} : { detalle: error.message })
  });
});

/* =========================
   ARRANQUE
========================= */

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Modo: ${PRODUCCION ? "produccion" : "desarrollo"}`);
});

/* Cierre limpio: da tiempo a que termine lo que se este escribiendo */
["SIGINT", "SIGTERM"].forEach(senal => {
  process.on(senal, () => {
    console.log(`\n${senal} recibido, cerrando servidor...`);
    server.close(() => process.exit(0));
  });
});

module.exports = app;
