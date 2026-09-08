/* =========================
   PREPARAR LAS PAGINAS HTML

   Se ejecuta con:  node scripts/preparar-html.js

   Hace dos cosas en las 23 paginas:

   1) Anade <script src="sesion.js"> como PRIMER script de la pagina.
      sesion.js tiene que cargarse antes que los demas porque define
      protegerPagina() y Sesion, que el resto usa.

   2) Anade la etiqueta viewport a las paginas que no la tenian.
      Sin ella el movil dibuja la pagina como si fuera una pantalla de
      ordenador y la encoge: por eso el contenido se salia de la
      pantalla en checkout, dashboard, favoritos, gracias, historial e
      "Informacion personal".

   Es seguro ejecutarlo varias veces.
========================= */

const fs = require("fs");
const path = require("path");
const { PUBLIC_DIR } = require("../lib/paths");

const VIEWPORT =
  '<meta name="viewport" content="width=device-width, initial-scale=1">';

const SESION = '<script src="sesion.js"></script>';

let conSesion = 0;
let conViewport = 0;

fs.readdirSync(PUBLIC_DIR)
  .filter(f => f.endsWith(".html"))
  .forEach(nombre => {
    const ruta = path.join(PUBLIC_DIR, nombre);
    const original = fs.readFileSync(ruta, "utf8");

    let texto = original;

    /* --- viewport --- */
    if (!/name=["']viewport["']/i.test(texto)) {
      if (/<head[^>]*>/i.test(texto)) {
        texto = texto.replace(/(<head[^>]*>)/i, `$1\n  ${VIEWPORT}`);
        conViewport += 1;
      }
    }

    /* --- sesion.js --- */
    if (!texto.includes('src="sesion.js"')) {
      const primerScript = texto.search(/<script\b/i);

      if (primerScript !== -1) {
        /* Justo antes del primer <script> que haya en la pagina */
        texto =
          texto.slice(0, primerScript) +
          `${SESION}\n` +
          texto.slice(primerScript);
      } else if (/<\/body>/i.test(texto)) {
        texto = texto.replace(/<\/body>/i, `  ${SESION}\n</body>`);
      } else {
        texto += `\n${SESION}\n`;
      }

      conSesion += 1;
    }

    if (texto !== original) fs.writeFileSync(ruta, texto, "utf8");
  });

console.log(`  sesion.js anadido a ${conSesion} paginas`);
console.log(`  viewport anadido a ${conViewport} paginas`);
