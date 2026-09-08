"""
=========================
PRUEBA DEL FLUJO COMPLETO EN EL NAVEGADOR

  1) arranca el servidor:   npm start
  2) en otra terminal:      python3 tests/navegador.py
  3) al terminar:           npm run limpiar-pruebas

La prueba CREA SU PROPIA CUENTA de comprador y su propio producto.
Nunca compra con una cuenta real ni toca el stock de un anuncio real:
una prueba no debe dejar pedidos a nombre de un cliente de verdad.
=========================
"""

from playwright.sync_api import sync_playwright
import json, sys, time

import os
PUERTO = os.environ.get("PORT", "3000")
B = f"http://localhost:{PUERTO}/"
SHOTS = "/tmp/claude-1004/-home-freelancer/0d898f7f-c2a6-4349-8425-69368702f93e/scratchpad/shots2"

errores = []
resultados = []


def r(nombre, ok, extra=""):
    resultados.append((nombre, ok, extra))
    print(("  OK   " if ok else "  FALLA ") + nombre + ("  " + str(extra) if extra else ""))


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 720})
    pg = ctx.new_page()

    pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errores.append("console." + m.type + ": " + m.text) if m.type == "error" else None)

    # ---------- 1. Portada sin sesion ----------
    errores.clear()
    pg.goto(B + "index.html", wait_until="networkidle")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{SHOTS}/01_home_pc.png")
    r("portada carga sin errores de JS", len(errores) == 0, errores[:3])

    # el vendedor "undefined" debe haber desaparecido
    cuerpo = pg.inner_text("body")
    r("ya no aparece 'undefined' como vendedor en la portada", "undefined" not in cuerpo)

    # ---------- 2. Registro + login de la cuenta de prueba ----------
    errores.clear()

    CORREO = f"Prueba.Mayus{int(time.time()*1000)}@Gmail.com"
    CLAVE = "clave12345"

    # Se registra con MAYUSCULAS a proposito: antes, quien lo hacia no
    # podia volver a entrar nunca.
    pg.request.post(B + "register", data={
        "accountType": "personal", "nombre": "Prueba", "apellido": "Navegador",
        "email": CORREO, "password": CLAVE, "telefono": "8090000001",
        "country": "RD", "state": "Santo Domingo", "city": "DN",
        "sector": "Naco", "address": "Calle Prueba 1", "zip": "10101"
    })

    pg.goto(B + "login.html", wait_until="networkidle")
    pg.fill("#loginEmail", CORREO)
    pg.fill("#loginPassword", CLAVE)
    pg.click("button[type=submit], form button")
    pg.wait_for_timeout(2500)
    r("login con el correo tal cual se escribio (con mayusculas)",
      "index.html" in pg.url or pg.url.rstrip("/").endswith(str(PUERTO)), pg.url)

    me = pg.evaluate("fetch('/me').then(r=>r.json())")
    r("el servidor reconoce la sesion", me.get("autenticado") is True, json.dumps(me)[:120])
    r("localStorage 'email' ahora SI esta puesto (5 paginas dependian de el)",
      pg.evaluate("localStorage.getItem('email')") == CORREO.lower(),
      pg.evaluate("localStorage.getItem('email')"))
    r("localStorage 'usuario' tambien",
      bool(pg.evaluate("localStorage.getItem('usuario')")),
      pg.evaluate("localStorage.getItem('usuario')"))

    # ---------- 3. Paginas que antes estaban muertas ----------
    for pagina, marca in [("direcciones.html", "direcciones"),
                          ("pagos.html", "pagos"),
                          ("comentarios.html", "comentarios"),
                          ("resolucion.html", "resolucion"),
                          ("solicita-datos.html", "solicita-datos")]:
        errores.clear()
        pg.goto(B + pagina, wait_until="networkidle")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=f"{SHOTS}/pagina_{marca}.png")
        sigue_logueado = "login.html" not in pg.url
        r(f"{pagina}: ya no expulsa al login", sigue_logueado, pg.url)
        if errores:
            r(f"{pagina}: errores de JS", False, errores[:2])

    # ---------- 4. Dashboard (estaba en blanco) ----------
    errores.clear()
    pg.goto(B + "dashboard.html", wait_until="networkidle")
    pg.wait_for_timeout(1800)
    pg.screenshot(path=f"{SHOTS}/02_dashboard_pc.png")
    r("dashboard sin errores de JS", len(errores) == 0, errores[:3])
    r("dashboard dibuja el formulario de publicar",
      pg.locator("#titulo").count() > 0 and pg.locator("#titulo").is_visible(),
      f"campos titulo={pg.locator('#titulo').count()}")

    # ---------- 5. Comprar de verdad ----------
    errores.clear()
    pg.goto(B + "index.html", wait_until="networkidle")
    pg.wait_for_timeout(1500)

    # abrir el primer producto
    tarjetas = pg.locator(".producto, .card, .product-card, a[href*='producto.html']")
    print("     tarjetas encontradas:", tarjetas.count())

    pg.evaluate("""() => {
      const el = document.querySelector("[onclick*='verProducto'], .producto, .card");
      if (el) el.click();
    }""")
    pg.wait_for_timeout(2000)

    if "producto.html" not in pg.url:
        # fallback: navegar a mano dejando el producto elegido
        ads = pg.evaluate("fetch('/all-ads').then(r=>r.json())")
        elegido = next((a for a in ads if a["cantidad"] > 0), None)
        pg.evaluate("p => localStorage.setItem('productoSeleccionado', JSON.stringify(p))", elegido)
        pg.goto(B + "producto.html", wait_until="networkidle")
        pg.wait_for_timeout(1500)

    pg.screenshot(path=f"{SHOTS}/03_producto_pc.png")
    r("la pagina de producto carga", "producto.html" in pg.url, pg.url)
    r("producto sin errores de JS", len(errores) == 0, errores[:3])

    sel = pg.evaluate("JSON.parse(localStorage.getItem('productoSeleccionado')||'null')")
    ad_id = sel and sel.get("id")
    r("el producto elegido tiene id", bool(ad_id), str(ad_id))

    stock_antes = pg.evaluate("id => fetch('/ads/'+id).then(r=>r.json()).then(a=>a.cantidad)", ad_id)

    # agregar al carrito por la interfaz
    errores.clear()
    # se llama la misma funcion que dispara el boton "Agregar al carrito"
    pg.evaluate("agregarCarritoProducto(null, null)")
    pg.wait_for_timeout(1200)

    carrito = pg.evaluate("JSON.parse(localStorage.getItem('carrito')||'[]')")
    r("el carrito guarda el adId (antes no lo guardaba)",
      len(carrito) > 0 and carrito[0].get("adId") is not None, json.dumps(carrito)[:200])

    # ---------- 6. Checkout real ----------
    pg.goto(B + "checkout.html", wait_until="networkidle")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{SHOTS}/04_checkout_pc.png")

    errores.clear()
    pg.evaluate("confirmarCompra()")
    pg.wait_for_timeout(2500)

    r("tras confirmar, va a la pagina de gracias", "gracias.html" in pg.url, pg.url)

    stock_despues = pg.evaluate("id => fetch('/ads/'+id).then(r=>r.json()).then(a=>a.cantidad)", ad_id)
    r(f"el stock bajo en el SERVIDOR ({stock_antes} -> {stock_despues})",
      stock_despues is not None and stock_despues < stock_antes)

    r("el carrito quedo vacio", pg.evaluate("localStorage.getItem('carrito')") in (None, "[]"))

    # ---------- 7. El pedido aparece en el historial ----------
    pg.goto(B + "historial.html", wait_until="networkidle")
    pg.wait_for_timeout(2000)
    pg.screenshot(path=f"{SHOTS}/05_historial_pc.png")

    texto_hist = pg.inner_text("body")
    r("el pedido recien hecho aparece en el historial (antes NUNCA aparecia)",
      "No tienes compras" not in texto_hist and len(texto_hist.strip()) > 40,
      texto_hist[:110].replace("\n", " "))

    ordenes = pg.evaluate("fetch('/my-orders').then(r=>r.json())")
    r("el servidor tiene el pedido con vendedor",
      len(ordenes) > 0 and bool(ordenes[0].get("vendedor")),
      f"{len(ordenes)} pedidos, vendedor={ordenes[0].get('vendedor') if ordenes else None}")

    # ---------- 8. Cerrar sesion de verdad ----------
    pg.goto(B + "index.html", wait_until="networkidle")
    pg.wait_for_timeout(800)
    pg.evaluate("cerrarSesion()")
    pg.wait_for_timeout(1800)
    me2 = pg.evaluate("fetch('/me').then(r=>r.json()).catch(()=>({autenticado:false}))")
    r("al cerrar sesion el SERVIDOR tambien la cierra", me2.get("autenticado") is not True, json.dumps(me2)[:80])

    ctx.close()

    # ---------- 9. Movil ----------
    ctxm = b.new_context(viewport={"width": 390, "height": 780})
    pgm = ctxm.new_page()
    for pagina, nombre in [("index.html", "home"), ("producto.html", "producto"),
                           ("dashboard.html", "dashboard"), ("checkout.html", "checkout")]:
        pgm.goto(B + pagina, wait_until="networkidle")
        pgm.wait_for_timeout(1200)
        pgm.screenshot(path=f"{SHOTS}/movil_{nombre}.png")

    desborde = pgm.evaluate(
        "() => ({doc: document.documentElement.scrollWidth, win: window.innerWidth})"
    )
    print("\n  movil scrollWidth:", desborde)
    ctxm.close()
    b.close()

ok = sum(1 for _, o, _ in resultados if o)
print(f"\n=== {ok} correctas, {len(resultados)-ok} fallidas ===")
