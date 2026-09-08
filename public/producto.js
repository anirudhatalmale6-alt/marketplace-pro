// --- VER PRODUCTO ---
function verProducto(boton) {

    let card = boton.closest(".card");

    if (!card) return;

    const producto = {

        id: card.dataset.id,

        nombre:
            card.querySelector("h3")?.innerText ||
            card.dataset.nombre ||
            "Producto",

        precio:
            card.querySelector(".price")?.innerText ||
            "$0",

        imagen:
            card.querySelector("img")?.src ||
            "",

        vendedor:
            card.querySelector(".seller")?.innerText ||
            "Desconocido",

        descripcion:
            card.querySelector(".desc")?.innerText ||
            "Producto en excelente estado"

    };

    localStorage.setItem(
        "productoSeleccionado",
        JSON.stringify(producto)
    );

    window.location.href = "producto.html";

}
// --- PROTEGER PAGINA ---
// Vive en sesion.js, que se carga antes que este archivo.
// Estaba duplicada en cuatro archivos con comportamientos distintos.



// --- MENU USUARIO ---
function toggleMenu(){
    let menu = document.getElementById("menuDesplegable");
    if(menu) menu.classList.toggle("show");
}

// --- CERRAR SECION ---
// Definida una sola vez en sesion.js: avisa al servidor antes de
// limpiar el navegador.

/* GALERIA */

function cambiarImagen(el){

const imagenPrincipal=document.getElementById("imagen");

imagenPrincipal.src=el.src;

document.querySelectorAll(".miniatura")
.forEach(img=>img.classList.remove("activa"));

el.classList.add("activa");

}

async function agregarFavorito() {

  const usuario = localStorage.getItem("usuarioData");

  if (!usuario) {
    alert("Debes iniciar sesión para agregar favoritos.");
    window.location.href = "login.html";
    return;
  }

  let usuarioData;

  try {
    usuarioData = JSON.parse(usuario);
  } catch (error) {
    console.error("❌ Error leyendo usuario:", error);
    alert("Error con la sesión.");
    return;
  }

  const producto = JSON.parse(
    localStorage.getItem("productoSeleccionado")
  );

  if (!producto || !producto.id) {
    alert("No se encontró el producto.");
    return;
  }

  const boton = document.querySelector(".favorito");

  try {

    const res = await fetch("/favoritos", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        email: usuarioData.email,
        adId: producto.id
      })

    });

    const data = await res.json();

    if (!res.ok) {

      alert(
        data.message ||
        "No se pudo agregar a favoritos."
      );

      return;
    }

    boton?.classList.add("activo");

    alert("Producto agregado a favoritos ❤️");

  } catch (error) {

    console.error(
      "❌ Error conectando con favoritos:",
      error
    );

    alert(
      "No se pudo conectar con el servidor."
    );

  }

}

/* "COMPRAR AHORA"

   Antes esta funcion registraba la venta llamando a /buy y DESPUES
   mandaba al usuario a checkout.html, donde se volvia a registrar la
   compra. Es decir: se apuntaba dos veces, y encima antes de que el
   usuario hubiera confirmado nada ni elegido direccion.

   Ahora solo guarda que producto quiere comprar y lleva al checkout.
   El pedido se crea alli, cuando el usuario confirma. */
async function comprarAhora() {

  const productoSeleccionado = JSON.parse(
    localStorage.getItem("productoSeleccionado") || "null"
  );

  if (!productoSeleccionado || !productoSeleccionado.id) {
    alert("No se encontro el producto.");
    return;
  }

  const usuario = await Sesion.usuario();

  if (!usuario) {
    window.location.href = "login.html?volver=producto.html";
    return;
  }

  // Se comprueba el stock contra el servidor, no contra la copia que
  // tenga guardada el navegador (que puede estar vieja)
  const { ok, datos } = await Sesion.api(`/ads/${productoSeleccionado.id}`);

  if (!ok || !datos) {
    alert("Este producto ya no esta disponible.");
    return;
  }

  const stock = parseInt(datos.cantidad, 10) || 0;

  if (stock <= 0) {
    alert("Producto agotado");
    return;
  }

  const select = document.getElementById("cantidadSeleccionada");
  const cantidad = parseInt(select?.value, 10) || 1;

  if (cantidad > stock) {
    alert(`Solo quedan ${stock} unidades`);
    return;
  }

  // Solo el identificador y la cantidad: el precio y el vendedor los
  // pone el servidor al crear el pedido
  localStorage.setItem(
    "productoCompra",
    JSON.stringify({
      adId: datos.id,
      nombre: datos.title,
      precio: datos.price,
      imagen: datos.image,
      cantidad
    })
  );

  localStorage.setItem("cantidadCompra", cantidad);

  // Ir al checkout
  window.location.href = "checkout.html";
}
document.addEventListener("DOMContentLoaded", () => {

  protegerPagina();

  const producto = JSON.parse(
    localStorage.getItem("productoSeleccionado")
  );

  if (!producto) {
    document.querySelector(".producto-container").innerHTML =
      "<h2>No se encontró el producto</h2>";
    return;
  }

  localStorage.setItem(
    "chatVendedor",
    JSON.stringify({
      nombre: producto.vendedorNombre || producto.email || "Vendedor",
      email: producto.email || "",
      username: producto.vendedorUsername || "general"
    })
  );



  // 🔥 NORMALIZAR DATOS (backend + frontend)
  const nombre = producto.title || producto.nombre;
  const precio = producto.price ? "RD$ " + producto.price : producto.precio;
  const descripcion = producto.description || producto.descripcion;
  const vendedorEmail =
  producto.sellerEmail ||
  producto.email ||
  producto.vendedor ||
  "";

const vendedorNombre =
  producto.sellerName ||
  producto.vendedorNombre ||
  producto.vendedor ||
  vendedorEmail;
  const cantidad = parseInt(producto.cantidad) || 0;

  const imagenes = producto.images || producto.imagenes || [producto.image || producto.imagen];

  // 🧠 CARGAR DATOS
  document.getElementById("nombre").innerText = nombre;
  document.getElementById("precio").innerText = precio;
  document.getElementById("descripcion").innerText = descripcion;
 document.getElementById("vendedor").innerHTML =
`<a href="seller.html?email=${encodeURIComponent(vendedorEmail)}">
  Vendedor: ${vendedorNombre}
</a>`;

  // 🖼️ IMAGEN PRINCIPAL
  const imagenPrincipal = document.getElementById("imagen");
  imagenPrincipal.src = imagenes[0];

  // 🧩 MINIATURAS (GALERÍA)
  const miniaturas = document.getElementById("miniaturas");
  miniaturas.innerHTML = "";

  imagenes.forEach((img, index) => {
    const mini = document.createElement("img");
    mini.src = img;
    mini.className = "miniatura" + (index === 0 ? " activa" : "");

    mini.onclick = () => {
      imagenPrincipal.src = img;

      document.querySelectorAll(".miniatura").forEach(m => {
        m.classList.remove("activa");
      });

      mini.classList.add("activa");
    };

    miniaturas.appendChild(mini);
  });

  // 📦 STOCK
  const textoCantidad = document.getElementById("cantidad");
  const stockTexto = document.getElementById("stockDisponible");
  const select = document.getElementById("cantidadSeleccionada");

  textoCantidad.innerText = "Cantidad disponible: " + cantidad;

  let estado = "";
  if (cantidad > 5) estado = "🟢 Disponible";
  else if (cantidad > 0) estado = "🟡 Poco stock";
  else estado = "🔴 Agotado";

  stockTexto.innerText = `${cantidad} disponibles - ${estado}`;

  // 🔢 SELECT DINÁMICO
  select.innerHTML = "";
  for (let i = 1; i <= cantidad; i++) {
    select.innerHTML += `<option value="${i}">${i}</option>`;
  }

  // 🚫 BLOQUEAR SI NO HAY STOCK
if (cantidad <= 0) {
  select.disabled = true;

  document.querySelectorAll(".boton.comprar").forEach(btn => {
    btn.disabled = true;
  });
}

});


const zoomContainer = document.querySelector(".imagen-zoom-container");
const imagen = document.getElementById("imagen");

if (zoomContainer && imagen) {
    zoomContainer.addEventListener("mousemove", (e) => {
        const rect = zoomContainer.getBoundingClientRect();

        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        imagen.style.transformOrigin = `${x}% ${y}%`;
    });

    zoomContainer.addEventListener("mouseenter", () => {
        imagen.style.transform = "scale(2)";
    });

    zoomContainer.addEventListener("mouseleave", () => {
        imagen.style.transform = "scale(1)";
        imagen.style.transformOrigin = "center center";
    });
}
