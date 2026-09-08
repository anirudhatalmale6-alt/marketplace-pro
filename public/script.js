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
function buscarProducto(){

    let texto = document.getElementById("buscarInput").value.toLowerCase().trim();
    let categoria = document.getElementById("categoria").value;
    let productos = document.querySelectorAll(".card");

    // Ir a la seccion de productos
    let seccion = document.querySelector(".products");
    if(seccion){
        seccion.scrollIntoView({ behavior:"smooth" });
    }

    productos.forEach(function(producto){

        let nombre = producto.getAttribute("data-nombre").toLowerCase();
        let cat = producto.getAttribute("data-categoria");

        let coincideNombre = nombre.includes(texto);
        let coincideCategoria = (categoria === "todo" || categoria === cat);

     if (coincideNombre && coincideCategoria) {

    producto.style.display = "block";
    producto.style.opacity = "1";
    producto.style.transform = "scale(1)";
    producto.style.pointerEvents = "auto";

} else {

    producto.style.display = "none";

}

    });

}

// --- USUARIO LOGUEADO ---
document.addEventListener("DOMContentLoaded", function () {
    let usuario = localStorage.getItem("usuarioLogueado");
    if (usuario) {

    const loginLink = document.getElementById("loginLink");
    const registerLink = document.getElementById("registerLink");
    const usuarioMenu = document.getElementById("usuarioMenu");
    const usuarioNombre = document.getElementById("usuarioNombre");
    const carritoLink = document.getElementById("carritoLink");

    if (loginLink) {
        loginLink.style.display = "none";
    }

    if (registerLink) {
        registerLink.style.display = "none";
    }

    if (usuarioMenu) {
        usuarioMenu.style.display = "inline-block";
    }

    if (usuarioNombre) {
        usuarioNombre.innerText = usuario;
    }

    if (carritoLink) {
        carritoLink.style.display = "inline-block";
    }
}

    let cantidad = localStorage.getItem("carritoCantidad");
    if(cantidad){
        let contador = document.getElementById("carritoCantidad");
        if(contador){
            contador.innerText = cantidad;
        }
    }

    cargarProductos();
});

// --- MENU USUARIO ---
function toggleMenu(){
    let menu = document.getElementById("menuDesplegable");
    menu.classList.toggle("show");
}
document.addEventListener("click", function(event){
    let menu = document.getElementById("menuDesplegable");
    let boton = document.querySelector(".usuario-btn");
    if(boton && menu && !boton.contains(event.target) && !menu.contains(event.target)) {
        menu.classList.remove("show");
    }
});

// --- CERRAR SESION ---
// Definida una sola vez en sesion.js: avisa al servidor de que cierre
// la sesion y despues limpia el navegador. Borrar solo localStorage
// dejaba la sesion abierta en el servidor.



// --- PANEL CARRITO ---
function abrirCarrito(){ document.getElementById("carritoPanel").classList.add("abierto"); cargarCarrito(); }
function cerrarCarrito(){ document.getElementById("carritoPanel").classList.remove("abierto"); }
function abrirCarritoSeguro(e){
    e.preventDefault();
    let usuario = localStorage.getItem("usuarioLogueado");
    if(!usuario){
        alert("Debes iniciar sesion para ver el carrito");
        window.location.href="login.html";
        return;
    }
    window.location.href="carrito.html";
}

// --- CARGAR PRODUCTOS ---
async function cargarProductos(){

  const res = await fetch("/all-ads");
  const productos = await res.json();

let contenedor = document.getElementById("productosContainer");

if (!contenedor) return;

contenedor.innerHTML = "";

  productos.slice().reverse().forEach((p)=>{

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

    contenedor.prepend(card);

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


function ordenarProductos(){

let grid = document.querySelector(".grid");

let productos = [...document.querySelectorAll(".card")];

let tipo = document.getElementById("ordenar").value;

productos.sort((a,b)=>{

let precioA = parseInt(a.querySelector(".price").innerText.replace("$",""));
let precioB = parseInt(b.querySelector(".price").innerText.replace("$",""));

if(tipo==="precioMenor") return precioA-precioB;

if(tipo==="precioMayor") return precioB-precioA;

return 0;

});

grid.innerHTML="";

productos.forEach(p=>grid.appendChild(p));

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


function filtrarTodo() {

  let categoria = document.getElementById("filtroCategoria").value;
  let precio = document.getElementById("filtroPrecio").value;
  let condicion = document.getElementById("filtroCondicion").value;

 let productos = document.querySelectorAll("#productosContainer .card");

  productos.forEach(producto => {

    let cat = producto.dataset.categoria;
    let prec = parseInt(producto.dataset.precio);
    let cond = producto.dataset.condicion;

    let mostrar = true;

    // FILTRO CATEGORIA
    if (categoria !== "todo" && cat !== categoria) {
      mostrar = false;
    }

    // FILTRO PRECIO
    if (precio !== "todos") {
      let [min, max] = precio.split("-").map(Number);
      if (prec < min || prec > max) {
        mostrar = false;
      }
    }

    // FILTRO CONDICION
    if (condicion !== "todo" && cond !== condicion) {
      mostrar = false;
    }

    // MOSTRAR / OCULTAR
    producto.style.display = mostrar ? "block" : "none";

  });

}





