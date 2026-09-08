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
    const favoritos = await store.findMany("favoritos", { email: req.email });

    /* Se piden solo los anuncios marcados, no el catalogo entero */
    const ads = await store.findMany("ads", {
      id: { $in: favoritos.map(f => Number(f.adId)) }
    });

    const porId = new Map(ads.map(a => [Number(a.id), a]));

    const productos = favoritos
      .map(f => porId.get(Number(f.adId)))
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

    const ad = await store.findOne("ads", { id: adId });

    if (!ad) {
      return res.status(404).json({ message: "El anuncio no existe" });
    }

    try {
      /* El indice unico (email + adId) es quien impide de verdad el
         duplicado, aunque lleguen dos peticiones a la vez */
      await store.insertOne("favoritos", {
        id: store.nuevoId(),
        email: req.email,
        adId,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(409).json({
          message: "El producto ya esta en favoritos"
        });
      }
      throw error;
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

    const borrados = await store.deleteMany("favoritos", {
      email: req.email,
      adId
    });

    if (borrados === 0) {
      return res.status(404).json({ message: "Favorito no encontrado" });
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

    const favorito = await store.findOne("favoritos", {
      email: req.email,
      adId
    });

    res.json({ favorito: Boolean(favorito) });
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
      const orden =
        (await store.findOne("orders", { numero: String(body.pedido) })) ||
        (await store.findOne("orders", { id: Number(body.pedido) }));

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
    const casos = await store.findMany(
      "resolution-cases",
      { email: req.email },
      { orden: { fecha: -1 } }
    );

    res.json(casos);
  } catch (error) {
    next(error);
  }
});

router.get("/resolution-cases/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const caso = await store.findOne("resolution-cases", {
      id,
      email: req.email
    });

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

    /* Consulta con indice: o las resenas RECIBIDAS por un vendedor, o
       las ESCRITAS por un usuario. Antes se leian todas las del sitio. */
    const filtro = vendedor
      ? { vendedor }
      : { email: normalizarEmail(req.query.email) };

    const lista = await store.findMany("comentarios", filtro, {
      orden: { createdAt: -1 },
      limite: 200
    });

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

      const existe = await store.findOne("users", { email: destino });

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
      const todos = (
        await store.findMany("comentarios", { vendedor })
      ).filter(c => Number(c.calificacion) > 0);

      const media =
        todos.reduce((s, c) => s + Number(c.calificacion || 0), 0) /
        (todos.length || 1);

      await store.updateOne(
        "users",
        { email: vendedor },
        {
          rating: Math.round(media * 10) / 10,
          totalReviews: todos.length
        }
      );
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
