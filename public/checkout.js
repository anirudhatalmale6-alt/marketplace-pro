let producto = JSON.parse(localStorage.getItem("productoCompra"));

let contenedor = document.getElementById("productoCompra");
let total = document.getElementById("totalCompra");

if (producto) {

contenedor.innerHTML = `
<img src="${producto.imagen}">
<div>
<h2>${producto.nombre}</h2>
<p>${producto.precio}</p>
</div>
`;

total.innerText = producto.precio;

}

function cambiarFormulario(){

let pais = document.getElementById("pais").value;
let contenedor = document.getElementById("formularioDireccion");

if(pais === "rd"){

contenedor.innerHTML = `

<input type="text" placeholder="Nombre">
<input type="text" placeholder="Apellido">
<input type="tel" placeholder="Teléfono">

<input id="direccion" type="text" placeholder="Escribe tu dirección">

<input type="text" placeholder="Provincia">
<input type="text" placeholder="Ciudad">
<input type="text" placeholder="Código postal">

`;

}

else if(pais === "us"){

contenedor.innerHTML = `

<input type="text" placeholder="First Name">
<input type="text" placeholder="Last Name">

<input type="tel" placeholder="Phone (+1...)">

<input type="text" placeholder="State">
<input type="text" placeholder="City">
<input type="text" placeholder="Street Address">
<input type="text" placeholder="ZIP Code">

`;

}

else if(pais === "mx"){

contenedor.innerHTML = `

<input type="text" placeholder="Nombre">
<input type="text" placeholder="Apellido">

<input type="tel" placeholder="Teléfono (+52...)">

<input type="text" placeholder="Estado">
<input type="text" placeholder="Ciudad">
<input type="text" placeholder="Dirección">
<input type="text" placeholder="Código Postal">

`;

}

else if(pais === "es"){

contenedor.innerHTML = `

<input type="text" placeholder="Nombre">
<input type="text" placeholder="Apellidos">

<input type="tel" placeholder="Teléfono (+34...)">

<input type="text" placeholder="Provincia">
<input type="text" placeholder="Ciudad">
<input type="text" placeholder="Dirección">
<input type="text" placeholder="Código Postal">

`;

}

}

function iniciarAutocomplete(){

let input = document.getElementById("direccion");

if(!input) return;

let autocomplete = new google.maps.places.Autocomplete(input, {
types: ["address"]
});

autocomplete.addListener("place_changed", function(){

let lugar = autocomplete.getPlace();

console.log("Dirección válida:", lugar.formatted_address);

});

}

window.onload = iniciarAutocomplete;

/* =========================
   CONFIRMAR COMPRA

   ESTE ERA EL FALLO MAS GRAVE DEL FLUJO DE COMPRA:

   esta funcion NO llamaba al servidor. Inventaba un numero de pedido
   con Math.random(), lo guardaba en localStorage.historialCompras y
   llevaba a "gracias.html".

   Pero la pagina de historial pide los pedidos al servidor
   (/my-orders). Por eso el cliente compraba, veia "gracias", y su
   pedido no aparecia en ningun sitio ni le llegaba al vendedor.

   Ahora el pedido se crea en el servidor y solo se limpia el carrito
   si el servidor confirma.
========================= */

async function confirmarCompra(){

  const productoDirecto = JSON.parse(
    localStorage.getItem("productoCompra") || "null"
  );

  const carrito = JSON.parse(localStorage.getItem("carrito")) || [];

  let productosCompra = [];
  let compraDesdeCarrito = false;

  /* SI VIENE DE "COMPRAR AHORA" */
  if (productoDirecto) {
    productosCompra = [productoDirecto];
  }

  /* SI VIENE DEL CARRITO */
  else if (carrito.length > 0) {
    productosCompra = carrito;
    compraDesdeCarrito = true;
  }

  if (productosCompra.length === 0) {
    alert("No hay productos para comprar");
    return;
  }

  const sinId = productosCompra.filter(p => !p.adId);

  if (sinId.length > 0) {
    alert(
      "Hay productos guardados con el formato antiguo. " +
      "Vacia el carrito y vuelve a agregarlos, por favor."
    );
    return;
  }

  const items = productosCompra.map(p => ({
    adId: p.adId,
    cantidad: parseInt(p.cantidad, 10) || 1
  }));

  const boton = document.getElementById("btnConfirmarCompra");
  if (boton) boton.disabled = true;

  try {
    const { ok, status, datos } = await Sesion.api("/checkout", {
      method: "POST",
      body: {
        items,
        metodoPago: (
          document.querySelector('input[name="metodoPago"]:checked') || {}
        ).value
      }
    });

    if (status === 401) {
      alert("Tu sesion ha caducado. Inicia sesion otra vez.");
      window.location.href = "login.html";
      return;
    }

    if (!ok) {
      alert((datos && datos.message) || "No se pudo completar la compra");
      return;
    }

    /* Solo ahora, con el pedido ya creado en el servidor, se limpia */
    localStorage.removeItem("productoCompra");
    localStorage.removeItem("cantidadCompra");

    if (compraDesdeCarrito) {
      localStorage.removeItem("carrito");
      localStorage.removeItem("carritoCantidad");
    }

    const pedido = datos.pedidos && datos.pedidos[0];

    if (pedido) {
      localStorage.setItem("ultimoPedido", pedido.numero);
    }

    window.location.href = "gracias.html";

  } catch (error) {
    console.error("Error al confirmar la compra:", error);
    alert("No se pudo conectar con el servidor. Intenta de nuevo.");
  } finally {
    if (boton) boton.disabled = false;
  }
}