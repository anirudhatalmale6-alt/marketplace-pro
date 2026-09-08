document.addEventListener("DOMContentLoaded", () => {
  const accountType = document.getElementById("accountType");
  const personalFields = document.getElementById("personalFields");
  const businessFields = document.getElementById("businessFields");
  const country = document.getElementById("country");
  const state = document.getElementById("state");
  const form = document.getElementById("registerForm");

  const estadosPorPais = {
    DO: [
      "Distrito Nacional",
      "Santo Domingo",
      "Santiago",
      "La Vega",
      "San Cristóbal",
      "San Pedro",
      "Puerto Plata"
      
    ],
    US: ["Florida", "New York", "Texas", "California"],
    ES: ["Madrid", "Barcelona", "Sevilla", "Valencia"],
    MX: ["CDMX", "Jalisco", "Monterrey", "Puebla"]
  };

  accountType.addEventListener("change", () => {
    personalFields.style.display = "block";

    if (accountType.value === "business") {
      businessFields.style.display = "block";
    } else {
      businessFields.style.display = "none";
    }
  });

  country.addEventListener("change", () => {
    const pais = country.value;
    state.innerHTML = `<option value="">Selecciona provincia / estado</option>`;

    if (estadosPorPais[pais]) {
      estadosPorPais[pais].forEach((estado) => {
        const option = document.createElement("option");
        option.value = estado;
        option.textContent = estado;
        state.appendChild(option);
      });
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
const telefono = document.getElementById("telefono").value.trim();
const email = document.getElementById("email").value.trim();
const password = document.getElementById("password").value.trim();
const tipo = accountType.value;

// ✅ teléfono real
if (!/^[0-9]{10,15}$/.test(telefono)) {
  alert("Número de teléfono inválido");
  return;
}

// ✅ correo real
if (!email.includes("@") || !email.includes(".")) {
  alert("Correo inválido");
  return;
}

// ✅ password segura
if (password.length < 6) {
  alert("La contraseña debe tener mínimo 6 caracteres");
  return;
}

// ✅ negocio obligatorio
if (tipo === "business") {
  const businessName = document.getElementById("businessName").value.trim();
  const documentNumber = document.getElementById("documentNumber").value.trim();

  if (!businessName) {
    alert("Debes poner el nombre del negocio");
    return;
  }

  if (!documentNumber) {
    alert("Debes poner cédula o RNC");
    return;
  }
}
   const payload = {
  accountType: accountType.value,
  nombre: document.getElementById("nombre").value.trim(),
  apellido: document.getElementById("apellido").value.trim(),
  country: country.value,
  state: state.value,
  city: document.getElementById("city").value.trim(),
  sector: document.getElementById("sector").value.trim(),
  address: document.getElementById("direccion").value.trim(),
  zip: document.getElementById("postalCode").value.trim(),
  reference: document.getElementById("reference").value.trim(),
  telefono: document.getElementById("telefono").value.trim(),
  email: document.getElementById("email").value.trim(),
  password: document.getElementById("password").value.trim(),
  businessName: document.getElementById("businessName").value.trim(),
  documentType: document.getElementById("documentType").value,
  documentNumber: document.getElementById("documentNumber").value.trim()
};

    const res = await fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message);

   if (res.ok) {
  // El servidor ya deja la sesion abierta con su cookie.
  // La direccion es relativa a proposito: antes estaba escrita
  // "http://localhost:3000/index.html", asi que al subir el sitio a un
  // servidor el registro echaba al usuario fuera del dominio.
  window.location.href = "index.html";
}
  });
});