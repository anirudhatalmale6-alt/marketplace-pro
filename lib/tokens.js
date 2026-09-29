/* =========================
   ENLACES DE UN SOLO USO

   Se usan para dos cosas: recuperar la contrasena y confirmar el
   correo al registrarse.

   Reglas de seguridad, y el motivo de cada una:

   1. El token se genera con crypto.randomBytes(32), no con Math.random
      ni con la fecha. Un token adivinable permite cambiarle la
      contrasena a otro.

   2. EN LA BASE DE DATOS SE GUARDA EL HASH, NO EL TOKEN. Si alguien
      llega a leer la tabla de usuarios, no puede usar lo que ve para
      entrar en ninguna cuenta. Es el mismo motivo por el que las
      contrasenas van cifradas.

   3. Caduca (1 hora para la contrasena, 24 para el correo).

   4. Un solo uso: al consumirlo se borra.

   5. Al cambiar la contrasena se invalidan todos los tokens de esa
      cuenta, no solo el usado.
========================= */

const crypto = require("crypto");

const store = require("./store");

const CADUCIDAD = {
  recuperacion: 60 * 60 * 1000, // 1 hora
  verificacion: 24 * 60 * 60 * 1000 // 1 dia
};

function hashear(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/* Crea un token, guarda su HASH y devuelve el token en claro.
   El token en claro solo existe aqui y en el correo: nunca se guarda. */
async function crear(email, tipo) {
  const token = crypto.randomBytes(32).toString("hex");

  /* Un solo enlace vivo por cuenta y tipo: si pide recuperar dos
     veces, el primero deja de valer */
  await store.deleteMany("tokens", { email, tipo });

  await store.insertOne("tokens", {
    id: store.nuevoId(),
    email,
    tipo,
    hash: hashear(token),
    caduca: Date.now() + (CADUCIDAD[tipo] || CADUCIDAD.recuperacion),
    createdAt: new Date().toISOString()
  });

  return token;
}

/* Comprueba un token y lo CONSUME. Devuelve el email o null. */
async function consumir(token, tipo) {
  if (!token || typeof token !== "string") return null;

  const guardado = await store.findOne("tokens", {
    hash: hashear(token),
    tipo
  });

  if (!guardado) return null;

  /* Caducado: se borra igualmente para no dejar basura */
  if (Number(guardado.caduca) < Date.now()) {
    await store.deleteMany("tokens", { id: guardado.id });
    return null;
  }

  await store.deleteMany("tokens", { id: guardado.id });

  return guardado.email;
}

/* Al cambiar la contrasena se anulan los enlaces de RECUPERACION que
   quedaran vivos, para que un enlace pedido antes no sirva despues.

   OJO: solo los de recuperacion, no todos.

   Antes borraba todos los de la cuenta y eso se cargaba el enlace de
   confirmar el correo que se manda al registrarse. Resultado: quien se
   registraba y despues recuperaba la contrasena, al pinchar el enlace
   de confirmacion del correo de bienvenida se encontraba "este enlace
   ya no vale", sin haber hecho nada mal.

   Y no aporta seguridad: un enlace de verificacion solo sirve para
   marcar un correo como confirmado, no para entrar en la cuenta. */
async function invalidarRecuperaciones(email) {
  return store.deleteMany("tokens", { email, tipo: "recuperacion" });
}

/* Limpieza de los caducados. Se llama de vez en cuando desde el
   servidor: si no, la coleccion crece sola para siempre. */
async function limpiarCaducados() {
  const todos = await store.read("tokens");

  const ahora = Date.now();
  let borrados = 0;

  for (const t of todos) {
    if (Number(t.caduca) < ahora) {
      /* eslint-disable no-await-in-loop */
      await store.deleteMany("tokens", { id: t.id });
      /* eslint-enable no-await-in-loop */
      borrados += 1;
    }
  }

  return borrados;
}

module.exports = {
  crear,
  consumir,
  invalidarRecuperaciones,
  limpiarCaducados,
  CADUCIDAD
};
