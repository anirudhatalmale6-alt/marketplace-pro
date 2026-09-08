document.addEventListener("DOMContentLoaded", () => {

const notificaciones =
    document.getElementById("notificaciones");

const correoNotificaciones =
    document.getElementById("correoNotificaciones");

const apariencia =
    document.getElementById("apariencia");

const idioma =
    document.getElementById("idioma");

const btnPrivacidad =
    document.getElementById("btnPrivacidad");

const btnCerrarCuenta =
    document.getElementById("btnCerrarCuenta");


/* =====================================================
   OBTENER EMAIL DEL USUARIO
===================================================== */

function obtenerEmailUsuario() {

    /* Sistema nuevo */

    const usuario =
        localStorage.getItem("user");

    if (usuario) {

        try {

            const user =
                JSON.parse(usuario);

            if (user.email) {
                return user.email.toLowerCase();
            }

        } catch (error) {

            console.error(
                "Error leyendo usuario:",
                error
            );

        }

    }


    /* Sistema que ya estabas utilizando */

    const usuarioLogueado =
        localStorage.getItem("usuarioLogueado");

    if (usuarioLogueado) {

        return usuarioLogueado.toLowerCase();

    }


    return null;
}


const email =
    obtenerEmailUsuario();


/* =====================================================
   VERIFICAR SESIÓN
===================================================== */

if (!email) {

    alert(
        "No hay una sesión iniciada."
    );

    window.location.href =
        "../login.html";

    return;
}


console.log(
    "👤 Usuario configuración:",
    email
);


/* =====================================================
   CARGAR CONFIGURACIÓN DESDE EL SERVIDOR
===================================================== */

async function cargarConfiguracion() {

    try {

        const response =
            await fetch(
                `/get-configuracion?email=${encodeURIComponent(email)}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "No se pudo cargar la configuración"
            );

        }


        const config =
            data.configuracion;


        /* NOTIFICACIONES */

        notificaciones.checked =
            config.notificaciones;


        /* CORREO */

        correoNotificaciones.checked =
            config.correoNotificaciones;


        /* APARIENCIA */

        apariencia.value =
            config.apariencia;


        /* IDIOMA */

        idioma.value =
            config.idioma;


        /* APLICAR APARIENCIA */

        aplicarApariencia(
            config.apariencia
        );


        console.log(
            "✅ Configuración cargada"
        );


    } catch (error) {

        console.error(
            "❌ Error cargando configuración:",
            error
        );

    }

}


/* =====================================================
   GUARDAR CONFIGURACIÓN EN EL SERVIDOR
===================================================== */

async function guardarConfiguracion() {

    try {

        const configuracion = {

            email: email,

            notificaciones:
                notificaciones.checked,

            correoNotificaciones:
                correoNotificaciones.checked,

            apariencia:
                apariencia.value,

            idioma:
                idioma.value

        };


        const response =
            await fetch(
                "/update-configuracion",
                {

                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            configuracion
                        )

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "No se pudo guardar la configuración"
            );

        }


        console.log(
            "✅ Configuración guardada"
        );


    } catch (error) {

        console.error(
            "❌ Error guardando configuración:",
            error
        );

        alert(
            "No se pudo guardar la configuración."
        );

    }

}


/* =====================================================
   NOTIFICACIONES
===================================================== */

notificaciones.addEventListener(
    "change",
    async () => {

        await guardarConfiguracion();

    }
);


/* =====================================================
   NOTIFICACIONES POR CORREO
===================================================== */

correoNotificaciones.addEventListener(
    "change",
    async () => {

        await guardarConfiguracion();

    }
);


/* =====================================================
   APARIENCIA
===================================================== */

apariencia.addEventListener(
    "change",
    async () => {

        aplicarApariencia(
            apariencia.value
        );

        await guardarConfiguracion();

    }
);


/* =====================================================
   IDIOMA
===================================================== */

idioma.addEventListener(
    "change",
    async () => {

        await guardarConfiguracion();

        aplicarIdioma(
            idioma.value
        );

    }
);


/* =====================================================
   APLICAR APARIENCIA
===================================================== */

function aplicarApariencia(modo) {

    if (modo === "oscuro") {

        document.body.classList.add(
            "modo-oscuro"
        );

    } else {

        document.body.classList.remove(
            "modo-oscuro"
        );

    }

}


/* =====================================================
   IDIOMA
===================================================== */

function aplicarIdioma(idiomaSeleccionado) {

    if (idiomaSeleccionado === "en") {

        console.log(
            "🌎 English seleccionado"
        );

        /*
         Aquí después traduciremos
         toda la interfaz.
        */

    } else {

        console.log(
            "🇩🇴 Español seleccionado"
        );

    }

}


/* =====================================================
   PRIVACIDAD
===================================================== */

btnPrivacidad.addEventListener(
    "click",
    () => {

        alert(
            "Aquí configuraremos las opciones de privacidad de tu cuenta."
        );

    }
);


/* =====================================================
   CERRAR CUENTA
===================================================== */

btnCerrarCuenta.addEventListener(
    "click",
    async () => {

        const confirmar =
            confirm(
                "⚠️ ATENCIÓN\n\n" +
                "¿Estás seguro de que quieres cerrar tu cuenta?\n\n" +
                "Tu cuenta, anuncios y datos relacionados serán eliminados.\n\n" +
                "Esta acción no se puede deshacer."
            );


        if (!confirmar) {
            return;
        }


        const password =
            prompt(
                "Introduce tu contraseña para confirmar el cierre de tu cuenta:"
            );


        if (!password) {
            return;
        }


        try {

            const response =
                await fetch(
                    "/close-account",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                email:
                                    email,

                                password:
                                    password

                            })

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                alert(
                    data.message ||
                    "No se pudo cerrar la cuenta."
                );

                return;

            }


            alert(
                "✅ Tu cuenta ha sido cerrada correctamente."
            );


            /* ELIMINAR SESIÓN */

            localStorage.removeItem(
                "user"
            );

            localStorage.removeItem(
                "usuarioLogueado"
            );


            /* VOLVER AL LOGIN */

            window.location.href =
                "../login.html";


        } catch (error) {

            console.error(
                "❌ Error cerrando cuenta:",
                error
            );

            alert(
                "No se pudo conectar con el servidor."
            );

        }

    }
);


/* =====================================================
   INICIAR CONFIGURACIÓN
===================================================== */

cargarConfiguracion();

});