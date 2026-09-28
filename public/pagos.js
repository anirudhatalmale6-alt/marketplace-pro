/* =========================
   PAYPAL
========================= */

function conectarPayPal() {

  alert(
    "Serás dirigido a PayPal para conectar tu cuenta."
  );

  /*
    AQUÍ CONECTAREMOS EL PROVEEDOR
    DE PAYPAL CUANDO HAGAMOS LA
    INTEGRACIÓN REAL.
  */

}


/* =========================
   TARJETA
========================= */

function abrirTarjeta() {

  document.getElementById("formTarjeta").style.display = "block";

}


function cerrarTarjeta() {

  document.getElementById("formTarjeta").style.display = "none";

}


/* =========================
   PREFERENCIAS DE PAGO DEL VENDEDOR

   /get-pagos y /update-pagos existian en el servidor desde la Fase 1
   pero ninguna pantalla los usaba. Son los metodos que el vendedor
   dice aceptar, y es lo que ve el comprador en el producto.
========================= */

async function cargarPreferenciasPago() {
  const { ok, datos } = await Sesion.api("/get-pagos");

  if (!ok || !datos) return;

  const p = datos.preferencias || {};

  const marcar = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(valor);
  };

  marcar("aceptaTransferencia", p.transferencia);
  marcar("aceptaEfectivo", p.paypal); /* se reutiliza el campo existente */
  marcar("aceptaTarjeta", p.tarjeta);
}

async function guardarPreferenciasPago() {
  const leer = id => {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };

  const boton = document.getElementById("btnGuardarPreferencias");
  if (boton) boton.disabled = true;

  const { ok, datos } = await Sesion.api("/update-pagos", {
    method: "PUT",
    body: {
      transferencia: leer("aceptaTransferencia"),
      paypal: leer("aceptaEfectivo"),
      tarjeta: false /* la tarjeta no se puede activar todavia */
    }
  });

  if (boton) boton.disabled = false;

  const caja = document.getElementById("mensajePreferencias");

  if (caja) {
    caja.textContent = ok
      ? "Guardado."
      : (datos && datos.message) || "No se pudo guardar.";
    caja.className = "mensaje " + (ok ? "mensaje-exito" : "mensaje-error");
    caja.style.display = "block";
    setTimeout(() => { caja.style.display = "none"; }, 4000);
  }
}

/* Se desactivan los campos de la tarjeta al cargar la pagina.

   El formulario pedia numero completo y CVV y despues NO guardaba
   nada (el comentario original lo decia). El problema es que el
   usuario no lo sabe: escribe los datos reales de su tarjeta en un
   formulario que no va a ninguna parte. Mientras no haya pasarela de
   pago, lo correcto es que no se pueda escribir nada. */
function desactivarFormularioTarjeta() {
  const form = document.getElementById("formTarjeta");

  if (!form) return;

  form.querySelectorAll("input, select, button").forEach(el => {
    el.disabled = true;
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const usuario = await Sesion.proteger("login.html?volver=pagos.html");

  if (!usuario) return;

  desactivarFormularioTarjeta();
  cargarPreferenciasPago();
});

function guardarTarjeta() {
  alert(
    "Los pagos con tarjeta todavia no estan activos. " +
    "Usa transferencia bancaria por ahora."
  );
  return;
}

function guardarTarjetaDesactivada() {

  const tipo =
    document.getElementById("tipoTarjeta").value;

  const numero =
    document.getElementById("numeroTarjeta").value.trim();

  const fecha =
    document.getElementById("fechaTarjeta").value.trim();

  const cvv =
    document.getElementById("cvvTarjeta").value.trim();


  if (!tipo || !numero || !fecha || !cvv) {

    alert(
      "Completa todos los campos de la tarjeta."
    );

    return;

  }


  /*
    IMPORTANTE:

    NO vamos a guardar el número completo
    de la tarjeta ni el CVV en users.json.

    Cuando conectemos el proveedor de pago,
    él manejará estos datos de forma segura.
  */


  alert(
    "La tarjeta está lista para conectarse con el proveedor de pago."
  );

}


/* =========================
   TRANSFERENCIA
========================= */

function abrirTransferencia() {

  document.getElementById(
    "formTransferencia"
  ).style.display = "block";

  cargarTransferencia();

}


function cerrarTransferencia() {

  document.getElementById(
    "formTransferencia"
  ).style.display = "none";

}


/* =========================
   CARGAR CUENTA BANCARIA
========================= */

async function cargarTransferencia() {

  const email =
    localStorage.getItem("email");

  if (!email) {
    return;
  }


  try {

    const respuesta = await fetch(
      `/get-transferencia?email=${encodeURIComponent(email)}`
    );


    const data =
      await respuesta.json();


    if (
      !respuesta.ok ||
      !data.transferencia
    ) {

      return;

    }


    const cuenta =
      data.transferencia;


    document.getElementById("banco").value =
      cuenta.banco || "";


    document.getElementById("tipoCuenta").value =
      cuenta.tipoCuenta || "";


    document.getElementById("numeroCuenta").value =
      cuenta.numeroCuenta || "";


    document.getElementById("titularCuenta").value =
      cuenta.titular || "";


    document.getElementById("identificacionCuenta").value =
      cuenta.identificacion || "";


  } catch (error) {

    console.error(
      "Error cargando cuenta bancaria:",
      error
    );

  }

}


/* =========================
   GUARDAR CUENTA BANCARIA
========================= */

async function guardarTransferencia() {

  const email =
    localStorage.getItem("email");


  if (!email) {

    alert(
      "Debes iniciar sesión para configurar una cuenta bancaria."
    );

    return;

  }


  const banco =
    document.getElementById("banco").value;


  const tipoCuenta =
    document.getElementById("tipoCuenta").value;


  const numeroCuenta =
    document.getElementById(
      "numeroCuenta"
    ).value.trim();


  const titular =
    document.getElementById(
      "titularCuenta"
    ).value.trim();


  const identificacion =
    document.getElementById(
      "identificacionCuenta"
    ).value.trim();


  if (
    !banco ||
    !tipoCuenta ||
    !numeroCuenta ||
    !titular
  ) {

    alert(
      "Completa todos los campos obligatorios."
    );

    return;

  }


  try {

    const respuesta = await fetch(
      "/guardar-transferencia",
      {

        method: "PUT",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          email: email,

          banco: banco,

          tipoCuenta: tipoCuenta,

          numeroCuenta: numeroCuenta,

          titular: titular,

          identificacion: identificacion

        })

      }
    );


    const data =
      await respuesta.json();


    if (!respuesta.ok) {

      alert(
        data.message ||
        "No se pudo guardar la cuenta bancaria."
      );

      return;

    }


    alert(
      "✅ Cuenta bancaria guardada correctamente."
    );


    cerrarTransferencia();


  } catch (error) {

    console.error(
      "Error guardando transferencia:",
      error
    );


    alert(
      "No se pudo conectar con el servidor."
    );

  }

}


/* =========================
   FORMATO TARJETA
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const numero =
      document.getElementById(
        "numeroTarjeta"
      );


    if (numero) {

      numero.addEventListener(
        "input",
        function () {

          let valor =
            this.value
              .replace(/\D/g, "")
              .substring(0, 16);


          valor =
            valor.replace(
              /(\d{4})(?=\d)/g,
              "$1 "
            );


          this.value = valor;

        }
      );

    }


    const fecha =
      document.getElementById(
        "fechaTarjeta"
      );


    if (fecha) {

      fecha.addEventListener(
        "input",
        function () {

          let valor =
            this.value
              .replace(/\D/g, "")
              .substring(0, 4);


          if (valor.length >= 3) {

            valor =
              valor.substring(0, 2)
              + "/"
              + valor.substring(2);

          }


          this.value = valor;

        }
      );

    }


    const cvv =
      document.getElementById(
        "cvvTarjeta"
      );


    if (cvv) {

      cvv.addEventListener(
        "input",
        function () {

          this.value =
            this.value
              .replace(/\D/g, "")
              .substring(0, 4);

        }
      );

    }

  }
);