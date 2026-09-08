/* =========================
   PASAR LOS DATOS DE LOS ARCHIVOS JSON A MONGODB

   Se ejecuta con:  npm run migrar-mongo

   Que hace:

   1) Lee las colecciones de data/*.json
   2) Las mete en MongoDB, en la base que indique MONGODB_URI
   3) COMPARA los dos lados documento a documento y avisa si algo no
      cuadra

   Es seguro ejecutarlo varias veces: usa el campo "id" de siempre como
   clave, asi que un documento que ya existe se actualiza en vez de
   duplicarse.

   NO borra nada de data/. Los archivos JSON se quedan donde estan como
   respaldo. Si algo sale mal, basta con quitar MONGODB_URI del .env
   para volver a ellos.

   El paso 3 es el importante: no basta con "no dio error". Cuenta los
   documentos de los dos lados y ademas compara el contenido de cada
   uno, porque una insercion puede colarse a medias sin quejarse.
========================= */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { DATA_DIR } = require("../lib/paths");
const mongo = require("../lib/store-mongo");

const COLECCIONES = [
  "users",
  "ads",
  "orders",
  "sales",
  "favoritos",
  "login-activity",
  "comentarios",
  "resolution-cases",
  "solicitudes-datos"
];

/* Campos que anade la propia migracion y no estaban en el JSON: se
   excluyen de la comparacion para no dar falsos avisos. */
const IGNORAR = new Set(["_id"]);

function leerJson(nombre) {
  const file = path.join(DATA_DIR, `${nombre}.json`);

  if (!fs.existsSync(file)) return [];

  const texto = fs.readFileSync(file, "utf8").trim();

  if (!texto) return [];

  const datos = JSON.parse(texto);

  return Array.isArray(datos) ? datos : [];
}

function normalizar(doc) {
  const salida = {};

  Object.keys(doc)
    .filter(k => !IGNORAR.has(k))
    .sort()
    .forEach(k => {
      salida[k] = doc[k];
    });

  return JSON.stringify(salida);
}

(async () => {
  console.log("\n=== JSON -> MONGODB ===\n");

  if (!process.env.MONGODB_URI) {
    console.error(
      "Falta MONGODB_URI en el .env.\n\n" +
        "Ejemplo para MongoDB en tu propio ordenador:\n" +
        "  MONGODB_URI=mongodb://127.0.0.1:27017/marketplace\n\n" +
        "Ejemplo para MongoDB Atlas (gratis, en la nube):\n" +
        "  MONGODB_URI=mongodb+srv://usuario:clave@servidor/marketplace\n"
    );
    process.exit(1);
  }

  const { destino } = await mongo.conectar();

  console.log(`Base de datos: ${destino}\n`);

  const resumen = [];
  let problemas = 0;

  for (const nombre of COLECCIONES) {
    const documentos = leerJson(nombre);

    if (documentos.length === 0) {
      /* Se crea igual la coleccion vacia, para que los indices existan */
      await mongo.count(nombre);
      resumen.push({ nombre, json: 0, mongo: await mongo.count(nombre) });
      continue;
    }

    /* Sin id no se puede identificar el documento: se avisa y se para,
       antes que meter datos que luego no se pueden actualizar */
    const sinId = documentos.filter(d => d.id === undefined || d.id === null);

    if (sinId.length > 0) {
      console.error(
        `ERROR en ${nombre}: ${sinId.length} documentos sin campo "id". ` +
          "Ejecuta antes: npm run migrar"
      );
      problemas += 1;
      continue;
    }

    const operaciones = documentos.map(doc => ({
      replaceOne: {
        filter: { id: doc.id },
        replacement: { ...doc },
        upsert: true
      }
    }));

    const res = await mongo._db()
      .collection(nombre)
      .bulkWrite(operaciones, { ordered: false });

    const enMongo = await mongo.count(nombre);

    resumen.push({
      nombre,
      json: documentos.length,
      mongo: enMongo,
      nuevos: res.upsertedCount,
      actualizados: res.modifiedCount
    });
  }

  /* =========================
     COMPROBACION REAL
  ========================= */

  console.log("COMPROBACION documento a documento:\n");

  for (const { nombre, json, mongo: enMongo } of resumen) {
    const origen = leerJson(nombre);
    const destinoDocs = await mongo.read(nombre);

    const porId = new Map(destinoDocs.map(d => [String(d.id), d]));

    const faltan = [];
    const distintos = [];

    origen.forEach(doc => {
      const copia = porId.get(String(doc.id));

      if (!copia) {
        faltan.push(doc.id);
      } else if (normalizar(doc) !== normalizar(copia)) {
        distintos.push(doc.id);
      }
    });

    const ok = faltan.length === 0 && distintos.length === 0 && json <= enMongo;

    console.log(
      `  ${ok ? "OK  " : "MAL "} ${nombre.padEnd(20)}` +
        `json: ${String(json).padStart(4)}   mongo: ${String(enMongo).padStart(4)}`
    );

    if (faltan.length) {
      console.log(`         NO LLEGARON ${faltan.length}: ${faltan.slice(0, 5).join(", ")}`);
      problemas += 1;
    }

    if (distintos.length) {
      console.log(
        `         LLEGARON CAMBIADOS ${distintos.length}: ${distintos.slice(0, 5).join(", ")}`
      );
      problemas += 1;
    }
  }

  await mongo.cerrar();

  if (problemas > 0) {
    console.error(
      `\nLA MIGRACION TIENE ${problemas} PROBLEMAS. Los archivos de data/ ` +
        "siguen intactos:\nquita MONGODB_URI del .env para volver a ellos " +
        "mientras se revisa.\n"
    );
    process.exit(1);
  }

  console.log(
    "\n=== MIGRACION CORRECTA ===\n" +
      "Todos los documentos estan en MongoDB y coinciden uno a uno con\n" +
      "los archivos JSON. Los archivos de data/ se quedan como respaldo.\n"
  );
})().catch(async error => {
  console.error("\nFALLO LA MIGRACION:", error.message);
  await mongo.cerrar().catch(() => {});
  process.exit(1);
});
