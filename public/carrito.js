// Navegación
function goCheckout() {
    window.location.href = "compra.html";
}

function goCart() {
    window.location.href = "carrito.html";
}

function irComprar() {
    window.location.href = "compras.html";
}

// Cargar carrito
function cargarCarrito() {
    const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    const contenedor = document.getElementById("listaCarrito");
    let total = 0;

    // #listaCarrito solo existe en carrito.html, pero este archivo se
    // carga tambien en producto.html e index.html. Sin esta comprobacion
    // el error cortaba TODO el script de la pagina.
    if (!contenedor) return;

    const totalEl = document.getElementById("total");

    if (carrito.length === 0) {
        contenedor.innerHTML = "Tu carrito está vacío";
        if (totalEl) totalEl.innerText = "";
        return;
    }

    contenedor.innerHTML = "";

    carrito.forEach((p, index) => {
        const item = document.createElement("div");
        item.className = "card";

        item.innerHTML = `
            <img src="${p.imagen}">
            <div>
                <h4>${p.nombre}</h4>
                <p class="price">${p.precio}</p>
                <button onclick="eliminar(${index})">Eliminar</button>
            </div>
        `;

        contenedor.appendChild(item);

        const precioNumero = parseInt(
    p.precio.toString().replace(/\D/g, "")
) || 0;
        total += precioNumero;
    });

    if (totalEl) totalEl.innerText = "Total: $" + total;
}

// Eliminar producto
function eliminar(index){

let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

carrito.splice(index,1);

localStorage.setItem("carrito", JSON.stringify(carrito));

// actualizar carrito visual
cargarCarrito();

// actualizar contador
let contador = document.getElementById("contadorCarrito");
if(contador){
contador.innerText = carrito.length;
}

cargarCarrito();

}

// Agregar producto al carrito
function agregarCarritoProducto(boton){

    const usuario = localStorage.getItem("usuarioLogueado");
    if (!usuario) {
        alert("Debes iniciar sesión para usar el carrito");
        window.location.href = "login.html";
        return;
    }

    const stockTexto =
        document.getElementById("stockDisponible")?.innerText || "";

    const stock = parseInt(stockTexto.replace(/\D/g, "")) || 0;

    // 🔴 bloquea agotado
    if (stock <= 0) {
        alert("Producto agotado 🔴");
        return;
    }

    const select = document.getElementById("cantidadSeleccionada");
    const cantidad = parseInt(select?.value) || 1;

    // ⚠️ evita más de lo disponible
    if (cantidad > stock) {
        alert("No hay suficiente stock ⚠️");
        return;
    }

    const img = document.getElementById("imagen");
    const nombre = document.getElementById("nombre").innerText;
    const precio = document.getElementById("precio").innerText;
    const imagen = img.src;

    const productoSeleccionado = JSON.parse(
          localStorage.getItem("productoSeleccionado")
);

    const producto = {
    nombre,
    precio,
    imagen,
    cantidad,
    vendedor: productoSeleccionado?.email || ""
};

    const carritoProductos = JSON.parse(localStorage.getItem("carrito")) || [];

    // 🔒 doble protección final
    if (stock > 0) {
        carritoProductos.push(producto);
        localStorage.setItem("carrito", JSON.stringify(carritoProductos));
        animarCarrito(img);
    }
}



// Animación de producto volando al carrito
function animarCarrito(img) {
    const imgRect = img.getBoundingClientRect();
    const carritoIcon = document.getElementById("carritoLink");
    const carritoRect = carritoIcon.getBoundingClientRect();

    const vuelo = img.cloneNode(true);
    vuelo.classList.add("volando");
    vuelo.style.position = "fixed";
    vuelo.style.left = imgRect.left + "px";
    vuelo.style.top = imgRect.top + "px";
    vuelo.style.width = imgRect.width + "px";
    vuelo.style.height = imgRect.height + "px";
    vuelo.style.transition = "all 0.7s ease-in-out";

    document.body.appendChild(vuelo);

    setTimeout(() => {
        vuelo.style.left = carritoRect.left + "px";
        vuelo.style.top = carritoRect.top + "px";
        vuelo.style.width = "30px";
        vuelo.style.height = "30px";
    }, 50);

    setTimeout(() => {
        vuelo.remove();
        let cantidad = parseInt(localStorage.getItem("carritoCantidad")) || 0;
        cantidad++;
        localStorage.setItem("carritoCantidad", cantidad);

        const contador = document.getElementById("carritoCantidad");
        if (contador) contador.innerText = cantidad;
    }, 750);
}

// Abrir / cerrar panel carrito
function abrirCarrito() {
    document.getElementById("carritoPanel").classList.add("abierto");
    cargarCarrito();
}

function cerrarCarrito() {
    document.getElementById("carritoPanel").classList.remove("abierto");
}

// Inicializar
cargarCarrito();

function abrirCarritoSeguro(e){

e.preventDefault();

let usuario = localStorage.getItem("usuarioLogueado");

if(!usuario){
alert("Debes iniciar sesión para ver el carrito");
window.location.href="login.html";
return;
}

window.location.href="carrito.html";

}

// protegerPagina() vive en sesion.js, que se carga antes que este
// archivo. Estaba duplicada en cuatro archivos distintos.


function actualizarContadorCarrito(){

let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

let contador = document.getElementById("contadorCarrito");

if(contador){
contador.innerText = carrito.length;
}

}

function actualizarContadorCarrito(){

let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

let contador = document.getElementById("contadorCarrito");

if(contador){
contador.innerText = carrito.length;
}

}
