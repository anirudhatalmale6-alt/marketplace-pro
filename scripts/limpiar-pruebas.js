/* =========================
   BORRAR LOS DATOS DE PRUEBA

   Se ejecuta con:  npm run limpiar-pruebas

   Las pruebas (npm test) crean usuarios y pedidos falsos sobre los
   datos reales. Este script los quita: borra las cuentas cuyo correo
   coincide con los patrones de prueba y todo lo que colgaba de ellas.

   No toca ninguna cuenta real.
========================= */

const fs = require("fs");
const path = require("path");
const { DATA_DIR } = require("../lib/paths");

/* Correos que solo usan las pruebas */
const PATRONES = [
  /^prueba\.mayus\d+@gmail\.com$/i,
  /^prueba\.auditoria@/i,
  /^vendedor\d+@test\.com$/i,
  /@t\.com$/i
];

const esPrueba = correo => PATRONES.some(p => p.test(String(correo || "")));

function leer(nombre) {
  const file = path.join(DATA_DIR, `${nombre}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function guardar(nombre, datos) {
  fs.writeFileSync(
    path.join(DATA_DIR, `${nombre}.json`),
    JSON.stringify(datos, null, 2),
    "utf8"
  );
}

const users = leer("users");
const correosPrueba = new Set(
  users.filter(u => esPrueba(u.email)).map(u => u.email)
);

if (correosPrueba.size === 0) {
  console.log("\nNo hay cuentas de prueba que borrar.\n");
  process.exit(0);
}

console.log(`\nCuentas de prueba: ${[...correosPrueba].join(", ")}\n`);

guardar("users", users.filter(u => !correosPrueba.has(u.email)));

const ads = leer("ads");
const adsPrueba = new Set(
  ads.filter(a => correosPrueba.has(a.sellerEmail)).map(a => Number(a.id))
);

guardar("ads", ads.filter(a => !correosPrueba.has(a.sellerEmail)));
console.log(`  ads: ${adsPrueba.size} anuncios de prueba borrados`);

/* Los pedidos de prueba descontaron stock de anuncios REALES.
   Al borrarlos hay que devolver ese stock, o cada vez que se corren
   las pruebas los productos del cliente pierden unidades para siempre. */
const orders = leer("orders");

const pedidosPrueba = orders.filter(
  o => correosPrueba.has(o.comprador) || correosPrueba.has(o.vendedor)
);

const devolver = new Map();

pedidosPrueba
  /* Un pedido cancelado ya devolvio su stock: no se cuenta dos veces */
  .filter(o => String(o.estado).toLowerCase() !== "cancelado")
  .forEach(o => {
    (o.productos || []).forEach(p => {
      const id = Number(p.adId);
      if (!id) return;
      devolver.set(id, (devolver.get(id) || 0) + (Number(p.cantidad) || 0));
    });
  });

if (devolver.size > 0) {
  const adsActuales = leer("ads");

  devolver.forEach((unidades, id) => {
    const ad = adsActuales.find(a => Number(a.id) === id);

    /* Si el anuncio era de prueba ya se ha borrado: nada que devolver */
    if (!ad) return;

    ad.cantidad = (Number(ad.cantidad) || 0) + unidades;
    console.log(
      `  stock devuelto: "${ad.title}" +${unidades} (queda ${ad.cantidad})`
    );
  });

  guardar("ads", adsActuales);
}

["orders", "sales"].forEach(nombre => {
  const lista = leer(nombre);

  const limpio = lista.filter(
    x => !correosPrueba.has(x.comprador) && !correosPrueba.has(x.vendedor)
  );

  console.log(`  ${nombre}: ${lista.length} -> ${limpio.length}`);
  guardar(nombre, limpio);
});

[
  "favoritos",
  "comentarios",
  "login-activity",
  "resolution-cases",
  "solicitudes-datos"
].forEach(nombre => {
  const lista = leer(nombre);

  const limpio = lista.filter(
    x =>
      !correosPrueba.has(x.email) &&
      !correosPrueba.has(x.vendedor) &&
      !adsPrueba.has(Number(x.adId))
  );

  if (lista.length !== limpio.length) {
    console.log(`  ${nombre}: ${lista.length} -> ${limpio.length}`);
  }

  guardar(nombre, limpio);
});

console.log("\nDatos de prueba eliminados.\n");
