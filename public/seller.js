document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);

  const email = params.get("email");

  if (!email) {
    alert("Vendedor no encontrado");
    return;
  }

  try {

    const res = await fetch("/seller/" + email);

    const data = await res.json();

    const vendedor = data.vendedor;
   

    const productos = data.productos;


    // DATOS VENDEDOR
    document.getElementById("sellerName").innerText =
      vendedor.nombre || vendedor.businessName;

    document.getElementById("sellerEmail").innerText =
      vendedor.email;

    document.getElementById("sellerUsername").innerText =
      "@" + vendedor.username;

      document.getElementById("sellerJoined").innerText =
  "📅 Miembro desde: " +
  new Date(vendedor.createdAt).toLocaleDateString();

document.getElementById("sellerTotalProducts").innerText =
  "📦 Productos publicados: " +
  productos.length;

document
.getElementById("contactSellerBtn")
.onclick = () => {

localStorage.setItem(
  "chatVendedor",
  JSON.stringify({
    nombre:
      vendedor.nombre ||
      vendedor.businessName,

    email: vendedor.email,

    username: vendedor.username
  })
);

localStorage.setItem(
  "abrirChatAutomatico",
  "si"
);

abrirChat();

};

  const avatar =
  document.getElementById("sellerAvatar");

const letra =
  (vendedor.nombre || vendedor.businessName || "U")
  .charAt(0)
  .toUpperCase();

avatar.innerText = letra;

    // PRODUCTOS
    const container = document.getElementById("sellerProducts");

    if (productos.length === 0) {
      container.innerHTML = "<p>Este vendedor no tiene productos.</p>";
      return;
    }

const productosPorPagina = 6;

let paginaActual = 1;

function mostrarProductos(){

  container.innerHTML = "";

  const inicio =
    (paginaActual - 1) * productosPorPagina;

  const fin =
    inicio + productosPorPagina;

 const productosPagina =
  productos
    .slice()
    .sort((a,b)=>
      new Date(b.createdAt) -
      new Date(a.createdAt)
    )
    .slice(inicio, fin);

  productosPagina.forEach(producto => {

    container.innerHTML += `
      <div class="product-card">

        <img src="${producto.image}"
        class="product-img">

        <h3>${producto.title}</h3>

        <p class="price">
          RD$ ${producto.price}
        </p>

<p class="product-date">

📅 ${
  producto.createdAt
    ? new Date(producto.createdAt)
        .toLocaleDateString()
    : "Fecha no disponible"
}

</p>

       <button class="btn-ver-producto" onclick='verProducto(${JSON.stringify(producto)})'>
  <span>Ver producto</span>
  <span class="flecha">→</span>
</button>

      </div>
    `;

  });

  mostrarPaginacion();
}

function mostrarPaginacion(){

  const totalPaginas =
    Math.ceil(productos.length / productosPorPagina);

  const pagination =
    document.getElementById("pagination");

  pagination.innerHTML = "";

  for(let i = 1; i <= totalPaginas; i++){

    pagination.innerHTML += `
      <button onclick="cambiarPagina(${i})">
        ${i}
      </button>
    `;
  }
}

window.cambiarPagina = function(pagina){

  paginaActual = pagina;

  mostrarProductos();
}

mostrarProductos();

cargarReviews();

actualizarRatingVendedor();

} catch (error) {
  console.error(error);
}

});

// VER PRODUCTO
function verProducto(producto){

  localStorage.setItem(
    "productoSeleccionado",
    JSON.stringify(producto)
  );

  window.location.href = "producto.html";
}

function seguirVendedor(){

  const vendedor =
    document.getElementById(
      "sellerUsername"
    ).innerText;

  const usuario =
    localStorage.getItem(
      "usuarioLogueado"
    );

  if(!usuario){

    alert(
      "Debes iniciar sesión"
    );

    return;
  }

  let seguidores =
    JSON.parse(
      localStorage.getItem("seguidores")
    ) || [];

  const yaExiste =
    seguidores.find(
      s =>
        s.usuario === usuario &&
        s.vendedor === vendedor
    );

  if(yaExiste){

  seguidores =
    seguidores.filter(
      s =>
        !(
          s.usuario === usuario &&
          s.vendedor === vendedor
        )
    );

  localStorage.setItem(
    "seguidores",
    JSON.stringify(seguidores)
  );

  actualizarSeguidores();
verificarSeguimiento();
  

  document.getElementById(
    "followBtn"
  ).innerText =
    "➕ Seguir vendedor";

  return;
}

document.getElementById(
  "followBtn"
).innerText =
  "✓ Siguiendo";
  seguidores.push({

    usuario,

    vendedor,

    fecha:
      new Date().toISOString()

  });

  localStorage.setItem(
    "seguidores",
    JSON.stringify(seguidores)
  );

  actualizarSeguidores();

  alert(
    "Ahora sigues este vendedor"
  );

}

function actualizarSeguidores(){

  const vendedor =
    document.getElementById(
      "sellerUsername"
    ).innerText;

  let seguidores =
    JSON.parse(
      localStorage.getItem("seguidores")
    ) || [];

  const total =
    seguidores.filter(
      s => s.vendedor === vendedor
    ).length;

  document.getElementById(
    "followersCount"
  ).innerText =

  `👥 ${total} seguidores`;

}

document.addEventListener("DOMContentLoaded", () => {

  setTimeout(() => {
    actualizarSeguidores();
  }, 100);

});


function agregarReview(){

  const vendedor =
    document.getElementById(
      "sellerUsername"
    ).innerText;

  let texto =
    document.getElementById(
      "reviewInput"
    ).value.trim();

 if(texto.length < 3){

  alert(
    "El comentario es muy corto"
  );

  return;
}

if(texto.length > 300){

  alert(
    "Máximo 300 caracteres"
  );

  return;
}

  let reviews =
    JSON.parse(
      localStorage.getItem("reviews")
    ) || [];

 reviews.push({

  vendedor,

  usuario:
    localStorage.getItem(
      "usuarioLogueado"
    ),

  texto,

  rating: ratingSeleccionado,

  fecha:
    new Date().toISOString()

});

  localStorage.setItem(
    "reviews",
    JSON.stringify(reviews)
  );

  cargarReviews();

  actualizarRatingVendedor();

  document.getElementById(
    "reviewInput"
  ).value = "";

}

function cargarReviews(){

  const vendedor =
    document.getElementById(
      "sellerUsername"
    ).innerText;

  const container =
    document.getElementById(
      "reviewsContainer"
    );

  let reviews =
    JSON.parse(
      localStorage.getItem("reviews")
    ) || [];

  const reviewsVendedor =
    reviews.filter(
      r => r.vendedor === vendedor
    );

  if(reviewsVendedor.length === 0){

    container.innerHTML = `
      <p>Aún no hay opiniones.</p>
    `;

    return;
  }

  container.innerHTML = "";

  reviewsVendedor
.reverse()
.forEach(review => {

    container.innerHTML += `

      <div class="review-card">

        <div class="review-user">
          👤 ${review.usuario}
        </div>

        <div class="review-text">
          ${review.texto}
        </div>
        <div class="review-date">

📅 ${
  new Date(review.fecha)
  .toLocaleDateString()
}

</div>
<div class="review-stars">

${"⭐".repeat(review.rating || 5)}

</div>
      </div>

    `;

  });

}


const textarea =
document.getElementById(
  "reviewInput"
);

if(textarea){

textarea.addEventListener(
  "input",
  function(){

    this.style.height = "auto";

    this.style.height =
      this.scrollHeight + "px";

  }
);

}

let ratingSeleccionado = 5;
window.addEventListener(
  "DOMContentLoaded",
  () => {

    setRating(5);

});

function setRating(rating){

ratingSeleccionado = rating;

const stars =
document.querySelectorAll(
  ".stars-input span"
);

stars.forEach((star,index)=>{

if(index < rating){

star.classList.add("activa");

}else{

star.classList.remove("activa");

}

});

}

function actualizarRatingVendedor(){

  const vendedor =
    document.getElementById(
      "sellerUsername"
    ).innerText;

  let reviews =
    JSON.parse(
      localStorage.getItem("reviews")
    ) || [];

  const reviewsVendedor =
    reviews.filter(
      r => r.vendedor === vendedor
    );

  if(reviewsVendedor.length === 0){

    document.getElementById(
      "sellerReputation"
    ).innerText =
      "Sin calificaciones";

    return;
  }

  const total =
    reviewsVendedor.reduce(
      (acc,review)=>
        acc + (review.rating || 5),
      0
    );

  const promedio =
    (
      total /
      reviewsVendedor.length
    ).toFixed(1);

  document.getElementById(
    "sellerReputation"
  ).innerText =

  `⭐ ${promedio}/5 · ${reviewsVendedor.length} comentarios`;

}


function verificarSeguimiento(){

  const vendedor =
    document.getElementById(
      "sellerUsername"
    ).innerText;

  const usuario =
    localStorage.getItem(
      "usuarioLogueado"
    );

  let seguidores =
    JSON.parse(
      localStorage.getItem("seguidores")
    ) || [];

  const siguiendo =
    seguidores.find(
      s =>
        s.usuario === usuario &&
        s.vendedor === vendedor
    );

  if(siguiendo){

    document.getElementById(
      "followBtn"
    ).innerText =
      "✓ Siguiendo";

  }

}