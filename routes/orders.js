/* =========================
   PEDIDOS Y VENTAS

   Lo que estaba roto antes:

   - /checkout aceptaba cualquier cuerpo tal cual. El navegador decidia
     el precio y el comprador. Se podia comprar a 0.01 un producto que
     ni existia.
   - El pedido no guardaba QUIEN VENDIA, asi que el vendedor nunca
     podia ver sus pedidos.
   - El stock nunca bajaba: se podia comprar 100 veces un producto con
     5 unidades.
   - /update-order-status no pedia sesion: cualquiera cambiaba el
     estado del pedido de otro.

   Ahora el precio, el vendedor y el stock los decide el servidor
   leyendo el anuncio real. El navegador solo dice QUE producto y
   CUANTAS unidades.
========================= */

const express = require("express");

const store = require("../lib/store");
const { normalizarEmail, requireAuth } = require("../lib/auth");

const router = express.Router();

const ESTADOS = [
  "pendiente",
  "confirmado",
  "enviado",
  "entregado",
  "cancelado"
];

/* Que transiciones puede hacer cada parte */
const PERMITE_VENDEDOR = ["confirmado", "enviado", "entregado", "cancelado"];
const PERMITE_COMPRADOR = ["cancelado"];

/* Una vez entregado o cancelado, el pedido ya no se toca */
const ESTADOS_FINALES = ["entregado", "cancelado"];

function normalizarEstado(valor) {
  return String(valor || "").trim().toLowerCase();
}

/* =========================
   CREAR PEDIDO (CHECKOUT)

   Cuerpo esperado:
   { items: [{ adId: 123, cantidad: 2 }, ...], direccionId?, metodoPago? }

   Se admite tambien "productos" como nombre del campo, porque asi lo
   llamaba el frontend antiguo.
========================= */

async function crearPedido(req, res, next) {
  try {
    const body = req.body || {};

    const entrada = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.productos)
        ? body.productos
        : [];

    if (entrada.length === 0) {
      return res.status(400).json({ message: "No hay productos para comprar" });
    }

    if (entrada.length > 50) {
      return res.status(400).json({ message: "Demasiados productos en un pedido" });
    }

    /* Se aceptan varios nombres de campo porque el carrito viejo
       guardaba "id" y el nuevo guarda "adId" */
    const pedidos = [];

    for (const item of entrada) {
      const adId = Number(item.adId ?? item.id ?? item.adID);
      const cantidad = parseInt(item.cantidad ?? item.qty ?? 1, 10);

      if (!Number.isFinite(adId) || adId <= 0) {
        return res.status(400).json({
          message:
            "Falta el identificador del producto. Vacia el carrito y vuelve a agregarlo."
        });
      }

      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) {
        return res.status(400).json({ message: "Cantidad invalida" });
      }

      pedidos.push({ adId, cantidad });
    }

    /* Agrupar por si el mismo producto viene repetido en el carrito */
    const porProducto = new Map();

    pedidos.forEach(p => {
      porProducto.set(p.adId, (porProducto.get(p.adId) || 0) + p.cantidad);
    });

    /* La direccion de envio se lee del perfil, no del navegador */
    const direcciones = req.user.direcciones || [];

    const envio =
      direcciones.find(d => Number(d.id) === Number(body.direccionId)) ||
      direcciones.find(d => d.predeterminada) ||
      direcciones[0] ||
      null;

    /* Reserva de stock: comprobar y descontar dentro del mismo turno de
       la cola, para que dos compras a la vez no vendan la misma unidad */
    const reserva = await store.update("ads", ads => {
      const lineas = [];

      for (const [adId, cantidad] of porProducto) {
        const ad = ads.find(a => Number(a.id) === adId);

        if (!ad || ad.activo === false) {
          return { error: `El producto ya no esta disponible`, codigo: 404 };
        }

        if (normalizarEmail(ad.sellerEmail) === req.email) {
          return { error: "No puedes comprar tu propio producto", codigo: 400 };
        }

        const disponible = Number(ad.cantidad) || 0;

        if (disponible < cantidad) {
          return {
            error: `"${ad.title}": solo quedan ${disponible} unidades`,
            codigo: 409
          };
        }

        lineas.push({
          adId: Number(ad.id),
          title: ad.title,
          imagen: ad.image,
          /* El precio sale del anuncio, NO de lo que mande el navegador */
          precio: Number(ad.price) || 0,
          cantidad,
          subtotal: (Number(ad.price) || 0) * cantidad,
          vendedor: normalizarEmail(ad.sellerEmail),
          vendedorNombre: ad.sellerName || "",
          vendedorUsername: ad.sellerUsername || ""
        });
      }

      /* Todo comprobado: ahora si se descuenta */
      lineas.forEach(l => {
        const ad = ads.find(a => Number(a.id) === l.adId);
        ad.cantidad = (Number(ad.cantidad) || 0) - l.cantidad;
      });

      return { lineas };
    });

    if (reserva.error) {
      return res.status(reserva.codigo).json({ message: reserva.error });
    }

    /* Un pedido por vendedor: cada vendedor gestiona el suyo */
    const porVendedor = new Map();

    reserva.lineas.forEach(l => {
      if (!porVendedor.has(l.vendedor)) porVendedor.set(l.vendedor, []);
      porVendedor.get(l.vendedor).push(l);
    });

    const ahora = new Date().toISOString();
    const creados = [];

    for (const [vendedor, lineas] of porVendedor) {
      const total = lineas.reduce((s, l) => s + l.subtotal, 0);

      const orden = {
        id: store.nuevoId(),
        numero: `ORD-${store.nuevoId()}`,

        comprador: req.email,
        compradorNombre:
          `${req.user.nombre || ""} ${req.user.apellido || ""}`.trim() ||
          req.user.businessName ||
          req.email,

        vendedor,
        vendedorNombre: lineas[0].vendedorNombre,

        productos: lineas.map(l => ({
          adId: l.adId,
          title: l.title,
          nombre: l.title, // el frontend antiguo lee "nombre"
          imagen: l.imagen,
          precio: l.precio,
          cantidad: l.cantidad,
          subtotal: l.subtotal
        })),

        total,
        metodoPago: String(body.metodoPago || "no especificado").slice(0, 40),

        envio: envio
          ? {
              nombre: envio.nombre,
              telefono: envio.telefono,
              country: envio.country,
              state: envio.state,
              city: envio.city,
              sector: envio.sector,
              address: envio.address,
              zip: envio.zip,
              reference: envio.reference
            }
          : null,

        estado: "pendiente",
        historial: [{ estado: "pendiente", fecha: ahora, por: req.email }],

        fecha: ahora,
        createdAt: ahora
      };

      await store.insert("orders", orden);

      /* Registro de venta para el vendedor */
      await store.update("sales", sales => {
        lineas.forEach(l => {
          sales.push({
            id: store.nuevoId(),
            orderId: orden.id,
            adId: l.adId,
            producto: l.title,
            precio: l.precio,
            cantidad: l.cantidad,
            total: l.subtotal,
            vendedor,
            comprador: req.email,
            estado: "pendiente",
            fecha: ahora
          });
        });
      });

      creados.push(orden);
    }

    console.log(
      "Nuevo pedido:",
      creados.map(o => o.numero).join(", "),
      "comprador:",
      req.email
    );

    res.status(201).json({
      message: "Compra realizada correctamente",
      pedidos: creados
    });
  } catch (error) {
    next(error);
  }
}

router.post("/checkout", requireAuth, crearPedido);

/* =========================
   COMPATIBILIDAD: /buy

   La pagina de producto usaba /buy para "comprar ahora" y guardaba en
   sales.json, mientras que el carrito usaba /checkout y guardaba en
   orders.json. Eran dos caminos de compra que no se hablaban.

   Ahora /buy es simplemente un pedido de un solo producto: mismo
   codigo, mismas comprobaciones, mismo descuento de stock.
========================= */

router.post("/buy", requireAuth, (req, res, next) => {
  const body = req.body || {};

  req.body = {
    items: [
      {
        adId: body.adId ?? body.id,
        cantidad: body.cantidad ?? 1
      }
    ],
    direccionId: body.direccionId,
    metodoPago: body.metodoPago
  };

  return crearPedido(req, res, next);
});

/* =========================
   MIS PEDIDOS (como comprador)
========================= */

router.get("/my-orders", requireAuth, async (req, res, next) => {
  try {
    const orders = await store.filter(
      "orders",
      o => normalizarEmail(o.comprador) === req.email
    );

    orders.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

/* La ruta antigua llevaba el email en la URL. Se mantiene para no
   romper historial.js, pero el email se ignora: siempre devuelve los
   pedidos de quien esta logueado. */
router.get("/my-orders/:email", requireAuth, async (req, res, next) => {
  try {
    const orders = await store.filter(
      "orders",
      o => normalizarEmail(o.comprador) === req.email
    );

    orders.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

/* =========================
   PEDIDOS QUE ME HAN HECHO (como vendedor)

   Esto no existia: el vendedor no tenia forma de ver sus pedidos.
========================= */

router.get("/seller-orders", requireAuth, async (req, res, next) => {
  try {
    const orders = await store.filter(
      "orders",
      o => normalizarEmail(o.vendedor) === req.email
    );

    orders.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

/* =========================
   MIS VENTAS
========================= */

router.get("/my-sales", requireAuth, async (req, res, next) => {
  try {
    const sales = await store.filter(
      "sales",
      v => normalizarEmail(v.vendedor) === req.email
    );

    sales.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(sales);
  } catch (error) {
    next(error);
  }
});

/* =========================
   CAMBIAR ESTADO DEL PEDIDO
========================= */

router.put("/update-order-status/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const estado = normalizarEstado(req.body && req.body.estado);

    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({
        message: `Estado invalido. Valores admitidos: ${ESTADOS.join(", ")}`
      });
    }

    const resultado = await store.update("orders", orders => {
      const i = orders.findIndex(o => Number(o.id) === id);

      if (i === -1) return { error: "Orden no encontrada", codigo: 404 };

      const orden = orders[i];

      const esVendedor = normalizarEmail(orden.vendedor) === req.email;
      const esComprador = normalizarEmail(orden.comprador) === req.email;

      if (!esVendedor && !esComprador) {
        return { error: "Este pedido no es tuyo", codigo: 403 };
      }

      const actual = normalizarEstado(orden.estado);

      if (ESTADOS_FINALES.includes(actual)) {
        return {
          error: `El pedido ya esta ${actual} y no se puede cambiar`,
          codigo: 409
        };
      }

      const permitidos = esVendedor ? PERMITE_VENDEDOR : PERMITE_COMPRADOR;

      if (!permitidos.includes(estado)) {
        return {
          error: esVendedor
            ? `Como vendedor puedes marcar: ${PERMITE_VENDEDOR.join(", ")}`
            : "Como comprador solo puedes cancelar el pedido",
          codigo: 403
        };
      }

      /* Al cancelar se devuelve el stock al anuncio */
      const devolverStock = estado === "cancelado";

      orden.estado = estado;
      orden.updatedAt = new Date().toISOString();

      if (!Array.isArray(orden.historial)) orden.historial = [];

      orden.historial.push({
        estado,
        fecha: orden.updatedAt,
        por: req.email
      });

      return { orden, devolverStock };
    });

    if (resultado.error) {
      return res.status(resultado.codigo).json({ message: resultado.error });
    }

    if (resultado.devolverStock) {
      await store.update("ads", ads => {
        (resultado.orden.productos || []).forEach(p => {
          const ad = ads.find(a => Number(a.id) === Number(p.adId));
          if (ad) ad.cantidad = (Number(ad.cantidad) || 0) + Number(p.cantidad || 0);
        });
      });
    }

    /* El registro de ventas sigue el mismo estado */
    await store.update("sales", sales => {
      sales.forEach(v => {
        if (Number(v.orderId) === Number(resultado.orden.id)) {
          v.estado = resultado.orden.estado;
        }
      });
    });

    res.json({
      message: "Estado actualizado",
      order: resultado.orden
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
