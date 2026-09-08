document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  if (!form) return;

  const boton = form.querySelector("button[type=submit], button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      alert("Escribe tu correo y tu contrasena");
      return;
    }

    if (boton) boton.disabled = true;

    try {
      const response = await fetch("/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (!response.ok) {
        alert((data && data.message) || "Error al iniciar sesion");
        return;
      }

      // La sesion de verdad es la cookie que acaba de poner el servidor.
      // Lo que se guarda en localStorage es solo una copia para las
      // pantallas que todavia leen de ahi, y lo escribe sesion.js a
      // partir de la respuesta del servidor.
      await Sesion.usuario({ recargar: true });

      // Direccion relativa: antes ponia "http://localhost:3000/index.html",
      // asi que en cuanto el sitio se subiera a un servidor el login
      // mandaba al usuario a una direccion que no existe.
      const destino =
        new URLSearchParams(window.location.search).get("volver") ||
        "index.html";

      // Solo se admiten destinos del propio sitio
      window.location.href = /^[a-zA-Z0-9._-]+\.html$/.test(destino)
        ? destino
        : "index.html";

    } catch (error) {
      console.error("Error de conexion en el login:", error);
      alert("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      if (boton) boton.disabled = false;
    }
  });
});
