/* =========================
   PRUEBAS DE LA API

   Como se usan:

     1) arranca el servidor en una terminal:   npm start
     2) en otra terminal:                      npm test

   Comprueban de punta a punta los fallos que se arreglaron: login con
   mayusculas, contrasenas migradas, rutas privadas sin sesion, precios
   y stock decididos por el servidor, permisos de pedidos, etc.

   OJO: crean usuarios y pedidos de prueba en los datos reales. Para
   dejarlo limpio, ejecuta despues:  npm run limpiar-pruebas
========================= */

/* Prueba de punta a punta contra el servidor real */

/* Puerto del servidor que se va a probar. Se toma de la variable
   PORT (la misma del .env); si no, 3000. */
const PORT = process.env.PORT || 3000;
const B = `http://localhost:${PORT}`;

let ok = 0;
let fail = 0;

function check(nombre, condicion, detalle = "") {
  if (condicion) {
    ok += 1;
    console.log(`  OK   ${nombre}`);
  } else {
    fail += 1;
    console.log(`  FALLA ${nombre}  ${detalle}`);
  }
}

/* Cliente con su propio "tarro de cookies" */
function cliente() {
  let cookie = "";

  return async (metodo, ruta, cuerpo, opciones = {}) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;

    let body;

    if (cuerpo instanceof FormData) {
      body = cuerpo;
    } else if (cuerpo !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(cuerpo);
    }

    const r = await fetch(B + ruta, { method: metodo, headers, body, redirect: "manual" });

    const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    set.forEach(c => {
      const par = c.split(";")[0];
      if (par.startsWith("token=")) cookie = par;
    });

    const texto = await r.text();
    let json = null;
    try { json = JSON.parse(texto); } catch (e) { /* html */ }

    return { status: r.status, json, texto };
  };
}

(async () => {
  console.log("\n=== 1. ARRANQUE ===");
  const anon = cliente();

  const health = await anon("GET", "/api/health");
  check("el servidor responde", health.status === 200 && health.json.ok);

  console.log("\n=== 2. BUG 1: correo con mayusculas (antes: no podia entrar nunca) ===");
  const a = cliente();

  const correoMixto = `Prueba.Mayus${Date.now()}@Gmail.com`;

  const reg = await a("POST", "/register", {
    accountType: "personal",
    nombre: "Ana",
    apellido: "Perez",
    email: correoMixto,
    password: "clave12345",
    telefono: "8091234567",
    country: "RD", state: "Santo Domingo", city: "DN",
    sector: "Naco", address: "Calle 1", zip: "10101"
  });
  check("registro con correo en mayusculas", reg.status === 201, JSON.stringify(reg.json));

  const login1 = await a("POST", "/login", { email: correoMixto, password: "clave12345" });
  check("login con el correo TAL CUAL lo escribio (mayusculas)", login1.status === 200, JSON.stringify(login1.json));

  const b = cliente();
  const login2 = await b("POST", "/login", { email: correoMixto.toLowerCase(), password: "clave12345" });
  check("login con el mismo correo en minusculas", login2.status === 200);

  console.log("\n=== 3. BUG 2: usuarios con la contrasena en texto plano ===");
  const c = cliente();
  const viejo = await c("POST", "/login", { email: "manuel@hotmail.com", password: "sasasdas" });
  check("un usuario antiguo ya puede entrar con su contrasena de siempre", viejo.status === 200, JSON.stringify(viejo.json));

  console.log("\n=== 4. BUG 4: el servidor ya no filtra datos privados ===");
  check("el login NO devuelve la contrasena", login1.json.user && login1.json.user.password === undefined,
    JSON.stringify(Object.keys(login1.json.user || {})));

  const sinSesion = await anon("GET", "/get-user?email=americodislaz98@gmail.com");
  check("/get-user sin sesion -> 401", sinSesion.status === 401, `dio ${sinSesion.status}`);

  const propio = await a("GET", "/get-user?email=americodislaz98@gmail.com");
  check("/get-user con sesion devuelve MIS datos, no los del email pedido",
    propio.status === 200 && propio.json.email === correoMixto.toLowerCase(),
    JSON.stringify(propio.json && propio.json.email));
  check("/get-user no incluye la contrasena", propio.json && propio.json.password === undefined);

  const vendedorPub = await anon("GET", "/seller/americodislaz98@gmail.com");
  check("/seller publico no expone contrasena", vendedorPub.status === 200 && !vendedorPub.json.vendedor.password);
  check("/seller publico no expone telefono", !vendedorPub.json.vendedor.telefono);
  check("/seller publico no expone direccion", !vendedorPub.json.vendedor.address);

  console.log("\n=== 5. BUG 3: rutas privadas sin sesion ===");
  for (const [metodo, ruta, cuerpo] of [
    ["GET", "/my-ads"], ["GET", "/my-orders"], ["GET", "/my-sales"],
    ["GET", "/seller-orders"], ["GET", "/direcciones"], ["GET", "/get-pagos"],
    ["GET", "/favoritos"], ["GET", "/login-activity"], ["GET", "/resolution-cases"],
    ["GET", "/get-configuracion"], ["GET", "/get-transferencia"],
    ["POST", "/checkout", { items: [] }], ["POST", "/update-profile", {}],
    ["PUT", "/update-order-status/1", { estado: "enviado" }],
    ["POST", "/solicitar-datos", {}], ["POST", "/comentarios", { texto: "x" }]
  ]) {
    const r = await anon(metodo, ruta, cuerpo);
    check(`${metodo} ${ruta} sin sesion -> 401`, r.status === 401, `dio ${r.status}`);
  }

  console.log("\n=== 6. Endpoints que antes daban 404 ===");
  const t1 = await a("POST", "/guardar-transferencia", {
    banco: "Banco Popular", tipoCuenta: "ahorro", titular: "Ana Perez", numeroCuenta: "1234567890"
  });
  check("POST /guardar-transferencia funciona", t1.status === 200, `dio ${t1.status}`);

  const t2 = await a("GET", "/get-transferencia");
  check("GET /get-transferencia funciona", t2.status === 200);
  check("el numero de cuenta vuelve enmascarado",
    t2.json.transferencia && /^\*+7890$/.test(t2.json.transferencia.numeroCuenta),
    JSON.stringify(t2.json.transferencia));

  console.log("\n=== 7. Publicar un producto ===");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );

  const vend = cliente();
  await vend("POST", "/register", {
    accountType: "business",
    nombre: "Luis", apellido: "Gomez",
    businessName: "Tienda Luis", documentType: "RNC", documentNumber: "130123456",
    email: `vendedor${Date.now()}@test.com`, password: "clave12345",
    telefono: "8090000000", country: "RD", state: "SD", city: "DN",
    sector: "x", address: "y", zip: "1"
  });

  const fd = new FormData();
  fd.append("title", "Telefono de prueba");
  fd.append("description", "Descripcion de prueba");
  fd.append("price", "1500");
  fd.append("cantidad", "3");
  fd.append("categoria", "celulares");
  fd.append("condicion", "nuevo");
  fd.append("images", new Blob([png], { type: "image/png" }), "foto.png");

  const crear = await vend("POST", "/create-ad", fd);
  check("publicar anuncio", crear.status === 201, JSON.stringify(crear.json));

  const adId = crear.json.ad && crear.json.ad.id;
  check("el precio se guarda como NUMERO", crear.json.ad && typeof crear.json.ad.price === "number",
    typeof (crear.json.ad || {}).price);
  check("la imagen se guarda como ruta relativa (sin localhost)",
    crear.json.ad && crear.json.ad.image.startsWith("/uploads/"), (crear.json.ad || {}).image);
  check("el anuncio guarda sellerEmail", crear.json.ad && !!crear.json.ad.sellerEmail);

  const fdMalo = new FormData();
  fdMalo.append("title", "Script");
  fdMalo.append("description", "d");
  fdMalo.append("price", "10");
  fdMalo.append("cantidad", "1");
  fdMalo.append("categoria", "x");
  fdMalo.append("images", new Blob(["<?php echo 1; ?>"], { type: "application/x-php" }), "malo.php");
  const subidaMala = await vend("POST", "/create-ad", fdMalo);
  check("rechaza subir un archivo que no es imagen", subidaMala.status === 400, `dio ${subidaMala.status}`);

  console.log("\n=== 8. Busqueda y filtros en el servidor ===");

  /* CONTROL: sin filtros tiene que venir la lista completa.
     Si esto diera 0, todas las pruebas de filtro de abajo pasarian
     solas sin comprobar nada. */
  const todos = await anon("GET", "/all-ads");
  check("CONTROL: /all-ads sin filtros devuelve la lista completa",
    Array.isArray(todos.json) && todos.json.length >= 5, `devolvio ${(todos.json || []).length}`);

  const busca = await anon("GET", "/all-ads?q=telefono%20de%20prueba");
  check("buscar por texto encuentra el producto", Array.isArray(busca.json) && busca.json.some(x => x.id === adId),
    `devolvio ${(busca.json || []).length}`);
  check("buscar por texto DESCARTA lo que no coincide", busca.json.length < todos.json.length,
    `${busca.json.length} de ${todos.json.length}`);

  const nada = await anon("GET", "/all-ads?q=zzzzzznoexiste");
  check("buscar algo que no existe devuelve lista vacia", Array.isArray(nada.json) && nada.json.length === 0);

  const filtra = await anon("GET", "/all-ads?min=100000");
  check("filtrar por precio minimo excluye el de 1500",
    Array.isArray(filtra.json) && !filtra.json.some(x => x.id === adId));

  const filtraBajo = await anon("GET", "/all-ads?min=1000&max=2000");
  check("filtrar 1000-2000 SI incluye el de 1500",
    filtraBajo.json.some(x => x.id === adId), `devolvio ${(filtraBajo.json || []).length}`);

  const porCat = await anon("GET", "/all-ads?categoria=celulares");
  check("filtrar por categoria", porCat.json.some(x => x.id === adId) && porCat.json.every(x => x.categoria === "celulares"));

  const pag = await anon("GET", "/all-ads?pagina=1&porPagina=2");
  check("paginacion devuelve 2 por pagina y el total real",
    pag.json.ads && pag.json.ads.length === 2 && pag.json.total === todos.json.length,
    JSON.stringify({ n: (pag.json.ads || []).length, total: pag.json.total }));

  const orden = await anon("GET", "/all-ads?orden=precio-asc");
  const precios = orden.json.map(x => x.price);
  check("ordenar por precio ascendente (numerico)",
    precios.every((p, i) => i === 0 || precios[i - 1] <= p), JSON.stringify(precios));

  const cats = await anon("GET", "/categorias");
  check("/categorias devuelve las categorias con su conteo", Array.isArray(cats.json) && cats.json.length > 0);

  console.log("\n=== 9. BUG 5+6+15: la compra llega al servidor, con vendedor y con stock ===");
  await a("POST", "/direcciones", {
    nombre: "Casa", telefono: "8091112222", country: "RD",
    state: "Santo Domingo", city: "DN", sector: "Naco",
    address: "Calle 1 #2", zip: "10101"
  });

  const compra = await a("POST", "/checkout", { items: [{ adId, cantidad: 2 }] });
  check("checkout crea el pedido", compra.status === 201, JSON.stringify(compra.json));

  const pedido = compra.json.pedidos && compra.json.pedidos[0];
  check("el pedido guarda el VENDEDOR", pedido && !!pedido.vendedor, JSON.stringify(pedido && pedido.vendedor));
  check("el precio lo pone el servidor (1500), no el navegador",
    pedido && pedido.productos[0].precio === 1500, JSON.stringify(pedido && pedido.productos[0]));
  check("el total se calcula en el servidor (1500 x 2 = 3000)", pedido && pedido.total === 3000, String(pedido && pedido.total));
  check("el pedido lleva la direccion de envio del perfil", pedido && pedido.envio && pedido.envio.address === "Calle 1 #2");

  const adDespues = await anon("GET", `/ads/${adId}`);
  check("el stock bajo de 3 a 1", adDespues.json.cantidad === 1, `quedan ${adDespues.json.cantidad}`);

  const sinStock = await a("POST", "/checkout", { items: [{ adId, cantidad: 5 }] });
  check("no deja comprar mas de lo que hay", sinStock.status === 409, `dio ${sinStock.status}: ${JSON.stringify(sinStock.json)}`);

  const propio2 = await vend("POST", "/checkout", { items: [{ adId, cantidad: 1 }] });
  check("no deja comprarse su propio producto", propio2.status === 400, `dio ${propio2.status}`);

  const inventado = await a("POST", "/checkout", { items: [{ adId: 999999999, cantidad: 1 }] });
  check("no deja comprar un producto que no existe", inventado.status === 404, `dio ${inventado.status}`);

  console.log("\n=== 10. El comprador y el vendedor ven el pedido ===");
  const misPedidos = await a("GET", "/my-orders");
  check("el comprador ve su pedido", misPedidos.json.some(o => o.id === pedido.id));

  const pedidosVend = await vend("GET", "/seller-orders");
  check("el VENDEDOR ve el pedido (esto antes no existia)", pedidosVend.json.some(o => o.id === pedido.id));

  const ventas = await vend("GET", "/my-sales");
  check("la venta aparece en /my-sales del vendedor", ventas.json.some(v => v.orderId === pedido.id));

  console.log("\n=== 11. BUG: cambiar el estado de un pedido ajeno ===");
  const ajeno = await b("PUT", `/update-order-status/${pedido.id}`, { estado: "entregado" });
  check("un tercero NO puede cambiar el estado -> 403", ajeno.status === 403, `dio ${ajeno.status}`);

  const compradorIntenta = await a("PUT", `/update-order-status/${pedido.id}`, { estado: "enviado" });
  check("el comprador no puede marcar 'enviado' -> 403", compradorIntenta.status === 403, `dio ${compradorIntenta.status}`);

  const vendMarca = await vend("PUT", `/update-order-status/${pedido.id}`, { estado: "enviado" });
  check("el vendedor SI puede marcar 'enviado'", vendMarca.status === 200, JSON.stringify(vendMarca.json));

  const estadoRaro = await vend("PUT", `/update-order-status/${pedido.id}`, { estado: "loquesea" });
  check("rechaza un estado inventado", estadoRaro.status === 400);

  console.log("\n=== 12. Cancelar devuelve el stock ===");
  const compra2 = await b("POST", "/checkout", { items: [{ adId, cantidad: 1 }] });
  check("segunda compra ok", compra2.status === 201, JSON.stringify(compra2.json));

  const stockTras = await anon("GET", `/ads/${adId}`);
  check("el stock bajo a 0", stockTras.json.cantidad === 0, `quedan ${stockTras.json.cantidad}`);

  const cancela = await b("PUT", `/update-order-status/${compra2.json.pedidos[0].id}`, { estado: "cancelado" });
  check("el comprador SI puede cancelar", cancela.status === 200, JSON.stringify(cancela.json));

  const stockVuelto = await anon("GET", `/ads/${adId}`);
  check("al cancelar, el stock vuelve a 1", stockVuelto.json.cantidad === 1, `quedan ${stockVuelto.json.cantidad}`);

  console.log("\n=== 13. Un anuncio solo lo edita y borra su dueno ===");
  const editaAjeno = await a("PUT", `/ads/${adId}`, { price: 1 });
  check("otro usuario no puede editar el anuncio -> 403", editaAjeno.status === 403, `dio ${editaAjeno.status}`);

  const borraAjeno = await a("DELETE", `/ads/${adId}`);
  check("otro usuario no puede borrar el anuncio -> 403", borraAjeno.status === 403, `dio ${borraAjeno.status}`);

  const editaDueno = await vend("PUT", `/ads/${adId}`, { price: 1200 });
  check("el dueno si puede editar", editaDueno.status === 200 && editaDueno.json.ad.price === 1200);

  console.log("\n=== 14. Favoritos y comentarios ===");
  const fav = await a("POST", "/favoritos", { adId });
  check("agregar a favoritos", fav.status === 201, JSON.stringify(fav.json));

  const favDup = await a("POST", "/favoritos", { adId });
  check("no duplica el favorito", favDup.status === 409);

  const favLista = await a("GET", "/favoritos");
  check("aparece en mi lista de favoritos", favLista.json.some(x => x.id === adId));

  const comSuyo = await vend("POST", "/comentarios", { texto: "me auto-reseno", calificacion: 5, vendedor: crear.json.ad.sellerEmail });
  check("no deja auto-resenarse", comSuyo.status === 400, `dio ${comSuyo.status}`);

  const com = await a("POST", "/comentarios", { texto: "Todo perfecto", calificacion: 5, vendedor: crear.json.ad.sellerEmail });
  check("dejar una resena a un vendedor", com.status === 201, JSON.stringify(com.json));

  const perfilVend = await anon("GET", `/seller/${crear.json.ad.sellerEmail}`);
  check("la valoracion media del vendedor se actualizo a 5", perfilVend.json.vendedor.rating === 5,
    String(perfilVend.json.vendedor.rating));

  console.log("\n=== 15. Cambio de contrasena y cierre de sesion ===");
  const cambioMal = await a("POST", "/change-password", { currentPassword: "incorrecta", newPassword: "otraclave123" });
  check("no cambia la contrasena sin la actual correcta", cambioMal.status === 401);

  const cambioCorta = await a("POST", "/change-password", { currentPassword: "clave12345", newPassword: "corta" });
  check("exige minimo 8 caracteres", cambioCorta.status === 400);

  const cambio = await a("POST", "/change-password", { currentPassword: "clave12345", newPassword: "nuevaclave123" });
  check("cambia la contrasena", cambio.status === 200, JSON.stringify(cambio.json));

  const loginNuevo = await cliente()("POST", "/login", { email: correoMixto, password: "nuevaclave123" });
  check("entra con la contrasena nueva", loginNuevo.status === 200);

  const loginViejo = await cliente()("POST", "/login", { email: correoMixto, password: "clave12345" });
  check("la contrasena vieja ya no sirve", loginViejo.status === 401);

  const yo = await a("GET", "/me");
  check("/me dice quien soy", yo.status === 200 && yo.json.autenticado === true);

  await a("POST", "/logout");
  const trasSalir = await a("GET", "/me");
  check("tras cerrar sesion /me dice que no hay sesion",
    trasSalir.status === 200 && trasSalir.json.autenticado === false,
    `${trasSalir.status} ${JSON.stringify(trasSalir.json)}`);

  console.log("\n=== 16. Validaciones de registro ===");
  for (const [nombre, cuerpo, esperado] of [
    ["contrasena corta", { accountType: "personal", nombre: "a", apellido: "b", email: `x${Date.now()}@t.com`, password: "123", telefono: "8090000000" }, 400],
    ["correo invalido", { accountType: "personal", nombre: "a", apellido: "b", email: "noesuncorreo", password: "clave12345", telefono: "8090000000" }, 400],
    ["telefono invalido", { accountType: "personal", nombre: "a", apellido: "b", email: `y${Date.now()}@t.com`, password: "clave12345", telefono: "abc" }, 400],
    ["tipo de cuenta invalido", { accountType: "Individual", nombre: "a", apellido: "b", email: `z${Date.now()}@t.com`, password: "clave12345", telefono: "8090000000" }, 400],
    ["correo repetido", { accountType: "personal", nombre: "a", apellido: "b", email: correoMixto, password: "clave12345", telefono: "8090000000" }, 400]
  ]) {
    const r = await cliente()("POST", "/register", cuerpo);
    check(`registro rechaza: ${nombre}`, r.status === esperado, `dio ${r.status} ${JSON.stringify(r.json)}`);
  }


  console.log("\n=== 17. Dos compradores a la vez por la ULTIMA unidad ===");

  /* Esta es la prueba que justifica MongoDB.

     Se publica un producto con UNA sola unidad y se lanzan 8 compras
     simultaneas. Exactamente una debe salir bien y siete deben recibir
     "no queda stock". Si salieran dos, se habria vendido algo que no
     existe: el fallo mas caro que puede tener una tienda. */

  const fdUno = new FormData();
  fdUno.append("title", "Ultima unidad");
  fdUno.append("description", "Solo queda una");
  fdUno.append("price", "999");
  fdUno.append("cantidad", "1");
  fdUno.append("categoria", "celulares");
  fdUno.append("condicion", "nuevo");
  fdUno.append("images", new Blob([png], { type: "image/png" }), "foto.png");

  const crearUno = await vend("POST", "/create-ad", fdUno);
  const adUnico = crearUno.json.ad && crearUno.json.ad.id;
  check("CONTROL: producto de prueba con stock 1", crearUno.status === 201 && crearUno.json.ad.cantidad === 1,
    JSON.stringify(crearUno.json && crearUno.json.ad && crearUno.json.ad.cantidad));

  /* 8 compradores distintos, cada uno con su sesion */
  const compradores = [];

  for (let i = 0; i < 8; i += 1) {
    const c = cliente();
    await c("POST", "/register", {
      accountType: "personal", nombre: "Carrera", apellido: `N${i}`,
      email: `carrera${Date.now()}${i}@t.com`, password: "clave12345",
      telefono: "8090000009", country: "RD", state: "SD", city: "DN",
      sector: "x", address: "y", zip: "1"
    });
    compradores.push(c);
  }

  /* PRE-CALENTAR antes de la carrera.

     Sin esto la prueba NO SIRVE. Cada cliente tiene que abrir su
     conexion TCP la primera vez, y eso escalona las peticiones unos
     10 ms unas de otras: llegan en fila india y nunca coinciden dentro
     del descuento de stock. La prueba pasaria siempre, incluso con un
     descuento mal hecho.

     Comprobado: con una version no atomica de descontar(), asi tal
     cual la prueba da 1 ganador (parece correcta); pre-calentando,
     da 5 ganadores y 5 pedidos para 1 unidad, que es el fallo real. */
  await Promise.all(compradores.map(c => c("GET", "/me")));
  await new Promise(r => setTimeout(r, 200));

  /* Ahora si: todas a la vez, sin esperar unas a otras */
  const intentos = await Promise.all(
    compradores.map(c => c("POST", "/checkout", { items: [{ adId: adUnico, cantidad: 1 }] }))
  );

  const ganadores = intentos.filter(r => r.status === 201).length;
  const rechazados = intentos.filter(r => r.status === 409).length;

  console.log("     codigos devueltos:", intentos.map(r => r.status).join(", "));

  check(`exactamente 1 de 8 compras simultaneas sale bien (fueron ${ganadores})`,
    ganadores === 1, intentos.map(r => r.status).join(","));
  check(`las otras 7 reciben "sin stock" (fueron ${rechazados})`,
    rechazados === 7, intentos.map(r => r.status).join(","));

  const stockFinal = await anon("GET", `/ads/${adUnico}`);
  check("el stock queda en 0, nunca en negativo", stockFinal.json.cantidad === 0,
    `quedo en ${stockFinal.json.cantidad}`);

  const pedidosDelProducto = (await vend("GET", "/seller-orders")).json
    .filter(o => (o.productos || []).some(p => Number(p.adId) === Number(adUnico)));

  check("solo se creo UN pedido para esa unidad",
    pedidosDelProducto.length === 1, `se crearon ${pedidosDelProducto.length}`);

  console.log(`\n=== RESULTADO: ${ok} correctas, ${fail} fallidas ===\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("ERROR EN LA PRUEBA:", e); process.exit(1); });
