/* =========================
   PRUEBAS DE LA ENTREGA 2: CORREO

   Se ejecuta con:  npm run test-correo

   Levanta un servidor SMTP de mentira en el propio ordenador, arranca
   el proyecto apuntando a el, y comprueba que los correos SALEN DE
   VERDAD por SMTP: no que "no dio error", sino que el mensaje llego,
   a quien tenia que llegar, y con el enlace dentro.

   Despues comprueba los dos flujos completos:
     - recuperar contrasena y entrar con la nueva
     - confirmar el correo de una cuenta recien creada

   Al terminar limpia con npm run limpiar-pruebas.
========================= */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");

const RAIZ = path.join(__dirname, "..");
const PUERTO_APP = 3926;
const PUERTO_SMTP = 3925;
const BUZON = path.join(RAIZ, "data", "buzon-de-pruebas.json");

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

const esperar = ms => new Promise(r => setTimeout(r, ms));

/* ---------- SMTP de mentira, dentro de este mismo proceso ---------- */

const recibidos = [];

function arrancarSmtp() {
  return new Promise(resolve => {
    const servidor = net.createServer(sock => {
      let buffer = "";
      let enDatos = false;
      let mensaje = { para: [], cuerpo: "" };

      const escribir = l => sock.write(l + "\r\n");

      escribir("220 smtp-de-pruebas listo");

      sock.on("data", chunk => {
        buffer += chunk.toString("utf8");

        let corte;
        while ((corte = buffer.indexOf("\r\n")) !== -1) {
          const linea = buffer.slice(0, corte);
          buffer = buffer.slice(corte + 2);

          if (enDatos) {
            if (linea === ".") {
              enDatos = false;
              recibidos.push({ ...mensaje });
              mensaje = { para: [], cuerpo: "" };
              escribir("250 OK");
            } else {
              mensaje.cuerpo += linea + "\n";
            }
            continue;
          }

          const comando = linea.split(" ")[0].toUpperCase();

          if (comando === "EHLO" || comando === "HELO") {
            escribir("250-smtp-de-pruebas");
            escribir("250 AUTH PLAIN LOGIN");
          } else if (comando === "DATA") {
            enDatos = true;
            escribir("354 adelante");
          } else if (comando === "RCPT") {
            const m = linea.match(/<([^>]+)>/);
            if (m) mensaje.para.push(m[1]);
            escribir("250 OK");
          } else if (comando === "QUIT") {
            escribir("221 adios");
            sock.end();
          } else {
            escribir("250 OK");
          }
        }
      });

      sock.on("error", () => {});
    });

    servidor.listen(PUERTO_SMTP, "127.0.0.1", () => resolve(servidor));
  });
}

/* El cuerpo viene codificado (quoted-printable o base64). Se
   descodifica lo justo para poder buscar el enlace dentro. */
function textoDe(mensaje) {
  let cuerpo = mensaje.cuerpo;

  /* quoted-printable: "=\n" corta lineas, "=XX" es un byte */
  cuerpo = cuerpo.replace(/=\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16))
  );

  /* base64: bloques largos sin espacios */
  cuerpo = cuerpo.replace(/^[A-Za-z0-9+/=]{60,}$/gm, linea => {
    try {
      return Buffer.from(linea, "base64").toString("utf8");
    } catch (e) {
      return linea;
    }
  });

  return cuerpo;
}

function correosPara(destinatario) {
  return recibidos.filter(m => m.para.includes(destinatario));
}

function enlaceDe(mensaje, pagina) {
  const texto = textoDe(mensaje);
  const m = texto.match(new RegExp(`https?://[^\\s"'<>]*${pagina}\\?token=[a-f0-9]+`));
  return m ? m[0] : null;
}

/* ---------- cliente HTTP con cookies ---------- */

function cliente() {
  let cookie = "";

  return async (metodo, ruta, cuerpo) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;

    let body;
    if (cuerpo !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(cuerpo);
    }

    const r = await fetch(`http://localhost:${PUERTO_APP}${ruta}`, {
      method: metodo,
      headers,
      body
    });

    (r.headers.getSetCookie ? r.headers.getSetCookie() : []).forEach(c => {
      const par = c.split(";")[0];
      if (par.startsWith("token=")) cookie = par;
    });

    const texto = await r.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch (e) {
      /* html */
    }

    return { status: r.status, json };
  };
}

function arrancarApp(env) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["server.js"], {
      cwd: RAIZ,
      env: { ...process.env, ...env, PORT: String(PUERTO_APP) }
    });

    let salida = "";
    let listo = false;

    const mirar = d => {
      salida += d.toString();
      if (!listo && salida.includes("Servidor corriendo")) {
        listo = true;
        resolve({ proc, salida: () => salida });
      }
    };

    proc.stdout.on("data", mirar);
    proc.stderr.on("data", mirar);

    setTimeout(() => {
      if (!listo) {
        proc.kill();
        reject(new Error("el servidor no arranco:\n" + salida));
      }
    }, 25000);
  });
}

/* =========================
   LAS PRUEBAS
========================= */

(async () => {
  const smtp = await arrancarSmtp();
  console.log(`\nSMTP de pruebas en 127.0.0.1:${PUERTO_SMTP}\n`);

  const env = {
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(PUERTO_SMTP),
    SMTP_USER: "pruebas@localhost",
    SMTP_PASS: "loquesea",
    SMTP_SEGURO: "false",
    URL_PUBLICA: `http://localhost:${PUERTO_APP}`,
    CORREO_REMITENTE: "Marketplace <no-reply@pruebas.local>",
    LOGIN_MAX_INTENTOS: "500",
    API_MAX_PETICIONES: "9000",
    REGISTRO_MAX_CUENTAS: "5000",
    RECUPERACION_MAX: "500",
    MONGODB_URI: ""
  };

  const { proc, salida } = await arrancarApp(env);

  await esperar(500);

  console.log("=== 1. ARRANQUE ===");
  check(
    "el servidor comprueba el SMTP al arrancar y dice que esta listo",
    salida().includes("Correo: SMTP listo"),
    salida().split("\n").filter(l => /[Cc]orreo/.test(l)).join(" | ")
  );

  const ts = Date.now();
  const CORREO = `carrera${ts}7@t.com`;
  const CLAVE = "clave12345";
  const CLAVE_NUEVA = "clavenueva999";

  console.log("\n=== 2. VERIFICACION AL REGISTRARSE ===");

  const a = cliente();
  const reg = await a("POST", "/register", {
    accountType: "personal",
    nombre: "Ana",
    apellido: "Prueba",
    email: CORREO,
    password: CLAVE,
    telefono: "8090000000",
    country: "RD", state: "SD", city: "DN",
    sector: "x", address: "y", zip: "1"
  });

  check("la cuenta se crea", reg.status === 201, JSON.stringify(reg.json));
  check(
    "el servidor dice que la verificacion salio",
    reg.json && reg.json.verificacion === "enviada",
    JSON.stringify(reg.json && reg.json.verificacion)
  );

  await esperar(800);

  const mensajesVerif = correosPara(CORREO);
  check(
    "EL CORREO LLEGO DE VERDAD AL SMTP (no solo 'sin error')",
    mensajesVerif.length === 1,
    `mensajes recibidos: ${mensajesVerif.length}`
  );

  const enlaceVerif = mensajesVerif[0] && enlaceDe(mensajesVerif[0], "verificar\\.html");
  check("el correo trae el enlace de confirmacion", Boolean(enlaceVerif), String(enlaceVerif));

  const tokenVerif = enlaceVerif && enlaceVerif.split("token=")[1];

  const antes = await a("GET", "/me");
  check(
    "la cuenta empieza SIN verificar",
    antes.json && antes.json.user && !antes.json.user.correoVerificado
  );

  const verif = await a("POST", "/verify-email", { token: tokenVerif });
  check("confirmar el correo funciona", verif.status === 200, JSON.stringify(verif.json));

  const despues = await a("GET", "/me");
  check(
    "la cuenta queda marcada como verificada",
    despues.json && despues.json.user && despues.json.user.correoVerificado === true,
    JSON.stringify(despues.json && despues.json.user && despues.json.user.correoVerificado)
  );

  const repetir = await a("POST", "/verify-email", { token: tokenVerif });
  check(
    "el mismo enlace NO se puede usar dos veces",
    repetir.status === 400,
    `dio ${repetir.status}`
  );

  console.log("\n=== 3. RECUPERAR CONTRASENA ===");

  const antesDeRecuperar = recibidos.length;

  const pedir = await cliente()("POST", "/forgot-password", { email: CORREO });
  check("pedir recuperacion responde 200", pedir.status === 200);

  await esperar(800);

  const nuevos = recibidos.slice(antesDeRecuperar).filter(m => m.para.includes(CORREO));
  check("llega el correo de recuperacion", nuevos.length === 1, `llegaron ${nuevos.length}`);

  const enlaceRec = nuevos[0] && enlaceDe(nuevos[0], "nueva-clave\\.html");
  check("trae el enlace para elegir contrasena", Boolean(enlaceRec), String(enlaceRec));

  const tokenRec = enlaceRec && enlaceRec.split("token=")[1];

  const comprobar = await cliente()(
    "GET",
    `/reset-password/check?token=${tokenRec}`
  );
  check(
    "la pagina puede comprobar que el enlace vale ANTES de pedir la clave",
    comprobar.json && comprobar.json.valido === true,
    JSON.stringify(comprobar.json)
  );

  const corta = await cliente()("POST", "/reset-password", {
    token: tokenRec,
    password: "123"
  });
  check("rechaza una contrasena corta", corta.status === 400);

  const cambiar = await cliente()("POST", "/reset-password", {
    token: tokenRec,
    password: CLAVE_NUEVA
  });
  check("cambia la contrasena", cambiar.status === 200, JSON.stringify(cambiar.json));

  const conNueva = await cliente()("POST", "/login", {
    email: CORREO,
    password: CLAVE_NUEVA
  });
  check("SE PUEDE ENTRAR con la contrasena nueva", conNueva.status === 200);

  const conVieja = await cliente()("POST", "/login", {
    email: CORREO,
    password: CLAVE
  });
  check("la contrasena vieja ya NO sirve", conVieja.status === 401);

  const reusar = await cliente()("POST", "/reset-password", {
    token: tokenRec,
    password: "otraclave123"
  });
  check(
    "el enlace de recuperacion es de UN SOLO USO",
    reusar.status === 400,
    `dio ${reusar.status}`
  );

  console.log("\n=== 3b. RECUPERAR LA CLAVE NO MATA EL ENLACE DE VERIFICACION ===");

  /* Esto fallaba y la prueba de arriba no lo veia, por el ORDEN:
     alli se confirmaba el correo ANTES de recuperar la clave.
     Haciendolo al reves (que es lo normal: te registras, no miras el
     correo, y al dia siguiente recuperas la clave) el enlace de
     confirmacion se moria. Lo encontro la prueba en navegador. */

  const b2 = cliente();
  const CORREO2 = `carrera${ts}6@t.com`;

  await b2("POST", "/register", {
    accountType: "personal", nombre: "Orden", apellido: "Inverso",
    email: CORREO2, password: CLAVE, telefono: "8090000004",
    country: "RD", state: "SD", city: "DN", sector: "x", address: "y", zip: "1"
  });

  await esperar(800);

  const verif2 = correosPara(CORREO2);
  const enlaceVerif2 = verif2[0] && enlaceDe(verif2[0], "verificar\\.html");
  const tokenVerif2 = enlaceVerif2 && enlaceVerif2.split("token=")[1];

  check("CONTROL: la cuenta nueva recibe su enlace de confirmacion",
    Boolean(tokenVerif2), String(enlaceVerif2));

  /* AHORA recupera la contrasena, SIN haber confirmado el correo */
  await cliente()("POST", "/forgot-password", { email: CORREO2 });
  await esperar(800);

  const rec2 = correosPara(CORREO2).filter(m => enlaceDe(m, "nueva-clave\\.html"));
  const tokenRec2 = enlaceDe(rec2[0], "nueva-clave\\.html").split("token=")[1];

  const cambio2 = await cliente()("POST", "/reset-password", {
    token: tokenRec2,
    password: "otraclavenueva1"
  });
  check("cambia la contrasena", cambio2.status === 200);

  /* Y el enlace de confirmacion de antes TIENE que seguir valiendo */
  const verifDespues = await cliente()("POST", "/verify-email", {
    token: tokenVerif2
  });

  check(
    "el enlace de CONFIRMAR CORREO sigue valiendo despues de recuperar la clave",
    verifDespues.status === 200,
    `dio ${verifDespues.status}: ${JSON.stringify(verifDespues.json)}`
  );

  console.log("\n=== 4. NO SE FILTRA QUIEN TIENE CUENTA ===");

  const antesDeInexistente = recibidos.length;

  const inexistente = await cliente()("POST", "/forgot-password", {
    email: `noexiste${ts}@t.com`
  });

  await esperar(600);

  check(
    "con un correo que no existe responde IGUAL que con uno que si",
    inexistente.status === 200 &&
      inexistente.json.message === pedir.json.message,
    JSON.stringify(inexistente.json)
  );
  check(
    "y no manda ningun correo",
    recibidos.length === antesDeInexistente,
    `se mandaron ${recibidos.length - antesDeInexistente}`
  );

  console.log("\n=== 5. AVISOS DE PEDIDO ===");

  /* vendedor con producto */
  const vend = cliente();
  const CORREO_V = `vendedor${ts}@test.com`;

  await vend("POST", "/register", {
    accountType: "business", nombre: "V", apellido: "V",
    businessName: "Tienda Avisos", documentType: "RNC", documentNumber: "1",
    email: CORREO_V, password: CLAVE, telefono: "8090000001",
    country: "RD", state: "SD", city: "DN", sector: "x", address: "y", zip: "1"
  });

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );

  const fd = new FormData();
  fd.append("title", "Producto con aviso");
  fd.append("description", "para probar los correos");
  fd.append("price", "1200");
  fd.append("cantidad", "5");
  fd.append("categoria", "celulares");
  fd.append("condicion", "nuevo");
  fd.append("images", new Blob([png], { type: "image/png" }), "f.png");

  const crearRes = await fetch(`http://localhost:${PUERTO_APP}/create-ad`, {
    method: "POST",
    headers: { cookie: "" },
    body: fd
  });

  /* hay que mandar la cookie del vendedor: se rehace con el cliente */
  const adId = await (async () => {
    const r = await vend("POST", "/login", { email: CORREO_V, password: CLAVE });
    if (r.status !== 200) return null;

    /* el cliente() no manda FormData, asi que se publica con fetch
       reutilizando su cookie */
    return null;
  })();

  /* Se publica con una peticion aparte que lleva la cookie a mano */
  const loginV = await fetch(`http://localhost:${PUERTO_APP}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: CORREO_V, password: CLAVE })
  });

  const cookieV = (loginV.headers.getSetCookie() || [])
    .map(c => c.split(";")[0])
    .find(c => c.startsWith("token="));

  const fd2 = new FormData();
  fd2.append("title", "Producto con aviso");
  fd2.append("description", "para probar los correos");
  fd2.append("price", "1200");
  fd2.append("cantidad", "5");
  fd2.append("categoria", "celulares");
  fd2.append("condicion", "nuevo");
  fd2.append("images", new Blob([png], { type: "image/png" }), "f.png");

  const pub = await fetch(`http://localhost:${PUERTO_APP}/create-ad`, {
    method: "POST",
    headers: { cookie: cookieV },
    body: fd2
  });

  const pubJson = await pub.json();
  const idAnuncio = pubJson.ad && pubJson.ad.id;

  check("el vendedor publica", pub.status === 201, JSON.stringify(pubJson).slice(0, 120));

  /* comprador */
  const comp = cliente();
  const CORREO_C = `carrera${ts}8@t.com`;

  await comp("POST", "/register", {
    accountType: "personal", nombre: "Comp", apellido: "Rador",
    email: CORREO_C, password: CLAVE, telefono: "8090000002",
    country: "RD", state: "SD", city: "DN", sector: "x", address: "y", zip: "1"
  });

  const antesCompra = recibidos.length;

  const compra = await comp("POST", "/checkout", {
    items: [{ adId: idAnuncio, cantidad: 2 }]
  });

  check("la compra se hace", compra.status === 201, JSON.stringify(compra.json).slice(0, 120));

  await esperar(1200);

  const avisoVendedor = recibidos
    .slice(antesCompra)
    .filter(m => m.para.includes(CORREO_V));

  check(
    "AL VENDEDOR LE LLEGA EL AVISO DE VENTA",
    avisoVendedor.length === 1,
    `le llegaron ${avisoVendedor.length}`
  );

  if (avisoVendedor[0]) {
    const texto = textoDe(avisoVendedor[0]);
    check(
      "el aviso dice que producto y cuanto",
      texto.includes("Producto con aviso") && /2[\.,]400/.test(texto),
      texto.replace(/\s+/g, " ").slice(0, 160)
    );
  }

  /* cambio de estado -> aviso al comprador */
  const pedidos = await fetch(`http://localhost:${PUERTO_APP}/seller-orders`, {
    headers: { cookie: cookieV }
  }).then(r => r.json());

  const antesEstado = recibidos.length;

  await fetch(
    `http://localhost:${PUERTO_APP}/update-order-status/${pedidos[0].id}`,
    {
      method: "PUT",
      headers: { cookie: cookieV, "content-type": "application/json" },
      body: JSON.stringify({ estado: "enviado" })
    }
  );

  await esperar(1200);

  const avisoComprador = recibidos
    .slice(antesEstado)
    .filter(m => m.para.includes(CORREO_C));

  check(
    "AL COMPRADOR LE LLEGA EL AVISO DE QUE VA EN CAMINO",
    avisoComprador.length === 1,
    `le llegaron ${avisoComprador.length}`
  );

  console.log("\n=== 6. SE RESPETA QUIEN NO QUIERE CORREOS ===");

  await comp("PUT", "/update-configuracion", {
    notificaciones: true,
    correoNotificaciones: false,
    apariencia: "claro",
    idioma: "es"
  });

  const antesApagado = recibidos.length;

  await fetch(
    `http://localhost:${PUERTO_APP}/update-order-status/${pedidos[0].id}`,
    {
      method: "PUT",
      headers: { cookie: cookieV, "content-type": "application/json" },
      body: JSON.stringify({ estado: "entregado" })
    }
  );

  await esperar(1200);

  const trasApagar = recibidos
    .slice(antesApagado)
    .filter(m => m.para.includes(CORREO_C));

  check(
    "si apaga los avisos por correo, NO se le escribe",
    trasApagar.length === 0,
    `le llegaron ${trasApagar.length}`
  );

  /* ---------- control negativo: sin SMTP no se miente ---------- */

  console.log("\n=== 7. CONTROL: SIN SMTP, EL SERVIDOR NO DICE QUE ENVIO ===");

  proc.kill();
  await esperar(1200);

  const sinSmtp = await arrancarApp({
    ...env,
    SMTP_HOST: "",
    SMTP_USER: ""
  });

  await esperar(500);

  check(
    "avisa en el arranque de que esta en modo pruebas",
    sinSmtp.salida().includes("MODO PRUEBAS"),
    sinSmtp.salida().split("\n").filter(l => /CORREO/.test(l)).join(" | ")
  );

  const antesSinSmtp = recibidos.length;

  const regSinSmtp = await cliente()("POST", "/register", {
    accountType: "personal", nombre: "Sin", apellido: "Smtp",
    email: `carrera${ts}9@t.com`, password: CLAVE, telefono: "8090000003",
    country: "RD", state: "SD", city: "DN", sector: "x", address: "y", zip: "1"
  });

  await esperar(600);

  check(
    "la cuenta se crea igual aunque no haya correo",
    regSinSmtp.status === 201
  );
  check(
    "y el servidor DICE que la verificacion no salio",
    regSinSmtp.json && regSinSmtp.json.verificacion === "no_enviada",
    JSON.stringify(regSinSmtp.json && regSinSmtp.json.verificacion)
  );
  check(
    "no se mando nada por SMTP (control)",
    recibidos.length === antesSinSmtp,
    `se mandaron ${recibidos.length - antesSinSmtp}`
  );

  const log = path.join(RAIZ, "data", "correos.log");
  check(
    "el correo queda guardado en data/correos.log para poder verlo",
    fs.existsSync(log) && fs.readFileSync(log, "utf8").includes(`carrera${ts}9@t.com`)
  );

  sinSmtp.proc.kill();
  smtp.close();

  if (fs.existsSync(BUZON)) fs.unlinkSync(BUZON);

  console.log(`\n=== RESULTADO: ${ok} correctas, ${fail} fallidas ===\n`);

  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error("ERROR EN LA PRUEBA:", e);
  process.exit(1);
});
