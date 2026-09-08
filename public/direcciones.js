/* =========================
   DIRECCIONES
========================= */

document.addEventListener("DOMContentLoaded", () => {

  cargarDireccion();

  const formulario =
    document.getElementById("formDireccion");

  formulario.addEventListener(
    "submit",
    guardarDireccion
  );

});


/* =========================
   OBTENER EMAIL DEL USUARIO
========================= */
function obtenerEmailUsuario() {

  // 1. Intentar obtener el email directamente
  const email = localStorage.getItem("email");

  if (email) {
    return email.trim().toLowerCase();
  }

  // 2. Intentar obtener el usuario guardado
  const claves = [
    "usuario",
    "user",
    "currentUser",
    "usuarioLogueado"
  ];

  for (const clave of claves) {

    try {

      const datos =
        JSON.parse(localStorage.getItem(clave));

      if (datos && datos.email) {
        return datos.email.trim().toLowerCase();
      }

    } catch (error) {
      console.log("No hay usuario en:", clave);
    }

  }

  return null;
}


/* =========================
   CARGAR DIRECCIÓN
========================= */

async function cargarDireccion() {

  const email =
    obtenerEmailUsuario();

  if (!email) {

    mostrarMensaje(
      "No se encontró la sesión del usuario.",
      "error"
    );

    return;
  }

  try {

    const respuesta =
      await fetch(
        `/get-user?email=${encodeURIComponent(email)}`
      );

    if (!respuesta.ok) {

      throw new Error(
        "No se pudo obtener el usuario"
      );

    }

    const usuario =
      await respuesta.json();


    /* =========================
       LLENAR CAMPOS
    ========================= */

    document.getElementById("telefono").value =
      usuario.telefono || "";

    document.getElementById("country").value =
      usuario.country || "";

    document.getElementById("state").value =
      usuario.state || "";

    document.getElementById("city").value =
      usuario.city || "";

    document.getElementById("sector").value =
      usuario.sector || "";

    document.getElementById("address").value =
      usuario.address || "";

    document.getElementById("zip").value =
      usuario.zip || "";

    document.getElementById("reference").value =
      usuario.reference || "";

  } catch (error) {

    console.error(
      "❌ Error cargando dirección:",
      error
    );

    mostrarMensaje(
      "No se pudieron cargar tus datos.",
      "error"
    );

  }

}


/* =========================
   GUARDAR DIRECCIÓN
========================= */

async function guardarDireccion(event) {

  event.preventDefault();

  const email =
    obtenerEmailUsuario();

  if (!email) {

    mostrarMensaje(
      "No se encontró la sesión del usuario.",
      "error"
    );

    return;
  }


  const boton =
    document.getElementById("btnGuardar");


  /* =========================
     OBTENER DATOS
  ========================= */

  const datos = {

    email,

    telefono:
      document.getElementById("telefono").value.trim(),

    country:
      document.getElementById("country").value.trim(),

    state:
      document.getElementById("state").value.trim(),

    city:
      document.getElementById("city").value.trim(),

    sector:
      document.getElementById("sector").value.trim(),

    address:
      document.getElementById("address").value.trim(),

    zip:
      document.getElementById("zip").value.trim(),

    reference:
      document.getElementById("reference").value.trim()

  };


  /* =========================
     VALIDACIÓN
  ========================= */

  if (!datos.telefono) {

    mostrarMensaje(
      "Ingresa tu número de teléfono.",
      "error"
    );

    document.getElementById(
      "telefono"
    ).focus();

    return;
  }

  if (!datos.country) {

    mostrarMensaje(
      "Selecciona tu país.",
      "error"
    );

    document.getElementById(
      "country"
    ).focus();

    return;
  }

  if (!datos.state) {

    mostrarMensaje(
      "Ingresa tu provincia.",
      "error"
    );

    document.getElementById(
      "state"
    ).focus();

    return;
  }

  if (!datos.city) {

    mostrarMensaje(
      "Ingresa tu ciudad.",
      "error"
    );

    document.getElementById(
      "city"
    ).focus();

    return;
  }

  if (!datos.address) {

    mostrarMensaje(
      "Ingresa tu dirección.",
      "error"
    );

    document.getElementById(
      "address"
    ).focus();

    return;
  }


  /* =========================
     DESACTIVAR BOTÓN
  ========================= */

  boton.disabled = true;

  boton.textContent =
    "Guardando...";


  try {

    const respuesta =
      await fetch(
        "/update-profile",
        {
          method: "POST",

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
        "No se pudo guardar la dirección"
      );

    }


    /* =========================
       ACTUALIZAR LOCALSTORAGE
    ========================= */

    actualizarUsuarioLocal(datos);


    mostrarMensaje(
      "Dirección guardada correctamente ✅",
      "exito"
    );


  } catch (error) {

    console.error(
      "❌ Error guardando dirección:",
      error
    );

    mostrarMensaje(
      error.message ||
      "Ocurrió un error al guardar la dirección.",
      "error"
    );

  } finally {

    boton.disabled = false;

    boton.textContent =
      "Guardar dirección";

  }

}


/* =========================
   ACTUALIZAR USUARIO LOCAL
========================= */

function actualizarUsuarioLocal(datos) {

  try {

    const usuario =
      JSON.parse(
        localStorage.getItem("usuario")
      );

    if (!usuario) {
      return;
    }

    usuario.telefono =
      datos.telefono;

    usuario.country =
      datos.country;

    usuario.state =
      datos.state;

    usuario.city =
      datos.city;

    usuario.sector =
      datos.sector;

    usuario.address =
      datos.address;

    usuario.zip =
      datos.zip;

    usuario.reference =
      datos.reference;


    localStorage.setItem(
      "usuario",
      JSON.stringify(usuario)
    );

  } catch (error) {

    console.error(
      "Error actualizando usuario local:",
      error
    );

  }

}


/* =========================
   MENSAJE
========================= */

function mostrarMensaje(
  texto,
  tipo
) {

  const mensaje =
    document.getElementById(
      "mensajeDireccion"
    );

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