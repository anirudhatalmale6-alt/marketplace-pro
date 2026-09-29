/* =========================
   ENVIO DE CORREO

   Un solo sitio desde donde sale todo el correo del proyecto.

   DOS MODOS, y se elige solo:

     Con SMTP_HOST en el .env  -> manda correo de verdad.
     Sin SMTP_HOST             -> MODO PRUEBAS: no manda nada, escribe
                                  el correo entero en data/correos.log
                                  y lo saca por consola.

   El modo pruebas existe para que el proyecto funcione hoy, antes de
   que contrates el servicio de correo. Lo importante: en ese modo el
   servidor NUNCA dice que envio nada. La respuesta al navegador lleva
   "enviado: false" y en la consola aparece un aviso. Un correo que no
   sale no se puede contar como enviado.
========================= */

const fs = require("fs/promises");
const path = require("path");
const nodemailer = require("nodemailer");

const { DATA_DIR } = require("./paths");

let transporte = null;
let modo = "pruebas";

/* =========================
   CONFIGURACION
========================= */

function configurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

function remitente() {
  return (
    process.env.CORREO_REMITENTE ||
    `Marketplace <${process.env.SMTP_USER || "no-reply@localhost"}>`
  );
}

/* La direccion publica del sitio. Hace falta para los enlaces que van
   dentro del correo: no se puede adivinar desde una peticion porque
   los correos se mandan tambien desde procesos sin peticion. */
function urlBase() {
  const url = process.env.URL_PUBLICA || `http://localhost:${process.env.PORT || 3000}`;
  return url.replace(/\/+$/, "");
}

async function iniciar() {
  if (!configurado()) {
    modo = "pruebas";

    console.warn(
      "\nCORREO EN MODO PRUEBAS: no hay SMTP_HOST en el .env.\n" +
        "Los correos NO se envian; se guardan en data/correos.log.\n" +
        "Para enviarlos de verdad, rellena SMTP_* en el .env.\n"
    );

    return { modo };
  }

  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SEGURO) === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  /* Comprobar de verdad que las credenciales valen, en vez de
     descubrirlo cuando alguien pida recuperar su contrasena */
  try {
    await transporte.verify();
    modo = "smtp";
    console.log(`Correo: SMTP listo (${process.env.SMTP_HOST})`);
  } catch (error) {
    transporte = null;
    modo = "pruebas";

    console.error(
      "\nEL SMTP NO RESPONDE: " + error.message + "\n" +
        "Se sigue en MODO PRUEBAS para no tumbar el sitio, pero NO se\n" +
        "estan enviando correos. Revisa SMTP_HOST, SMTP_USER y SMTP_PASS.\n"
    );
  }

  return { modo };
}

/* =========================
   ENVIAR
========================= */

async function enviar({ para, asunto, html, texto }) {
  const mensaje = {
    from: remitente(),
    to: para,
    subject: asunto,
    text: texto || quitarHtml(html),
    html
  };

  if (modo !== "smtp" || !transporte) {
    await guardarEnArchivo(mensaje);

    console.log(
      `[CORREO NO ENVIADO - modo pruebas] para: ${para} | asunto: ${asunto}`
    );

    return { enviado: false, modo: "pruebas" };
  }

  try {
    const info = await transporte.sendMail(mensaje);
    return { enviado: true, modo: "smtp", id: info.messageId };
  } catch (error) {
    /* Que falle un correo NO debe tumbar la operacion que lo disparo:
       si el aviso al vendedor falla, la compra sigue siendo valida. */
    console.error(`Fallo al enviar correo a ${para}: ${error.message}`);

    await guardarEnArchivo({ ...mensaje, error: error.message });

    return { enviado: false, modo: "smtp", error: error.message };
  }
}

function quitarHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function guardarEnArchivo(mensaje) {
  const linea =
    `\n${"=".repeat(70)}\n` +
    `FECHA:   ${new Date().toISOString()}\n` +
    `PARA:    ${mensaje.to}\n` +
    `ASUNTO:  ${mensaje.subject}\n` +
    (mensaje.error ? `ERROR:   ${mensaje.error}\n` : "") +
    `${"-".repeat(70)}\n${mensaje.text}\n`;

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(path.join(DATA_DIR, "correos.log"), linea, "utf8");
  } catch (error) {
    console.error("No se pudo escribir data/correos.log:", error.message);
  }
}

/* =========================
   PLANTILLAS

   HTML sencillo a proposito: los gestores de correo (Gmail, Outlook)
   ignoran la mayoria del CSS moderno. Tablas y estilos en linea es lo
   que se ve igual en todos.
========================= */

function escapar(texto) {
  return String(texto === undefined || texto === null ? "" : texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plantilla({ titulo, cuerpo, boton }) {
  const enlace = boton
    ? `<p style="margin:28px 0;">
         <a href="${boton.url}"
            style="background:#1a73e8;color:#ffffff;text-decoration:none;
                   padding:13px 26px;border-radius:6px;display:inline-block;
                   font-weight:bold;">${escapar(boton.texto)}</a>
       </p>
       <p style="color:#777;font-size:13px;">
         Si el boton no funciona, copia este enlace en tu navegador:<br>
         <span style="color:#1a73e8;word-break:break-all;">${boton.url}</span>
       </p>`
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;
                      margin:0 auto;padding:24px;color:#222;line-height:1.6;">
      <h2 style="margin:0 0 18px;color:#1a73e8;">${escapar(titulo)}</h2>
      ${cuerpo}
      ${enlace}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0 14px;">
      <p style="color:#999;font-size:12px;margin:0;">
        Este correo se envio automaticamente. No hace falta contestarlo.
      </p>
    </div>`;
}

/* --- Verificar la cuenta --- */

function correoVerificacion(nombre, token) {
  return {
    asunto: "Confirma tu correo",
    html: plantilla({
      titulo: "Confirma tu correo",
      cuerpo: `<p>Hola ${escapar(nombre)},</p>
               <p>Gracias por registrarte. Pulsa el boton para confirmar
                  que este correo es tuyo.</p>`,
      boton: {
        texto: "Confirmar mi correo",
        url: `${urlBase()}/verificar.html?token=${token}`
      }
    })
  };
}

/* --- Recuperar la contrasena --- */

function correoRecuperacion(nombre, token) {
  return {
    asunto: "Recuperar tu contrasena",
    html: plantilla({
      titulo: "Recuperar tu contrasena",
      cuerpo: `<p>Hola ${escapar(nombre)},</p>
               <p>Pediste cambiar tu contrasena. Pulsa el boton y elige
                  una nueva. <strong>El enlace vale una hora</strong> y
                  solo se puede usar una vez.</p>
               <p>Si no fuiste tu, no hagas nada: tu contrasena sigue
                  igual.</p>`,
      boton: {
        texto: "Elegir contrasena nueva",
        url: `${urlBase()}/nueva-clave.html?token=${token}`
      }
    })
  };
}

/* --- Aviso al vendedor: tienes una venta --- */

function correoNuevoPedido(vendedor, orden) {
  const lineas = (orden.productos || [])
    .map(
      p => `<tr>
              <td style="padding:6px 0;">${escapar(p.title || p.nombre)}</td>
              <td style="padding:6px 0;text-align:center;">${p.cantidad}</td>
              <td style="padding:6px 0;text-align:right;">RD$ ${Number(p.subtotal || 0).toLocaleString("es-DO")}</td>
            </tr>`
    )
    .join("");

  return {
    asunto: `Tienes una venta: ${orden.numero}`,
    html: plantilla({
      titulo: "Te han comprado",
      cuerpo: `<p>Hola ${escapar(vendedor)},</p>
        <p><strong>${escapar(orden.compradorNombre || orden.comprador)}</strong>
           acaba de hacerte un pedido.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;
                      border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5;">
          ${lineas}
        </table>
        <p style="text-align:right;font-size:16px;">
          <strong>Total: RD$ ${Number(orden.total || 0).toLocaleString("es-DO")}</strong>
        </p>
        <p>Entra en tu panel para confirmarlo y prepararlo para el envio.</p>`,
      boton: { texto: "Ver el pedido", url: `${urlBase()}/dashboard.html` }
    })
  };
}

/* --- Aviso al comprador: cambio el estado --- */

const TEXTO_ESTADO = {
  confirmado: "El vendedor confirmo tu pedido y lo esta preparando.",
  enviado: "Tu pedido va en camino.",
  entregado: "Tu pedido figura como entregado. Que lo disfrutes.",
  cancelado: "Tu pedido fue cancelado."
};

function correoEstadoPedido(comprador, orden) {
  const estado = String(orden.estado || "").toLowerCase();

  return {
    asunto: `Tu pedido ${orden.numero}: ${estado}`,
    html: plantilla({
      titulo: "Novedades de tu pedido",
      cuerpo: `<p>Hola ${escapar(comprador)},</p>
               <p>${escapar(TEXTO_ESTADO[estado] || `Tu pedido esta ahora: ${estado}`)}</p>
               <p style="color:#666;font-size:14px;">
                 Pedido <strong>${escapar(orden.numero)}</strong> &middot;
                 RD$ ${Number(orden.total || 0).toLocaleString("es-DO")}
               </p>`,
      boton: { texto: "Ver mis compras", url: `${urlBase()}/historial.html` }
    })
  };
}

module.exports = {
  iniciar,
  enviar,
  urlBase,
  modoActual: () => modo,
  correoVerificacion,
  correoRecuperacion,
  correoNuevoPedido,
  correoEstadoPedido
};
