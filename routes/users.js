/* =========================
   PERFIL, CONFIGURACION, PAGOS Y DIRECCIONES

   Regla que se aplica en todo el archivo: el usuario sale del token,
   NUNCA del email que manda el navegador. Si el cuerpo trae un email
   distinto, se ignora.
========================= */

const express = require("express");

const store = require("../lib/store");
const {
  normalizarEmail,
  requireAuth,
  usuarioPropio,
  usuarioPublico
} = require("../lib/auth");

const router = express.Router();

/* Ayuda: modifica el usuario de la sesion dentro de la cola */
async function editarUsuario(email, cambiar) {
  return store.update("users", users => {
    const i = users.findIndex(u => normalizarEmail(u.email) === email);

    if (i === -1) return { error: "Usuario no encontrado" };

    const salida = cambiar(users[i], users);

    return salida === undefined ? { user: users[i] } : salida;
  });
}

function texto(valor, max = 200) {
  return String(valor === undefined || valor === null ? "" : valor)
    .trim()
    .slice(0, max);
}

/* =========================
   MIS DATOS

   Antes: /get-user?email=cualquiera devolvia la ficha completa de esa
   persona, con el hash de la contrasena incluido, sin pedir sesion.
   Ahora devuelve SOLO los datos de quien esta logueado.
========================= */

router.get("/get-user", requireAuth, (req, res) => {
  res.json(usuarioPropio(req.user));
});

/* =========================
   PERFIL PUBLICO POR USERNAME
   (visible sin sesion, pero sin datos privados)
========================= */

router.get("/user/:username", async (req, res, next) => {
  try {
    const username = String(req.params.username || "").toLowerCase();

    const user = await store.find(
      "users",
      u => String(u.username || "").toLowerCase() === username
    );

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(usuarioPublico(user));
  } catch (error) {
    next(error);
  }
});

/* =========================
   ACTUALIZAR PERFIL
========================= */

router.post("/update-profile", requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};

    const campos = [
      "nombre",
      "apellido",
      "address",
      "city",
      "state",
      "zip",
      "country",
      "sector",
      "reference"
    ];

    if (body.telefono !== undefined && body.telefono !== "") {
      if (!/^[0-9]{7,15}$/.test(String(body.telefono).trim())) {
        return res.status(400).json({ message: "Telefono invalido" });
      }
    }

    const resultado = await editarUsuario(req.email, user => {
      campos.forEach(campo => {
        /* Antes se escribian todos los campos aunque llegaran vacios:
           editar solo el telefono te borraba la direccion. */
        if (body[campo] !== undefined) user[campo] = texto(body[campo]);
      });

      if (body.telefono !== undefined) {
        user.telefono = texto(body.telefono, 20);
      }

      user.updatedAt = new Date().toISOString();
    });

    if (resultado.error) {
      return res.status(404).json({ message: resultado.error });
    }

    res.json({
      message: "Perfil actualizado correctamente",
      user: usuarioPropio(resultado.user)
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   CONFIGURACION
========================= */

const CONFIG_POR_DEFECTO = {
  notificaciones: true,
  correoNotificaciones: true,
  apariencia: "claro",
  idioma: "es"
};

router.get("/get-configuracion", requireAuth, async (req, res, next) => {
  try {
    res.json({
      configuracion: { ...CONFIG_POR_DEFECTO, ...(req.user.configuracion || {}) }
    });
  } catch (error) {
    next(error);
  }
});

router.put("/update-configuracion", requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};

    const resultado = await editarUsuario(req.email, user => {
      user.configuracion = {
        notificaciones: Boolean(body.notificaciones),
        correoNotificaciones: Boolean(body.correoNotificaciones),
        apariencia: body.apariencia === "oscuro" ? "oscuro" : "claro",
        idioma: body.idioma === "en" ? "en" : "es"
      };
    });

    if (resultado.error) {
      return res.status(404).json({ message: resultado.error });
    }

    res.json({
      success: true,
      message: "Configuracion actualizada correctamente",
      configuracion: resultado.user.configuracion
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   PREFERENCIAS DE PAGO
========================= */

const PAGOS_POR_DEFECTO = {
  tarjeta: false,
  paypal: false,
  transferencia: false
};

router.get("/get-pagos", requireAuth, (req, res) => {
  res.json({
    preferencias: { ...PAGOS_POR_DEFECTO, ...(req.user.pagos || {}) }
  });
});

router.put("/update-pagos", requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};

    const resultado = await editarUsuario(req.email, user => {
      user.pagos = {
        tarjeta: Boolean(body.tarjeta),
        paypal: Boolean(body.paypal),
        transferencia: Boolean(body.transferencia)
      };
    });

    if (resultado.error) {
      return res.status(404).json({ message: resultado.error });
    }

    res.json({
      success: true,
      message: "Preferencias de pago actualizadas correctamente",
      preferencias: resultado.user.pagos
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   DATOS DE TRANSFERENCIA

   El frontend (pagos.js) ya llamaba a /guardar-transferencia y
   /get-transferencia, pero esas rutas NO existian en el servidor:
   devolvian 404. Aqui estan.

   Solo se guarda lo justo para recibir un pago: banco, tipo de cuenta,
   titular y numero. Del numero de cuenta se devuelven al navegador
   solo los ultimos 4 digitos.
========================= */

function enmascararCuenta(numero) {
  const limpio = String(numero || "").replace(/\s/g, "");

  if (limpio.length <= 4) return limpio;

  return `${"*".repeat(limpio.length - 4)}${limpio.slice(-4)}`;
}

router.get("/get-transferencia", requireAuth, (req, res) => {
  const t = req.user.transferencia;

  if (!t) return res.json({ transferencia: null });

  res.json({
    transferencia: {
      banco: t.banco,
      tipoCuenta: t.tipoCuenta,
      titular: t.titular,
      numeroCuenta: enmascararCuenta(t.numeroCuenta),
      actualizado: t.actualizado
    }
  });
});

router.post("/guardar-transferencia", requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};

    const banco = texto(body.banco, 80);
    const titular = texto(body.titular, 120);
    const numeroCuenta = texto(body.numeroCuenta, 34).replace(/\s/g, "");
    const tipoCuenta =
      body.tipoCuenta === "corriente" ? "corriente" : "ahorro";

    if (!banco || !titular || !numeroCuenta) {
      return res.status(400).json({
        message: "Banco, titular y numero de cuenta son obligatorios"
      });
    }

    if (!/^[0-9A-Za-z-]{6,34}$/.test(numeroCuenta)) {
      return res.status(400).json({ message: "Numero de cuenta invalido" });
    }

    const resultado = await editarUsuario(req.email, user => {
      user.transferencia = {
        banco,
        tipoCuenta,
        titular,
        numeroCuenta,
        actualizado: new Date().toISOString()
      };
    });

    if (resultado.error) {
      return res.status(404).json({ message: resultado.error });
    }

    res.json({
      success: true,
      message: "Datos de transferencia guardados",
      transferencia: {
        banco,
        tipoCuenta,
        titular,
        numeroCuenta: enmascararCuenta(numeroCuenta)
      }
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   DIRECCIONES
========================= */

router.get("/direcciones", requireAuth, (req, res) => {
  res.json({ direcciones: req.user.direcciones || [] });
});

router.post("/direcciones", requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};

    if (!body.address || !body.city || !body.state) {
      return res.status(400).json({
        message: "Completa los campos obligatorios"
      });
    }

    const resultado = await editarUsuario(req.email, user => {
      if (!Array.isArray(user.direcciones)) user.direcciones = [];

      if (user.direcciones.length >= 20) {
        return { error: "Has alcanzado el maximo de direcciones guardadas" };
      }

      const esPrimera = user.direcciones.length === 0;

      const nueva = {
        id: store.nuevoId(),
        nombre: texto(body.nombre, 80) || "Direccion de envio",
        telefono: texto(body.telefono, 20),
        country: texto(body.country, 60),
        state: texto(body.state, 60),
        city: texto(body.city, 60),
        sector: texto(body.sector, 60),
        address: texto(body.address, 200),
        zip: texto(body.zip, 12),
        reference: texto(body.reference, 200),
        predeterminada: esPrimera,
        createdAt: new Date().toISOString()
      };

      user.direcciones.push(nueva);

      return { direccion: nueva };
    });

    if (resultado.error) {
      const codigo = resultado.error === "Usuario no encontrado" ? 404 : 400;
      return res.status(codigo).json({ message: resultado.error });
    }

    res.status(201).json({
      success: true,
      message: "Direccion guardada correctamente",
      direccion: resultado.direccion
    });
  } catch (error) {
    next(error);
  }
});

router.put("/direcciones/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};

    const resultado = await editarUsuario(req.email, user => {
      const direcciones = user.direcciones || [];
      const i = direcciones.findIndex(d => Number(d.id) === id);

      if (i === -1) return { error: "Direccion no encontrada" };

      const campos = {
        nombre: 80,
        telefono: 20,
        country: 60,
        state: 60,
        city: 60,
        sector: 60,
        address: 200,
        zip: 12,
        reference: 200
      };

      Object.entries(campos).forEach(([campo, max]) => {
        if (body[campo] !== undefined) {
          direcciones[i][campo] = texto(body[campo], max);
        }
      });

      user.direcciones = direcciones;

      return { direccion: direcciones[i] };
    });

    if (resultado.error) {
      const codigo = resultado.error === "Usuario no encontrado" ? 404 : 404;
      return res.status(codigo).json({ message: resultado.error });
    }

    res.json({
      success: true,
      message: "Direccion actualizada correctamente",
      direccion: resultado.direccion
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/direcciones/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const resultado = await editarUsuario(req.email, user => {
      const direcciones = user.direcciones || [];
      const i = direcciones.findIndex(d => Number(d.id) === id);

      if (i === -1) return { error: "Direccion no encontrada" };

      const eraPredeterminada = direcciones[i].predeterminada;

      direcciones.splice(i, 1);

      if (eraPredeterminada && direcciones.length > 0) {
        direcciones[0].predeterminada = true;
      }

      user.direcciones = direcciones;

      return { ok: true };
    });

    if (resultado.error) {
      return res.status(404).json({ message: resultado.error });
    }

    res.json({ success: true, message: "Direccion eliminada correctamente" });
  } catch (error) {
    next(error);
  }
});

router.put(
  "/direcciones/:id/predeterminada",
  requireAuth,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      const resultado = await editarUsuario(req.email, user => {
        const direcciones = user.direcciones || [];

        if (!direcciones.some(d => Number(d.id) === id)) {
          return { error: "Direccion no encontrada" };
        }

        direcciones.forEach(d => {
          d.predeterminada = Number(d.id) === id;
        });

        user.direcciones = direcciones;

        return { ok: true };
      });

      if (resultado.error) {
        return res.status(404).json({ message: resultado.error });
      }

      res.json({
        success: true,
        message: "Direccion predeterminada actualizada"
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   SOLICITAR MIS DATOS
========================= */

router.post("/solicitar-datos", requireAuth, async (req, res, next) => {
  try {
    const resultado = await store.update("solicitudes-datos", solicitudes => {
      const pendiente = solicitudes.find(
        s => normalizarEmail(s.email) === req.email && s.estado === "pendiente"
      );

      if (pendiente) {
        return { error: "Ya tienes una solicitud de datos pendiente." };
      }

      const nueva = {
        id: store.nuevoId(),
        email: req.email,
        nombre: req.user.nombre || "",
        apellido: req.user.apellido || "",
        fecha: new Date().toISOString(),
        estado: "pendiente"
      };

      solicitudes.push(nueva);

      return { solicitud: nueva };
    });

    if (resultado.error) {
      return res.status(400).json({ message: resultado.error });
    }

    res.status(201).json({
      success: true,
      message: "Tu solicitud de datos fue registrada correctamente.",
      solicitud: resultado.solicitud
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
