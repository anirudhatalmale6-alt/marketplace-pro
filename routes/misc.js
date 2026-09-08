/* =========================
   FAVORITOS, CENTRO DE RESOLUCION Y COMENTARIOS
========================= */

const express = require("express");

const store = require("../lib/store");
const { normalizarEmail, requireAuth } = require("../lib/auth");

const router = express.Router();

/* =========================
   FAVORITOS
========================= */

router.get("/favoritos", requireAuth, async (req, res, next) => {
  try {
    const favoritos = await store.filter(
      "favoritos",
      f => normalizarEmail(f.email) === req.email
    );

    const ads = await store.read("ads");

    const productos = favoritos
      .map(f => ads.find(a => Number(a.id) === Number(f.adId)))
      .filter(Boolean)
      .filter(a => a.activo !== false)
      .map(a => ({ ...a, price: Number(a.price) || 0 }));

    res.json(productos);
  } catch (error) {
    next(error);
  }
});

router.post("/favoritos", requireAuth, async (req, res, next) => {
  try {
    const adId = Number((req.body || {}).adId);

    if (!Number.isFinite(adId) || adId <= 0) {
      return res.status(400).json({ message: "Anuncio invalido" });
    }

    const ad = await store.find("ads", a => Number(a.id) === adId);

    if (!ad) {
      return res.status(404).json({ message: "El anuncio no existe" });
    }

    const resultado = await store.update("favoritos", favoritos => {
      const existe = favoritos.some(
        f => normalizarEmail(f.email) === req.email && Number(f.adId) === adId
      );

      if (existe) return { error: "El producto ya esta en favoritos" };

      favoritos.push({
        id: store.nuevoId(),
        email: req.email,
        adId,
        createdAt: new Date().toISOString()
      });

      return { ok: true };
    });

    if (resultado.error) {
      return res.status(409).json({ message: resultado.error });
    }

    res.status(201).json({
      success: true,
      message: "Producto agregado a favoritos"
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/favoritos", requireAuth, async (req, res, next) => {
  try {
    /* El adId puede venir en el cuerpo o en la query: algunos
       navegadores y proxys se comen el cuerpo de un DELETE */
    const adId = Number(
      (req.body && req.body.adId) !== undefined
        ? req.body.adId
        : req.query.adId
    );

    if (!Number.isFinite(adId) || adId <= 0) {
      return res.status(400).json({ message: "Anuncio invalido" });
    }

    const resultado = await store.update("favoritos", favoritos => {
      const antes = favoritos.length;

      for (let i = favoritos.length - 1; i >= 0; i -= 1) {
        if (
          normalizarEmail(favoritos[i].email) === req.email &&
          Number(favoritos[i].adId) === adId
        ) {
          favoritos.splice(i, 1);
        }
      }

      if (favoritos.length === antes) return { error: "Favorito no encontrado" };

      return { ok: true };
    });

    if (resultado.error) {
      return res.status(404).json({ message: resultado.error });
    }

    res.json({
      success: true,
      message: "Producto eliminado de favoritos"
    });
  } catch (error) {
    next(error);
  }
});

router.get("/favoritos/check", requireAuth, async (req, res, next) => {
  try {
    const adId = Number(req.query.adId);

    if (!Number.isFinite(adId)) {
      return res.status(400).json({ message: "Anuncio invalido" });
    }

    const favoritos = await store.read("favoritos");

    res.json({
      favorito: favoritos.some(
        f => normalizarEmail(f.email) === req.email && Number(f.adId) === adId
      )
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   CENTRO DE RESOLUCION
========================= */

const TIPOS_CASO = [
  "producto-no-recibido",
  "producto-danado",
  "producto-diferente",
  "devolucion",
  "problema-pago",
  "otro"
];

router.post("/resolution-cases", requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};

    const tipo = String(body.tipo || "").trim().toLowerCase();
    const asunto = String(body.asunto || "").trim().slice(0, 150);
    const descripcion = String(body.descripcion || "").trim().slice(0, 4000);

    if (!tipo || !asunto || !descripcion) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    if (!TIPOS_CASO.includes(tipo)) {
      return res.status(400).json({
        message: `Tipo de caso invalido. Admitidos: ${TIPOS_CASO.join(", ")}`
      });
    }

    /* Si se refiere a un pedido, tiene que ser un pedido suyo */
    let pedido = "";

    if (body.pedido) {
      const orden = await store.find(
        "orders",
        o =>
          String(o.numero) === String(body.pedido) ||
          Number(o.id) === Number(body.pedido)
      );

      if (!orden) {
        return res.status(404).json({ message: "Ese pedido no existe" });
      }

      if (
        normalizarEmail(orden.comprador) !== req.email &&
        normalizarEmail(orden.vendedor) !== req.email
      ) {
        return res.status(403).json({ message: "Ese pedido no es tuyo" });
      }

      pedido = orden.numero || String(orden.id);
    }

    const nuevo = {
      id: store.nuevoId(),
      email: req.email,
      tipo,
      asunto,
      descripcion,
      pedido,
      estado: "abierto",
      respuestas: [],
      fecha: new Date().toISOString()
    };

    await store.insert("resolution-cases", nuevo);

    console.log("Nuevo caso de resolucion:", nuevo.id, req.email);

    res.status(201).json({
      success: true,
      message: "Caso creado correctamente",
      caso: nuevo
    });
  } catch (error) {
    next(error);
  }
});

router.get("/resolution-cases", requireAuth, async (req, res, next) => {
  try {
    const casos = await store.filter(
      "resolution-cases",
      c => normalizarEmail(c.email) === req.email
    );

    casos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(casos);
  } catch (error) {
    next(error);
  }
});

router.get("/resolution-cases/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const caso = await store.find(
      "resolution-cases",
      c => Number(c.id) === id && normalizarEmail(c.email) === req.email
    );

    if (!caso) {
      return res.status(404).json({ message: "Caso no encontrado" });
    }

    res.json(caso);
  } catch (error) {
    next(error);
  }
});

/* =========================
   COMENTARIOS / VALORACIONES

   Antes se guardaba el comentario con el email que mandara el
   navegador: se podian escribir resenas en nombre de otro.
   Ahora el autor es siempre quien esta logueado.
========================= */

router.get("/comentarios", async (req, res, next) => {
  try {
    /* Las resenas de un vendedor son publicas */
    const vendedor = normalizarEmail(req.query.vendedor);

    const comentarios = await store.read("comentarios");

    const lista = vendedor
      ? comentarios.filter(c => normalizarEmail(c.vendedor) === vendedor)
      : comentarios.filter(
          c => normalizarEmail(c.email) === normalizarEmail(req.query.email)
        );

    lista.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(
      lista.map(c => ({
        id: c.id,
        usuario: c.usuario,
        texto: c.texto,
        calificacion: c.calificacion,
        vendedor: c.vendedor,
        fecha: c.fecha,
        createdAt: c.createdAt
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post("/comentarios", requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};

    const texto = String(body.texto || "").trim().slice(0, 2000);

    if (!texto) {
      return res.status(400).json({ message: "El comentario no puede estar vacio" });
    }

    const calificacion = Math.max(
      0,
      Math.min(5, Math.round(Number(body.calificacion) || 0))
    );

    let vendedor = "";

    if (body.vendedor) {
      const destino = normalizarEmail(body.vendedor);

      if (destino === req.email) {
        return res.status(400).json({
          message: "No puedes dejarte una resena a ti mismo"
        });
      }

      const existe = await store.find(
        "users",
        u => normalizarEmail(u.email) === destino
      );

      if (!existe) {
        return res.status(404).json({ message: "Ese vendedor no existe" });
      }

      vendedor = destino;
    }

    const nuevo = {
      id: store.nuevoId(),
      email: req.email,
      vendedor,
      usuario:
        `${req.user.nombre || ""} ${req.user.apellido || ""}`.trim() ||
        req.user.businessName ||
        req.user.username,
      texto,
      calificacion,
      fecha: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    await store.insert("comentarios", nuevo);

    /* Recalcular la valoracion media del vendedor */
    if (vendedor) {
      const todos = await store.filter(
        "comentarios",
        c => normalizarEmail(c.vendedor) === vendedor && c.calificacion > 0
      );

      const media =
        todos.reduce((s, c) => s + Number(c.calificacion || 0), 0) /
        (todos.length || 1);

      await store.update("users", users => {
        const i = users.findIndex(u => normalizarEmail(u.email) === vendedor);
        if (i === -1) return store.SIN_CAMBIOS;

        users[i].rating = Math.round(media * 10) / 10;
        users[i].totalReviews = todos.length;
      });
    }

    res.status(201).json({
      success: true,
      message: "Comentario guardado correctamente",
      comentario: nuevo
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
