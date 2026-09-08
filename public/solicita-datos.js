/* =========================
   SOLICITA TUS DATOS
========================= */

document.addEventListener("DOMContentLoaded", () => {

  const boton =
    document.getElementById("btnSolicitarDatos");

  if (!boton) {
    return;
  }

  boton.addEventListener(
    "click",
    solicitarDatos
  );

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

    if (usuario && usuario.email) {
      return usuario;
    }

  } catch (error) {

    console.error(
      "Error leyendo usuario:",
      error
    );

  }

  const email =
    localStorage.getItem("email");

  if (email) {

    return {
      email: email.toLowerCase()
    };

  }

  return null;

}


/* =========================
   SOLICITAR DATOS
========================= */

async function solicitarDatos() {

  const usuario =
    obtenerUsuario();

  if (!usuario || !usuario.email) {

    mostrarEstado(
      "No se encontró la sesión del usuario.",
      false
    );

    return;

  }


  const boton =
    document.getElementById(
      "btnSolicitarDatos"
    );


  boton.disabled = true;

  boton.textContent =
    "Procesando solicitud...";


  try {

    const respuesta =
      await fetch(
        "/solicitar-datos",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            email:
              usuario.email
          })

        }
      );


    const resultado =
      await respuesta.json();


    if (!respuesta.ok) {

      throw new Error(
        resultado.message ||
        "No se pudo realizar la solicitud."
      );

    }


    mostrarEstado(
      resultado.message ||
      "Tu solicitud de datos fue registrada correctamente.",
      true
    );


    boton.textContent =
      "Solicitud enviada";


  } catch (error) {

    console.error(
      "❌ Error solicitando datos:",
      error
    );


    mostrarEstado(
      error.message ||
      "Ocurrió un error al solicitar tus datos.",
      false
    );


    boton.disabled = false;

    boton.textContent =
      "Solicitar mis datos";

  }

}


/* =========================
   MOSTRAR ESTADO
========================= */

function mostrarEstado(
  mensaje,
  exitoso
) {

  const contenedor =
    document.getElementById(
      "estadoSolicitud"
    );

  const texto =
    document.getElementById(
      "mensajeSolicitud"
    );


  if (!contenedor || !texto) {
    return;
  }


  texto.textContent =
    mensaje;


  if (exitoso) {

    contenedor.style.display =
      "flex";

  } else {

    contenedor.style.display =
      "flex";

    contenedor.style.background =
      "#fff5f5";

    contenedor.style.borderColor =
      "#f0b8b8";

  }

}