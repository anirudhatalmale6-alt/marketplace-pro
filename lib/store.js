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

async function insert(name, doc) {
  return update(name, lista => {
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

module.exports = {
  read,
  write,
  update,
  find,
  filter,
  insert,
  nuevoId,
  SIN_CAMBIOS,
  DATA_DIR
};
