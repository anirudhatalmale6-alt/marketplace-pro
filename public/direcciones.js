/* =========================
   DIRECCIONES DE ENVIO

   Que hacia antes esta pagina:

   Guardaba la direccion DENTRO del perfil del usuario, llamando a
   /update-profile. O sea, una sola direccion por persona, y ademas
   mezclada con los datos de la cuenta. Si el usuario tenia una
   direccion de casa y otra del trabajo, la segunda pisaba a la
   primera.

   El servidor ya tenia hecha la parte de varias direcciones
   (GET/POST/PUT/DELETE /direcciones, y marcar una como
   predeterminada), pero NINGUNA pagina la usaba.

   Ahora la pagina usa esa parte: lista, agregar, editar, borrar y
   elegir cual es la predeterminada. La predeterminada es la que el
   servidor pone en el pedido al hacer una compra.
========================= */

let direcciones = [];
let editandoId = null;

/* Los campos del formulario, con su id en el HTML */
const CAMPOS = [
  "telefono",
  "country",
  "state",
  "city",
  "sector",
  "zip",
  "address",
  "reference"
];

function campo(id) {
  return document.getElementById(id);
}

function valor(id) {
  const el = campo(id);
  return el ? String(el.value || "").trim() : "";
}

function escapar(texto) {
  return String(texto === undefined || texto === null ? "" : texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* =========================
   CARGAR Y DIBUJAR
========================= */

async function cargarDirecciones() {
  const contenedor = document.getElementById("listaDirecciones");

  if (!contenedor) return;

  const { ok, datos } = await Sesion.api("/direcciones");

  if (!ok) {
    contenedor.innerHTML =
      "<p class='vacio'>No se pudieron cargar las direcciones.</p>";
    return;
  }

  direcciones = (datos && datos.direcciones) || [];

  if (direcciones.length === 0) {
    contenedor.innerHTML =
      "<p class='vacio'>Todavia no tienes ninguna direccion guardada. " +
      "Agrega una abajo.</p>";
    return;
  }

  /* La predeterminada primero */
  const ordenadas = [...direcciones].sort(
    (a, b) => Number(Boolean(b.predeterminada)) - Number(Boolean(a.predeterminada))
  );

  contenedor.innerHTML = ordenadas.map(dibujarDireccion).join("");
}

function dibujarDireccion(d) {
  const lineas = [
    d.address,
    [d.sector, d.city].filter(Boolean).join(", "),
    [d.state, d.country].filter(Boolean).join(", "),
    d.zip ? `Codigo postal: ${d.zip}` : "",
    d.telefono ? `Tel: ${d.telefono}` : ""
  ]
    .filter(Boolean)
    .map(l => escapar(l))
    .join("<br>");

  return `
    <div class="direccion-guardada ${d.predeterminada ? "es-predeterminada" : ""}">
      <div class="direccion-cabecera">
        <strong>${escapar(d.nombre || "Direccion")}</strong>
        ${d.predeterminada
          ? '<span class="etiqueta-predeterminada">Predeterminada</span>'
          : ""}
      </div>

      <div class="direccion-cuerpo">${lineas}</div>

      ${d.reference ? `<div class="direccion-ref">${escapar(d.reference)}</div>` : ""}

      <div class="direccion-acciones">
        ${d.predeterminada
          ? ""
          : `<button type="button" onclick="marcarPredeterminada(${d.id})">
               Usar por defecto
             </button>`}
        <button type="button" onclick="editarDireccion(${d.id})">Editar</button>
        <button type="button" class="peligro" onclick="borrarDireccion(${d.id})">
          Borrar
        </button>
      </div>
    </div>
  `;
}

/* =========================
   GUARDAR (agregar o editar)
========================= */

async function guardarDireccion(evento) {
  if (evento) evento.preventDefault();

  const boton = document.getElementById("btnGuardar");

  const cuerpo = {
    nombre: valor("nombreDireccion") || "Direccion de envio"
  };

  CAMPOS.forEach(c => {
    cuerpo[c] = valor(c);
  });

  /* El servidor vuelve a comprobar esto, pero avisar aqui evita un
     viaje de ida y vuelta y un mensaje feo */
  if (!cuerpo.address || !cuerpo.city || !cuerpo.state) {
    mostrarMensaje("Completa al menos la direccion, la ciudad y la provincia.", "error");
    return;
  }

  if (cuerpo.telefono && !/^[0-9]{7,15}$/.test(cuerpo.telefono)) {
    mostrarMensaje("El telefono debe tener entre 7 y 15 numeros.", "error");
    return;
  }

  if (boton) boton.disabled = true;

  const esEdicion = editandoId !== null;

  const { ok, status, datos } = await Sesion.api(
    esEdicion ? `/direcciones/${editandoId}` : "/direcciones",
    { method: esEdicion ? "PUT" : "POST", body: cuerpo }
  );

  if (boton) boton.disabled = false;

  if (status === 401) {
    window.location.href = "login.html?volver=direcciones.html";
    return;
  }

  if (!ok) {
    mostrarMensaje((datos && datos.message) || "No se pudo guardar.", "error");
    return;
  }

  mostrarMensaje(
    esEdicion ? "Direccion actualizada." : "Direccion guardada.",
    "exito"
  );

  cancelarEdicion();
  await cargarDirecciones();
}

/* =========================
   EDITAR
========================= */

function editarDireccion(id) {
  const d = direcciones.find(x => Number(x.id) === Number(id));

  if (!d) return;

  editandoId = Number(id);

  const nombre = campo("nombreDireccion");
  if (nombre) nombre.value = d.nombre || "";

  CAMPOS.forEach(c => {
    const el = campo(c);
    if (el) el.value = d[c] || "";
  });

  const titulo = document.getElementById("tituloFormulario");
  if (titulo) titulo.textContent = "Editando: " + (d.nombre || "direccion");

  const cancelar = document.getElementById("btnCancelarEdicion");
  if (cancelar) cancelar.style.display = "";

  const boton = document.getElementById("btnGuardar");
  if (boton) boton.textContent = "Guardar cambios";

  const form = document.getElementById("formDireccion");
  if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicion() {
  editandoId = null;

  const form = document.getElementById("formDireccion");
  if (form) form.reset();

  const titulo = document.getElementById("tituloFormulario");
  if (titulo) titulo.textContent = "Agregar una direccion";

  const cancelar = document.getElementById("btnCancelarEdicion");
  if (cancelar) cancelar.style.display = "none";

  const boton = document.getElementById("btnGuardar");
  if (boton) boton.textContent = "Guardar direccion";
}

/* =========================
   BORRAR Y PREDETERMINADA
========================= */

async function borrarDireccion(id) {
  if (!confirm("Seguro que quieres borrar esta direccion?")) return;

  const { ok, datos } = await Sesion.api(`/direcciones/${id}`, {
    method: "DELETE"
  });

  if (!ok) {
    mostrarMensaje((datos && datos.message) || "No se pudo borrar.", "error");
    return;
  }

  /* Si se borra la predeterminada, el servidor asciende otra sola.
     Por eso se vuelve a pedir la lista en vez de quitarla aqui. */
  mostrarMensaje("Direccion eliminada.", "exito");

  if (editandoId === Number(id)) cancelarEdicion();

  await cargarDirecciones();
}

async function marcarPredeterminada(id) {
  const { ok, datos } = await Sesion.api(`/direcciones/${id}/predeterminada`, {
    method: "PUT"
  });

  if (!ok) {
    mostrarMensaje((datos && datos.message) || "No se pudo cambiar.", "error");
    return;
  }

  mostrarMensaje("Esta sera la direccion de tus proximas compras.", "exito");
  await cargarDirecciones();
}

/* =========================
   MENSAJES
========================= */

let temporizadorMensaje = null;

function mostrarMensaje(texto, tipo) {
  const caja = document.getElementById("mensajeDireccion");

  if (!caja) return;

  caja.textContent = texto;
  caja.className = "mensaje " + (tipo === "error" ? "mensaje-error" : "mensaje-exito");
  caja.style.display = "block";

  clearTimeout(temporizadorMensaje);
  temporizadorMensaje = setTimeout(() => {
    caja.style.display = "none";
  }, 5000);
}

/* =========================
   ARRANQUE
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  const usuario = await Sesion.proteger("login.html?volver=direcciones.html");

  if (!usuario) return;

  /* Si el perfil ya tiene una direccion escrita (como se guardaba
     antes) y todavia no hay ninguna en la lista, se rellena el
     formulario con ella para que el usuario solo tenga que darle a
     guardar y no reescribirla entera. */
  await cargarDirecciones();

  if (direcciones.length === 0 && usuario.address) {
    CAMPOS.forEach(c => {
      const el = campo(c);
      if (el && usuario[c]) el.value = usuario[c];
    });

    mostrarMensaje(
      "Encontramos la direccion de tu perfil. Revisala y pulsa Guardar " +
        "para anadirla a tu lista.",
      "exito"
    );
  }

  const form = document.getElementById("formDireccion");
  if (form) form.addEventListener("submit", guardarDireccion);
});
