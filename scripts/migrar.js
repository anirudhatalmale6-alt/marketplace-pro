/* =========================
   MIGRACION Y LIMPIEZA DE DATOS

   Se ejecuta con:  npm run migrar

   Es seguro ejecutarlo varias veces: cada paso comprueba antes de
   tocar nada. Lo primero que hace es una copia de seguridad completa
   en backups/AAAA-MM-DD_hh-mm-ss/

   Que arregla:

   1) Mueve los .json sueltos de la raiz a la carpeta data/
   2) Cifra las contrasenas que estaban guardadas en TEXTO PLANO
      (14 de 18 cuentas). Sin esto, esas personas no pueden entrar:
      bcrypt.compare contra un texto plano siempre da falso.
   3) Pone todos los correos en minusculas. El registro guardaba en
      minusculas y el login comparaba texto exacto: quien se registraba
      con una mayuscula no podia entrar nunca.
   4) accountType: los valores "Individual" y vacio pasan a "personal",
      que es uno de los dos tipos que entiende el codigo.
   5) Genera username a quien no lo tenga y quita los repetidos.
   6) Anuncios: el campo "email" del vendedor pasa a "sellerEmail"
      (por eso en la portada salia "undefined" como vendedor),
      y el precio pasa de texto ("5000") a numero (5000).
   7) Pedidos: quita "http://localhost:3000" de las imagenes y las deja
      como rutas relativas, para que sigan cargando en el servidor.
      Rellena el vendedor cuando se puede deducir del anuncio.
   8) Normaliza los estados de los pedidos a minusculas.
========================= */

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

const { ROOT, DATA_DIR, BACKUP_DIR } = require("../lib/paths");

const COLECCIONES = [
  "users",
  "ads",
  "orders",
  "sales",
  "favoritos",
  "login-activity",
  "comentarios",
  "resolution-cases",
  "solicitudes-datos"
];

const RONDAS_BCRYPT = 12;

const registro = [];

function anotar(mensaje) {
  registro.push(mensaje);
  console.log(`  ${mensaje}`);
}

function leer(nombre) {
  const file = path.join(DATA_DIR, `${nombre}.json`);

  if (!fs.existsSync(file)) return [];

  try {
    const texto = fs.readFileSync(file, "utf8").trim();
    if (!texto) return [];

    const datos = JSON.parse(texto);
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    throw new Error(`No se pudo leer ${nombre}.json: ${error.message}`);
  }
}

function guardar(nombre, datos) {
  fs.writeFileSync(
    path.join(DATA_DIR, `${nombre}.json`),
    JSON.stringify(datos, null, 2),
    "utf8"
  );
}

function minus(v) {
  return String(v || "").trim().toLowerCase();
}

function aNumero(valor) {
  const n = Number(String(valor).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/* =========================
   PASO 0 - COPIA DE SEGURIDAD
========================= */

function copiaSeguridad() {
  const marca = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  const destino = path.join(BACKUP_DIR, marca);

  fs.mkdirSync(destino, { recursive: true });

  let n = 0;

  [ROOT, DATA_DIR].forEach(origen => {
    if (!fs.existsSync(origen)) return;

    fs.readdirSync(origen)
      .filter(f => f.endsWith(".json") && f !== "package-lock.json")
      .filter(f => f !== "package.json")
      .forEach(f => {
        const desde = path.join(origen, f);
        if (!fs.statSync(desde).isFile()) return;

        const nombreDestino =
          origen === ROOT ? `raiz_${f}` : `data_${f}`;

        fs.copyFileSync(desde, path.join(destino, nombreDestino));
        n += 1;
      });
  });

  anotar(`Copia de seguridad: ${n} archivos en backups/${marca}/`);
}

/* =========================
   PASO 1 - MOVER LOS .JSON A data/
========================= */

function moverADatos() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let movidos = 0;

  COLECCIONES.forEach(nombre => {
    const origen = path.join(ROOT, `${nombre}.json`);
    const destino = path.join(DATA_DIR, `${nombre}.json`);

    if (!fs.existsSync(origen)) return;

    if (fs.existsSync(destino)) {
      /* Ya migrado antes: se deja el de data/ y se aparta el viejo */
      fs.renameSync(origen, `${origen}.antiguo`);
      anotar(`${nombre}.json ya estaba en data/, el de la raiz se renombro a .antiguo`);
      return;
    }

    fs.renameSync(origen, destino);
    movidos += 1;
  });

  if (movidos) anotar(`${movidos} colecciones movidas de la raiz a data/`);
}

/* =========================
   PASO 2 - USUARIOS
========================= */

async function migrarUsuarios() {
  const users = leer("users");

  if (users.length === 0) {
    anotar("users: no hay usuarios");
    return users;
  }

  let cifradas = 0;
  let correos = 0;
  let tipos = 0;
  let usernames = 0;

  const usados = new Set();

  for (const user of users) {
    /* --- correo en minusculas --- */
    const original = user.email;
    user.email = minus(user.email);
    if (original !== user.email) correos += 1;

    /* --- contrasena en texto plano --- */
    const pass = String(user.password || "");

    if (pass && !pass.startsWith("$2")) {
      user.password = await bcrypt.hash(pass, RONDAS_BCRYPT);
      user.passwordMigrada = new Date().toISOString();
      cifradas += 1;
    }

    /* --- tipo de cuenta --- */
    const tipo = minus(user.accountType);

    if (tipo !== "personal" && tipo !== "business") {
      user.accountType = "personal";
      tipos += 1;
    } else {
      user.accountType = tipo;
    }

    /* --- username unico --- */
    let username = minus(user.username).replace(/[^a-z0-9]/g, "");

    if (!username) {
      const base =
        user.accountType === "business"
          ? user.businessName
          : `${user.nombre || ""}${user.apellido || ""}`;

      username =
        minus(base)
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 20) || "usuario";
    }

    let candidato = username;
    let n = 0;

    while (usados.has(candidato)) {
      n += 1;
      candidato = `${username}${n}`;
    }

    if (candidato !== user.username) usernames += 1;

    user.username = candidato;
    usados.add(candidato);

    /* --- campos que el codigo nuevo espera --- */
    if (user.rating === undefined) user.rating = 0;
    if (user.totalSales === undefined) user.totalSales = 0;
  }

  /* --- correos duplicados --- */
  const vistos = new Map();
  const duplicados = [];

  users.forEach(u => {
    if (vistos.has(u.email)) duplicados.push(u.email);
    else vistos.set(u.email, u);
  });

  guardar("users", users);

  anotar(`users: ${users.length} cuentas`);
  if (cifradas) anotar(`users: ${cifradas} contrasenas cifradas (estaban en texto plano)`);
  if (correos) anotar(`users: ${correos} correos pasados a minusculas`);
  if (tipos) anotar(`users: ${tipos} accountType corregidos a "personal"`);
  if (usernames) anotar(`users: ${usernames} usernames generados o corregidos`);
  if (duplicados.length) {
    anotar(
      `AVISO users: ${duplicados.length} correos repetidos tras pasar a minusculas: ${duplicados.join(", ")}`
    );
  }

  return users;
}

/* =========================
   PASO 3 - ANUNCIOS
========================= */

function migrarAnuncios(users) {
  const ads = leer("ads");

  let vendedores = 0;
  let precios = 0;

  const porEmail = new Map(users.map(u => [minus(u.email), u]));

  ads.forEach(ad => {
    /* El campo del vendedor cambio de nombre a mitad del proyecto:
       los anuncios viejos lo guardan en "email" */
    if (!ad.sellerEmail && ad.email) {
      ad.sellerEmail = ad.email;
      vendedores += 1;
    }

    ad.sellerEmail = minus(ad.sellerEmail);

    /* Rellenar el nombre del vendedor a partir del usuario real */
    const user = porEmail.get(ad.sellerEmail);

    if (user) {
      if (!ad.sellerName) {
        ad.sellerName =
          user.accountType === "business"
            ? user.businessName
            : `${user.nombre || ""} ${user.apellido || ""}`.trim();
      }
      if (!ad.sellerUsername) ad.sellerUsername = user.username;
    }

    /* Precio: de texto a numero */
    if (typeof ad.price !== "number") {
      ad.price = aNumero(ad.price);
      precios += 1;
    }

    ad.cantidad = parseInt(ad.cantidad, 10) || 0;

    if (!Array.isArray(ad.images)) ad.images = ad.image ? [ad.image] : [];

    /* Imagenes como rutas relativas */
    ad.images = ad.images.map(quitarLocalhost);
    ad.image = quitarLocalhost(ad.image) || ad.images[0] || "";

    if (ad.activo === undefined) ad.activo = true;
    if (!ad.condicion) ad.condicion = "nuevo";
    ad.condicion = minus(ad.condicion);
  });

  const huerfanos = ads.filter(a => !porEmail.has(a.sellerEmail));

  guardar("ads", ads);

  anotar(`ads: ${ads.length} anuncios`);
  if (vendedores) anotar(`ads: ${vendedores} anuncios con el vendedor recuperado del campo "email"`);
  if (precios) anotar(`ads: ${precios} precios convertidos de texto a numero`);
  if (huerfanos.length) {
    anotar(
      `AVISO ads: ${huerfanos.length} anuncios cuyo vendedor ya no existe como usuario` +
        ` (ids: ${huerfanos.map(a => a.id).join(", ")})`
    );
  }

  return ads;
}

/* =========================
   QUITAR http://localhost:3000 DE LAS RUTAS
========================= */

function quitarLocalhost(ruta) {
  if (!ruta || typeof ruta !== "string") return ruta;

  return ruta.replace(/^https?:\/\/[^/]+(\/uploads\/)/i, "$1");
}

/* =========================
   PASO 4 - PEDIDOS
========================= */

function migrarPedidos(ads) {
  const orders = leer("orders");

  let imagenes = 0;
  let vendedores = 0;
  let estados = 0;
  let sinVendedor = 0;

  const porTitulo = new Map(
    ads.map(a => [String(a.title || "").trim().toLowerCase(), a])
  );

  orders.forEach(orden => {
    orden.comprador = minus(orden.comprador);

    const estadoOriginal = orden.estado;
    orden.estado = minus(orden.estado) || "pendiente";
    if (estadoOriginal !== orden.estado) estados += 1;

    if (!orden.numero) orden.numero = `ORD-${orden.id}`;

    if (!Array.isArray(orden.productos)) orden.productos = [];

    orden.productos.forEach(p => {
      const antes = p.imagen;
      p.imagen = quitarLocalhost(p.imagen);
      if (antes !== p.imagen) imagenes += 1;

      /* El carrito guardaba el precio como texto de pantalla
         ("RD$ 966"). Se pasa a numero para poder sumar totales. */
      if (typeof p.precio !== "number") p.precio = aNumero(p.precio);

      p.cantidad = parseInt(p.cantidad, 10) || 1;

      /* Los pedidos viejos no guardaban a que anuncio correspondia
         cada linea. Se intenta recuperar por el titulo; si no
         coincide se deja vacio en vez de inventar nada. */
      if (!p.adId) {
        const ad = porTitulo.get(
          String(p.nombre || p.title || "").trim().toLowerCase()
        );
        if (ad) {
          p.adId = ad.id;
          if (!p.title) p.title = ad.title;
        }
      }
    });

    /* El pedido no guardaba el vendedor: se deduce del anuncio */
    if (!orden.vendedor) {
      const conAd = orden.productos.find(p => p.adId);

      if (conAd) {
        const ad = ads.find(a => Number(a.id) === Number(conAd.adId));
        if (ad && ad.sellerEmail) {
          orden.vendedor = minus(ad.sellerEmail);
          vendedores += 1;
        }
      }
    } else {
      orden.vendedor = minus(orden.vendedor);
    }

    if (!orden.vendedor) sinVendedor += 1;

    if (orden.total === undefined) {
      orden.total = orden.productos.reduce(
        (s, p) => s + (Number(p.precio) || 0) * (Number(p.cantidad) || 1),
        0
      );
    }

    if (!Array.isArray(orden.historial)) {
      orden.historial = [
        { estado: orden.estado, fecha: orden.fecha || null, por: orden.comprador }
      ];
    }
  });

  guardar("orders", orders);

  anotar(`orders: ${orders.length} pedidos`);
  if (imagenes) anotar(`orders: ${imagenes} imagenes con http://localhost:3000 pasadas a ruta relativa`);
  if (vendedores) anotar(`orders: ${vendedores} pedidos con el vendedor recuperado`);
  if (estados) anotar(`orders: ${estados} estados normalizados a minusculas`);
  if (sinVendedor) {
    anotar(
      `AVISO orders: ${sinVendedor} pedidos siguen SIN vendedor` +
        " (su producto ya no existe, no hay de donde deducirlo)"
    );
  }
}

/* =========================
   PASO 5 - VENTAS Y RESTO
========================= */

function migrarResto() {
  const sales = leer("sales");

  sales.forEach(v => {
    v.vendedor = minus(v.vendedor);
    v.comprador = minus(v.comprador);
    if (typeof v.precio !== "number") v.precio = aNumero(v.precio);
    if (!v.estado) v.estado = "pendiente";
    v.estado = minus(v.estado);
  });

  guardar("sales", sales);
  anotar(`sales: ${sales.length} registros normalizados`);

  ["favoritos", "login-activity", "comentarios", "resolution-cases", "solicitudes-datos"].forEach(
    nombre => {
      const lista = leer(nombre);

      lista.forEach(item => {
        if (item.email) item.email = minus(item.email);
        if (item.vendedor) item.vendedor = minus(item.vendedor);
        if (item.adId !== undefined) item.adId = Number(item.adId);
      });

      guardar(nombre, lista);

      if (lista.length) anotar(`${nombre}: ${lista.length} registros normalizados`);
    }
  );
}

/* =========================
   EJECUCION
========================= */

(async () => {
  console.log("\n=== MIGRACION DE DATOS ===\n");

  try {
    copiaSeguridad();
    moverADatos();

    const users = await migrarUsuarios();
    const ads = migrarAnuncios(users);

    migrarPedidos(ads);
    migrarResto();

    console.log("\n=== MIGRACION TERMINADA ===");
    console.log(`${registro.length} pasos. Copia de seguridad en backups/\n`);
  } catch (error) {
    console.error("\nLA MIGRACION FALLO:", error.message);
    console.error(
      "Puede haber quedado a medias. Los datos originales estan en la\n" +
        "carpeta backups/ que se creo al empezar: restaura desde ahi.\n"
    );
    process.exit(1);
  }
})();
