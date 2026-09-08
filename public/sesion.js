/* =========================
   SESION - ARCHIVO COMPARTIDO

   Este archivo se carga EL PRIMERO en todas las paginas.

   Que resuelve:

   1) Antes cada pagina decidia por su cuenta si habia sesion leyendo
      localStorage, y cada una leia una clave distinta:
        login.js escribia  "usuarioLogueado" y "usuarioData"
        pero direcciones.js, pagos.js, comentarios.js, resolucion.js y
        solicita-datos.js leian  "email" y "usuario", que NADIE escribia.
      Esas cinco paginas creian siempre que no habias iniciado sesion.

   2) localStorage no es una sesion: cualquiera puede escribir ahi el
      correo que quiera. Ahora quien manda es la cookie firmada del
      servidor. Se sigue rellenando localStorage, pero solo con lo que
      responde el servidor y solo para que el codigo antiguo que lo lee
      siga funcionando.

   3) protegerPagina() estaba definida cuatro veces en cuatro archivos
      distintos, y en dashboard.html no estaba definida en ninguno: por
      eso el panel se quedaba en blanco.
========================= */

const Sesion = (() => {
  let cache = null;
  let pedido = null;

  const CLAVES = [
    "usuarioLogueado",
    "usuarioData",
    "email",
    "usuario",
    "user",
    "tipoCuenta"
  ];

  function guardarEnLocal(user) {
    const nombre =
      user.accountType === "business"
        ? user.businessName || ""
        : `${user.nombre || ""} ${user.apellido || ""}`.trim();

    /* Se escriben TODAS las claves que usa alguna pagina para que
       ninguna se quede fuera.

       Ojo con el FORMATO, que no es el mismo en todas:
         "usuarioLogueado" y "email"  ->  el correo, texto suelto
         "usuario", "usuarioData", "user"  ->  el objeto en JSON
       (direcciones.js, pagos.js, comentarios.js, resolucion.js,
        solicita-datos.js y preferencias.js hacen JSON.parse de
        "usuario" y despues leen usuario.email) */
    const json = JSON.stringify({ ...user, nombreCompleto: nombre });

    localStorage.setItem("usuarioLogueado", user.email);
    localStorage.setItem("email", user.email);
    localStorage.setItem("usuario", json);
    localStorage.setItem("usuarioData", json);
    localStorage.setItem("user", json);
    localStorage.setItem("tipoCuenta", user.accountType || "");
  }

  function limpiarLocal() {
    CLAVES.forEach(c => localStorage.removeItem(c));
  }

  /* Pregunta al servidor quien soy. Una sola peticion por pagina. */
  async function usuario({ recargar = false } = {}) {
    if (cache && !recargar) return cache;

    if (!pedido || recargar) {
      pedido = fetch("/me", { credentials: "same-origin" })
        .then(r => (r.ok ? r.json() : null))
        .then(datos => {
          if (datos && datos.autenticado) {
            cache = datos.user;
            guardarEnLocal(cache);
          } else {
            cache = null;
            limpiarLocal();
          }
          return cache;
        })
        .catch(() => {
          /* Sin conexion: no se borra nada, se devuelve lo que haya */
          cache = null;
          return null;
        });
    }

    return pedido;
  }

  /* Para paginas que exigen sesion */
  async function proteger(destino = "login.html") {
    const user = await usuario();

    if (!user) {
      window.location.href = destino;
      return null;
    }

    return user;
  }

  async function salir() {
    try {
      await fetch("/logout", { method: "POST", credentials: "same-origin" });
    } catch (error) {
      /* aunque falle la peticion, se limpia el navegador */
    }

    cache = null;
    pedido = null;
    limpiarLocal();

    /* El carrito es del navegador, tambien se vacia al salir */
    localStorage.removeItem("carrito");
    localStorage.removeItem("carritoCantidad");

    window.location.href = "index.html";
  }

  /* Ayuda para llamar a la API mandando siempre la cookie y avisando
     de forma clara cuando la sesion ha caducado */
  async function api(ruta, opciones = {}) {
    const config = { credentials: "same-origin", ...opciones };

    if (config.body && !(config.body instanceof FormData)) {
      config.headers = {
        "Content-Type": "application/json",
        ...(config.headers || {})
      };
      if (typeof config.body !== "string") {
        config.body = JSON.stringify(config.body);
      }
    }

    const res = await fetch(ruta, config);

    let datos = null;
    try {
      datos = await res.json();
    } catch (error) {
      datos = null;
    }

    if (res.status === 401) {
      cache = null;
      limpiarLocal();
    }

    return { ok: res.ok, status: res.status, datos };
  }

  return { usuario, proteger, salir, api };
})();

/* =========================
   COMPATIBILIDAD

   Varias paginas llaman a protegerPagina() sin await. Se deja definida
   globalmente para no tener que reescribir todas de golpe.
========================= */

function protegerPagina(destino = "login.html") {
  return Sesion.proteger(destino);
}

function cerrarSesion() {
  return Sesion.salir();
}

/* Al cargar cualquier pagina se sincroniza el estado de sesion con el
   servidor, para que el resto del codigo lea datos de verdad */
Sesion.usuario();
