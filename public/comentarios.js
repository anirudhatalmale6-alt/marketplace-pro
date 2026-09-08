/* =========================
   COMENTARIOS
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    cargarComentarios();

  }
);


/* =========================
   OBTENER USUARIO
========================= */

function obtenerEmailUsuario() {

  const email =
    localStorage.getItem("email");

  if (email) {
    return email.toLowerCase();
  }


  try {

    const usuario =
      JSON.parse(
        localStorage.getItem("usuario")
      );

    if (
      usuario &&
      usuario.email
    ) {

      return usuario.email.toLowerCase();

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
   CARGAR COMENTARIOS
========================= */

async function cargarComentarios() {

  const email =
    obtenerEmailUsuario();

  if (!email) {

    mostrarMensajeVacio(
      "No se encontró la sesión del usuario."
    );

    return;

  }


  try {

    const respuesta =
      await fetch(
        `/comentarios?email=${encodeURIComponent(email)}`
      );


    if (!respuesta.ok) {

      throw new Error(
        "No se pudieron cargar los comentarios"
      );

    }


    const comentarios =
      await respuesta.json();


    mostrarComentarios(
      comentarios
    );


  } catch (error) {

    console.error(
      "❌ Error cargando comentarios:",
      error
    );


    mostrarMensajeVacio(
      "No se pudieron cargar los comentarios."
    );

  }

}


/* =========================
   MOSTRAR COMENTARIOS
========================= */

function mostrarComentarios(
  comentarios
) {

  const contenedor =
    document.getElementById(
      "listaComentarios"
    );


  if (!contenedor) {
    return;
  }


  if (
    !Array.isArray(comentarios) ||
    comentarios.length === 0
  ) {

    mostrarMensajeVacio(
      "Cuando tengas comentarios o valoraciones, aparecerán aquí."
    );

    return;

  }


  contenedor.innerHTML = "";


  comentarios.forEach(
    comentario => {

      const elemento =
        document.createElement(
          "div"
        );

      elemento.className =
        "comentario";


      const estrellas =
        generarEstrellas(
          comentario.calificacion || 0
        );


      elemento.innerHTML = `

        <div class="comentario-header">

          <span class="comentario-usuario">
            ${escaparHTML(
              comentario.usuario || "Usuario"
            )}
          </span>

          <span class="comentario-fecha">
            ${escaparHTML(
              comentario.fecha || ""
            )}
          </span>

        </div>

        <div class="comentario-estrellas">
          ${estrellas}
        </div>

        <p class="comentario-texto">
          ${escaparHTML(
            comentario.texto || ""
          )}
        </p>

      `;


      contenedor.appendChild(
        elemento
      );

    }
  );

}


/* =========================
   ESTADO VACÍO
========================= */

function mostrarMensajeVacio(
  mensaje
) {

  const contenedor =
    document.getElementById(
      "listaComentarios"
    );


  if (!contenedor) {
    return;
  }


  contenedor.innerHTML = `

    <div class="comentario-vacio">

      <div class="vacio-icon">
        💬
      </div>

      <h3>
        No tienes comentarios todavía
      </h3>

      <p>
        ${escaparHTML(mensaje)}
      </p>

    </div>

  `;

}


/* =========================
   ESTRELLAS
========================= */

function generarEstrellas(
  cantidad
) {

  const numero =
    Math.max(
      0,
      Math.min(
        5,
        Number(cantidad)
      )
    );


  return "★".repeat(numero) +
         "☆".repeat(5 - numero);

}


/* =========================
   SEGURIDAD
========================= */

function escaparHTML(
  texto
) {

  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    texto;

  return div.innerHTML;

}