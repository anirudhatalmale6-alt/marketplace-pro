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


function guardarTarjeta() {

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