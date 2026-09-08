/* =========================
   CAPA DE ACCESO A DATOS

   Todo el resto del proyecto pide y guarda datos SOLO a traves de este
   archivo. Ninguna ruta vuelve a llamar a fs.readFileSync directamente.

   Por que:

   1) Antes, cada ruta hacia readFileSync + writeFileSync del archivo
      completo. Dos peticiones a la vez leian la misma version y la
      segunda pisaba a la primera: se perdian pedidos y usuarios.
      Aqui cada coleccion tiene una cola: las escrituras se hacen una
      detras de otra, nunca a la vez.

   2) La escritura es atomica (se escribe un archivo temporal y despues
      se renombra). Si el servidor se cae a mitad de un guardado, el
      archivo original queda intacto en vez de quedar corrupto.

   3) Cuando pasemos a MongoDB solo hay que cambiar ESTE archivo.
      Las rutas no se tocan.
========================= */

const fs = require("fs/promises");
const fssync = require("fs");
const path = require("path");
const { DATA_DIR } = require("./paths");

/* Colas de escritura, una por coleccion */
const locks = new Map();

function withLock(name, fn) {
  const previo = locks.get(name) || Promise.resolve();

  const actual = previo.then(fn, fn);

  /* La cola no debe romperse si una operacion falla */
  locks.set(
    name,
    actual.catch(() => {})
  );

  return actual;
}

function archivoDe(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

if (!fssync.existsSync(DATA_DIR)) {
  fssync.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================
   LECTURA
========================= */

async function read(name) {
  const file = archivoDe(name);

  try {
    const texto = await fs.readFile(file, "utf8");

    if (!texto.trim()) return [];

    const datos = JSON.parse(texto);

    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    /* La coleccion todavia no existe: no es un error */
    if (error.code === "ENOENT") return [];

    /* JSON corrupto: avisar fuerte en vez de devolver [] en silencio,
       porque devolver vacio haria que el servidor "pierda" los datos */
    throw new Error(
      `La coleccion "${name}" no se pudo leer (${error.message})`
    );
  }
}

/* =========================
   ESCRITURA ATOMICA
========================= */

async function writeAtomic(name, datos) {
  const file = archivoDe(name);
  const tmp = `${file}.tmp`;

  await fs.writeFile(tmp, JSON.stringify(datos, null, 2), "utf8");
  await fs.rename(tmp, file);
}

async function write(name, datos) {
  return withLock(name, () => writeAtomic(name, datos));
}

/* =========================
   LEER + MODIFICAR + GUARDAR
   (todo dentro del mismo turno de la cola)

   mutar(lista) puede devolver cualquier cosa: eso es lo que recibe
   quien llamo. Si devuelve el simbolo SIN_CAMBIOS no se escribe nada.
========================= */

const SIN_CAMBIOS = Symbol("sin-cambios");

async function update(name, mutar) {
  return withLock(name, async () => {
    const lista = await read(name);

    const resultado = await mutar(lista);

    if (resultado === SIN_CAMBIOS) return resultado;

    await writeAtomic(name, lista);

    return resultado;
  });
}

/* =========================
   AYUDAS DE USO FRECUENTE
========================= */

async function find(name, predicado) {
  const lista = await read(name);
  return lista.find(predicado) || null;
}

async function filter(name, predicado) {
  const lista = await read(name);
  return lista.filter(predicado);
}

/* =========================
   CLAVES UNICAS

   MongoDB tiene indices unicos que rechazan un duplicado aunque dos
   peticiones lleguen en el mismo instante. Aqui no hay indices, asi
   que la comprobacion se hace a mano DENTRO de la cola de escritura y
   se lanza el mismo error (code 11000) que lanzaria MongoDB.

   Es importante que los dos motores fallen igual: si no, el codigo de
   las rutas tendria que saber cual esta debajo, y una prueba que pasa
   con archivos podria fallar en produccion. */
const UNICOS = {
  users: [["id"], ["email"], ["username"]],
  ads: [["id"]],
  orders: [["id"]],
  sales: [["id"]],
  favoritos: [["id"], ["email", "adId"]],
  "login-activity": [["id"]],
  comentarios: [["id"]],
  "resolution-cases": [["id"]],
  "solicitudes-datos": [["id"]]
};

function errorDuplicado(campos) {
  const error = new Error(
    `Ya existe un registro con el mismo ${campos.join(" + ")}`
  );
  error.code = 11000;
  return error;
}

function comprobarUnicos(name, lista, doc) {
  (UNICOS[name] || []).forEach(campos => {
    /* Un campo vacio no cuenta como duplicado (equivale al indice
       "sparse" de MongoDB): si dos usuarios no tienen username, no se
       consideran repetidos entre si. */
    if (campos.some(c => doc[c] === undefined || doc[c] === null)) return;

    const choca = lista.some(d => campos.every(c => d[c] === doc[c]));

    if (choca) throw errorDuplicado(campos);
  });
}

async function insert(name, doc) {
  return update(name, lista => {
    comprobarUnicos(name, lista, doc);

    lista.push(doc);
    return doc;
  });
}

/* Identificadores unicos.

   Antes se usaba Date.now() como id: dos anuncios (o dos pedidos)
   creados en el mismo milisegundo recibian el MISMO id.

   Se mantiene el formato numerico de 13 digitos para no romper los
   datos que ya existen, pero si el reloj devuelve un valor ya usado se
   avanza uno. Asi nunca se repite dentro del proceso. */
let ultimoId = 0;

function nuevoId() {
  const ahora = Date.now();

  ultimoId = ahora > ultimoId ? ahora : ultimoId + 1;

  return ultimoId;
}

/* =========================
   API DE CONSULTA

   Estos metodos existen igual en el motor de MongoDB. Las rutas los
   usan sin saber cual de los dos hay detras.

   El "filtro" es un objeto sencillo: { campo: valor }. En MongoDB se
   traduce a una consulta real (con indice); aqui se recorre la lista.
   Se admite ademas { campo: { $in: [...] } } y { campo: { $gte: n } }
   porque son los unicos operadores que necesita el proyecto.
========================= */

function coincide(doc, filtro) {
  return Object.entries(filtro || {}).every(([campo, esperado]) => {
    const valor = doc[campo];

    if (esperado && typeof esperado === "object" && !Array.isArray(esperado)) {
      if ("$in" in esperado) return esperado.$in.includes(valor);
      if ("$gte" in esperado) return Number(valor) >= Number(esperado.$gte);
      if ("$ne" in esperado) return valor !== esperado.$ne;
    }

    return valor === esperado;
  });
}

async function findOne(name, filtro) {
  const lista = await read(name);
  return lista.find(d => coincide(d, filtro)) || null;
}

async function findMany(name, filtro = {}, opciones = {}) {
  let lista = (await read(name)).filter(d => coincide(d, filtro));

  const { orden, limite, saltar } = opciones;

  if (orden) {
    const [campo, dir] = Object.entries(orden)[0];

    lista.sort((a, b) => {
      const x = a[campo];
      const y = b[campo];

      /* Las fechas van como texto ISO, que se ordena bien alfabeticamente */
      if (x === y) return 0;
      return (x > y ? 1 : -1) * (dir === -1 ? -1 : 1);
    });
  }

  if (saltar) lista = lista.slice(saltar);
  if (limite) lista = lista.slice(0, limite);

  return lista;
}

async function count(name, filtro = {}) {
  return (await read(name)).filter(d => coincide(d, filtro)).length;
}

async function insertOne(name, doc) {
  return insert(name, doc);
}

async function updateOne(name, filtro, cambios) {
  return update(name, lista => {
    const i = lista.findIndex(d => coincide(d, filtro));

    if (i === -1) return null;

    Object.assign(lista[i], cambios);

    return lista[i];
  });
}

async function deleteMany(name, filtro) {
  return update(name, lista => {
    let n = 0;

    for (let i = lista.length - 1; i >= 0; i -= 1) {
      if (coincide(lista[i], filtro)) {
        lista.splice(i, 1);
        n += 1;
      }
    }

    return n;
  });
}

/* Resta condicional: solo descuenta si queda suficiente.

   Devuelve el documento ya actualizado, o null si no habia bastante.
   En MongoDB esto es una sola operacion atomica; aqui se apoya en la
   cola de escritura, que dentro de un proceso da la misma garantia. */
async function descontar(name, filtro, campo, cantidad) {
  return update(name, lista => {
    const i = lista.findIndex(d => coincide(d, filtro));

    if (i === -1) return null;

    const actual = Number(lista[i][campo]) || 0;

    if (actual < cantidad) return null;

    lista[i][campo] = actual - cantidad;

    return lista[i];
  });
}

/* El motor JSON no necesita conectar ni cerrar nada */
async function conectar() {
  return { motor: "json", destino: DATA_DIR };
}

async function cerrar() {}

module.exports = {
  motor: "json",

  read,
  write,
  update,
  find,
  filter,
  insert,
  nuevoId,
  SIN_CAMBIOS,
  DATA_DIR,

  findOne,
  findMany,
  count,
  insertOne,
  updateOne,
  deleteMany,
  descontar,

  conectar,
  cerrar
};
