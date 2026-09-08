/* =========================
   AUTENTICACION

   Antes NINGUNA ruta comprobaba quien eras: se fiaba del email que
   mandaba el navegador. Cualquiera podia pedir /get-user?email=otro
   y recibir sus datos, o cambiar el pedido de otra persona.

   Ahora quien eres sale SIEMPRE del token firmado que guarda el
   servidor en una cookie httpOnly. El email que llegue en el cuerpo o
   en la query se ignora.
========================= */

const jwt = require("jsonwebtoken");
const store = require("./store");

const NOMBRE_COOKIE = "token";

/* Duracion de la sesion */
const DURACION = process.env.JWT_EXPIRES_IN || "7d";
const DURACION_MS = 7 * 24 * 60 * 60 * 1000;

function secreto() {
  const valor = process.env.JWT_SECRET;

  /* Sin secreto los tokens se podrian falsificar. Mejor no arrancar
     que arrancar inseguro sin que nadie se entere. */
  if (!valor || valor.length < 16) {
    throw new Error(
      "Falta JWT_SECRET en el archivo .env (minimo 16 caracteres). " +
        "Copia .env.example a .env y pon un valor largo y aleatorio."
    );
  }

  return valor;
}

/* =========================
   NORMALIZAR CORREO

   El registro guardaba el correo en minusculas pero el login comparaba
   texto exacto. Quien se registraba con una mayuscula no podia entrar
   nunca. Todo el proyecto pasa ahora por esta funcion.
========================= */

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/* =========================
   TOKEN
========================= */

function firmarToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      accountType: user.accountType
    },
    secreto(),
    { expiresIn: DURACION }
  );
}

function ponerCookie(res, token) {
  res.cookie(NOMBRE_COOKIE, token, {
    httpOnly: true, // el JavaScript de la pagina no puede leerla
    sameSite: "lax", // corta el envio desde otros sitios (CSRF)
    secure: process.env.NODE_ENV === "production", // solo por HTTPS en el servidor
    maxAge: DURACION_MS,
    path: "/"
  });
}

function quitarCookie(res) {
  res.clearCookie(NOMBRE_COOKIE, { path: "/" });
}

function leerToken(req) {
  if (req.cookies && req.cookies[NOMBRE_COOKIE]) {
    return req.cookies[NOMBRE_COOKIE];
  }

  /* Tambien se acepta la cabecera Authorization, util para probar la
     API con curl o desde una app movil mas adelante */
  const cabecera = req.headers.authorization || "";

  if (cabecera.startsWith("Bearer ")) {
    return cabecera.slice(7);
  }

  return null;
}

/* =========================
   MIDDLEWARE: SESION OBLIGATORIA
========================= */

async function requireAuth(req, res, next) {
  try {
    const token = leerToken(req);

    if (!token) {
      return res.status(401).json({ message: "Debes iniciar sesion" });
    }

    let datos;

    try {
      datos = jwt.verify(token, secreto());
    } catch (error) {
      quitarCookie(res);
      return res.status(401).json({ message: "Sesion expirada o invalida" });
    }

    /* El token puede ser valido pero el usuario haber cerrado su cuenta.

       Esto se ejecuta en CADA peticion con sesion, asi que va por
       consulta directa con indice (findOne) y no recorriendo la lista
       entera de usuarios. Con archivos JSON daba igual; con MongoDB y
       miles de cuentas, la diferencia es enorme.

       El correo se guarda siempre en minusculas, asi que buscar por
       igualdad exacta es correcto. */
    const user = await store.findOne("users", {
      email: normalizarEmail(datos.email)
    });

    if (!user) {
      quitarCookie(res);
      return res.status(401).json({ message: "La cuenta ya no existe" });
    }

    req.user = user;
    req.email = normalizarEmail(user.email);

    next();
  } catch (error) {
    next(error);
  }
}

/* =========================
   MIDDLEWARE: SESION OPCIONAL
   (para paginas publicas que muestran algo extra si hay sesion)
========================= */

async function optionalAuth(req, res, next) {
  const token = leerToken(req);

  if (!token) return next();

  try {
    const datos = jwt.verify(token, secreto());

    const user = await store.findOne("users", {
      email: normalizarEmail(datos.email)
    });

    if (user) {
      req.user = user;
      req.email = normalizarEmail(user.email);
    }
  } catch (error) {
    /* token malo en una ruta publica: se sigue como visitante */
  }

  next();
}

/* =========================
   QUE DATOS SE DEVUELVEN AL NAVEGADOR

   Antes /login y /get-user devolvian el objeto entero, incluido el
   hash de la contrasena, el telefono y la direccion. Ahora hay dos
   vistas: la propia y la publica.
========================= */

/* Vista propia: todo menos la contrasena */
function usuarioPropio(user) {
  if (!user) return null;

  const { password, ...resto } = user;

  return resto;
}

/* Vista publica: lo que puede ver cualquier otra persona de un
   vendedor. Nada de contrasena, telefono, direcciones ni documentos. */
function usuarioPublico(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    accountType: user.accountType,
    nombre: user.nombre,
    apellido: user.apellido,
    businessName: user.businessName,
    country: user.country,
    state: user.state,
    city: user.city,
    rating: user.rating || 0,
    totalSales: user.totalSales || 0,
    createdAt: user.createdAt
  };
}

module.exports = {
  NOMBRE_COOKIE,
  normalizarEmail,
  firmarToken,
  ponerCookie,
  quitarCookie,
  requireAuth,
  optionalAuth,
  usuarioPropio,
  usuarioPublico
};
