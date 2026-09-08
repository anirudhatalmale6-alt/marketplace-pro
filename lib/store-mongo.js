/* =========================
   MOTOR DE DATOS: MONGODB

   Ofrece EXACTAMENTE los mismos metodos que lib/store-json.js. Las
   rutas no saben cual de los dos hay debajo: se elige en lib/store.js
   segun haya o no MONGODB_URI en el .env.

   Notas de diseno:

   - Se usa el driver oficial de mongodb, no mongoose. El proyecto
     guarda documentos con forma libre (los pedidos antiguos no tienen
     los mismos campos que los nuevos) y un esquema estricto de
     mongoose rechazaria datos que ya existen.

   - El campo "id" numerico de siempre SE MANTIENE y lleva indice
     unico. Asi los enlaces, los favoritos y los pedidos antiguos
     siguen apuntando a lo mismo. Mongo anade su propio _id, que no se
     devuelve nunca al navegador.

   - descontar() es la operacion importante: descuenta stock en UNA
     sola instruccion atomica de la base de datos. Con archivos JSON
     eso solo estaba garantizado dentro de un proceso; aqui lo esta
     aunque haya varios servidores a la vez.
========================= */

const { MongoClient } = require("mongodb");

let cliente = null;
let db = null;

/* Colecciones y sus indices */
const INDICES = {
  users: [
    [{ id: 1 }, { unique: true }],
    [{ email: 1 }, { unique: true }],
    [{ username: 1 }, { unique: true, sparse: true }]
  ],
  ads: [
    [{ id: 1 }, { unique: true }],
    [{ sellerEmail: 1 }, {}],
    [{ categoria: 1 }, {}],
    [{ price: 1 }, {}],
    [{ createdAt: -1 }, {}],
    /* Busqueda por texto en titulo y descripcion */
    [{ title: "text", description: "text" }, { default_language: "spanish" }]
  ],
  orders: [
    [{ id: 1 }, { unique: true }],
    [{ comprador: 1 }, {}],
    [{ vendedor: 1 }, {}],
    [{ fecha: -1 }, {}]
  ],
  sales: [
    [{ id: 1 }, { unique: true }],
    [{ vendedor: 1 }, {}],
    [{ orderId: 1 }, {}]
  ],
  favoritos: [
    [{ id: 1 }, { unique: true }],
    [{ email: 1, adId: 1 }, { unique: true }]
  ],
  "login-activity": [[{ id: 1 }, { unique: true }], [{ email: 1 }, {}]],
  comentarios: [
    [{ id: 1 }, { unique: true }],
    [{ vendedor: 1 }, {}],
    [{ email: 1 }, {}]
  ],
  "resolution-cases": [[{ id: 1 }, { unique: true }], [{ email: 1 }, {}]],
  "solicitudes-datos": [[{ id: 1 }, { unique: true }], [{ email: 1 }, {}]]
};

const COLECCIONES = Object.keys(INDICES);

/* =========================
   CONEXION
========================= */

async function conectar() {
  if (db) return { motor: "mongodb", destino: db.databaseName };

  const uri = process.env.MONGODB_URI;

  if (!uri) throw new Error("Falta MONGODB_URI");

  cliente = new MongoClient(uri, {
    /* Si la base no responde, mejor fallar rapido que dejar al
       usuario esperando 30 segundos delante de una pantalla en blanco */
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 20
  });

  await cliente.connect();

  db = cliente.db(process.env.MONGODB_DB || undefined);

  /* Comprobacion real: connect() no siempre habla con el servidor */
  await db.command({ ping: 1 });

  await crearIndices();

  return { motor: "mongodb", destino: db.databaseName };
}

async function crearIndices() {
  for (const [coleccion, indices] of Object.entries(INDICES)) {
    for (const [campos, opciones] of indices) {
      try {
        await db.collection(coleccion).createIndex(campos, opciones);
      } catch (error) {
        /* Un indice unico puede fallar si los datos que ya hay tienen
           duplicados. Se avisa pero no se tumba el servidor: es mejor
           arrancar sin ese indice que no arrancar. */
        console.warn(
          `Aviso: no se pudo crear el indice ${JSON.stringify(campos)} en ` +
            `"${coleccion}": ${error.message}`
        );
      }
    }
  }
}

async function cerrar() {
  if (cliente) await cliente.close();
  cliente = null;
  db = null;
}

function col(name) {
  if (!db) throw new Error("MongoDB no esta conectado todavia");
  return db.collection(name);
}

/* Mongo anade _id a cada documento. Fuera de esta capa nadie debe
   verlo: el resto del proyecto trabaja con el "id" numerico. */
function limpiar(doc) {
  if (!doc) return doc;
  const { _id, ...resto } = doc;
  return resto;
}

/* =========================
   LECTURA
========================= */

async function read(name) {
  const docs = await col(name).find({}).toArray();
  return docs.map(limpiar);
}

async function find(name, predicado) {
  /* Compatibilidad con el codigo que pasa una funcion JavaScript.
     No se puede mandar a la base de datos, asi que se filtra aqui.
     Las rutas importantes usan findOne(), que si consulta con indice. */
  const lista = await read(name);
  return lista.find(predicado) || null;
}

async function filter(name, predicado) {
  const lista = await read(name);
  return lista.filter(predicado);
}

async function findOne(name, filtro) {
  return limpiar(await col(name).findOne(filtro));
}

async function findMany(name, filtro = {}, opciones = {}) {
  let cursor = col(name).find(filtro);

  if (opciones.orden) cursor = cursor.sort(opciones.orden);
  if (opciones.saltar) cursor = cursor.skip(opciones.saltar);
  if (opciones.limite) cursor = cursor.limit(opciones.limite);

  return (await cursor.toArray()).map(limpiar);
}

async function count(name, filtro = {}) {
  return col(name).countDocuments(filtro);
}

/* =========================
   ESCRITURA
========================= */

async function insert(name, doc) {
  await col(name).insertOne({ ...doc });
  return doc;
}

const insertOne = insert;

async function updateOne(name, filtro, cambios) {
  const res = await col(name).findOneAndUpdate(
    filtro,
    { $set: cambios },
    { returnDocument: "after" }
  );

  return limpiar(res && res.value ? res.value : res);
}

async function deleteMany(name, filtro) {
  const res = await col(name).deleteMany(filtro);
  return res.deletedCount;
}

/* Resta condicional ATOMICA.

   Toda la comprobacion y el descuento ocurren en la base de datos en
   una sola operacion: si dos personas compran la ultima unidad a la
   vez, una de las dos recibe null. No hay forma de vender de mas. */
async function descontar(name, filtro, campo, cantidad) {
  const res = await col(name).findOneAndUpdate(
    { ...filtro, [campo]: { $gte: cantidad } },
    { $inc: { [campo]: -cantidad } },
    { returnDocument: "after" }
  );

  const doc = res && res.value !== undefined ? res.value : res;

  return limpiar(doc);
}

/* =========================
   COMPATIBILIDAD: read + modificar + guardar

   Las rutas antiguas hacen store.update(nombre, lista => {...}).
   Aqui se lee la coleccion, se deja que la modifiquen, y despues se
   guarda SOLO lo que cambio (comparando por "id"), en vez de borrar y
   reescribir la coleccion entera.

   Se mantiene la cola por coleccion para que dos peticiones del mismo
   proceso no se pisen.
========================= */

const SIN_CAMBIOS = Symbol("sin-cambios");

const colas = new Map();

function withLock(name, fn) {
  const previo = colas.get(name) || Promise.resolve();
  const actual = previo.then(fn, fn);

  colas.set(
    name,
    actual.catch(() => {})
  );

  return actual;
}

async function update(name, mutar) {
  return withLock(name, async () => {
    const antes = await read(name);

    /* Copia profunda para poder comparar despues */
    const original = new Map(
      antes.map(d => [String(d.id), JSON.stringify(d)])
    );

    const lista = JSON.parse(JSON.stringify(antes));

    const resultado = await mutar(lista);

    if (resultado === SIN_CAMBIOS) return resultado;

    const operaciones = [];
    const vistos = new Set();

    lista.forEach(doc => {
      const clave = String(doc.id);
      vistos.add(clave);

      const anterior = original.get(clave);

      if (anterior === undefined) {
        operaciones.push({ insertOne: { document: { ...doc } } });
      } else if (anterior !== JSON.stringify(doc)) {
        operaciones.push({
          replaceOne: { filter: { id: doc.id }, replacement: { ...doc } }
        });
      }
    });

    original.forEach((_, clave) => {
      if (!vistos.has(clave)) {
        const id = antes.find(d => String(d.id) === clave).id;
        operaciones.push({ deleteOne: { filter: { id } } });
      }
    });

    if (operaciones.length > 0) {
      await col(name).bulkWrite(operaciones, { ordered: true });
    }

    return resultado;
  });
}

async function write(name, datos) {
  return withLock(name, async () => {
    await col(name).deleteMany({});
    if (datos.length > 0) {
      await col(name).insertMany(datos.map(d => ({ ...d })));
    }
  });
}

/* =========================
   IDENTIFICADORES
========================= */

let ultimoId = 0;

function nuevoId() {
  const ahora = Date.now();
  ultimoId = ahora > ultimoId ? ahora : ultimoId + 1;
  return ultimoId;
}

module.exports = {
  motor: "mongodb",

  read,
  write,
  update,
  find,
  filter,
  insert,
  nuevoId,
  SIN_CAMBIOS,

  findOne,
  findMany,
  count,
  insertOne,
  updateOne,
  deleteMany,
  descontar,

  conectar,
  cerrar,

  COLECCIONES,
  _db: () => db
};
