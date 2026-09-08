/* =========================
   CENTRO DE RESOLUCIÓN
========================= */

document.addEventListener("DOMContentLoaded", () => {

  cargarCasos();

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

function enviarCaso(event) {

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
     CREAR CASO LOCAL
     TEMPORAL
  ========================= */

  let casos =
    obtenerCasos();


  const nuevoCaso = {

    id: Date.now(),

    email,

    tipo,

    asunto,

    descripcion,

    pedido,

    estado: "abierto",

    fecha:
      new Date().toLocaleString()

  };


  casos.unshift(
    nuevoCaso
  );


  guardarCasos(
    casos
  );


  document
    .getElementById(
      "formCaso"
    )
    .reset();


  cerrarModal();

  cargarCasos();


  mostrarMensaje(
    "Caso creado correctamente. ✅"
  );

}


/* =========================
   OBTENER CASOS
========================= */

function obtenerCasos() {

  const email =
    obtenerEmail();

  if (!email) {
    return [];
  }


  try {

    const casos =
      JSON.parse(
        localStorage.getItem(
          "casosResolucion"
        )
      ) || [];


    return casos.filter(
      caso =>
        caso.email === email
    );

  } catch (error) {

    console.error(
      "Error obteniendo casos:",
      error
    );

    return [];

  }

}


/* =========================
   GUARDAR CASOS
========================= */

function guardarCasos(casos) {

  const email =
    obtenerEmail();

  if (!email) {
    return;
  }


  let todos = [];


  try {

    todos =
      JSON.parse(
        localStorage.getItem(
          "casosResolucion"
        )
      ) || [];

  } catch (error) {

    todos = [];

  }


  todos =
    todos.filter(
      caso =>
        caso.email !== email
    );


  todos.push(
    ...casos
  );


  localStorage.setItem(
    "casosResolucion",
    JSON.stringify(todos)
  );

}


/* =========================
   CARGAR CASOS
========================= */

function cargarCasos() {

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
    obtenerCasos();


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