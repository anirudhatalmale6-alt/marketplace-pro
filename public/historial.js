const contenedor = document.getElementById("listaCompras");

let paginaActual = 1;
let porPagina = 10;


async function mostrarCompras() {
    const email = localStorage.getItem("usuarioLogueado");

    const res = await fetch("/my-orders/" + email);
    const compras = await res.json();

    contenedor.innerHTML = "";

    let lista = [];

    compras.forEach(compra => {
        if (compra.productos && Array.isArray(compra.productos)) {
            compra.productos.forEach(producto => {
                lista.push({
                    imagen: producto.imagen,
                    nombre: producto.nombre,
                    precio: producto.precio,
                    pedido: producto.cantidad || 1,
                    fecha: compra.fecha,
                    estado: compra.estado || "Pendiente"
                });
            });
        }
    });

    let inicio = (paginaActual - 1) * porPagina;
    let fin = inicio + porPagina;
if (lista.length === 0) {
    contenedor.innerHTML = "<p>No tienes compras todavía</p>";
    return;
}
    let pagina = lista.slice(inicio, fin);

    pagina.forEach(compra => {
        let div = document.createElement("div");
        div.classList.add("compra");

        div.innerHTML = `
            <img src="${compra.imagen}">
            <div class="compra-info">
                <h3>${compra.nombre}</h3>
                <p><strong>Precio:</strong> ${compra.precio}</p>
                <p><strong>Cantidad:</strong> ${compra.pedido}</p>
                <p><strong>Fecha:</strong> ${compra.fecha}</p>
                <p class="estado ${compra.estado.toLowerCase()}">
                    ${compra.estado}
                </p>
            </div>
        `;

        contenedor.appendChild(div);
    });

    crearPaginacion(lista.length);
}

document.addEventListener("DOMContentLoaded", () => {
    mostrarCompras();
});


function cambiarCantidadPagina() {
    porPagina = parseInt(
        document.getElementById("porPaginaSelect").value
    );
    paginaActual = 1;
    mostrarCompras();
}

function crearPaginacion(total) {
    let vieja = document.querySelector(".paginacion");
    if (vieja) vieja.remove();

    let paginas = Math.ceil(total / porPagina);

    let pagDiv = document.createElement("div");
    pagDiv.classList.add("paginacion");

    for (let i = 1; i <= paginas; i++) {
        let btn = document.createElement("button");
        btn.innerText = i;

        if (i === paginaActual) {
            btn.classList.add("activo");
        }

        btn.onclick = () => {
            paginaActual = i;
            mostrarCompras();
        };

        pagDiv.appendChild(btn);
    }

    contenedor.appendChild(pagDiv);
}