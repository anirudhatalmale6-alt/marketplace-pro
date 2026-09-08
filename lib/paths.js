/* =========================
   RUTAS ABSOLUTAS DEL PROYECTO

   Antes el codigo usaba rutas relativas ("users.json"), que dependen de
   la carpeta desde la que arrancas el proceso. Si arrancabas node desde
   otra carpeta, el servidor no encontraba los datos.
   Aqui todo se resuelve a partir de la carpeta del proyecto.
========================= */

const path = require("path");

const ROOT = path.join(__dirname, "..");

module.exports = {
  ROOT,
  DATA_DIR: path.join(ROOT, "data"),
  PUBLIC_DIR: path.join(ROOT, "public"),
  UPLOADS_DIR: path.join(ROOT, "uploads"),
  BACKUP_DIR: path.join(ROOT, "backups")
};
