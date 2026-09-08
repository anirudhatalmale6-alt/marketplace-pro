/* =========================
   REGISTRO, LOGIN, SESION Y CUENTA
========================= */

const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const store = require("../lib/store");
const {
  normalizarEmail,
  firmarToken,
  ponerCookie,
  quitarCookie,
  requireAuth,
  optionalAuth,
  usuarioPropio
} = require("../lib/auth");

const router = express.Router();

const RONDAS_BCRYPT = 12;

/* =========================
   LIMITE DE INTENTOS

   Antes se podia probar contrasenas sin ningun limite.
========================= */

/* Configurable desde .env: en produccion 10 esta bien, pero mientras
   se prueba el sitio uno mismo se queda fuera enseguida. */
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_MAX_INTENTOS) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiados intentos. Espera 15 minutos e intenta de nuevo."
  }
});

const limiteRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas cuentas creadas desde aqui. Intenta mas tarde."
  }
});

/* =========================
   USERNAME AUTOMATICO
========================= */

async function generarUsername(base) {
  const limpio = String(base || "usuario")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20) || "usuario";

  let candidato = limpio;
  let n = 0;

  /* Antes se anadia un numero al azar y podia repetirse.

     Se pregunta a la base de datos por cada candidato (consulta con
     indice) en vez de traerse la lista completa de usuarios solo para
     saber que nombres estan cogidos. */
  /* eslint-disable no-await-in-loop */
  while (await store.findOne("users", { username: candidato })) {
    n += 1;
    candidato = `${limpio}${n}`;

    /* Salvaguarda: si algo va muy mal, no dar vueltas para siempre */
    if (n > 500) {
      candidato = `${limpio}${store.nuevoId()}`;
      break;
    }
  }
  /* eslint-enable no-await-in-loop */

  return candidato;
}

const TIPOS_CUENTA = ["personal", "business"];

/* =========================
   REGISTRO
========================= */

router.post("/register", limiteRegistro, async (req, res, next) => {
  try {
    const data = req.body || {};

    const accountType = String(data.accountType || "").toLowerCase();
    const email = normalizarEmail(data.email);
    const password = String(data.password || "");
    const telefono = String(data.telefono || "").trim();

    if (!accountType || !email || !password) {
      return res.status(400).json({ message: "Campos obligatorios faltantes" });
    }

    if (!TIPOS_CUENTA.includes(accountType)) {
      return res.status(400).json({
        message: "El tipo de cuenta debe ser personal o business"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ message: "Correo invalido" });
    }

    if (!/^[0-9]{7,15}$/.test(telefono)) {
      return res.status(400).json({ message: "Telefono invalido" });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "La contrasena debe tener minimo 8 caracteres"
      });
    }

    /* Comprobaciones que dependen del tipo de cuenta, antes de gastar
       tiempo cifrando la contrasena */
    if (accountType === "personal" && (!data.nombre || !data.apellido)) {
      return res.status(400).json({ message: "Nombre y apellido requeridos" });
    }

    if (
      accountType === "business" &&
      (!data.businessName || !data.documentType || !data.documentNumber)
    ) {
      return res.status(400).json({ message: "Datos del negocio incompletos" });
    }

    if (await store.findOne("users", { email })) {
      return res.status(400).json({ message: "El usuario ya existe" });
    }

    const hashedPassword = await bcrypt.hash(password, RONDAS_BCRYPT);

    const base = {
      id: store.nuevoId(),
      accountType,
      email,
      password: hashedPassword,
      telefono,
      country: data.country || "",
      state: data.state || "",
      city: data.city || "",
      sector: data.sector || "",
      address: data.address || "",
      zip: data.zip || "",
      reference: data.reference || "",
      rating: 0,
      totalSales: 0,
      createdAt: new Date().toISOString()
    };

    const nuevo =
      accountType === "personal"
        ? {
            ...base,
            nombre: String(data.nombre).trim(),
            apellido: String(data.apellido).trim(),
            username: await generarUsername(`${data.nombre}${data.apellido}`)
          }
        : {
            ...base,
            nombre: String(data.nombre || "").trim(),
            apellido: String(data.apellido || "").trim(),
            businessName: String(data.businessName).trim(),
            documentType: data.documentType,
            documentNumber: data.documentNumber,
            username: await generarUsername(data.businessName)
          };

    try {
      await store.insertOne("users", nuevo);
    } catch (error) {
      /* La comprobacion de arriba deja pasar el caso de dos registros
         con el mismo correo EN EL MISMO INSTANTE. Quien decide de
         verdad es el indice unico de la base de datos, que rechaza el
         segundo. Aqui se traduce ese rechazo a un mensaje normal. */
      if (error && error.code === 11000) {
        return res.status(400).json({ message: "El usuario ya existe" });
      }
      throw error;
    }

    /* Al registrarse ya queda la sesion abierta */
    ponerCookie(res, firmarToken(nuevo));

    console.log("Usuario registrado:", email);

    res.status(201).json({
      message: "Registro exitoso",
      user: usuarioPropio(nuevo)
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   LOGIN
========================= */

router.post("/login", limiteLogin, async (req, res, next) => {
  try {
    const email = normalizarEmail(req.body && req.body.email);
    const password = String((req.body && req.body.password) || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Todos los campos son obligatorios"
      });
    }

    /* Consulta directa por indice, no recorriendo todos los usuarios */
    const user = await store.findOne("users", { email });

    /* Mismo mensaje exista o no el usuario, para no revelar que
       correos estan registrados */
    const generico = { message: "Correo o contrasena incorrectos" };

    if (!user) return res.status(401).json(generico);

    const guardada = String(user.password || "");

    /* Si por lo que sea quedara una contrasena sin cifrar, no se acepta
       la comparacion directa: se rechaza y se avisa en consola.
       El script scripts/migrar.js cifra las que estaban en texto plano. */
    if (!guardada.startsWith("$2")) {
      console.warn(
        "Contrasena sin cifrar en la cuenta:",
        user.email,
        "- ejecuta: npm run migrar"
      );
      return res.status(401).json(generico);
    }

    const passwordOk = await bcrypt.compare(password, guardada);

    if (!passwordOk) return res.status(401).json(generico);

    /* Actividad de inicio de sesion.

       Es una insercion suelta: antes se leia el historial ENTERO para
       anadir una linea, en cada login. */
    await store.insertOne("login-activity", {
      id: store.nuevoId(),
      email: normalizarEmail(user.email),
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
      fecha: new Date().toISOString()
    });

    ponerCookie(res, firmarToken(user));

    console.log("Usuario logueado:", user.email);

    res.json({
      message: "Inicio de sesion exitoso",
      user: usuarioPropio(user)
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   CERRAR SESION
========================= */

router.post("/logout", (req, res) => {
  quitarCookie(res);
  res.json({ message: "Sesion cerrada" });
});

/* =========================
   QUIEN SOY

   El frontend llama aqui al cargar cada pagina para saber si hay
   sesion, en vez de fiarse de lo que haya en localStorage.
========================= */

router.get("/me", optionalAuth, (req, res) => {
  /* Responde 200 tambien cuando NO hay sesion: "no estas logueado" es
     una respuesta valida, no un error. Devolver 401 aqui llenaba la
     consola del navegador de errores rojos en cada visita anonima. */
  if (!req.user) {
    return res.json({ autenticado: false, user: null });
  }

  res.json({ autenticado: true, user: usuarioPropio(req.user) });
});

/* =========================
   ACTIVIDAD DE LOGIN (solo la propia)
========================= */

router.get("/login-activity", requireAuth, async (req, res, next) => {
  try {
    const actividad = await store.findMany(
      "login-activity",
      { email: req.email },
      { orden: { fecha: -1 }, limite: 50 }
    );

    res.json(actividad);
  } catch (error) {
    next(error);
  }
});

/* =========================
   CAMBIAR CONTRASENA
========================= */

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String((req.body && req.body.currentPassword) || "");
    const newPassword = String((req.body && req.body.newPassword) || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Todos los campos son obligatorios"
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "La nueva contrasena debe tener minimo 8 caracteres"
      });
    }

    const guardada = String(req.user.password || "");

    const correcta = guardada.startsWith("$2")
      ? await bcrypt.compare(currentPassword, guardada)
      : false;

    if (!correcta) {
      return res.status(401).json({
        message: "La contrasena actual es incorrecta"
      });
    }

    if (await bcrypt.compare(newPassword, guardada)) {
      return res.status(400).json({
        message: "La nueva contrasena debe ser distinta de la actual"
      });
    }

    const hash = await bcrypt.hash(newPassword, RONDAS_BCRYPT);

    await store.updateOne(
      "users",
      { email: req.email },
      { password: hash, passwordChangedAt: new Date().toISOString() }
    );

    /* Al cambiar la contrasena se renueva el token */
    ponerCookie(res, firmarToken(req.user));

    res.json({ message: "Contrasena actualizada correctamente" });
  } catch (error) {
    next(error);
  }
});

/* =========================
   CERRAR CUENTA
========================= */

router.post("/close-account", requireAuth, async (req, res, next) => {
  try {
    const password = String((req.body && req.body.password) || "");

    if (!password) {
      return res.status(400).json({ message: "La contrasena es obligatoria" });
    }

    const guardada = String(req.user.password || "");

    const correcta = guardada.startsWith("$2")
      ? await bcrypt.compare(password, guardada)
      : false;

    if (!correcta) {
      return res.status(401).json({ message: "La contrasena es incorrecta" });
    }

    const email = req.email;

    await store.deleteMany("users", { email });
    await store.deleteMany("ads", { sellerEmail: email });
    await store.deleteMany("login-activity", { email });
    await store.deleteMany("favoritos", { email });

    /* Los pedidos y las ventas NO se borran: son el registro contable
       de la otra parte. Se marca la cuenta como eliminada. */
    for (const o of await store.findMany("orders", { comprador: email })) {
      /* eslint-disable no-await-in-loop */
      await store.updateOne("orders", { id: o.id }, { compradorEliminado: true });
      /* eslint-enable no-await-in-loop */
    }

    for (const o of await store.findMany("orders", { vendedor: email })) {
      /* eslint-disable no-await-in-loop */
      await store.updateOne("orders", { id: o.id }, { vendedorEliminado: true });
      /* eslint-enable no-await-in-loop */
    }

    quitarCookie(res);

    console.log("Cuenta eliminada:", email);

    res.json({ success: true, message: "Cuenta cerrada correctamente" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
