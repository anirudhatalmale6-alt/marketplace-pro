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

/* Devuelve al anuncio las unidades que se habian reservado.

   Se usa en dos sitios: cuando el checkout falla a mitad, y cuando se
   cancela un pedido. Descontar es "restar si hay bastante"; devolver
   es sumar sin condiciones, asi que se hace con descontar en negativo
   sobre un campo que siempre admite el cambio. */
async function devolverStock(lineas) {
  for (const l of lineas) {
    /* eslint-disable no-await-in-loop */
    const ad = await store.findOne("ads", { id: Number(l.adId) });

    if (!ad) continue;

    await store.updateOne(
      "ads",
      { id: Number(l.adId) },
      { cantidad: (Number(ad.cantidad) || 0) + (Number(l.cantidad) || 0) }
    );
    /* eslint-enable no-await-in-loop */
  }
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

    /* =========================
       RESERVA DE STOCK

       Se descuenta producto a producto con una operacion ATOMICA:
       la base de datos comprueba "hay al menos N" y resta N en un solo
       paso. Si dos personas compran la ultima unidad a la vez, una de
       las dos recibe null. No hay hueco entre comprobar y descontar,
       que es donde se cuela una venta de mas.

       Antes esto se hacia leyendo la lista, comprobando y volviendo a
       escribirla. Dentro de un solo proceso funcionaba; con dos
       servidores contra la misma base, no.

       Si un producto falla a mitad, se DEVUELVE lo ya reservado antes
       de responder. Si no, quedaria stock bloqueado sin ningun pedido
       detras. */
    const lineas = [];
    let fallo = null;

    for (const [adId, cantidad] of porProducto) {
      /* eslint-disable no-await-in-loop */
      const ad = await store.findOne("ads", { id: adId });

      if (!ad || ad.activo === false) {
        fallo = { error: "El producto ya no esta disponible", codigo: 404 };
        break;
      }

      if (normalizarEmail(ad.sellerEmail) === req.email) {
        fallo = { error: "No puedes comprar tu propio producto", codigo: 400 };
        break;
      }

      const reservado = await store.descontar(
        "ads",
        { id: adId, activo: { $ne: false } },
        "cantidad",
        cantidad
      );

      if (!reservado) {
        fallo = {
          error: `"${ad.title}": solo quedan ${Number(ad.cantidad) || 0} unidades`,
          codigo: 409
        };
        break;
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
      /* eslint-enable no-await-in-loop */
    }

    if (fallo) {
      await devolverStock(lineas);
      return res.status(fallo.codigo).json({ message: fallo.error });
    }

    const reserva = { lineas };

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

      /* Registro de venta para el vendedor.

         Insercion suelta por linea: antes se leia sales.json ENTERO
         para anadir una fila, en cada compra. */
      for (const l of lineas) {
        /* eslint-disable no-await-in-loop */
        await store.insertOne("sales", {
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
        /* eslint-enable no-await-in-loop */
      }

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
    /* Consulta con indice sobre "comprador" y ordenada por la propia
       base de datos, en vez de traerse TODOS los pedidos del sitio y
       filtrarlos aqui. */
    const orders = await store.findMany(
      "orders",
      { comprador: req.email },
      { orden: { fecha: -1 } }
    );

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
    const orders = await store.findMany(
      "orders",
      { comprador: req.email },
      { orden: { fecha: -1 } }
    );

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
    const orders = await store.findMany(
      "orders",
      { vendedor: req.email },
      { orden: { fecha: -1 } }
    );

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
    const sales = await store.findMany(
      "sales",
      { vendedor: req.email },
      { orden: { fecha: -1 } }
    );

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
      await devolverStock(resultado.orden.productos || []);
    }

    /* El registro de ventas sigue el mismo estado */
    const ventas = await store.findMany("sales", {
      orderId: Number(resultado.orden.id)
    });

    for (const v of ventas) {
      /* eslint-disable no-await-in-loop */
      await store.updateOne("sales", { id: v.id }, { estado: resultado.orden.estado });
      /* eslint-enable no-await-in-loop */
    }

    res.json({
      message: "Estado actualizado",
      order: resultado.orden
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
