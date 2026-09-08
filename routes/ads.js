/* =========================
   ANUNCIOS / PRODUCTOS
========================= */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const store = require("../lib/store");
const { UPLOADS_DIR } = require("../lib/paths");
const {
  normalizarEmail,
  requireAuth,
  optionalAuth,
  usuarioPublico
} = require("../lib/auth");

const router = express.Router();

/* =========================
   SUBIDA DE IMAGENES

   Antes: multer aceptaba cualquier archivo, de cualquier tamano, y el
   nombre se construia con la extension que mandaba el navegador. Se
   podia subir un .php o un .html y quedaba servido desde /uploads.
========================= */

const EXTENSIONES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif"
};

const MAX_IMAGENES = 10;
const MAX_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    /* Nombre generado por el servidor: no se usa nada de lo que manda
       el navegador, ni el nombre ni la extension */
    const ext = EXTENSIONES[file.mimetype] || ".bin";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: MAX_IMAGENES },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONES[file.mimetype]) {
      return cb(new Error("Solo se admiten imagenes JPG, PNG, WEBP, GIF o AVIF"));
    }
    cb(null, true);
  }
});

/* Si la validacion del anuncio falla despues de subir las fotos, hay
   que borrarlas para no dejar basura en /uploads */
async function borrarSubidas(files) {
  await Promise.all(
    (files || []).map(f => fs.unlink(f.path).catch(() => {}))
  );
}

/* =========================
   NORMALIZACION

   price se guardaba como texto ("5000"), asi que ordenar por precio
   comparaba letra a letra: "9" salia despues de "10000".
   Aqui el precio es SIEMPRE un numero.
========================= */

/* Devuelve NaN cuando no hay numero.

   Ojo con esto: Number("") es 0, no NaN. Si un filtro que no viene en
   la peticion se convierte en 0, "precio minimo" pasa a valer 0 y
   "precio maximo" tambien, y el listado devuelve CERO productos
   pareciendo que simplemente no hay nada que mostrar. */
function aNumero(valor) {
  if (valor === undefined || valor === null || valor === "") return NaN;

  const limpio = String(valor).replace(/[^\d.-]/g, "");

  if (!limpio) return NaN;

  const n = Number(limpio);

  return Number.isFinite(n) ? n : NaN;
}

const CONDICIONES = ["nuevo", "usado", "reacondicionado"];

function vistaAnuncio(ad) {
  return {
    ...ad,
    price: Number(ad.price) || 0,
    cantidad: Number(ad.cantidad) || 0
  };
}

/* =========================
   CREAR ANUNCIO
========================= */

router.post(
  "/create-ad",
  requireAuth,
  upload.array("images", MAX_IMAGENES),
  async (req, res, next) => {
    try {
      const body = req.body || {};

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          message: "Debes subir al menos una imagen"
        });
      }

      const title = String(body.title || "").trim().slice(0, 120);
      const description = String(body.description || "").trim().slice(0, 4000);
      const categoria = String(body.categoria || "").trim().slice(0, 60);
      const condicion = String(body.condicion || "nuevo").trim().toLowerCase();

      const price = aNumero(body.price);
      const cantidad = parseInt(body.cantidad, 10);

      const problema = (() => {
        if (!title) return "El titulo es obligatorio";
        if (!description) return "La descripcion es obligatoria";
        if (!categoria) return "La categoria es obligatoria";
        if (!Number.isFinite(price) || price <= 0) {
          return "El precio debe ser un numero mayor que cero";
        }
        if (price > 100000000) return "El precio es demasiado alto";
        if (!Number.isInteger(cantidad) || cantidad < 1) {
          return "La cantidad debe ser un numero entero de al menos 1";
        }
        if (!CONDICIONES.includes(condicion)) {
          return `La condicion debe ser: ${CONDICIONES.join(", ")}`;
        }
        return null;
      })();

      if (problema) {
        await borrarSubidas(req.files);
        return res.status(400).json({ message: problema });
      }

      /* Rutas relativas, nunca http://localhost:3000. Asi las imagenes
         siguen funcionando cuando el sitio pase al servidor. */
      const imagenes = req.files.map(f => `/uploads/${f.filename}`);

      const user = req.user;

      const nuevo = {
        id: store.nuevoId(),

        title,
        description,
        price,
        cantidad,
        categoria,
        condicion,

        image: imagenes[0],
        images: imagenes,

        sellerEmail: normalizarEmail(user.email),
        sellerName:
          user.accountType === "business"
            ? user.businessName
            : `${user.nombre || ""} ${user.apellido || ""}`.trim(),
        sellerUsername: user.username,

        activo: true,
        createdAt: new Date().toISOString()
      };

      await store.insert("ads", nuevo);

      console.log("Nuevo anuncio:", nuevo.id, user.email);

      res.status(201).json({
        message: "Anuncio publicado correctamente",
        ad: vistaAnuncio(nuevo)
      });
    } catch (error) {
      await borrarSubidas(req.files);
      next(error);
    }
  }
);

/* =========================
   LISTADO PUBLICO CON BUSQUEDA Y FILTROS

   Antes /all-ads devolvia el archivo entero y el filtrado se hacia en
   el navegador. Ahora se puede filtrar y ordenar en el servidor:

   /all-ads?q=iphone&categoria=celulares&min=100&max=900
           &condicion=nuevo&orden=precio-asc&pagina=1&porPagina=24

   Sin parametros devuelve la lista completa, como antes, para no
   romper el frontend que ya existe.
========================= */

router.get("/all-ads", async (req, res, next) => {
  try {
    const ads = (await store.read("ads"))
      .filter(a => a.activo !== false)
      .map(vistaAnuncio);

    const q = String(req.query.q || "").trim().toLowerCase();
    const categoria = String(req.query.categoria || "").trim().toLowerCase();
    const condicion = String(req.query.condicion || "").trim().toLowerCase();

    const min = aNumero(req.query.min);
    const max = aNumero(req.query.max);

    let lista = ads;

    if (q) {
      lista = lista.filter(a =>
        `${a.title} ${a.description} ${a.categoria}`.toLowerCase().includes(q)
      );
    }

    if (categoria && categoria !== "todo") {
      lista = lista.filter(
        a => String(a.categoria || "").toLowerCase() === categoria
      );
    }

    if (condicion && condicion !== "todo") {
      lista = lista.filter(
        a => String(a.condicion || "").toLowerCase() === condicion
      );
    }

    if (Number.isFinite(min)) lista = lista.filter(a => a.price >= min);
    if (Number.isFinite(max)) lista = lista.filter(a => a.price <= max);

    const orden = String(req.query.orden || "recientes");

    const ordenaciones = {
      "precio-asc": (a, b) => a.price - b.price,
      "precio-desc": (a, b) => b.price - a.price,
      antiguos: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      recientes: (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    };

    lista.sort(ordenaciones[orden] || ordenaciones.recientes);

    const total = lista.length;

    /* La paginacion solo se aplica si la piden, para no cambiar la
       respuesta que espera el frontend actual */
    if (req.query.pagina || req.query.porPagina) {
      const porPagina = Math.min(
        Math.max(parseInt(req.query.porPagina, 10) || 24, 1),
        100
      );
      const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
      const desde = (pagina - 1) * porPagina;

      return res.json({
        total,
        pagina,
        porPagina,
        paginas: Math.ceil(total / porPagina),
        ads: lista.slice(desde, desde + porPagina)
      });
    }

    res.json(lista);
  } catch (error) {
    next(error);
  }
});

/* =========================
   CATEGORIAS DISPONIBLES
   (para llenar el desplegable de filtros sin quemarlo en el HTML)
========================= */

router.get("/categorias", async (req, res, next) => {
  try {
    const ads = await store.read("ads");

    const cuenta = new Map();

    ads
      .filter(a => a.activo !== false && a.categoria)
      .forEach(a => {
        const c = String(a.categoria).trim();
        cuenta.set(c, (cuenta.get(c) || 0) + 1);
      });

    res.json(
      [...cuenta.entries()]
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => a.categoria.localeCompare(b.categoria))
    );
  } catch (error) {
    next(error);
  }
});

/* =========================
   UN ANUNCIO POR ID
========================= */

router.get("/ads/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const ad = await store.findOne("ads", { id });

    if (!ad || ad.activo === false) {
      return res.status(404).json({ message: "Anuncio no encontrado" });
    }

    res.json(vistaAnuncio(ad));
  } catch (error) {
    next(error);
  }
});

/* =========================
   MIS ANUNCIOS
========================= */

router.get("/my-ads", requireAuth, async (req, res, next) => {
  try {
    const ads = await store.findMany(
      "ads",
      { sellerEmail: req.email },
      { orden: { createdAt: -1 } }
    );

    res.json(ads.map(vistaAnuncio));
  } catch (error) {
    next(error);
  }
});

/* =========================
   EDITAR ANUNCIO (solo el dueno)
========================= */

router.put("/ads/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};

    const resultado = await store.update("ads", ads => {
      const i = ads.findIndex(a => Number(a.id) === id);

      if (i === -1) return { error: "Anuncio no encontrado", codigo: 404 };

      if (normalizarEmail(ads[i].sellerEmail) !== req.email) {
        return { error: "Este anuncio no es tuyo", codigo: 403 };
      }

      if (body.title !== undefined) {
        const t = String(body.title).trim().slice(0, 120);
        if (!t) return { error: "El titulo no puede quedar vacio", codigo: 400 };
        ads[i].title = t;
      }

      if (body.description !== undefined) {
        ads[i].description = String(body.description).trim().slice(0, 4000);
      }

      if (body.categoria !== undefined) {
        ads[i].categoria = String(body.categoria).trim().slice(0, 60);
      }

      if (body.condicion !== undefined) {
        const c = String(body.condicion).toLowerCase();
        if (!CONDICIONES.includes(c)) {
          return { error: "Condicion invalida", codigo: 400 };
        }
        ads[i].condicion = c;
      }

      if (body.price !== undefined) {
        const p = aNumero(body.price);
        if (!Number.isFinite(p) || p <= 0) {
          return { error: "Precio invalido", codigo: 400 };
        }
        ads[i].price = p;
      }

      if (body.cantidad !== undefined) {
        const c = parseInt(body.cantidad, 10);
        if (!Number.isInteger(c) || c < 0) {
          return { error: "Cantidad invalida", codigo: 400 };
        }
        ads[i].cantidad = c;
      }

      if (body.activo !== undefined) ads[i].activo = Boolean(body.activo);

      ads[i].updatedAt = new Date().toISOString();

      return { ad: ads[i] };
    });

    if (resultado.error) {
      return res.status(resultado.codigo).json({ message: resultado.error });
    }

    res.json({
      message: "Anuncio actualizado correctamente",
      ad: vistaAnuncio(resultado.ad)
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ELIMINAR ANUNCIO (solo el dueno)
========================= */

router.delete("/ads/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const ad = await store.findOne("ads", { id });

    if (!ad) {
      return res.status(404).json({ message: "Anuncio no encontrado" });
    }

    if (normalizarEmail(ad.sellerEmail) !== req.email) {
      return res.status(403).json({ message: "Este anuncio no es tuyo" });
    }

    await store.deleteMany("ads", { id });

    const resultado = { ad };

    /* Se borran tambien las fotos del disco */
    await Promise.all(
      (resultado.ad.images || [])
        .filter(ruta => ruta && ruta.startsWith("/uploads/"))
        .map(ruta =>
          fs
            .unlink(path.join(UPLOADS_DIR, path.basename(ruta)))
            .catch(() => {})
        )
    );

    /* Y deja de estar en los favoritos de nadie */
    await store.deleteMany("favoritos", { adId: id });

    res.json({ success: true, message: "Anuncio eliminado correctamente" });
  } catch (error) {
    next(error);
  }
});

/* =========================
   PERFIL PUBLICO DE VENDEDOR

   Antes devolvia el objeto de usuario COMPLETO: hash de contrasena,
   telefono, direcciones y documento de identidad, sin pedir sesion.
========================= */

router.get("/seller/:email", optionalAuth, async (req, res, next) => {
  try {
    const email = normalizarEmail(req.params.email);

    const user = await store.findOne("users", { email });

    if (!user) {
      return res.status(404).json({ message: "Vendedor no encontrado" });
    }

    const productos = (
      await store.findMany(
        "ads",
        { sellerEmail: email },
        { orden: { createdAt: -1 } }
      )
    )
      .filter(a => a.activo !== false)
      .map(vistaAnuncio);

    res.json({
      vendedor: usuarioPublico(user),
      productos
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
