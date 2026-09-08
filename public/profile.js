/* =====================================================
   PROTEGER PÁGINA

   Vive en sesion.js, que se carga antes que este archivo.
   Estaba duplicada en cuatro archivos y cada copia decidia una cosa
   distinta; en dashboard.html no estaba definida en ninguno y por eso
   el panel se quedaba en blanco.
===================================================== */


/* =====================================================
   CARGAR PÁGINA
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    protegerPagina();

    cargarPerfil();

    cargarDatos();

    configurarIframes();

});


/* =====================================================
   CAMBIAR PESTAÑAS
===================================================== */

function showTab(tabName, element) {

    document
        .querySelectorAll(".tab-content")
        .forEach(tab => {

            tab.style.display = "none";

        });


    const tab =
        document.getElementById(tabName);


    if (tab) {

        tab.style.display = "block";

    }


    document
        .querySelectorAll(".tabs button")
        .forEach(button => {

            button.classList.remove("active");

        });


    if (element) {

        element.classList.add("active");

    }

}


/* =====================================================
   ACTIVITY
===================================================== */

function mostrarActivity(id, elemento) {

    document
        .querySelectorAll(".activity-seccion")
        .forEach(seccion => {

            seccion.style.display = "none";

        });


    const seccion =
        document.getElementById(id);


    if (seccion) {

        seccion.style.display = "block";

    }


    document
        .querySelectorAll("#activity .sidebar a")
        .forEach(link => {

            link.classList.remove("active");

        });


    if (elemento) {

        elemento.classList.add("active");

    }

}


/* =====================================================
   MENSAJES
===================================================== */

function mostrarMensaje(id) {

    document
        .querySelectorAll(".mensaje-seccion")
        .forEach(seccion => {

            seccion.style.display = "none";

        });


    const seccion =
        document.getElementById(id);


    if (seccion) {

        seccion.style.display = "block";

    }

}


/* =====================================================
   ACCOUNT - MOSTRAR CONTENIDO
===================================================== */

async function mostrarContenido(id) {

    document
        .querySelectorAll("#account .seccion")
        .forEach(seccion => {

            seccion.style.display = "none";

        });


    const seccion =
        document.getElementById(id);


    if (!seccion) {

        console.error(
            "No existe la sección:",
            id
        );

        return;

    }


    seccion.style.display = "block";


    const iframe =
        seccion.querySelector("iframe");


    if (iframe) {

        if (iframe.contentDocument) {

            ajustarIframe(iframe);

        }

        iframe.addEventListener(
            "load",
            () => {

                ajustarIframe(iframe);

            },
            { once: true }
        );

    }

}


/* =====================================================
   IFRAMES
===================================================== */

function configurarIframes() {

    document
        .querySelectorAll("iframe")
        .forEach(iframe => {

            iframe.setAttribute(
                "scrolling",
                "no"
            );


            iframe.addEventListener(
                "load",
                () => {

                    ajustarIframe(iframe);

                }
            );

        });


    setTimeout(() => {

        ajustarTodosLosIframes();

    }, 500);

}


/* =====================================================
   AJUSTAR UN IFRAME
===================================================== */

function ajustarIframe(iframe) {

    try {

        const documento =
            iframe.contentWindow.document;


        iframe.style.height = "0px";


        const altura =
            Math.max(
                documento.body.scrollHeight,
                documento.documentElement.scrollHeight
            );


        iframe.style.height =
            altura + "px";


    } catch (error) {

        console.warn(
            "No se pudo ajustar el iframe:",
            error
        );

    }

}


/* =====================================================
   AJUSTAR TODOS LOS IFRAMES
===================================================== */

function ajustarTodosLosIframes() {

    document
        .querySelectorAll("iframe")
        .forEach(iframe => {

            try {

                if (iframe.contentDocument) {

                    ajustarIframe(iframe);

                }

            } catch (error) {

                console.warn(error);

            }

        });

}


/* =====================================================
   EDITAR
===================================================== */

function editar(tipo) {

    const vista =
        document.getElementById(
            "vista-" + tipo
        );


    const formulario =
        document.getElementById(
            "form-" + tipo
        );


    if (vista) {

        vista.style.display = "none";

    }


    if (formulario) {

        formulario.style.display = "block";

    }

}


/* =====================================================
   CANCELAR
===================================================== */

function cancelar(tipo) {

    const formulario =
        document.getElementById(
            "form-" + tipo
        );


    const vista =
        document.getElementById(
            "vista-" + tipo
        );


    if (formulario) {

        formulario.style.display = "none";

    }


    if (vista) {

        vista.style.display = "block";

    }

}


/* =====================================================
   GUARDAR DATOS ANTIGUOS
===================================================== */

function guardar(tipo) {

    if (tipo === "registro") {

        const datos = {

            nombre:
                document.getElementById(
                    "reg-nombre"
                ).value,

            email:
                document.getElementById(
                    "reg-email"
                ).value,

            telefono:
                document.getElementById(
                    "reg-telefono"
                ).value,

            direccion:
                document.getElementById(
                    "reg-direccion"
                ).value

        };


        localStorage.setItem(
            "registro",
            JSON.stringify(datos)
        );


        const texto =
            document.getElementById(
                "texto-registro"
            );


        if (texto) {

            texto.innerHTML =
                `<strong>${datos.nombre}</strong><br>
                ${datos.email}<br>
                ${datos.telefono}<br>
                ${datos.direccion}`;

        }

    }


    if (tipo === "envio") {

        const datos = {

            direccion:
                document.getElementById(
                    "env-direccion"
                ).value,

            ciudad:
                document.getElementById(
                    "env-ciudad"
                ).value,

            codigo:
                document.getElementById(
                    "env-codigo"
                ).value

        };


        localStorage.setItem(
            "envio",
            JSON.stringify(datos)
        );


        const texto =
            document.getElementById(
                "texto-envio"
            );


        if (texto) {

            texto.innerHTML =
                `${datos.direccion}<br>
                ${datos.ciudad}<br>
                ${datos.codigo}`;

        }

    }


    cancelar(tipo);

}


/* =====================================================
   CARGAR DATOS ANTIGUOS
===================================================== */

function cargarDatos() {

    const registro =
        JSON.parse(
            localStorage.getItem(
                "registro"
            )
        );


    const textoRegistro =
        document.getElementById(
            "texto-registro"
        );


    if (
        registro &&
        textoRegistro
    ) {

        textoRegistro.innerHTML =
            `<strong>${registro.nombre}</strong><br>
            ${registro.email}<br>
            ${registro.telefono}<br>
            ${registro.direccion}`;

    }


    const envio =
        JSON.parse(
            localStorage.getItem(
                "envio"
            )
        );


    const textoEnvio =
        document.getElementById(
            "texto-envio"
        );


    if (
        envio &&
        textoEnvio
    ) {

        textoEnvio.innerHTML =
            `${envio.direccion}<br>
            ${envio.ciudad}<br>
            ${envio.codigo}`;

    }

}


/* =====================================================
   CARGAR PERFIL
===================================================== */

async function cargarPerfil() {

    const email =
        localStorage.getItem(
            "usuarioLogueado"
        );


    const contenedor =
        document.getElementById(
            "perfilUsuario"
        );


    if (!contenedor) {

        return;

    }


    if (!email) {

        contenedor.innerHTML =
            "<p>No hay usuario logueado</p>";

        return;

    }


    try {

        const res =
            await fetch(
                "/get-user?email=" +
                encodeURIComponent(email)
            );


        if (!res.ok) {

            throw new Error(
                "No se pudo cargar el usuario"
            );

        }


        const user =
            await res.json();


        let html = `

            <form
                id="formPerfil"
                class="profile-card">

                <h2>
                    👤 Información personal
                </h2>

                <div class="profile-grid">


                    <div class="input-group">

                        <label>
                            Nombre
                        </label>

                        <input
                            type="text"
                            id="nombre"
                            value="${user.nombre || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            Apellido
                        </label>

                        <input
                            type="text"
                            id="apellido"
                            value="${user.apellido || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            País
                        </label>

                        <input
                            type="text"
                            id="country"
                            value="${user.country || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            Provincia / Estado
                        </label>

                        <input
                            type="text"
                            id="state"
                            value="${user.state || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            Ciudad
                        </label>

                        <input
                            type="text"
                            id="city"
                            value="${user.city || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            Sector / barrio
                        </label>

                        <input
                            type="text"
                            id="sector"
                            value="${user.sector || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            Dirección
                        </label>

                        <input
                            type="text"
                            id="address"
                            value="${user.address || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            Código postal
                        </label>

                        <input
                            type="text"
                            id="zip"
                            value="${user.zip || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            Referencia
                        </label>

                        <input
                            type="text"
                            id="reference"
                            value="${user.reference || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            Teléfono
                        </label>

                        <input
                            type="text"
                            id="phone"
                            value="${user.telefono || ""}">

                    </div>


                    <div class="input-group">

                        <label>
                            Email
                        </label>

                        <input
                            type="email"
                            value="${user.email || ""}"
                            readonly>

                    </div>

                </div>
        `;


        /* =========================
           NEGOCIO
        ========================= */

        if (
            user.accountType ===
            "business"
        ) {

            html += `

                <h2
                    style="margin-top:30px;">

                    🏪 Información del negocio

                </h2>

                <div class="profile-grid">


                    <div class="input-group">

                        <label>
                            Nombre del negocio
                        </label>

                        <input
                            type="text"
                            value="${user.businessName || ""}"
                            readonly>

                    </div>


                    <div class="input-group">

                        <label>
                            Tipo de documento
                        </label>

                        <input
                            type="text"
                            value="${user.documentType || ""}"
                            readonly>

                    </div>


                    <div class="input-group">

                        <label>
                            Número de documento
                        </label>

                        <input
                            type="text"
                            value="${user.documentNumber || ""}"
                            readonly>

                    </div>

                </div>

            `;

        }


        html += `

                <button
                    type="button"
                    class="save-btn"
                    onclick="guardarPerfil()">

                    Guardar cambios

                </button>

            </form>

        `;


        contenedor.innerHTML =
            html;


    } catch (error) {

        console.error(
            "Error cargando perfil:",
            error
        );


        contenedor.innerHTML =
            "<p>Error cargando perfil</p>";

    }

}


/* =====================================================
   GUARDAR PERFIL
===================================================== */

async function guardarPerfil() {

    const usuario =
        localStorage.getItem(
            "usuarioLogueado"
        );


    if (!usuario) {

        alert(
            "Debes iniciar sesión"
        );

        return;

    }


    const datos = {

        email: usuario,

        nombre:
            document.getElementById(
                "nombre"
            ).value,

        apellido:
            document.getElementById(
                "apellido"
            ).value,

        country:
            document.getElementById(
                "country"
            ).value,

        state:
            document.getElementById(
                "state"
            ).value,

        city:
            document.getElementById(
                "city"
            ).value,

        sector:
            document.getElementById(
                "sector"
            ).value,

        address:
            document.getElementById(
                "address"
            ).value,

        zip:
            document.getElementById(
                "zip"
            ).value,

        reference:
            document.getElementById(
                "reference"
            ).value,

        telefono:
            document.getElementById(
                "phone"
            ).value

    };


    try {

        const res =
            await fetch(
                "/update-profile",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(datos)

                }
            );


        const data =
            await res.json();


        alert(
            data.message
        );


    } catch (error) {

        console.error(
            "Error guardando perfil:",
            error
        );


        alert(
            "Error guardando perfil"
        );

    }

}


/* =====================================================
   CARGAR DIRECCIONES
===================================================== */

async function cargarDirecciones() {

    const email =
        localStorage.getItem(
            "usuarioLogueado"
        );


    const contenedor =
        document.getElementById(
            "listaDirecciones"
        );


    if (!contenedor) {

        return;

    }


    try {

        const res =
            await fetch(
                "/get-user?email=" +
                encodeURIComponent(email)
            );


        const user =
            await res.json();


        contenedor.innerHTML = `

            <div class="address-card">

                <h3>
                    📍 Dirección principal
                </h3>

                <p>
                    <strong>
                        ${user.nombre || ""}
                        ${user.apellido || ""}
                    </strong>
                </p>

                <p>
                    ${user.address || ""}
                </p>

                <p>
                    ${user.sector || ""},
                    ${user.city || ""}
                </p>

                <p>
                    ${user.state || ""},
                    ${user.country || ""}
                </p>

                <p>
                    ZIP: ${user.zip || ""}
                </p>

                <p>
                    📌 ${user.reference || ""}
                </p>

                <p>
                    📱 ${user.telefono || ""}
                </p>

            </div>

        `;


    } catch (error) {

        console.error(
            "Error cargando dirección:",
            error
        );


        contenedor.innerHTML =
            "<p>Error cargando dirección</p>";

    }

}


/* =====================================================
   PERSONAL INFORMATION
===================================================== */

function openPersonalInfo() {

    const section =
        document.getElementById(
            "personalInfoSection"
        );


    if (!section) {

        return;

    }


    section.style.display =
        "block";


    loadPersonalInfo();

}


async function loadPersonalInfo() {

    const usuario =
        localStorage.getItem(
            "usuarioLogueado"
        );


    if (!usuario) {

        return;

    }


    try {

        const response =
            await fetch(
                "/get-user?email=" +
                encodeURIComponent(usuario)
            );


        if (!response.ok) {

            throw new Error(
                "No se pudo cargar el usuario"
            );

        }


        const user =
            await response.json();


        document.getElementById(
            "personalFullName"
        ).value =
            `${user.nombre || ""}
            ${user.apellido || ""}`.trim();


        document.getElementById(
            "personalAddress"
        ).value =
            user.address || "";


        document.getElementById(
            "personalCity"
        ).value =
            user.city || "";


        document.getElementById(
            "personalCountry"
        ).value =
            user.country || "";


        document.getElementById(
            "personalPhone"
        ).value =
            user.telefono || "";


    } catch (error) {

        console.error(
            "Error cargando Personal Information:",
            error
        );


        const mensaje =
            document.getElementById(
                "personalMessage"
            );


        if (mensaje) {

            mensaje.textContent =
                "Error cargando información";

        }

    }

}


/* =====================================================
   GUARDAR PERSONAL INFO
===================================================== */

async function savePersonalInfo() {

    const usuario =
        localStorage.getItem(
            "usuarioLogueado"
        );


    if (!usuario) {

        alert(
            "Debes iniciar sesión"
        );

        return;

    }


    const nombreCompleto =
        document.getElementById(
            "personalFullName"
        ).value.trim();


    if (!nombreCompleto) {

        alert(
            "Escribe tu nombre completo"
        );

        return;

    }


    const partes =
        nombreCompleto.split(/\s+/);


    const nombre =
        partes.shift() || "";


    const apellido =
        partes.join(" ");


    const datos = {

        email: usuario,

        nombre: nombre,

        apellido: apellido,

        address:
            document.getElementById(
                "personalAddress"
            ).value.trim(),

        city:
            document.getElementById(
                "personalCity"
            ).value.trim(),

        country:
            document.getElementById(
                "personalCountry"
            ).value.trim(),

        telefono:
            document.getElementById(
                "personalPhone"
            ).value.trim()

    };


    try {

        const response =
            await fetch(
                "/update-profile",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(datos)

                }
            );


        const result =
            await response.json();


        const mensaje =
            document.getElementById(
                "personalMessage"
            );


        if (mensaje) {

            mensaje.textContent =
                result.message;

        }


        if (!response.ok) {

            return;

        }


        bloquearPersonal();


    } catch (error) {

        console.error(
            "Error guardando:",
            error
        );


        const mensaje =
            document.getElementById(
                "personalMessage"
            );


        if (mensaje) {

            mensaje.textContent =
                "Error guardando información";

        }

    }

}


/* =====================================================
   BLOQUEAR PERSONAL INFO
===================================================== */

function bloquearPersonal() {

    document
        .querySelectorAll(
            "#personalInfoSection input"
        )
        .forEach(input => {

            input.disabled = true;

        });

}


/* =====================================================
   CERRAR CUENTA
===================================================== */

async function cerrarCuenta() {

    const email =
        localStorage.getItem(
            "usuarioLogueado"
        );


    const passwordInput =
        document.getElementById(
            "passwordCerrarCuenta"
        );


    const mensaje =
        document.getElementById(
            "mensajeCerrarCuenta"
        );


    const password =
        passwordInput
            ? passwordInput.value
            : "";


    if (!email) {

        if (mensaje) {

            mensaje.textContent =
                "No hay una sesión activa.";

        }

        return;

    }


    if (!password) {

        if (mensaje) {

            mensaje.textContent =
                "Introduce tu contraseña.";

        }

        return;

    }


    const confirmar =
        confirm(
            "¿Estás seguro de que quieres cerrar tu cuenta?\n\n" +
            "Esta acción es permanente y eliminará tu cuenta."
        );


    if (!confirmar) {

        return;

    }


    try {

        if (mensaje) {

            mensaje.textContent =
                "Cerrando cuenta...";

        }


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
                            email: email,
                            password: password
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            if (mensaje) {

                mensaje.textContent =
                    result.message ||
                    "No se pudo cerrar la cuenta.";

            }

            return;

        }


        if (mensaje) {

            mensaje.textContent =
                "Cuenta cerrada correctamente.";

        }


        localStorage.removeItem(
            "usuarioLogueado"
        );

        localStorage.removeItem(
            "registro"
        );

        localStorage.removeItem(
            "envio"
        );

        localStorage.removeItem(
            "email"
        );


        setTimeout(() => {

            window.location.href =
                "login.html";

        }, 1500);


    } catch (error) {

        console.error(
            "Error cerrando cuenta:",
            error
        );


        if (mensaje) {

            mensaje.textContent =
                "No se pudo conectar con el servidor.";

        }

    }

}


/* =====================================================
   MOSTRAR SECCIÓN ANTIGUA
===================================================== */

function mostrarSeccion(seccion) {

    document
        .querySelectorAll(".seccion")
        .forEach(sec => {

            sec.style.display = "none";

        });


    const elemento =
        document.getElementById(
            "seccion-" + seccion
        );


    if (elemento) {

        elemento.style.display =
            "block";

    }


    if (seccion === "direcciones") {

        cargarDirecciones();

    }


    if (seccion === "productos") {

        if (typeof verProductos === "function") {

            verProductos();

        }

    }


    if (seccion === "ventas") {

        if (typeof verVentas === "function") {

            verVentas();

        }

    }


    if (seccion === "perfil") {

        if (typeof verPerfil === "function") {

            verPerfil();

        }

    }

}


/* =====================================================
   ACTUALIZAR IFRAMES AL CAMBIAR TAMAÑO
===================================================== */

window.addEventListener(
    "resize",
    () => {

        ajustarTodosLosIframes();

    }
);


/* =====================================================
   ACTUALIZAR IFRAMES DESPUÉS DE CARGAR
===================================================== */

window.addEventListener(
    "load",
    () => {

        setTimeout(() => {

            ajustarTodosLosIframes();

        }, 500);

    }
);