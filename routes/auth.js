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

function generarUsername(base, usados) {
  const limpio = String(base || "usuario")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20) || "usuario";

  let candidato = limpio;
  let n = 0;

  /* Antes se anadia un numero al azar y podia repetirse. Ahora se
     comprueba contra los que ya existen. */
  while (usados.has(candidato)) {
    n += 1;
    candidato = `${limpio}${n}`;
  }

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

    const hashedPassword = await bcrypt.hash(password, RONDAS_BCRYPT);

    /* Se comprueba el duplicado y se inserta dentro del mismo turno de
       la cola. Antes, dos registros simultaneos con el mismo correo
       pasaban los dos. */
    const resultado = await store.update("users", users => {
      const existe = users.some(u => normalizarEmail(u.email) === email);

      if (existe) return { error: "El usuario ya existe" };

      const usados = new Set(users.map(u => u.username).filter(Boolean));

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

      let nuevo;

      if (accountType === "personal") {
        if (!data.nombre || !data.apellido) {
          return { error: "Nombre y apellido requeridos" };
        }

        nuevo = {
          ...base,
          nombre: String(data.nombre).trim(),
          apellido: String(data.apellido).trim(),
          username: generarUsername(
            `${data.nombre}${data.apellido}`,
            usados
          )
        };
      } else {
        if (!data.businessName || !data.documentType || !data.documentNumber) {
          return { error: "Datos del negocio incompletos" };
        }

        nuevo = {
          ...base,
          nombre: String(data.nombre || "").trim(),
          apellido: String(data.apellido || "").trim(),
          businessName: String(data.businessName).trim(),
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          username: generarUsername(data.businessName, usados)
        };
      }

      users.push(nuevo);

      return { user: nuevo };
    });

    if (resultado.error) {
      return res.status(400).json({ message: resultado.error });
    }

    /* Al registrarse ya queda la sesion abierta */
    ponerCookie(res, firmarToken(resultado.user));

    console.log("Usuario registrado:", email);

    res.status(201).json({
      message: "Registro exitoso",
      user: usuarioPropio(resultado.user)
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

    const user = await store.find(
      "users",
      u => normalizarEmail(u.email) === email
    );

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

    /* Actividad de inicio de sesion */
    await store.update("login-activity", actividad => {
      actividad.push({
        id: store.nuevoId(),
        email: normalizarEmail(user.email),
        ip: req.ip,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
        fecha: new Date().toISOString()
      });

      /* No dejar que el archivo crezca sin limite */
      if (actividad.length > 5000) actividad.splice(0, actividad.length - 5000);
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
    const actividad = await store.filter(
      "login-activity",
      a => normalizarEmail(a.email) === req.email
    );

    actividad.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(actividad.slice(0, 50));
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

    await store.update("users", users => {
      const i = users.findIndex(u => normalizarEmail(u.email) === req.email);

      if (i === -1) return store.SIN_CAMBIOS;

      users[i].password = hash;
      users[i].passwordChangedAt = new Date().toISOString();
    });

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

    await store.update("users", users => {
      const i = users.findIndex(u => normalizarEmail(u.email) === email);
      if (i !== -1) users.splice(i, 1);
    });

    await store.update("ads", ads => {
      for (let i = ads.length - 1; i >= 0; i -= 1) {
        if (normalizarEmail(ads[i].sellerEmail) === email) ads.splice(i, 1);
      }
    });

    await store.update("login-activity", act => {
      for (let i = act.length - 1; i >= 0; i -= 1) {
        if (normalizarEmail(act[i].email) === email) act.splice(i, 1);
      }
    });

    await store.update("favoritos", favs => {
      for (let i = favs.length - 1; i >= 0; i -= 1) {
        if (normalizarEmail(favs[i].email) === email) favs.splice(i, 1);
      }
    });

    /* Los pedidos y las ventas NO se borran: son el registro contable
       de la otra parte. Se marca la cuenta como eliminada. */
    await store.update("orders", orders => {
      orders.forEach(o => {
        if (normalizarEmail(o.comprador) === email) o.compradorEliminado = true;
        if (normalizarEmail(o.vendedor) === email) o.vendedorEliminado = true;
      });
    });

    quitarCookie(res);

    console.log("Cuenta eliminada:", email);

    res.json({ success: true, message: "Cuenta cerrada correctamente" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
