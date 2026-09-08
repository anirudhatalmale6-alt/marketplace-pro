/* =========================
   CAPA DE ACCESO A DATOS

   Todo el proyecto pide y guarda datos SOLO a traves de este archivo.
   Ninguna ruta abre un archivo ni habla con MongoDB directamente.

   Hay dos motores detras, con exactamente los mismos metodos:

     lib/store-mongo.js   se usa si hay MONGODB_URI en el .env
     lib/store-json.js    se usa si no la hay (archivos en data/)

   La eleccion se hace aqui, una sola vez, al arrancar. Las rutas no
   se enteran de cual esta activo.

   Por que se mantienen los dos: MongoDB es lo que va en el servidor,
   pero poder arrancar sin instalar nada sigue siendo comodo para
   probar. Y sobre todo, las mismas pruebas se pasan contra los dos
   motores, que es la unica forma de asegurar que se comportan igual.
========================= */

const usarMongo = Boolean(process.env.MONGODB_URI);

const motor = usarMongo
  ? require("./store-mongo")
  : require("./store-json");

module.exports = motor;
