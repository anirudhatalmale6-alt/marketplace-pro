/* =========================
   REGISTRO, LOGIN, SESION Y CUENTA
========================= */

const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const store = require("../lib/store");
const correo = require("../lib/correo");
const tokens = require("../lib/tokens");
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

/* Tambien configurable: al pasar las pruebas se crean muchas cuentas
   seguidas y el limite de produccion las corta a mitad. */
const limiteRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.REGISTRO_MAX_CUENTAS) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas cuentas creadas desde aqui. Intenta mas tarde."
  }
});

/* Recuperar contrasena: limite aparte y mas estrecho.
   Sin esto se puede usar el formulario para inundar de correos el
   buzon de cualquiera cuyo correo se conozca. */
const limiteRecuperacion = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RECUPERACION_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Has pedido recuperar la contrasena demasiadas veces. Espera un rato."
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

    /* Correo de confirmacion.

       Si el envio falla, el registro NO se deshace: la cuenta ya
       existe y la persona ya esta dentro. Lo unico que pasa es que
       queda sin verificar y puede pedir el correo otra vez. */
    let avisoCorreo = null;

    try {
      const token = await tokens.crear(email, "verificacion");
      const plantilla = correo.correoVerificacion(
        nuevo.nombre || nuevo.businessName || email,
        token
      );

      const envio = await correo.enviar({
        para: email,
        asunto: plantilla.asunto,
        html: plantilla.html
      });

      if (!envio.enviado) avisoCorreo = "correo_no_enviado";
    } catch (error) {
      console.error("No se pudo mandar la verificacion:", error.message);
      avisoCorreo = "correo_no_enviado";
    }

    res.status(201).json({
      message: "Registro exitoso",
      user: usuarioPropio(nuevo),
      /* Honesto a proposito: si el correo no salio, el navegador se
         entera y puede decirselo al usuario en vez de mandarlo a
         mirar un buzon donde no hay nada. */
      verificacion: avisoCorreo ? "no_enviada" : "enviada"
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

/* =========================
   RECUPERAR CONTRASENA

   Antes NO EXISTIA: quien perdia la contrasena perdia la cuenta.

   Detalle importante: esta ruta responde SIEMPRE lo mismo, exista o no
   el correo. Si contestara distinto, cualquiera podria usarla para
   averiguar que correos estan registrados en el sitio.
========================= */

router.post("/forgot-password", limiteRecuperacion, async (req, res, next) => {
  try {
    const email = normalizarEmail(req.body && req.body.email);

    /* La misma respuesta pase lo que pase */
    const respuesta = {
      message:
        "Si ese correo tiene una cuenta, te acabamos de enviar un enlace " +
        "para cambiar la contrasena. Revisa tambien la carpeta de spam."
    };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.json(respuesta);
    }

    const user = await store.findOne("users", { email });

    /* No existe: se responde igual y no se hace nada mas */
    if (!user) {
      console.log("Recuperacion pedida para un correo que no existe:", email);
      return res.json(respuesta);
    }

    const token = await tokens.crear(email, "recuperacion");

    const plantilla = correo.correoRecuperacion(
      user.nombre || user.businessName || email,
      token
    );

    const envio = await correo.enviar({
      para: email,
      asunto: plantilla.asunto,
      html: plantilla.html
    });

    /* Si el correo no salio de verdad, se dice. En modo pruebas el
       enlace queda en data/correos.log. */
    if (!envio.enviado) {
      console.warn(
        `El correo de recuperacion para ${email} NO SE ENVIO ` +
          `(modo ${envio.modo}). El enlace esta en data/correos.log`
      );
    }

    res.json(respuesta);
  } catch (error) {
    next(error);
  }
});

/* =========================
   COMPROBAR SI UN ENLACE SIGUE VALIDO

   La pagina lo llama antes de ensenar el formulario, para no hacer
   escribir una contrasena nueva y decir despues que el enlace caduco.
========================= */

router.get("/reset-password/check", async (req, res, next) => {
  try {
    const token = String(req.query.token || "");

    if (!token) return res.status(400).json({ valido: false });

    const guardado = await store.findOne("tokens", {
      hash: require("crypto").createHash("sha256").update(token).digest("hex"),
      tipo: "recuperacion"
    });

    const valido = Boolean(guardado && Number(guardado.caduca) > Date.now());

    res.json({ valido });
  } catch (error) {
    next(error);
  }
});

/* =========================
   GUARDAR LA CONTRASENA NUEVA
========================= */

router.post("/reset-password", limiteRecuperacion, async (req, res, next) => {
  try {
    const token = String((req.body && req.body.token) || "");
    const nueva = String((req.body && req.body.password) || "");

    if (!token) {
      return res.status(400).json({ message: "Falta el enlace" });
    }

    if (nueva.length < 8) {
      return res.status(400).json({
        message: "La contrasena debe tener minimo 8 caracteres"
      });
    }

    /* consumir() comprueba, caduca y BORRA el token de una vez */
    const email = await tokens.consumir(token, "recuperacion");

    if (!email) {
      return res.status(400).json({
        message:
          "Este enlace ya no vale. Puede que haya caducado o que ya lo " +
          "hayas usado. Pide uno nuevo."
      });
    }

    const user = await store.findOne("users", { email });

    if (!user) {
      return res.status(400).json({ message: "Esa cuenta ya no existe" });
    }

    const hash = await bcrypt.hash(nueva, RONDAS_BCRYPT);

    await store.updateOne(
      "users",
      { email },
      { password: hash, passwordChangedAt: new Date().toISOString() }
    );

    /* Fuera los demas enlaces de recuperacion que quedaran vivos.
       El de confirmar el correo NO se toca: no es una credencial de
       acceso y anularlo solo molesta al usuario. */
    await tokens.invalidarRecuperaciones(email);

    console.log("Contrasena recuperada:", email);

    res.json({
      message: "Contrasena cambiada. Ya puedes iniciar sesion."
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   CONFIRMAR EL CORREO
========================= */

router.post("/verify-email", async (req, res, next) => {
  try {
    const token = String((req.body && req.body.token) || req.query.token || "");

    if (!token) {
      return res.status(400).json({ message: "Falta el enlace" });
    }

    const email = await tokens.consumir(token, "verificacion");

    if (!email) {
      return res.status(400).json({
        message:
          "Este enlace ya no vale. Entra en tu cuenta y pide que te lo " +
          "manden otra vez."
      });
    }

    await store.updateOne(
      "users",
      { email },
      { correoVerificado: true, verificadoEn: new Date().toISOString() }
    );

    console.log("Correo verificado:", email);

    res.json({ message: "Correo confirmado. Gracias." });
  } catch (error) {
    next(error);
  }
});

/* =========================
   REENVIAR LA CONFIRMACION
========================= */

router.post("/resend-verification", requireAuth, limiteRecuperacion,
  async (req, res, next) => {
    try {
      if (req.user.correoVerificado) {
        return res.json({ message: "Tu correo ya estaba confirmado." });
      }

      const token = await tokens.crear(req.email, "verificacion");

      const plantilla = correo.correoVerificacion(
        req.user.nombre || req.user.businessName || req.email,
        token
      );

      const envio = await correo.enviar({
        para: req.email,
        asunto: plantilla.asunto,
        html: plantilla.html
      });

      res.json({
        message: envio.enviado
          ? "Te lo acabamos de enviar. Revisa tu correo."
          : "El servidor de correo no esta configurado todavia, asi que " +
            "no se pudo enviar. Avisa al administrador.",
        enviado: envio.enviado
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
