let temporizadorInactividad;
let temporizadorBorrado;

function obtenerChatId(){

const usuario =
localStorage.getItem(
  "usuarioLogueado"
) || "anonimo";

const vendedor =
JSON.parse(
  localStorage.getItem(
    "chatVendedor"
  )
);

const nombreVendedor =
vendedor?.username || "general";

return `chat_${usuario}_${nombreVendedor}`;

}



function abrirChat(){

let badge=document.getElementById("notificacionChat");

if(badge){
badge.innerText="0";
badge.classList.remove("activa");
}

let producto = document.getElementById("nombre");

if(producto){

let nombreProducto = producto.innerText.trim();

let nombreChat = document.getElementById("chatProductoNombre");

if(nombreChat){
nombreChat.innerText = nombreProducto;
}

localStorage.setItem("chatProducto", nombreProducto);

/* mensaje automático del usuario */

let mensajes = JSON.parse(localStorage.getItem(obtenerChatId())) || [];

if(mensajes.length === 0){

mensajes.push({
texto:"Hola, estoy interesado en este producto: " + nombreProducto,
tipo:"usuario"
});

localStorage.setItem(obtenerChatId(), JSON.stringify(mensajes));

cargarMensajes();

respuestaAutomatica();

}

}

let chatBox=document.getElementById("chatBox");

if(chatBox){
chatBox.style.display="flex";
}

borrarChatAutomatico();
reiniciarTemporizador();

localStorage.setItem("chatAbierto","si");

cargarMensajes();

}


function cerrarChat(){

let chatBox=document.getElementById("chatBox");

if(chatBox){
chatBox.style.display="none";
}

localStorage.setItem("chatAbierto","no");

}

function enviarMensaje(){

let input=document.getElementById("mensajeInput");

let boton =
document.querySelector(
".chat-input button"
);

if(boton){

boton.disabled = true;

setTimeout(()=>{

boton.disabled = false;

},1000);

}

if(!input) return;

let mensaje=input.value.trim();

if(mensaje==="") return;

let mensajes=JSON.parse(localStorage.getItem(obtenerChatId()))||[];

mensajes.push({
texto:mensaje,
tipo:"usuario",
hora:new Date().toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
}),
visto:false
});

const vendedor =
JSON.parse(
  localStorage.getItem(
    "chatVendedor"
  )
);

let conversaciones =
JSON.parse(
  localStorage.getItem(
    "conversaciones"
  )
) || [];

const usuario =
localStorage.getItem(
  "usuarioLogueado"
);

const chatId =
obtenerChatId();

const existe =
conversaciones.find(
  c => c.chatId === chatId
);

if(!existe){

conversaciones.push({

chatId,

usuario,

vendedor:
  vendedor?.username,

nombreVendedor:
  vendedor?.nombre,

ultimoMensaje: mensaje,

fecha:
  new Date().toISOString()

});

}else{

existe.ultimoMensaje =
mensaje;

existe.fecha =
new Date().toISOString();

}

localStorage.setItem(
  "conversaciones",
  JSON.stringify(
    conversaciones
  )
);

localStorage.setItem(obtenerChatId(),JSON.stringify(mensajes));

input.value="";

cargarMensajes();

cargarConversaciones();

reiniciarTemporizador();

respuestaAutomatica();

localStorage.removeItem(
"borradorChat"
);

}



function cargarMensajes(){

let contenedor=document.getElementById("chatMensajes");

if(!contenedor) return;

const chatId =
localStorage.getItem("chatActual")
|| obtenerChatId();

let mensajes =
JSON.parse(
localStorage.getItem(chatId)
) || [];

contenedor.innerHTML="";

let ultimaFecha = "";

mensajes.forEach(m=>{

const fechaMensaje =
new Date().toLocaleDateString();

if(fechaMensaje !== ultimaFecha){

ultimaFecha = fechaMensaje;

const fechaDiv =
document.createElement("div");

fechaDiv.classList.add(
"fecha-chat"
);

fechaDiv.innerText =
fechaMensaje;

contenedor.appendChild(
fechaDiv
);

}

let div=document.createElement("div");

div.classList.add("mensaje");

if(m.tipo==="usuario"){
div.classList.add("usuario");
}
else if(m.tipo==="vendedor"){
div.classList.add("vendedor");
}
else if(m.tipo==="sistema"){
div.classList.add("sistema");
}

div.innerHTML = `

${m.texto}

<div class="hora-mensaje">

${m.hora || ""}

${
m.tipo === "usuario"
? (
m.visto
? " ✓✓"
: " ✓"
)
: ""
}

</div>

`;

contenedor.appendChild(div);

});

const estaAbajo =

contenedor.scrollHeight -
contenedor.scrollTop <=
contenedor.clientHeight + 100;

if(estaAbajo){

contenedor.scrollTop =
contenedor.scrollHeight;

}

}

function respuestaAutomatica(){

setTimeout(()=>{

mostrarEscribiendo();

const input =
document.getElementById(
"mensajeInput"
);

if(input){

input.disabled = true;

}

let mensajes=JSON.parse(localStorage.getItem(obtenerChatId()))||[];

const ultimoMensaje =
mensajes[
mensajes.length - 1
]?.texto?.toLowerCase() || "";

let yaRespondio = mensajes.some(
m =>
m.tipo === "vendedor"
&&
m.texto.includes(
"Gracias por escribirnos"
)
);

if(!yaRespondio){

let texto = "";

if(
ultimoMensaje.includes("precio")
){

texto =
"El precio publicado es el disponible actualmente.";

}
else if(
ultimoMensaje.includes("delivery")
){

texto =
"Sí, tenemos delivery disponible.";

}
else if(
ultimoMensaje.includes("ubicacion")
||
ultimoMensaje.includes("donde")
){

texto =
"Podemos coordinar un punto de entrega.";

}
else if(
ultimoMensaje.includes("disponible")
){

texto =
"Sí 👌 el producto sigue disponible.";

}
else{

const respuestas = [

"Hola 👋\nGracias por escribirnos.\n¿En qué puedo ayudarte?",

"Buenas 👋\nSí, el producto sigue disponible.",

"Hola 😊\nGracias por contactar al vendedor.",

"Saludos 👋\n¿Deseas más información del producto?",

"Hola.\nEstamos para ayudarte."

];

texto =

respuestas[
Math.floor(
Math.random() *
respuestas.length
)
];

}
const typing =
document.getElementById(
"typingIndicator"
);

if(typing){

  if(input){

input.disabled = false;

input.focus();

}

typing.remove();

}

mensajes.forEach(m=>{

if(m.tipo==="usuario"){

m.visto = true;

}

});

mensajes.push({
texto:texto,
tipo:"vendedor",
hora:new Date().toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
})
});

localStorage.setItem(obtenerChatId(),JSON.stringify(mensajes));

cargarMensajes();

notificarMensaje(texto);

let conversaciones =
JSON.parse(
localStorage.getItem(
"conversaciones"
)
) || [];

const chatId =
obtenerChatId();

const existe =
conversaciones.find(
c => c.chatId === chatId
);

if(existe){

existe.ultimoMensaje =
texto;

existe.fecha =
new Date().toISOString();

existe.noLeidos =
(existe.noLeidos || 0) + 1;

localStorage.setItem(
"conversaciones",
JSON.stringify(conversaciones)
);

}

cargarConversaciones();

}

reiniciarTemporizador();

},2000);

}

function minimizarChat(){

let chat = document.getElementById("chatBox");

if(!chat) return;

chat.classList.toggle("chat-minimizado");

if(chat.classList.contains("chat-minimizado")){
localStorage.setItem("chatMinimizado","si");
}else{
localStorage.setItem("chatMinimizado","no");
}

}

function notificarMensaje(texto){

let badge = document.getElementById("notificacionChat");

if(badge){

let numero = parseInt(badge.innerText) || 0;

numero++;

badge.innerText = numero;

badge.classList.add("activa");

}

let sonido = document.getElementById("sonidoMensaje");

if(sonido){
sonido.play().catch(()=>{});
}

mostrarNotificacion(texto);

}

function mostrarNotificacion(texto){

let chat = document.getElementById("chatBox");
let noti = document.getElementById("notificacionFlotante");

if(!noti) return;

if(chat && chat.style.display === "flex" && !chat.classList.contains("chat-minimizado")){
return;
}

let textoNoti = document.getElementById("textoNoti");

if(textoNoti){
textoNoti.innerText = texto;
}

noti.style.display = "flex";

setTimeout(()=>{

noti.style.display = "none";

},5000);

}

function finalizarChat(){

localStorage.removeItem(obtenerChatId());

let contenedor = document.getElementById("chatMensajes")

if(contenedor){
contenedor.innerHTML = "";
}

cerrarChat();

}

function reiniciarTemporizador(){

clearTimeout(temporizadorInactividad);

let boton = document.getElementById("botonFinalizar");

if(boton){
boton.style.display="none";
}

temporizadorInactividad = setTimeout(()=>{

if(boton){
boton.style.display="block";
}

},300000);

}

function borrarChatAutomatico(){

clearTimeout(temporizadorBorrado);

temporizadorBorrado = setTimeout(()=>{

localStorage.removeItem(obtenerChatId());

let contenedor = document.getElementById("chatMensajes");

if(contenedor){
contenedor.innerHTML="";
}

cerrarChat();

},300000);

}

window.onload=function(){

let chatBox=document.getElementById("chatBox");

if(localStorage.getItem("chatAbierto")==="si" && chatBox){

chatBox.style.display="flex";

cargarMensajes();

}
cargarConversaciones();

if(
  localStorage.getItem(
    "abrirChatAutomatico"
  ) === "si"
){

  setTimeout(() => {

    abrirChat();

    localStorage.removeItem(
      "abrirChatAutomatico"
    );

  }, 500);

}

if(localStorage.getItem("chatMinimizado")==="si" && chatBox){

chatBox.classList.add("chat-minimizado");

}

let badge=document.getElementById("notificacionChat");

if(badge){
badge.innerText="0";
badge.classList.remove("activa");
}

}

document.addEventListener("DOMContentLoaded", function () {

let input = document.getElementById("mensajeInput");

if (input) {

  input.value = localStorage.getItem("borradorChat") || "";

  input.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  });

  // FIX: mover input listener aquí (ESTABA ROMPIENDO)
  input.addEventListener("input", function () {
    localStorage.setItem("borradorChat", this.value);
  });

}

});

/* mensaje para finalizar chat después de 1 minuto */

setTimeout(function(){

let contenedor = document.getElementById("chatMensajes");
let boton = document.getElementById("botonFinalizar");

if(contenedor){

let div = document.createElement("div");
div.classList.add("mensaje","sistema");
div.innerText = "¿Desea finalizar el chat?";

contenedor.appendChild(div);

contenedor.scrollTop = contenedor.scrollHeight;

}

if(boton){
boton.style.display = "block";
}

},60000);

function cargarConversaciones(){

const container =
document.getElementById(
  "listaConversaciones"
);

if(!container) return;

let conversaciones =
JSON.parse(
  localStorage.getItem(
    "conversaciones"
  )
) || [];

if(conversaciones.length === 0){

container.innerHTML = `
<p>No hay conversaciones</p>
`;

return;
}

container.innerHTML = "";

conversaciones
.sort((a,b)=>
new Date(b.fecha) -
new Date(a.fecha)
)
.forEach(conv=>{

container.innerHTML += `

<div class="conversacion-item"
onclick="abrirConversacion('${conv.chatId}')">

<div class="conversacion-nombre">

👤 ${conv.nombreVendedor || "Vendedor"}




</div>

</div>

`;

});

}

function abrirConversacion(chatId){

localStorage.setItem(
"chatActual",
chatId
);


let conversaciones =
JSON.parse(
localStorage.getItem(
"conversaciones"
)
) || [];

const conv =
conversaciones.find(
c => c.chatId === chatId
);

if(conv){

conv.noLeidos = 0;

localStorage.setItem(
"conversaciones",
JSON.stringify(conversaciones)
);

}

cargarMensajes();

let chatBox =
document.getElementById(
"chatBox"
);

if(chatBox){

chatBox.style.display =
"flex";

}

}

document.addEventListener(
"keydown",
function(e){

if(e.key === "Escape"){

cerrarChat();

}

}
);

function mostrarEscribiendo(){

let existente = document.getElementById("typingIndicator");
if (existente) existente.remove();

let contenedor =
document.getElementById(
"chatMensajes"
);

if(!contenedor) return;

const typing =
document.createElement("div");

typing.id = "typingIndicator";

typing.classList.add(
"mensaje",
"vendedor"
);

typing.innerText =
"Escribiendo...";

contenedor.appendChild(
typing
);

contenedor.scrollTop =
contenedor.scrollHeight;

}