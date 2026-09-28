document.addEventListener("DOMContentLoaded", async () => {
  // El panel es privado: sin sesion no se muestra nada.
  // Antes llamaba a protegerPagina(), que en esta pagina no estaba
  // definida en ningun archivo cargado, asi que reventaba el script
  // entero y el panel se quedaba en blanco.
  const usuario = await Sesion.proteger("login.html?volver=dashboard.html");

  if (!usuario) return;

  inicializarFormulario();

  // Antes aqui se llamaba a cargarPerfil(), que esta definida en
  // profile.js y dashboard.html NO carga profile.js: el error
  // "cargarPerfil is not defined" tumbaba el resto del arranque.
  // El panel tiene sus propias secciones (publicar, productos, ventas);
  // el perfil completo vive en profile.html.

  // Las tres secciones del panel vienen con style="display:none" en el
  // HTML y NADIE abria ninguna al cargar. Por eso el panel se veia
  // vacio: los botones estaban, pero debajo no habia nada.
  mostrarSeccion("publicar");
});

// -------------------- INICIALIZAR --------------------
function inicializarFormulario() {
  previewImagenes();
  eventosFormulario();
  eventosTitulo();
}

// -------------------- EVENTOS DEL FORMULARIO --------------------
//
// Esta funcion se llamaba desde inicializarFormulario() pero NO existia
// en ningun archivo. El error "eventosFormulario is not defined" cortaba
// la carga del panel: no se dibujaba el formulario de publicar ni el
// perfil. Aqui esta, haciendo lo que se esperaba de ella: recalcular el
// indicador de calidad segun se escribe.
function eventosFormulario() {
  const campos = [
    "titulo",
    "precio",
    "descripcion",
    "cantidad",
    "categoriaProducto",
    "condicion"
  ];

  campos.forEach(id => {
    const campo = document.getElementById(id);
    if (!campo) return;

    campo.addEventListener("input", evaluarFormulario);
    campo.addEventListener("change", evaluarFormulario);
  });

  const fotos = document.getElementById("fotosProducto");
  if (fotos) fotos.addEventListener("change", evaluarFormulario);

  evaluarFormulario();
}

// -------------------- PREVIEW IMÁGENES --------------------
let imagenes = [];

function previewImagenes() {
  const input = document.getElementById("fotosProducto");
  const preview = document.getElementById("previewFotos");

  if (!input || !preview) return;

  input.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);

    files.forEach(file => {
      if (file.type.startsWith("image/") && imagenes.length < 10) {
        imagenes.push(file);
      }
    });

    renderPreview();
  });
}

function renderPreview() {
  const preview = document.getElementById("previewFotos");

  if (!preview) return;

  preview.innerHTML = "";

  imagenes.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const div = document.createElement("div");
      div.className = "preview-item";

      const img = document.createElement("img");
      img.src = e.target.result;

      img.onclick = () => {
        const imgSel = imagenes.splice(index, 1)[0];
        imagenes.unshift(imgSel);
        renderPreview();
      };

      const btn = document.createElement("button");
      btn.innerText = "✖";
      btn.onclick = (ev) => {
        ev.stopPropagation();
        imagenes.splice(index, 1);
        renderPreview();
      };

      div.appendChild(img);
      div.appendChild(btn);
      preview.appendChild(div);
    };

    reader.readAsDataURL(file);
  });
}



// -------------------- PUBLICAR --------------------
async function publicarProducto() {
const titulo = document.getElementById("titulo").value;
const precio = document.getElementById("precio").value;
const descripcion = document.getElementById("descripcion").value;
const cantidad = document.getElementById("cantidad").value;
const categoria = document.getElementById("categoriaProducto").value;
const condicion = document.getElementById("condicion").value;

  if (!titulo || !precio || !descripcion || imagenes.length === 0 || !cantidad) {
    alert("Completa todos los campos");
    return;
  }

  const formData = new FormData();
// Ya no se manda "email": el servidor sabe quien publica por la sesion.
// Antes iba el correo que hubiera en localStorage, asi que se podia
// publicar un anuncio en nombre de otra persona.
formData.append("title", titulo);
formData.append("description", descripcion);
formData.append("price", precio);
formData.append("cantidad", cantidad);
formData.append("categoria", categoria);
formData.append("condicion", condicion);

  // ✅ MANDAR TODAS LAS IMÁGENES
  imagenes.forEach((file) => {
    formData.append("images", file);
  });

  try {
    const res = await fetch("/create-ad", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    alert(data.message);

    if (res.ok) {
      location.reload();
    }

  } catch (error) {
    console.error("❌ ERROR:", error);
    alert("Error al publicar");
  }
}


// -------------------- CALIDAD --------------------
function evaluarFormulario() {
  // Cada campo se comprueba antes de usarlo: si falta uno en el HTML,
  // la funcion no debe tumbar el resto del panel.
  const valor = id => (document.getElementById(id) || {}).value || "";

  let puntos = 0;

  const titulo = valor("titulo");
  const precio = valor("precio");
  const descripcion = valor("descripcion");
  const fotos = imagenes.length;

  if (titulo.length > 20) puntos += 30;
  if (precio) puntos += 20;
  if (descripcion.length > 30) puntos += 20;
  if (fotos >= 3) puntos += 30;

  const barra = document.getElementById("barraProgreso");
  const estado = document.getElementById("estadoCalidad");

  if (barra) barra.style.width = puntos + "%";

  if (estado) {
    if (puntos < 40) {
      estado.textContent = "Bajo";
    } else if (puntos < 70) {
      estado.textContent = "Medio";
    } else {
      estado.textContent = "Alto";
    }
  }
}

// -------------------- TITULO --------------------
function eventosTitulo() {
  const titulo = document.getElementById("titulo");
  const contador = document.getElementById("contadorTitulo");

  if (!titulo || !contador) return;

  titulo.addEventListener("input", () => {
    contador.textContent = `${titulo.value.length}/80`;
  });
}

// -------------------- SECCIONES --------------------
function mostrarSeccion(seccion) {
  document.querySelectorAll(".seccion").forEach(sec => {
    sec.style.display = "none";
  });

  // Antes esto era: document.getElementById(...).style.display = "block"
  // sin comprobar nada. Al pedir una seccion que no existe en el HTML
  // (perfil, direcciones) reventaba con "Cannot read properties of null"
  // y dejaba TODAS las secciones ocultas: el panel se veia vacio.
  const destino = document.getElementById("seccion-" + seccion);

  if (!destino) {
    console.warn(`La seccion "${seccion}" no existe en esta pagina`);
    return;
  }

  destino.style.display = "block";

  // Marcar como activo el boton de la seccion abierta. Antes la clase
  // "active" se quedaba fija en "Publicar" pasara lo que pasara.
  document.querySelectorAll(".btn[onclick*='mostrarSeccion']").forEach(btn => {
    btn.classList.toggle(
      "active",
      (btn.getAttribute("onclick") || "").includes(`'${seccion}'`)
    );
  });

  if (seccion === "productos") verProductos();
  if (seccion === "pedidos") verPedidos();
  if (seccion === "ventas") verVentas();
  if (seccion === "perfil") verPerfil();
}

/* =========================
   PEDIDOS RECIBIDOS (el vendedor)

   Esta pantalla NO EXISTIA. El servidor ya sabia devolver los pedidos
   de un vendedor (/seller-orders) y cambiar su estado
   (/update-order-status), pero no habia ninguna pagina que lo usara:
   el vendedor no tenia forma de enterarse de que le habian comprado.
========================= */

/* Que puede hacer el vendedor segun como este el pedido.
   El servidor vuelve a comprobar esto: aqui solo se decide que
   botones se dibujan. */
const SIGUIENTES_ESTADOS = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["enviado", "cancelado"],
  enviado: ["entregado"],
  entregado: [],
  cancelado: []
};

const TEXTO_ESTADO = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado"
};

const TEXTO_BOTON = {
  confirmado: "Confirmar pedido",
  enviado: "Marcar como enviado",
  entregado: "Marcar como entregado",
  cancelado: "Cancelar"
};

function dinero(n) {
  return "RD$ " + Number(n || 0).toLocaleString("es-DO");
}

function escapar(texto) {
  /* Lo que escriben los usuarios (nombres, direcciones) va dentro de
     HTML: hay que escaparlo o alguien puede meter etiquetas. */
  return String(texto === undefined || texto === null ? "" : texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fechaBonita(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

async function verPedidos() {
  const contenedor = document.getElementById("listaPedidos");

  if (!contenedor) return;

  contenedor.innerHTML = "<p>Cargando...</p>";

  const { ok, datos } = await Sesion.api("/seller-orders");

  if (!ok || !Array.isArray(datos)) {
    contenedor.innerHTML = "<p>No se pudieron cargar los pedidos.</p>";
    return;
  }

  const filtro = (document.getElementById("filtroEstado") || {}).value || "";

  const pedidos = filtro
    ? datos.filter(o => String(o.estado).toLowerCase() === filtro)
    : datos;

  /* Contador de pendientes en la pestana */
  const pendientes = datos.filter(
    o => String(o.estado).toLowerCase() === "pendiente"
  ).length;

  const badge = document.getElementById("contadorPedidos");
  if (badge) badge.textContent = pendientes > 0 ? pendientes : "";

  if (pedidos.length === 0) {
    contenedor.innerHTML = filtro
      ? "<p>No tienes pedidos en ese estado.</p>"
      : "<p>Todavia no te han hecho ningun pedido.</p>";
    return;
  }

  contenedor.innerHTML = pedidos.map(dibujarPedido).join("");
}

function dibujarPedido(o) {
  const estado = String(o.estado || "pendiente").toLowerCase();

  const productos = (o.productos || [])
    .map(
      p => `
      <div class="linea-producto">
        <img src="${escapar(p.imagen)}" alt="">
        <div>
          <strong>${escapar(p.title || p.nombre)}</strong><br>
          ${p.cantidad} x ${dinero(p.precio)}
        </div>
        <div class="subtotal">${dinero(p.subtotal || p.precio * p.cantidad)}</div>
      </div>`
    )
    .join("");

  const envio = o.envio
    ? `<div class="envio">
         <strong>Enviar a:</strong><br>
         ${escapar(o.envio.nombre)}<br>
         ${escapar(o.envio.address)}${o.envio.sector ? ", " + escapar(o.envio.sector) : ""}<br>
         ${escapar(o.envio.city)}, ${escapar(o.envio.state)}<br>
         ${o.envio.telefono ? "Tel: " + escapar(o.envio.telefono) : ""}
         ${o.envio.reference ? "<br><em>" + escapar(o.envio.reference) + "</em>" : ""}
       </div>`
    : `<div class="envio"><em>El comprador no tiene direccion guardada.
         Ponte en contacto con el.</em></div>`;

  const acciones = (SIGUIENTES_ESTADOS[estado] || [])
    .map(
      e =>
        `<button class="btn-estado ${e}" onclick="cambiarEstadoPedido(${o.id}, '${e}')">
           ${TEXTO_BOTON[e]}
         </button>`
    )
    .join("");

  return `
    <div class="pedido" id="pedido-${o.id}">
      <div class="pedido-cabecera">
        <div>
          <strong>${escapar(o.numero || o.id)}</strong>
          <span class="etiqueta-estado ${estado}">${TEXTO_ESTADO[estado] || estado}</span>
        </div>
        <div class="pedido-fecha">${fechaBonita(o.fecha)}</div>
      </div>

      <div class="pedido-comprador">
        Comprador: <strong>${escapar(o.compradorNombre || o.comprador)}</strong>
        <span class="correo">${escapar(o.comprador)}</span>
      </div>

      ${productos}

      <div class="pedido-total">Total: <strong>${dinero(o.total)}</strong></div>

      ${envio}

      <div class="pedido-acciones">${acciones || "<em>Pedido cerrado</em>"}</div>
    </div>
  `;
}

async function cambiarEstadoPedido(id, estado) {
  const confirmaciones = {
    cancelado: "Vas a CANCELAR este pedido y se devolvera el stock. Seguro?",
    entregado: "Marcar como entregado? Despues ya no se puede cambiar."
  };

  if (confirmaciones[estado] && !confirm(confirmaciones[estado])) return;

  const tarjeta = document.getElementById("pedido-" + id);

  /* Bloquear los botones mientras se manda, para que no se pulse dos
     veces y se creen dos cambios de estado */
  if (tarjeta) {
    tarjeta.querySelectorAll("button").forEach(b => (b.disabled = true));
  }

  const { ok, datos } = await Sesion.api("/update-order-status/" + id, {
    method: "PUT",
    body: { estado }
  });

  if (!ok) {
    alert((datos && datos.message) || "No se pudo cambiar el estado");

    if (tarjeta) {
      tarjeta.querySelectorAll("button").forEach(b => (b.disabled = false));
    }
    return;
  }

  /* Se vuelve a pedir la lista al servidor en vez de cambiarla aqui:
     asi lo que ves es lo que hay guardado de verdad. */
  verPedidos();
}

// -------------------- VER PRODUCTOS --------------------
async function verProductos() {

  const contenedor = document.getElementById("listaProductos");

  // Sin contenedor no hay nada que dibujar. Antes se llamaba
  // .innerHTML directamente y tumbaba el script entero.
  if (!contenedor) return;

  contenedor.innerHTML = "";

  const email = localStorage.getItem("usuarioLogueado");

  try {

    /* Ya no se manda el email: el servidor sabe quien eres por la sesion */
    const res = await fetch("/my-ads", { credentials: "same-origin" });
    const productos = await res.json();

    if (!Array.isArray(productos) || !productos.length) {
      contenedor.innerHTML = "<p>No tienes productos publicados.</p>";
      return;
    }

    contenedor.innerHTML = productos.map(p => `
      <div class="card producto-propio" id="anuncio-${p.id}">
        <img src="${escapar(p.image)}" alt="">

        <div class="datos-anuncio">
          <h3>${escapar(p.title)}</h3>
          <p class="precio-anuncio">${dinero(p.price)}</p>
          <p class="stock-anuncio">
            ${p.cantidad > 0
              ? `En stock: <strong>${p.cantidad}</strong>`
              : `<span class="agotado">AGOTADO</span>`}
            ${p.activo === false ? ' &middot; <span class="oculto">Oculto</span>' : ""}
          </p>
        </div>

        <div class="acciones-anuncio">
          <button onclick="editarAnuncio(${p.id})">Editar</button>
          <button onclick="cambiarVisibilidad(${p.id}, ${p.activo === false})">
            ${p.activo === false ? "Mostrar" : "Ocultar"}
          </button>
          <button class="peligro" onclick="borrarAnuncio(${p.id})">Borrar</button>
        </div>
      </div>
    `).join("");

  } catch (error) {
    console.error("Error cargando productos:", error);
    contenedor.innerHTML = "<p>Error al cargar productos</p>";
  }
}

 
fetch("navbar.html")
.then(res => res.text())
.then(data => {
    // dashboard.html no tiene un <div id="navbar">: sin esta
    // comprobacion, la promesa fallaba con "Cannot set properties of
    // null" y quedaba un error suelto en la consola en cada carga.
    const contenedorNavbar = document.getElementById("navbar");

    if (!contenedorNavbar) return;

    contenedorNavbar.innerHTML = data;

    // ocultar carrito
    const carrito = document.getElementById("carritoLink");
    if (carrito) carrito.style.display = "none";

    // ocultar buscador
    const search = document.querySelector(".search-container");
    if (search) search.style.display = "none";

    // 👤 ocultar menú usuario
const usuarioMenu = document.getElementById("usuarioMenu");
if (usuarioMenu) usuarioMenu.style.display = "none";
    
    // 🔥 ACTIVAR MENU
    const btn = document.querySelector(".usuario-btn");
    const menu = document.getElementById("menuDesplegable");

    if (btn && menu) {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        });

        document.addEventListener("click", () => {
            menu.style.display = "none";
        });
    }
});

function activarMenuUsuario() {
    const btn = document.querySelector(".usuario-btn");
    const menu = document.getElementById("menuDesplegable");

    if (!btn || !menu) return;

    btn.onclick = () => {
        menu.style.display = menu.style.display === "block" ? "none" : "block";
    };

    // cerrar si haces click fuera
    document.addEventListener("click", (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
            menu.style.display = "none";
        }
    });
}

async function verVentas() {

  const contenedor = document.getElementById("listaVentas");

  if (!contenedor) return;

  contenedor.innerHTML = "";

  const email = localStorage.getItem("usuarioLogueado");

  try {

    const res = await fetch("/my-sales?email=" + email);
    const ventas = await res.json();

    if (!ventas.length) {
      contenedor.innerHTML = "<p>No tienes ventas aún</p>";
      return;
    }

    ventas.forEach(v => {

      contenedor.innerHTML += `
        <div class="card">
          <h3>${v.producto}</h3>
          <p>💰 RD$ ${v.precio}</p>
          <p>👤 Comprador: ${v.comprador}</p>
          <p>📅 ${v.fecha}</p>
        </div>
      `;

    });

  } catch (error) {
    console.error(error);
  }
}

async function verPerfil() {
  const contenedor = document.getElementById("perfilUsuario");

  // dashboard.html no tiene seccion de perfil (esa vive en
  // profile.html). Si algun dia se anade, esto ya funciona.
  if (!contenedor) return;

  try {
    const res = await fetch("/get-user", { credentials: "same-origin" });
    const user = await res.json();

    contenedor.innerHTML = `
      <form id="formPerfil" class="card">
        <h3>👤 Información personal</h3>

        <label>Nombre completo</label>
        <input type="text" id="fullName"
          value="${user.fullName || `${user.nombre || ""} ${user.apellido || ""}`}" />

        <label>Email</label>
        <input type="email" id="emailPerfil" value="${user.email}" readonly />

        <label>Teléfono</label>
        <input type="text" id="phone"
          value="${user.phone || user.telefono || ""}" />

        <label>Dirección</label>
        <input type="text" id="address"
          value="${user.address || ""}" />

        <label>Ciudad</label>
        <input type="text" id="city"
          value="${user.city || ""}" />

        <label>Estado / Provincia</label>
        <input type="text" id="state"
          value="${user.state || ""}" />

        <label>ZIP</label>
        <input type="text" id="zip"
          value="${user.zip || ""}" />

        <label>País</label>
        <input type="text" id="country"
          value="${user.country || ""}" />

        <button type="button" onclick="guardarPerfil()">
          💾 Guardar cambios
        </button>
      </form>
    `;
  } catch (error) {
    console.error(error);
    contenedor.innerHTML = "<p>Error cargando perfil</p>";
  }
}

async function guardarPerfil() {
  const datos = {
    email: document.getElementById("emailPerfil").value,
    fullName: document.getElementById("fullName").value,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value,
    city: document.getElementById("city").value,
    state: document.getElementById("state").value,
    zip: document.getElementById("zip").value,
    country: document.getElementById("country").value
  };

  try {
    const res = await fetch("/update-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datos)
    });

    const data = await res.json();
    alert(data.message);

  } catch (error) {
    console.error(error);
    alert("Error guardando perfil");
  }
}

// Mostrar/ocultar especificaciones según categoría
function cargarEspecificaciones() {
    const categoria = document.getElementById("categoriaProducto").value;
    const contenedor = document.querySelector("#especificaciones .spec-grid");

    document.getElementById("especificaciones").style.display = "block";

    let html = "";

    if (categoria === "telefonos") {
        html = `
            <input type="text" placeholder="Marca (Ej: Apple)" id="marca">
            <input type="text" placeholder="Modelo (Ej: iPhone 13 mini)" id="modelo">
            <input type="text" placeholder="Almacenamiento (Ej: 128 GB)" id="almacenamiento">
            <input type="text" placeholder="Color" id="color">
            <input type="text" placeholder="Estado de red" id="red">
            <input type="text" placeholder="Pantalla" id="pantalla">
            <input type="text" placeholder="RAM" id="ram">
            <input type="text" placeholder="Sistema operativo" id="so">
        `;
    }

    else if (categoria === "computadoras") {
        html = `
            <input type="text" placeholder="Marca" id="marca">
            <input type="text" placeholder="Modelo" id="modelo">
            <input type="text" placeholder="Procesador" id="cpu">
            <input type="text" placeholder="RAM" id="ram">
            <input type="text" placeholder="Almacenamiento" id="storage">
            <input type="text" placeholder="Pantalla" id="pantalla">
            <input type="text" placeholder="Sistema operativo" id="so">
        `;
    }

    else if (categoria === "consolas") {
        html = `
            <input type="text" placeholder="Marca" id="marca">
            <input type="text" placeholder="Modelo" id="modelo">
            <input type="text" placeholder="Edición" id="edicion">
            <input type="text" placeholder="Almacenamiento" id="almacenamiento">
            <input type="text" placeholder="Estado" id="estado">
        `;
    }

    else if (categoria === "tv") {
        html = `
            <input type="text" placeholder="Marca" id="marca">
            <input type="text" placeholder="Pulgadas" id="pantalla">
            <input type="text" placeholder="Resolución" id="resolucion">
            <input type="text" placeholder="Smart TV (Sí/No)" id="smart">
            <input type="text" placeholder="Modelo" id="modelo">
        `;
    }

    else if (categoria === "carros") {
        html = `
            <input type="text" placeholder="Marca (Ej: Toyota)" id="marca">
            <input type="text" placeholder="Modelo (Ej: Corolla)" id="modelo">
            <input type="text" placeholder="Año" id="anio">
            <input type="text" placeholder="Kilometraje" id="km">
            <input type="text" placeholder="Transmisión" id="transmision">
            <input type="text" placeholder="Combustible" id="combustible">
            <input type="text" placeholder="Color" id="color">
            <input type="text" placeholder="Condición" id="condicion">
        `;
    }

    else {
        document.getElementById("especificaciones").style.display = "none";
    }

    contenedor.innerHTML = html;
}

function validarProducto() {
    const categoria = document.getElementById("categoriaProducto").value;

    // obtener todos los inputs dentro del formulario
    const inputs = document.querySelectorAll("#especificaciones input");

    let valido = true;
    let mensaje = "";

    // validar que haya categoría
    if (!categoria) {
        alert("⚠️ Debes seleccionar una categoría");
        return false;
    }

    // validar inputs vacíos
    inputs.forEach(input => {
        if (input.value.trim() === "") {
            valido = false;
            input.style.border = "2px solid red";
        } else {
            input.style.border = "1px solid #ccc";
        }
    });

    if (!valido) {
        mensaje = "⚠️ Debes completar todos los campos";
        alert(mensaje);
        return false;
    }

    return true;
}

/* =========================
   EDITAR, OCULTAR Y BORRAR UN ANUNCIO

   El servidor ya tenia PUT y DELETE /ads/:id, y solo dejan al dueno.
   Lo que faltaba eran los botones: hasta ahora, una vez publicabas un
   anuncio no habia forma de corregirlo ni de quitarlo.
========================= */

async function editarAnuncio(id) {
  const { ok, datos: ad } = await Sesion.api("/ads/" + id);

  if (!ok || !ad) {
    alert("No se pudo cargar el anuncio.");
    return;
  }

  /* Se pregunta campo a campo. Es sencillo, pero es lo que hay que
     tener antes de nada: poder corregir un precio mal puesto. */
  const title = prompt("Titulo:", ad.title);
  if (title === null) return;

  const price = prompt("Precio en RD$:", ad.price);
  if (price === null) return;

  const cantidad = prompt("Unidades en stock:", ad.cantidad);
  if (cantidad === null) return;

  const description = prompt("Descripcion:", ad.description);
  if (description === null) return;

  const cambios = {
    title: title.trim(),
    price: Number(String(price).replace(/[^\d.]/g, "")),
    cantidad: parseInt(cantidad, 10),
    description: description.trim()
  };

  if (!cambios.title) {
    alert("El titulo no puede quedar vacio.");
    return;
  }

  if (!Number.isFinite(cambios.price) || cambios.price <= 0) {
    alert("El precio tiene que ser un numero mayor que cero.");
    return;
  }

  if (!Number.isInteger(cambios.cantidad) || cambios.cantidad < 0) {
    alert("El stock tiene que ser un numero entero (0 o mas).");
    return;
  }

  const res = await Sesion.api("/ads/" + id, { method: "PUT", body: cambios });

  if (!res.ok) {
    alert((res.datos && res.datos.message) || "No se pudo guardar.");
    return;
  }

  verProductos();
}

async function cambiarVisibilidad(id, estaOculto) {
  const res = await Sesion.api("/ads/" + id, {
    method: "PUT",
    body: { activo: estaOculto }
  });

  if (!res.ok) {
    alert((res.datos && res.datos.message) || "No se pudo cambiar.");
    return;
  }

  verProductos();
}

async function borrarAnuncio(id) {
  if (
    !confirm(
      "Se borrara el anuncio y sus fotos, y desaparecera de los " +
      "favoritos de quien lo tuviera guardado.\n\nEsto no se puede deshacer. Seguro?"
    )
  ) {
    return;
  }

  const res = await Sesion.api("/ads/" + id, { method: "DELETE" });

  if (!res.ok) {
    alert((res.datos && res.datos.message) || "No se pudo borrar.");
    return;
  }

  verProductos();
}
