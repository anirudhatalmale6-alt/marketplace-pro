document.addEventListener("DOMContentLoaded", cargarFavoritos);


/* =========================
   OBTENER USUARIO
========================= */
function obtenerUsuario() {

  const usuarioGuardado =
    localStorage.getItem("usuarioData");

  if (!usuarioGuardado) {
    return null;
  }

  try {

    return JSON.parse(usuarioGuardado);

  } catch (error) {

    console.error(
      "❌ Error leyendo usuario:",
      error
    );

    return null;
  }

}


/* =========================
   CARGAR FAVORITOS
========================= */

async function cargarFavoritos() {

  const contenedor =
    document.getElementById("listaFavoritos");

  const usuario = obtenerUsuario();

  if (!usuario || !usuario.email) {

    contenedor.innerHTML = `
      <div class="sin-favoritos">
        <h2>🔐 Debes iniciar sesión</h2>
        <p>Inicia sesión para ver tus productos favoritos.</p>
      </div>
    `;

    return;
  }

  try {

    const res = await fetch(
      `/favoritos?email=${encodeURIComponent(usuario.email)}`
    );

    const productos = await res.json();

    if (!res.ok) {
      throw new Error(
        productos.message || "Error cargando favoritos"
      );
    }

    contenedor.innerHTML = "";

    if (productos.length === 0) {

      contenedor.innerHTML = `
        <div class="sin-favoritos">

          <div class="icono-favorito">
            ⭐
          </div>

          <h2>No tienes productos favoritos</h2>

          <p>
            Cuando guardes un producto como favorito,
            aparecerá aquí.
          </p>

        </div>
      `;

      return;
    }

    productos.forEach(producto => {

      const div =
        document.createElement("div");

      div.classList.add("producto-favorito");

      div.innerHTML = `

        <img
          src="${producto.image}"
          alt="${producto.title}"
        >

        <h3>
          ${producto.title}
        </h3>

        <p class="precio">
          RD$ ${Number(producto.price).toLocaleString("es-DO")}
        </p>

        <p class="condicion">
          ${producto.condicion || ""}
        </p>

        <div class="acciones-favorito">

          <button
            class="btn-ver"
            onclick="verProducto(${producto.id})"
          >
            Ver producto
          </button>

          <button
            class="btn-eliminar"
            onclick="eliminarFavorito(${producto.id})"
          >
            ❌ Quitar
          </button>

        </div>

      `;

      contenedor.appendChild(div);

    });

  } catch (error) {

    console.error(
      "❌ Error cargando favoritos:",
      error
    );

    contenedor.innerHTML = `
      <div class="sin-favoritos">

        <h2>⚠️ No se pudieron cargar los favoritos</h2>

        <p>
          Intenta nuevamente.
        </p>

      </div>
    `;

  }

}


/* =========================
   ELIMINAR FAVORITO
========================= */

async function eliminarFavorito(adId) {

  const usuario = obtenerUsuario();

  if (!usuario || !usuario.email) {
    alert("Debes iniciar sesión");
    return;
  }

  try {

    const res = await fetch("/favoritos", {

      method: "DELETE",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        email: usuario.email,
        adId: adId
      })

    });

    const data = await res.json();

    if (!res.ok) {

      alert(
        data.message ||
        "No se pudo eliminar el favorito"
      );

      return;
    }

    cargarFavoritos();

  } catch (error) {

    console.error(
      "❌ Error eliminando favorito:",
      error
    );

    alert(
      "Error de conexión con el servidor"
    );

  }

}


/* =========================
   VER PRODUCTO
========================= */

function verProducto(id) {

  window.location.href =
    `producto.html?id=${id}`;

}