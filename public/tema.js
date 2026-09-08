(function () {

  function obtenerEmailUsuario() {

    const usuarioLogueado = localStorage.getItem("usuarioLogueado");

    if (usuarioLogueado) {
      return usuarioLogueado.toLowerCase();
    }

    const usuarioData = localStorage.getItem("usuarioData");

    if (usuarioData) {
      try {
        const usuario = JSON.parse(usuarioData);

        if (usuario.email) {
          return usuario.email.toLowerCase();
        }

      } catch (error) {
        console.error("Error leyendo usuarioData:", error);
      }
    }

    return null;
  }


  function aplicarTema(apariencia) {

    document.documentElement.setAttribute(
      "data-tema",
      apariencia
    );

  }


  async function cargarTema() {

    const email = obtenerEmailUsuario();

    console.log("👤 Email para tema:", email);

    if (!email) {
      console.log("⚠️ No se encontró usuario para cargar tema.");
      return;
    }

    try {

      const response = await fetch(
        `/get-configuracion?email=${encodeURIComponent(email)}`
      );

      if (!response.ok) {
        console.error("❌ Error obteniendo configuración.");
        return;
      }

      const data = await response.json();

      const apariencia =
        data.configuracion?.apariencia || "claro";

      console.log("🎨 Apariencia:", apariencia);

      aplicarTema(apariencia);

    } catch (error) {

      console.error(
        "❌ Error cargando tema:",
        error
      );

    }

  }


  window.aplicarTemaGlobal = aplicarTema;

  cargarTema();

})();