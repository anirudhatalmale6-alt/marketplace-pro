/* =========================
   ARREGLAR EL TEXTO DANADO DEL FRONTEND

   Se ejecuta con:  node scripts/arreglar-texto.js

   En algun momento del proyecto unos archivos se guardaron con una
   conversion de codificacion mal hecha. El resultado es texto que el
   usuario ve roto en pantalla:

     "Debes iniciar sesiA3n"     en vez de  "Debes iniciar sesion"
     "Tu carrito esta! vaci-o"   en vez de  "Tu carrito esta vacio"

   Se corrigen SOLO las secuencias concretas que estan mal, una a una.
   No se reinterpreta el archivo entero: eso romperia los acentos que
   si estan bien escritos.

   Es seguro ejecutarlo varias veces.
========================= */

const fs = require("fs");
const path = require("path");
const { PUBLIC_DIR } = require("../lib/paths");

/* Cada par es: [secuencia rota, texto correcto].
   Las secuencias van con \u para que este archivo sea legible y no
   se vuelva a romper al copiarlo de un sitio a otro. */
const CORRECCIONES = [
  /* Vocales acentuadas partidas en dos caracteres */
  ["sesiÃ³n", "sesion"],
  ["protecciÃ³n", "proteccion"],
  ["estÃ¡", "esta"],
  ["vacÃ­o", "vacio"],
  ["mÃ¡s", "mas"],
  ["pÃ¡gina", "pagina"],
  ["aÃ±o", "ano"],

  /* Restos sueltos del segundo destrozo: la vocal quedo sin acento y
     el acento se quedo solo detras */
  ["esta¡", "esta"],
  ["vaci­o", "vacio"],

  /* Emojis rotos: se quitan. Se quedaban como "d??" en pantalla. */
  ["ðŸ”´", ""],
  ["ðŸ”’", ""],
  ["ðŸ—‘", ""],
  ["ðŸŽ‰", ""],
  ["âš ï¸", ""],

  /* Guion blando invisible suelto */
  ["­", ""]
];

let cambiados = 0;
let sustituciones = 0;

fs.readdirSync(PUBLIC_DIR)
  .filter(f => /\.(js|html|css)$/.test(f))
  .forEach(nombre => {
    const ruta = path.join(PUBLIC_DIR, nombre);
    const original = fs.readFileSync(ruta, "utf8");

    let texto = original;
    let n = 0;

    CORRECCIONES.forEach(([roto, bueno]) => {
      const partes = texto.split(roto);

      if (partes.length > 1) {
        n += partes.length - 1;
        texto = partes.join(bueno);
      }
    });

    if (texto !== original) {
      fs.writeFileSync(ruta, texto, "utf8");
      cambiados += 1;
      sustituciones += n;
      console.log(`  ${nombre}: ${n} correcciones`);
    }
  });

console.log(
  cambiados
    ? `\n${cambiados} archivos, ${sustituciones} textos corregidos.`
    : "\nNo habia texto danado que corregir."
);
