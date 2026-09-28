// --- USUARIO ---
// protegerPagina() y la sesion viven ahora en sesion.js, que se carga
// antes que este archivo en todas las paginas. Estaba duplicada aqui,
// en producto.js, en carrito.js y en profile.js, y cada copia decidia
// una cosa distinta.
function usuarioActivo(){
    return localStorage.getItem("usuarioLogueado");
}

// Agregar producto al carrito
function agregarCarritoProducto(boton, event){
    if(event) event.preventDefault();

    const usuario = localStorage.getItem("usuarioLogueado");
    if (!usuario) {
        alert("Debes iniciar sesión para usar el carrito");
        window.location.href = "login.html";
        return;
    }

    const stockTexto =
        document.getElementById("stockDisponible")?.innerText || "";

    const stock = parseInt(stockTexto.replace(/\D/g, "")) || 0;

    // bloquea agotado
    if (stock <= 0) {
        alert("Producto agotado");
        return;
    }

    const select = document.getElementById("cantidadSeleccionada");
    const cantidad = parseInt(select?.value) || 1;

    // evita mas de lo disponible
    if (cantidad > stock) {
        alert("No hay suficiente stock");
        return;
    }

    // El identificador del producto es lo importante: sin el, al pagar
    // el servidor no sabe QUE se esta comprando y tendria que creerse
    // el precio que le mande el navegador.
    const seleccionado = JSON.parse(
        localStorage.getItem("productoSeleccionado") || "null"
    );

    const adId = seleccionado && seleccionado.id;

    if (!adId) {
        alert("No se pudo identificar el producto. Recarga la pagina.");
        return;
    }

    const img = document.getElementById("imagen");
    const nombre = document.getElementById("nombre").innerText;
    const precio = document.getElementById("precio").innerText;
    const imagen = img.src;

    const carritoProductos = JSON.parse(localStorage.getItem("carrito")) || [];

    // Si ya estaba en el carrito se suma la cantidad, en vez de meter
    // una segunda linea del mismo producto
    const existente = carritoProductos.find(p => p.adId === adId);

    if (existente) {
        existente.cantidad = Math.min(
            (parseInt(existente.cantidad, 10) || 1) + cantidad,
            stock
        );
    } else {
        carritoProductos.push({ adId, nombre, precio, imagen, cantidad });
    }

    localStorage.setItem("carrito", JSON.stringify(carritoProductos));
    localStorage.setItem("carritoCantidad", carritoProductos.length);
    animarCarrito(img);
}
// --- COMPRAS ---
let compras = JSON.parse(localStorage.getItem("misCompras")) || [];
function agregarCompra(producto){
    compras.push(producto);
    localStorage.setItem("misCompras", JSON.stringify(compras));
}



// --- CARGAR CARRITO EN PAGINA ---
function cargarCarrito(){
    let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    let contenedor = document.getElementById("carritoProductos");
    if(!contenedor) return;

    if(carrito.length === 0){
        contenedor.innerHTML = "<p>Tu carrito esta vacio</p>";
        return;
    }

    contenedor.innerHTML = "";
    carrito.forEach((producto, index)=>{
        contenedor.innerHTML += `
 <div class="card">
          <img src="${producto.imagen}" alt="${producto.nombre}">
          <div>
              <h4>${producto.nombre}</h4>
              <p>${producto.precio}</p>
              <p>Cantidad: ${producto.cantidad}</p>
              <button onclick="eliminar(${index})"> Eliminar</button>
          </div>
      </div>`;
});
}

// Eliminar producto
function eliminar(index){

let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

// eliminar producto
carrito.splice(index,1);

// guardar carrito actualizado
localStorage.setItem("carrito", JSON.stringify(carrito));

// actualizar cantidad del carrito
localStorage.setItem("carritoCantidad", carrito.length);

// actualizar contador visual
let contador = document.getElementById("contadorCarrito");
if(contador){
contador.innerText = carrito.length;
}

// volver a pintar carrito
cargarCarrito();

location.reload(); // refresca la pagina

}

// --- FINALIZAR COMPRA ---
//
// Antes esta funcion:
//   - descontaba el stock en localStorage.productosMarketplace, una
//     clave que no leia nadie mas: el stock real nunca bajaba;
//   - guardaba el pedido en localStorage.historialCompras, mientras que
//     la pagina de historial lo pedia al servidor: nunca coincidian;
//   - mandaba el precio y el comprador desde el navegador;
//   - no esperaba la respuesta ni comprobaba si habia fallado.
//
// Ahora manda solo QUE producto y CUANTAS unidades. El precio, el
// vendedor, el stock y el comprador los decide el servidor.
async function finalizarCompra() {
    const carrito = JSON.parse(localStorage.getItem("carrito")) || [];

    if (carrito.length === 0) {
        alert("El carrito esta vacio");
        return;
    }

    const sinId = carrito.filter(p => !p.adId);

    if (sinId.length > 0) {
        alert(
            "Hay productos en el carrito guardados con el formato antiguo. " +
            "Vacia el carrito y vuelve a agregarlos, por favor."
        );
        return;
    }

    const items = carrito.map(p => ({
        adId: p.adId,
        cantidad: parseInt(p.cantidad, 10) || 1
    }));

    const boton = document.getElementById("btnFinalizarCompra");
    if (boton) boton.disabled = true;

    try {
        const { ok, status, datos } = await Sesion.api("/checkout", {
            method: "POST",
            body: { items }
        });

        if (status === 401) {
            alert("Tu sesion ha caducado. Inicia sesion otra vez.");
            window.location.href = "login.html";
            return;
        }

        if (!ok) {
            // El servidor explica el motivo real: sin stock, producto
            // retirado, es tu propio producto...
            alert((datos && datos.message) || "No se pudo completar la compra");
            return;
        }

        localStorage.removeItem("carrito");
        localStorage.removeItem("carritoCantidad");

        window.location.href = "gracias.html";
    } catch (error) {
        console.error("Error al finalizar la compra:", error);
        alert("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
        if (boton) boton.disabled = false;
    }
}

// --- BUSCAR PRODUCTO ---
//
// Antes recorria las tarjetas ya pintadas y escondia las que no
// coincidian. Eso solo puede encontrar lo que YA se habia descargado.
// Ahora la busqueda la hace el servidor, que si tiene el catalogo
// entero y un indice de texto.
let temporizadorBusqueda = null;

function buscarProducto(){

    const seccion = document.querySelector(".products");
    if (seccion) seccion.scrollIntoView({ behavior: "smooth" });

    /* Se escribe letra a letra: se espera un momento antes de
       preguntar, para no lanzar una peticion por cada tecla */
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(cargarProductos, 250);

}


function filtrosActuales() {
  const valor = id => {
    const el = document.getElementById(id);
    return el ? el.value : "";
  };

  const parametros = new URLSearchParams();

  const buscar = valor("buscarInput").trim();
  if (buscar) parametros.set("q", buscar);

  /* El buscador de la barra y el filtro lateral son dos desplegables
     distintos; gana el que no este en "todo" */
  const categoria = valor("filtroCategoria") || valor("categoria");
  if (categoria && categoria !== "todo") parametros.set("categoria", categoria);

  const condicion = valor("filtroCondicion");
  if (condicion && condicion !== "todo") parametros.set("condicion", condicion);

  const precio = valor("filtroPrecio");
  if (precio && precio !== "todos") {
    const [min, max] = precio.split("-");
    if (min) parametros.set("min", min);
    if (max) parametros.set("max", max);
  }

  /* El desplegable de la pagina usa sus propios nombres; se traducen
     a los que entiende el servidor */
  const ORDENES = {
    precioMenor: "precio-asc",
    precioMayor: "precio-desc",
    best: "recientes",
    vendidos: "recientes"
  };

  const orden = ORDENES[valor("ordenar")];
  if (orden) parametros.set("orden", orden);

  return parametros;
}

async function cargarProductos(){

  const parametros = filtrosActuales();

  const res = await fetch("/all-ads?" + parametros.toString());
  const productos = await res.json();

let contenedor = document.getElementById("productosContainer");

if (!contenedor) return;

contenedor.innerHTML = "";

if (!Array.isArray(productos) || productos.length === 0) {
  contenedor.innerHTML =
    "<p class='sin-resultados'>No encontramos productos con esos filtros.</p>";
  return;
}

  productos.forEach((p)=>{

    let card = document.createElement("div");

    card.className = "card";

    // ID REAL DEL ANUNCIO
card.dataset.id = p.id;

// adaptado a tu backend
card.setAttribute("data-nombre", p.title);

card.dataset.categoria = p.categoria || "";
card.dataset.precio = p.price || 0;
card.dataset.condicion = p.condicion || "";

card.onclick = () => {

localStorage.setItem("productoSeleccionado", JSON.stringify({

  id: p.id,

  nombre: p.title,

  precio: "RD$ " + p.price,

  imagen: p.image,

  imagenes: p.images || [p.image],

  descripcion: p.description,

  cantidad: p.cantidad,

  // vendedor
email: p.sellerEmail,

  vendedorNombre: p.sellerName,

  vendedorUsername: p.sellerUsername

}));


    window.location.href = "producto.html";
};

    card.innerHTML = `

    <img src="${p.image}">

    <div class="info">

    <h3>${p.title}</h3>

    <div class="price">RD$ ${p.price}</div>

    <div class="label ${
  p.cantidad > 5 ? "green" : p.cantidad > 0 ? "yellow" : "red"
}">
  ${
    p.cantidad > 5
      ? "🟢 Disponible"
      : p.cantidad > 0
      ? "🟠 Poco stock"
      : "🔴 Agotado"
  }
</div>

    <div class="seller">

<a href="seller.html?email=${encodeURIComponent(p.sellerEmail)}"
onclick="event.stopPropagation()">

${p.sellerName}

</a>

</div>

    <p class="desc">${p.description}</p>
    
<p class="stock">
🟢 Disponible: ${p.cantidad || 1}
</p>
    </div>
    `;

    /* appendChild, NO prepend.

       El codigo original insertaba cada tarjeta al PRINCIPIO y por eso
       recorria la lista con .reverse() antes: dos vueltas al reves
       daban el orden bueno. Al pasar el orden al servidor quite el
       .reverse(), pero el prepend seguia ahi y dejaba la lista al
       reves: pedir "precio menor" mostraba el mas caro primero. */
    contenedor.appendChild(card);

  });

}

// se llama cuando se carga la pagina

// La rejilla y los botones de vista solo existen en la portada, pero
// este archivo se carga tambien en producto.html y carrito.html. Sin
// comprobar antes, el error cortaba el resto del script en esas paginas.
function cambiarVista(esLista){

let grid = document.querySelector(".grid");

if (!grid) return;

grid.classList.toggle("list-view", esLista);

const btnLista = document.getElementById("btnLista");
const btnGaleria = document.getElementById("btnGaleria");

if (btnLista) btnLista.classList.toggle("active", esLista);
if (btnGaleria) btnGaleria.classList.toggle("active", !esLista);

}

function vistaGaleria(){
  cambiarVista(false);
}

function vistaLista(){
  cambiarVista(true);
}


/* Ordenar lo hace el servidor.

   Antes se reordenaban las tarjetas ya pintadas leyendo el precio del
   TEXTO de la tarjeta con parseInt("RD$ 10,000"), que da 10 y no
   10000. Ademas solo podia ordenar lo que ya estaba descargado. */
function ordenarProductos(){
  cargarProductos();
}

function actualizarContadorCarrito(){

let cantidad = parseInt(localStorage.getItem("carritoCantidad")) || 0;

let contador = document.getElementById("contadorCarrito");

if(contador){
contador.innerText = cantidad;
}

}

window.addEventListener("load", function(){
    vistaLista();
});


/* Antes esto recorria las tarjetas ya dibujadas y las escondia con
   display:none. El resultado parecia un filtro, pero el navegador
   seguia teniendo el catalogo entero y la paginacion contaba mal.
   Ahora se le pide al servidor la lista que corresponde. */
function filtrarTodo() {
  cargarProductos();
}









/* =========================
   MENU DE USUARIO Y PANEL DEL CARRITO

   Estas cuatro funciones las llama el HTML de la portada con onclick.
   (Se rescataron del control de versiones: una edicion anterior mia
   las borro sin querer al reemplazar un bloque por posicion.)
========================= */

function toggleMenu(){
    const menu = document.getElementById("menuDesplegable");
    if (menu) menu.classList.toggle("show");
}

function abrirCarrito(){
    const panel = document.getElementById("carritoPanel");
    if (!panel) return;
    panel.classList.add("abierto");
    cargarCarrito();
}

function cerrarCarrito(){
    const panel = document.getElementById("carritoPanel");
    if (panel) panel.classList.remove("abierto");
}

function abrirCarritoSeguro(e){
    if (e) e.preventDefault();

    const usuario = localStorage.getItem("usuarioLogueado");

    if(!usuario){
        alert("Debes iniciar sesion para ver el carrito");
        window.location.href = "login.html";
        return;
    }

    window.location.href = "carrito.html";
}


/* =========================
   CATEGORIAS AUTOMATICAS

   Los desplegables de categoria estaban escritos a mano en el HTML
   (telefonos, consolas, tv, computadoras). Si alguien publicaba en
   "muebles", esa categoria no aparecia por ningun lado y el producto
   no se podia filtrar.

   El servidor ya devolvia /categorias con las categorias que existen
   de verdad y cuantos productos hay en cada una; nadie lo usaba.
========================= */

async function cargarCategorias() {
  const selects = [
    document.getElementById("categoria"),        // el de la barra de busqueda
    document.getElementById("filtroCategoria")   // el del panel de filtros
  ].filter(Boolean);

  if (selects.length === 0) return;

  let categorias = [];

  try {
    const res = await fetch("/categorias");
    categorias = await res.json();
  } catch (error) {
    /* Si falla, se dejan las opciones que ya trae el HTML */
    console.error("No se pudieron cargar las categorias:", error);
    return;
  }

  if (!Array.isArray(categorias) || categorias.length === 0) return;

  selects.forEach(select => {
    const elegida = select.value;

    select.innerHTML =
      '<option value="todo">Todo</option>' +
      categorias
        .map(c => {
          const valor = String(c.categoria)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");

          return `<option value="${valor}">${valor} (${c.total})</option>`;
        })
        .join("");

    /* Si el usuario ya tenia una elegida, se respeta */
    if (elegida) select.value = elegida;
    if (!select.value) select.value = "todo";
  });
}

/* Al abrir la portada: primero las categorias reales, despues los
   productos con los filtros que haya */
/* Arranque de la portada.

   Primero las categorias reales y despues el catalogo. Antes de esto
   habia otro bloque DOMContentLoaded que llamaba a cargarProductos();
   al reemplazar el buscador por posicion me lo lleve por delante y la
   portada se quedaba vacia hasta que tocabas un filtro. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("productosContainer")) return;

  /* Las categorias primero: asi el desplegable ya tiene las opciones
     reales cuando el usuario llega */
  await cargarCategorias();

  cargarProductos();

  const contador = document.getElementById("carritoCantidad");
  const cantidad = localStorage.getItem("carritoCantidad");

  if (contador && cantidad) contador.innerText = cantidad;
});
