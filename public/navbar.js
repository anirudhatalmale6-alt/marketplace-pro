// USUARIO LOGUEADO
//
// Dos arreglos aqui:
//
// 1) Habia un document.addEventListener("DOMContentLoaded", ...) DENTRO
//    de otro. El de dentro se registraba cuando el evento YA habia
//    pasado, asi que actualizarContador() no se llamaba nunca.
//
// 2) Los elementos de la barra (loginLink, usuarioMenu, carritoLink...)
//    no existen en todas las paginas: en varias la barra se inyecta
//    despues con fetch("navbar.html"). Al no comprobarlo, el error
//    "Cannot read properties of null" cortaba el resto del archivo.
function el(id) {
  return document.getElementById(id);
}

function mostrar(id, valor) {
  const nodo = el(id);
  if (nodo) nodo.style.display = valor;
}

document.addEventListener("DOMContentLoaded", function () {
let usuario = localStorage.getItem("usuarioLogueado");

if (usuario) {

mostrar("loginLink", "none");
mostrar("registerLink", "none");
mostrar("usuarioMenu", "inline-block");
mostrar("carritoLink", "inline-block");

const nombre = el("usuarioNombre");
if (nombre) nombre.innerText = usuario;
}

let cantidad = localStorage.getItem("carritoCantidad");

if(cantidad){
let contador = document.getElementById("carritoCantidad");
if(contador){
contador.innerText = cantidad;
}
}

actualizarContador();
cargarCarrito();

});


// MENU USUARIO
function toggleMenu(){
const menu = document.getElementById("menuDesplegable");
menu.classList.toggle("show");
}


// CERRAR SESION
//
// Antes solo borraba localStorage. La sesion de verdad es la cookie
// del servidor: si no se le avisa, seguia abierta y bastaba con volver
// a escribir el correo en localStorage para "reaparecer" logueado.
// Sesion.salir() (sesion.js) avisa al servidor y luego limpia.
function cerrarSesion(){
  return Sesion.salir();
}


// CARRITO
let carrito = JSON.parse(localStorage.getItem("carrito")) || [];


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


function cerrarCarrito(){
let panel = document.getElementById("carritoPanel");
if(panel){
panel.classList.remove("abierto");
}
}


function agregarCarrito(btn){

const card = btn.closest(".card");

const nombre = card.querySelector("div:nth-child(4)").innerText;
const precio = card.querySelector(".price").innerText;
const img = card.querySelector("img").src;

carrito.push({
nombre:nombre,
precio:precio,
imagen:img
});

localStorage.setItem("carrito",JSON.stringify(carrito));
localStorage.setItem("carritoCantidad",carrito.length);

actualizarContador();

}


// ACTUALIZAR CARRITO
function cargarCarrito(){

let contenedor = document.getElementById("carritoProductos");

if(!contenedor) return;

contenedor.innerHTML="";

if(carrito.length === 0){
contenedor.innerHTML="<p>Tu carrito esta vacio</p>";
return;
}

carrito.forEach((producto,index)=>{

contenedor.innerHTML += `
<div class="item-carrito">

<img src="${producto.imagen}">

<div>
<strong>${producto.nombre}</strong>
<br>
${producto.precio}
<br>
<button onclick="eliminarDelCarrito(${index})">
Eliminar
</button>
</div>

</div>
`;

});

}


// ELIMINAR PRODUCTO
function eliminarDelCarrito(index){

let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

carrito.splice(index,1);

localStorage.setItem("carrito",JSON.stringify(carrito));

actualizarContador();
cargarCarrito();

}


// CONTADOR CARRITO
function actualizarContador(){

let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

let contador = document.getElementById("carritoCantidad");

if(contador){
contador.innerText = carrito.length;
}

}


// BUSCADOR
function buscarProducto(){

let texto = document.getElementById("buscarInput").value.toLowerCase();

let resultados = document.getElementById("resultadosBusqueda");

let productos = document.querySelectorAll(".card");

resultados.innerHTML="";

if(texto === ""){
resultados.style.display="none";
return;
}

productos.forEach(producto=>{

let nombre = producto.getAttribute("data-nombre");

if(nombre && nombre.includes(texto)){

resultados.innerHTML += `
<div class="resultado-item" onclick="irProducto('${nombre}')">
${nombre}
</div>
`;

}

});

resultados.style.display="block";

}


function irProducto(nombre){

let productos = document.querySelectorAll(".card");

productos.forEach(producto=>{

if(producto.getAttribute("data-nombre") === nombre){

producto.scrollIntoView({
behavior:"smooth"
});

}

});

document.getElementById("resultadosBusqueda").style.display="none";

}


