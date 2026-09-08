const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const closeModal = document.getElementById("closeModal");


/* =========================
   PROTEGER PÁGINA
========================= */

function usuarioActivo() {
    return localStorage.getItem("usuarioLogueado");
}


function protegerSeguridad() {

    const usuario = usuarioActivo();

    if (!usuario) {

        alert("Debes iniciar sesión");

        window.location.href = "login.html";

        return false;
    }

    return true;
}


/* =========================
   ABRIR MODAL
========================= */

function abrirModal(titulo) {

    modalTitle.innerText = titulo;

    modal.style.display = "flex";

}


function cerrarModal() {

    modal.style.display = "none";

    modalBody.innerHTML = "";

}


/* =========================
   CERRAR MODAL
========================= */

closeModal.addEventListener("click", cerrarModal);


window.addEventListener("click", (e) => {

    if (e.target === modal) {

        cerrarModal();

    }

});


/* =========================
   CAMBIAR CONTRASEÑA
========================= */

function mostrarCambiarPassword() {

    abrirModal("Cambiar contraseña");

    modalBody.innerHTML = `

        <label>Contraseña actual</label>

        <input
            type="password"
            id="currentPassword"
            placeholder="Escribe tu contraseña actual"
        >


        <label>Nueva contraseña</label>

        <input
            type="password"
            id="newPassword"
            placeholder="Mínimo 6 caracteres"
        >


        <label>Confirmar nueva contraseña</label>

        <input
            type="password"
            id="confirmPassword"
            placeholder="Repite la nueva contraseña"
        >


        <button
            class="security-save-btn"
            onclick="cambiarPassword()"
        >
            Guardar nueva contraseña
        </button>


        <p
            class="security-message"
            id="securityMessage"
        ></p>

    `;

}


async function cambiarPassword() {

    const email = usuarioActivo();

    const currentPassword =
        document.getElementById("currentPassword").value;

    const newPassword =
        document.getElementById("newPassword").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

    const message =
        document.getElementById("securityMessage");


    if (!currentPassword || !newPassword || !confirmPassword) {

        message.innerText =
            "Completa todos los campos";

        return;

    }


    if (newPassword.length < 6) {

        message.innerText =
            "La nueva contraseña debe tener mínimo 6 caracteres";

        return;

    }


    if (newPassword !== confirmPassword) {

        message.innerText =
            "Las contraseñas nuevas no coinciden";

        return;

    }


    try {

        const response =
            await fetch("/change-password", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    email,
                    currentPassword,
                    newPassword

                })

            });


        const data =
            await response.json();


        message.innerText =
            data.message;


    } catch (error) {

        console.error(error);

        message.innerText =
            "Error al cambiar la contraseña";

    }

}


/* =========================
   ACTIVIDAD DE INICIO
========================= */

async function mostrarActividad() {

    abrirModal("Actividad de inicio de sesión");

    modalBody.innerHTML = `

        <p>Cargando actividad...</p>

    `;


    const email = usuarioActivo();


    try {

        const response =
            await fetch(

                "/login-activity?email=" +

                encodeURIComponent(email)

            );


        const actividades =
            await response.json();


        if (!actividades.length) {

            modalBody.innerHTML = `

                <p>
                    No hay actividad registrada todavía.
                </p>

            `;

            return;

        }


        modalBody.innerHTML = "";


        actividades
            .slice()
            .reverse()
            .forEach(activity => {

                modalBody.innerHTML += `

                    <div class="activity-item">

                        <strong>
                            Inicio de sesión
                        </strong>

                        <p>
                            Fecha:
                            ${activity.fecha}
                        </p>

                    </div>

                `;

            });


    } catch (error) {

        console.error(error);

        modalBody.innerHTML = `

            <p>
                Error cargando actividad.
            </p>

        `;

    }

}


/* =========================
   BOTONES
========================= */

document.addEventListener("DOMContentLoaded", () => {

    if (!protegerSeguridad()) return;


    document
        .querySelectorAll(".action-btn")
        .forEach(button => {


            button.addEventListener("click", () => {


                const action =
                    button.dataset.action;


                if (action === "password") {

                    mostrarCambiarPassword();

                }


                if (action === "activity") {

                    mostrarActividad();

                }


            });


        });


});

