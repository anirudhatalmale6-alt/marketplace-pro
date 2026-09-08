/* =========================
   PREFERENCIAS DE CUENTA
========================= */

document.addEventListener("DOMContentLoaded", () => {

  cargarPreferencias();

  const boton = document.getElementById("btnGuardar");

  if (boton) {
    boton.addEventListener("click", guardarPreferencias);
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

    if (usuario && usuario.email) {
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
   CARGAR PREFERENCIAS
========================= */

async function cargarPreferencias() {

  const usuario = obtenerUsuario();

  if (!usuario || !usuario.email) {

    mostrarMensaje(
      "No se encontró la sesión del usuario.",
      "error"
    );

    return;
  }


  try {

    const respuesta = await fetch(
      `/get-configuracion?email=${encodeURIComponent(usuario.email)}`
    );


    const resultado = await respuesta.json();


    if (!respuesta.ok) {

      throw new Error(
        resultado.message ||
        "No se pudieron cargar las preferencias"
      );

    }


    const configuracion =
      resultado.configuracion;


    document.getElementById("idioma").value =
      configuracion.idioma || "es";


    document.getElementById("apariencia").value =
      configuracion.apariencia || "claro";


    document.getElementById("notificaciones").checked =
      configuracion.notificaciones !== false;


    document.getElementById("correoNotificaciones").checked =
      configuracion.correoNotificaciones !== false;


  } catch (error) {

    console.error(
      "❌ Error cargando preferencias:",
      error
    );

    mostrarMensaje(
      error.message ||
      "No se pudieron cargar las preferencias.",
      "error"
    );

  }

}


/* =========================
   GUARDAR PREFERENCIAS
========================= */

async function guardarPreferencias() {

  const usuario = obtenerUsuario();

  if (!usuario || !usuario.email) {

    mostrarMensaje(
      "No se encontró la sesión del usuario.",
      "error"
    );

    return;
  }


  const boton =
    document.getElementById("btnGuardar");


  const datos = {

    email:
      usuario.email.toLowerCase(),

    idioma:
      document.getElementById("idioma").value,

    apariencia:
      document.getElementById("apariencia").value,

    notificaciones:
      document.getElementById("notificaciones").checked,

    correoNotificaciones:
      document.getElementById(
        "correoNotificaciones"
      ).checked

  };


  boton.disabled = true;

  boton.textContent =
    "Guardando...";


  try {

    const respuesta =
      await fetch(
        "/update-configuracion",
        {

          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(datos)

        }
      );


    const resultado =
      await respuesta.json();


    if (!respuesta.ok) {

      throw new Error(
        resultado.message ||
        "No se pudieron guardar las preferencias"
      );

    }


    mostrarMensaje(
      "Preferencias guardadas correctamente ✅",
      "exito"
    );


    /* =========================
       GUARDAR TAMBIÉN LOCALMENTE
    ========================= */

    usuario.configuracion =
      resultado.configuracion;


    localStorage.setItem(
      "usuario",
      JSON.stringify(usuario)
    );


  } catch (error) {

    console.error(
      "❌ Error guardando preferencias:",
      error
    );

    mostrarMensaje(
      error.message ||
      "Ocurrió un error al guardar.",
      "error"
    );

  } finally {

    boton.disabled = false;

    boton.textContent =
      "Guardar preferencias";

  }

}


/* =========================
   MENSAJE
========================= */

function mostrarMensaje(texto, tipo) {

  const mensaje =
    document.getElementById(
      "mensajePreferencias"
    );


  if (!mensaje) {
    return;
  }


  mensaje.textContent =
    texto;


  mensaje.className =
    `mensaje ${tipo}`;


  mensaje.style.display =
    "block";


  setTimeout(() => {

    mensaje.style.display =
      "none";

  }, 5000);

}