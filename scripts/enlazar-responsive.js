/* =========================
   ENLAZAR responsive.css EN TODAS LAS PAGINAS

   Se ejecuta con:  node scripts/enlazar-responsive.js

   responsive.css tiene que cargarse EL ULTIMO de todos los estilos
   para que sus reglas de movil ganen a las anteriores. Por eso se
   inserta justo antes de </head>, y si la pagina define estilos con
   <style> dentro del <head>, despues de ese bloque.

   Es seguro ejecutarlo varias veces.
========================= */

const fs = require("fs");
const path = require("path");
const { PUBLIC_DIR } = require("../lib/paths");

const LINK = '<link rel="stylesheet" href="responsive.css">';

let n = 0;

fs.readdirSync(PUBLIC_DIR)
  .filter(f => f.endsWith(".html"))
  .forEach(nombre => {
    const ruta = path.join(PUBLIC_DIR, nombre);
    const original = fs.readFileSync(ruta, "utf8");

    if (original.includes('href="responsive.css"')) return;

    let texto;

    if (/<\/head>/i.test(original)) {
      texto = original.replace(/<\/head>/i, `  ${LINK}\n</head>`);
    } else {
      /* Paginas sin <head> explicito: antes del primer <script> o al
         principio del archivo */
      const i = original.search(/<script\b/i);

      texto =
        i !== -1
          ? original.slice(0, i) + `${LINK}\n` + original.slice(i)
          : `${LINK}\n${original}`;
    }

    fs.writeFileSync(ruta, texto, "utf8");
    n += 1;
  });

console.log(`  responsive.css enlazado en ${n} paginas`);
