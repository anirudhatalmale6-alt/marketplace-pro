/* =========================
   CENTRO DE RESOLUCIÓN
========================= */

document.addEventListener("DOMContentLoaded", async () => {

  /* Los casos son privados: sin sesion no hay nada que ver */
  const usuario = await Sesion.proteger("login.html?volver=resolucion.html");

  if (!usuario) return;

  await cargarCasos();

  const formulario =
    document.getElementById("formCaso");

  if (formulario) {

    formulario.addEventListener(
      "submit",
      enviarCaso
    );

  }

});


/* =========================
   OBTENER USUARIO
========================= */

function obtenerUsuario() {

  try {

    const usuario =
      JSON.parse(
        localStorage.getItem("usuario")
      );

    if (usuario) {
      return usuario;
    }

  } catch (error) {

    console.error(
      "Error leyendo usuario:",
      error
    );

  }

  return null;
}


/* =========================
   OBTENER EMAIL
========================= */

function obtenerEmail() {

  const usuario =
    obtenerUsuario();

  if (
    usuario &&
    usuario.email
  ) {

    return usuario.email
      .trim()
      .toLowerCase();

  }

  const email =
    localStorage.getItem("email");

  if (email) {

    return email
      .trim()
      .toLowerCase();

  }

  return null;
}


/* =========================
   ABRIR CASO
========================= */

function abrirCaso(tipo) {

  const modal =
    document.getElementById(
      "modalCaso"
    );

  const tipoInput =
    document.getElementById(
      "tipoCaso"
    );

  const titulo =
    document.getElementById(
      "tituloModal"
    );

  const descripcion =
    document.getElementById(
      "descripcionModal"
    );


  tipoInput.value = tipo;


  const textos = {

    compra: {
      titulo:
        "Problema con una compra",

      descripcion:
        "Cuéntanos qué problema tuviste con el producto que compraste."
    },

    pago: {
      titulo:
        "Problema con un pago",

      descripcion:
        "Describe el problema relacionado con tu pago o transferencia."
    },

    pedido: {
      titulo:
        "Problema con un pedido",

      descripcion:
        "Indica qué ocurrió con tu pedido o entrega."
    },

    devolucion: {
      titulo:
        "Solicitar devolución",

      descripcion:
        "Indica por qué deseas devolver el producto."
    }

  };


  const informacion =
    textos[tipo] ||
    textos.compra;


  titulo.textContent =
    informacion.titulo;

  descripcion.textContent =
    informacion.descripcion;


  modal.classList.add(
    "mostrar"
  );


  document
    .getElementById("asunto")
    .focus();

}


/* =========================
   CERRAR MODAL
========================= */

function cerrarModal() {

  const modal =
    document.getElementById(
      "modalCaso"
    );

  modal.classList.remove(
    "mostrar"
  );

}


/* =========================
   ENVIAR CASO
========================= */

async function enviarCaso(event) {

  event.preventDefault();


  const email =
    obtenerEmail();


  if (!email) {

    mostrarMensaje(
      "Debes iniciar sesión para crear un caso."
    );

    return;

  }


  const tipo =
    document.getElementById(
      "tipoCaso"
    ).value;


  const asunto =
    document.getElementById(
      "asunto"
    ).value.trim();


  const descripcion =
    document.getElementById(
      "descripcionCaso"
    ).value.trim();


  const pedido =
    document.getElementById(
      "numeroPedido"
    ).value.trim();


  if (!asunto) {

    mostrarMensaje(
      "Escribe el asunto del problema."
    );

    return;

  }


  if (!descripcion) {

    mostrarMensaje(
      "Describe el problema."
    );

    return;

  }


  /* =========================
     CREAR EL CASO EN EL SERVIDOR

     Antes esto guardaba el caso en localStorage. O sea: el caso se
     quedaba en el navegador de quien lo escribia y no llegaba a
     ninguna parte. Nadie podia atenderlo, y si el usuario entraba
     desde otro telefono sus casos no aparecian.

     El servidor ya tenia /resolution-cases hecho; solo faltaba que la
     pagina lo llamara.
  ========================= */

  const boton = document.querySelector("#formCaso button[type=submit]");
  if (boton) boton.disabled = true;

  const { ok, status, datos } = await Sesion.api("/resolution-cases", {
    method: "POST",
    body: { tipo, asunto, descripcion, pedido }
  });

  if (boton) boton.disabled = false;

  if (status === 401) {
    mostrarMensaje("Tu sesion expiro. Vuelve a iniciar sesion.");
    window.location.href = "login.html?volver=resolucion.html";
    return;
  }

  if (!ok) {
    /* El servidor comprueba que el pedido exista y sea tuyo, asi que
       aqui se muestra el motivo real en vez de un mensaje generico */
    mostrarMensaje((datos && datos.message) || "No se pudo crear el caso.");
    return;
  }

  document.getElementById("formCaso").reset();

  cerrarModal();

  await cargarCasos();

  mostrarMensaje("Caso creado correctamente.");

}


/* =========================
   OBTENER CASOS
========================= */

async function obtenerCasos() {

  /* Los casos viven en el servidor, no en el navegador.
     Antes se leian de localStorage: solo los veia quien los escribio,
     y desde ese mismo telefono. */
  const { ok, datos } = await Sesion.api("/resolution-cases");

  return ok && Array.isArray(datos) ? datos : [];

}


/* =========================
   GUARDAR CASOS
========================= */

/* guardarCasos() se elimino: ya no se guarda nada en el navegador.
   Crear un caso es una llamada al servidor (ver enviarCaso). */




/* =========================
   CARGAR CASOS
========================= */

async function cargarCasos() {

  const lista =
    document.getElementById(
      "listaCasos"
    );

  const contador =
    document.getElementById(
      "contadorCasos"
    );


  if (!lista) {
    return;
  }


  const casos =
    await obtenerCasos();


  contador.textContent =
    casos.length;


  if (casos.length === 0) {

    lista.innerHTML = `

      <div class="sin-casos">

        <div class="sin-casos-icono">
          📋
        </div>

        <h3>
          No tienes casos abiertos
        </h3>

        <p>
          Cuando reportes un problema aparecerá aquí.
        </p>

      </div>

    `;

    return;

  }


  lista.innerHTML =
    casos.map(
      caso => {

        const estadoClase =
          caso.estado === "resuelto"
            ? "estado-resuelto"
            : "estado-abierto";


        const estadoTexto =
          caso.estado === "resuelto"
            ? "Resuelto"
            : "Abierto";


        return `

          <div class="caso-card">

            <div class="caso-superior">

              <div>

                <h3>
                  ${escaparHTML(caso.asunto)}
                </h3>

                <p>
                  Caso #${caso.id}
                </p>

                <p>
                  ${escaparHTML(caso.fecha)}
                </p>

              </div>

              <span class="estado ${estadoClase}">
                ${estadoTexto}
              </span>

            </div>

            <p>
              ${escaparHTML(caso.descripcion)}
            </p>

            ${
              caso.pedido
                ? `
                  <p>
                    <strong>
                      Pedido:
                    </strong>
                    ${escaparHTML(caso.pedido)}
                  </p>
                `
                : ""
            }

          </div>

        `;

      }
    ).join("");

}


/* =========================
   CONTACTAR SOPORTE
========================= */

function contactarSoporte() {

  mostrarMensaje(
    "El sistema de soporte estará disponible próximamente. 💬"
  );

}


/* =========================
   MENSAJE
========================= */

function mostrarMensaje(texto) {

  const mensaje =
    document.getElementById(
      "mensajeResolucion"
    );


  mensaje.textContent =
    texto;


  mensaje.style.display =
    "block";


  setTimeout(() => {

    mensaje.style.display =
      "none";

  }, 4000);

}


/* =========================
   SEGURIDAD HTML
========================= */

function escaparHTML(texto) {

  return String(texto)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================
   CERRAR MODAL
   AL HACER CLICK AFUERA
========================= */

document.addEventListener(
  "click",
  (event) => {

    const modal =
      document.getElementById(
        "modalCaso"
      );

    if (
      event.target === modal
    ) {

      cerrarModal();

    }

  }
);