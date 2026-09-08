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
  if (seccion === "ventas") verVentas();
  if (seccion === "perfil") verPerfil();
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

    const res = await fetch("/my-ads?email=" + email);
    const productos = await res.json();

    if (!productos.length) {
      contenedor.innerHTML = "<p>No tienes productos</p>";
      return;
    }

    productos.forEach(p => {

      contenedor.innerHTML += `
        <div class="card">
          <img src="${p.image}" style="width:120px; border-radius:8px;">
          <h3>${p.title}</h3>
          <p>RD$ ${p.price}</p>
        </div>
      `;

    });

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