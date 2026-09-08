# Marketplace

Sitio tipo marketplace: cuentas de usuario, publicacion de productos,
busqueda con filtros, carrito, pedidos y valoraciones.

Node.js + Express 5. Los datos se guardan por ahora en archivos JSON
dentro de `data/`.

---

## Poner en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de configuracion
cp .env.example .env

# 3. Generar una clave de sesion y pegarla en JWT_SECRET dentro de .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Ordenar los datos que ya existen (SOLO la primera vez)
npm run migrar

# 5. Arrancar
npm start
```

El sitio queda en http://localhost:3000 (o el puerto que pongas en
`PORT`).

Si `JWT_SECRET` falta o sigue siendo el valor de ejemplo, el servidor
**no arranca** y te dice por que. Es a proposito: sin esa clave las
sesiones se podrian falsificar.

---

## Subirlo a un servidor

1. Sube todo **menos** `node_modules/` y `.env`.
2. En el servidor: `npm install --omit=dev`
3. Crea el `.env` alli, con:
   - `JWT_SECRET` distinto del de tu ordenador
   - `NODE_ENV=production`
   - `TRUST_PROXY=true` si va detras de Nginx, Apache, Render, Railway
     o Cloudflare
4. `npm run migrar` (una sola vez, si llevas los datos)
5. Arrancalo con PM2 o similar: `pm2 start server.js --name marketplace`

Con `NODE_ENV=production` la cookie de sesion solo viaja por HTTPS.
**Necesitas certificado SSL en el dominio**, si no nadie podra iniciar
sesion.

Las carpetas `data/`, `uploads/` y `backups/` guardan informacion real:
inclúyelas en tus copias de seguridad y no las subas a git (ya estan en
`.gitignore`).

---

## Estructura

```
server.js              Monta la aplicacion y arranca. Nada mas.
.env.example           Todas las variables de configuracion, comentadas.

lib/
  paths.js             Rutas absolutas del proyecto.
  store.js             UNICO punto de acceso a los datos.
  auth.js              Sesiones (JWT en cookie), permisos y que datos
                       se pueden devolver al navegador.

routes/
  auth.js              registro, login, logout, /me, contrasena, cerrar cuenta
  users.js             perfil, configuracion, pagos, direcciones
  ads.js               publicar, listar, buscar, filtrar, editar, borrar
  orders.js            carrito -> pedido, stock, estados, ventas
  misc.js              favoritos, centro de resolucion, comentarios

scripts/
  migrar.js            Ordena y repara los datos antiguos (idempotente)
  limpiar-pruebas.js   Borra los usuarios/pedidos que crean las pruebas
  arreglar-texto.js    Corrige el texto con la codificacion rota
  preparar-html.js     Anade sesion.js y la etiqueta viewport a las paginas
  enlazar-responsive.js  Anade responsive.css a las paginas

public/
  sesion.js            Se carga la PRIMERA en todas las paginas.
                       Unico sitio donde se decide si hay sesion.
  responsive.css       Se carga la ULTIMA. Adaptacion a movil y tablet.
  ...                  El resto de paginas y estilos.

data/                  Los datos (users.json, ads.json, orders.json...)
uploads/               Fotos subidas por los usuarios
backups/               Copias que hace npm run migrar antes de tocar nada
tests/                 Pruebas automaticas
```

---

## Comandos

| Comando | Que hace |
|---|---|
| `npm start` | Arranca el servidor |
| `npm run dev` | Igual, pero se reinicia solo al guardar |
| `npm run migrar` | Ordena los datos antiguos. Hace copia antes |
| `npm test` | Prueba la API de punta a punta (con el servidor arrancado) |
| `npm run limpiar-pruebas` | Borra los datos que crean las pruebas |

Para las pruebas del navegador (necesitan Python y Playwright):

```bash
python3 tests/navegador.py     # flujo completo de compra
python3 tests/responsive.py    # comprueba movil, tablet y PC
```

---

## Como funciona la sesion

- Al iniciar sesion el servidor pone una **cookie `token` httpOnly**
  firmada. El JavaScript de la pagina no puede leerla.
- Cada ruta privada saca el usuario de esa cookie. **El correo que
  mande el navegador se ignora siempre.**
- `public/sesion.js` pregunta a `/me` al cargar cada pagina y copia el
  resultado a `localStorage` solo para las pantallas que todavia leen
  de ahi. La copia nunca decide nada: manda la cookie.

Si cambias `JWT_SECRET`, se cierran todas las sesiones abiertas.

---

## Notas sobre los datos

- Los precios se guardan como **numero**, no como texto.
- Las imagenes se guardan como **ruta relativa** (`/uploads/...`).
  Nunca con el dominio delante: asi funcionan igual en local y en el
  servidor.
- El stock lo descuenta el servidor al crear el pedido, y lo devuelve
  si el pedido se cancela.
- El precio de un pedido lo pone el servidor leyendo el anuncio. El
  navegador solo dice **que** producto y **cuantas** unidades.

---

## Pendiente

- **MongoDB**: hoy los datos van en archivos JSON. Todo el acceso pasa
  por `lib/store.js`, asi que la migracion afecta solo a ese archivo;
  las rutas no se tocan. La variable `MONGODB_URI` ya esta reservada en
  `.env.example`.
- **Chat**: `public/chat.js` guarda los mensajes en el navegador de
  quien escribe. No hay backend de chat todavia, asi que los mensajes
  no llegan al otro usuario.
- **Centro de resolucion**: el servidor ya tiene los endpoints; la
  pagina todavia guarda en el navegador.
- 7 pedidos antiguos se quedaron sin vendedor porque el producto al que
  correspondian ya no existe y no hay de donde deducirlo. Los nuevos lo
  guardan siempre.
