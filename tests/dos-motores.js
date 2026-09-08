/* =========================
   LA MISMA PRUEBA CONTRA LOS DOS MOTORES

   Se ejecuta con:  npm run test-motores

   Que hace, sin que tengas que instalar MongoDB:

     1) Arranca el servidor con archivos JSON y pasa las 87 pruebas
     2) Levanta un MongoDB temporal en memoria
     3) Importa los datos de data/ con el mismo script de migracion
     4) Arranca el servidor contra ese MongoDB y pasa LAS MISMAS pruebas
     5) Compara los dos resultados

   Por que importa: si los dos motores no se comportan igual, una
   prueba que pasa en tu ordenador con archivos puede fallar en el
   servidor con MongoDB. Esta prueba es la unica forma de asegurarlo.

   No toca tus datos: el MongoDB temporal se borra al terminar, y las
   cuentas de prueba se limpian con "npm run limpiar-pruebas".
========================= */

const { spawn } = require("child_process");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

const PUERTO_JSON = 3891;
const PUERTO_MONGO = 3892;

function esperar(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* Arranca un proceso y espera a que diga que esta listo */
function arrancarServidor(env, puerto, etiqueta) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["server.js"], {
      cwd: RAIZ,
      env: { ...process.env, ...env, PORT: String(puerto) }
    });

    let salida = "";
    let resuelto = false;

    const mirar = data => {
      salida += data.toString();

      if (!resuelto && salida.includes("Servidor corriendo")) {
        resuelto = true;
        resolve(proc);
      }
    };

    proc.stdout.on("data", mirar);
    proc.stderr.on("data", mirar);

    proc.on("exit", code => {
      if (!resuelto) {
        resuelto = true;
        reject(
          new Error(`El servidor (${etiqueta}) murio con codigo ${code}:\n${salida}`)
        );
      }
    });

    setTimeout(() => {
      if (!resuelto) {
        resuelto = true;
        proc.kill();
        reject(new Error(`El servidor (${etiqueta}) no arranco:\n${salida}`));
      }
    }, 30000);
  });
}

/* Lanza tests/api.js contra un puerto y devuelve correctas/fallidas */
function correrPruebas(puerto, env = {}) {
  return new Promise(resolve => {
    const proc = spawn("node", ["tests/api.js"], {
      cwd: RAIZ,
      env: { ...process.env, ...env, PORT: String(puerto) }
    });

    let salida = "";

    proc.stdout.on("data", d => {
      salida += d.toString();
    });
    proc.stderr.on("data", d => {
      salida += d.toString();
    });

    proc.on("exit", () => {
      const m = salida.match(/(\d+) correctas, (\d+) fallidas/);

      resolve({
        correctas: m ? Number(m[1]) : 0,
        fallidas: m ? Number(m[2]) : -1,
        fallos: salida
          .split("\n")
          .filter(l => l.includes("FALLA"))
          .map(l => l.trim()),
        salida
      });
    });
  });
}

function correrScript(script, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [script], {
      cwd: RAIZ,
      env: { ...process.env, ...env }
    });

    let salida = "";
    proc.stdout.on("data", d => {
      salida += d.toString();
    });
    proc.stderr.on("data", d => {
      salida += d.toString();
    });

    proc.on("exit", code => {
      if (code === 0) resolve(salida);
      else reject(new Error(`${script} fallo:\n${salida}`));
    });
  });
}

(async () => {
  let servidor = null;
  let mongo = null;

  const limites = {
    LOGIN_MAX_INTENTOS: "500",
    API_MAX_PETICIONES: "9000"
  };

  try {
    /* ========== 1. ARCHIVOS JSON ========== */

    console.log("\n########## MOTOR 1: ARCHIVOS JSON ##########\n");

    servidor = await arrancarServidor(
      { ...limites, MONGODB_URI: "" },
      PUERTO_JSON,
      "json"
    );

    const resJson = await correrPruebas(PUERTO_JSON, limites);

    console.log(`  ${resJson.correctas} correctas, ${resJson.fallidas} fallidas`);
    resJson.fallos.forEach(f => console.log(`    ${f}`));

    servidor.kill();
    await esperar(1000);
    await correrScript("scripts/limpiar-pruebas.js");

    /* ========== 2. MONGODB ========== */

    console.log("\n########## MOTOR 2: MONGODB ##########\n");

    const { MongoMemoryServer } = require("mongodb-memory-server");

    console.log("  levantando MongoDB temporal...");
    mongo = await MongoMemoryServer.create();

    const uri = `${mongo.getUri()}marketplace_prueba`;
    const envMongo = { ...limites, MONGODB_URI: uri };

    console.log("  importando los datos de data/ ...");
    const salidaMigracion = await correrScript(
      "scripts/migrar-mongo.js",
      envMongo
    );

    salidaMigracion
      .split("\n")
      .filter(l => l.includes("OK ") || l.includes("MAL "))
      .forEach(l => console.log(`  ${l.trim()}`));

    servidor = await arrancarServidor(envMongo, PUERTO_MONGO, "mongodb");

    const resMongo = await correrPruebas(PUERTO_MONGO, limites);

    console.log(
      `\n  ${resMongo.correctas} correctas, ${resMongo.fallidas} fallidas`
    );
    resMongo.fallos.forEach(f => console.log(`    ${f}`));

    servidor.kill();
    await esperar(1000);

    /* ========== 3. COMPARAR ========== */

    console.log("\n########## COMPARACION ##########\n");

    console.log(
      `  archivos JSON : ${resJson.correctas} correctas / ${resJson.fallidas} fallidas`
    );
    console.log(
      `  MongoDB       : ${resMongo.correctas} correctas / ${resMongo.fallidas} fallidas`
    );

    const iguales =
      resJson.correctas === resMongo.correctas &&
      resJson.fallidas === resMongo.fallidas &&
      resJson.fallidas === 0;

    if (iguales) {
      console.log(
        "\n  LOS DOS MOTORES SE COMPORTAN IGUAL Y NO FALLA NADA.\n"
      );
    } else {
      console.log("\n  LOS RESULTADOS NO COINCIDEN. Revisa arriba.\n");
    }

    await mongo.stop();

    process.exit(iguales ? 0 : 1);
  } catch (error) {
    console.error("\nERROR:", error.message);
    if (servidor) servidor.kill();
    if (mongo) await mongo.stop().catch(() => {});
    process.exit(1);
  }
})();
