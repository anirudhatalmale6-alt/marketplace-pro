from playwright.sync_api import sync_playwright

B = "http://localhost:3177/"
SHOTS = "/tmp/claude-1004/-home-freelancer/0d898f7f-c2a6-4349-8425-69368702f93e/scratchpad/shots3"

PAGINAS = [
    ("index.html", "home"),
    ("producto.html", "producto"),
    ("carrito.html", "carrito"),
    ("checkout.html", "checkout"),
    ("dashboard.html", "dashboard"),
    ("historial.html", "historial"),
    ("profile.html", "profile"),
    ("direcciones.html", "direcciones"),
]

with sync_playwright() as p:
    b = p.chromium.launch()

    for ancho, alto, etiqueta in [(390, 780, "movil"), (768, 720, "tablet"), (1280, 720, "pc")]:
        ctx = b.new_context(viewport={"width": ancho, "height": alto})
        pg = ctx.new_page()

        # sesion
        pg.goto(B + "login.html", wait_until="networkidle")
        pg.fill("#loginEmail", "manuel@hotmail.com")
        pg.fill("#loginPassword", "sasasdas")
        pg.click("form button")
        pg.wait_for_timeout(2000)

        # dejar un producto elegido y algo en el carrito
        ads = pg.evaluate("fetch('/all-ads').then(r=>r.json())")
        elegido = [a for a in ads if a["cantidad"] > 0][0]
        pg.evaluate("p => localStorage.setItem('productoSeleccionado', JSON.stringify(p))", elegido)
        pg.evaluate(
            """p => localStorage.setItem('carrito', JSON.stringify([
                 {adId: p.id, nombre: p.title, precio: 'RD$ '+p.price, imagen: p.image, cantidad: 1}
               ]))""",
            elegido,
        )

        print(f"\n=== {etiqueta} ({ancho}px) ===")

        for pagina, nombre in PAGINAS:
            pg.goto(B + pagina, wait_until="networkidle")
            pg.wait_for_timeout(1200)

            medidas = pg.evaluate("""() => {
              // El cajon lateral del carrito (.carrito-panel) esta
              // aparcado FUERA de la pantalla a proposito mientras esta
              // cerrado: no cuenta como desborde.
              const desbordan = [...document.querySelectorAll('body *')]
                .filter(e => !e.closest('.carrito-panel, .dropdown-menu, .chat-box'))
                // La foto del producto se amplia con scale(2) al pasar el
                // raton por encima, dentro de un contenedor con
                // overflow:hidden. No desborda la pagina.
                .filter(e => getComputedStyle(e).transform === 'none')
                .filter(e => {
                  const r = e.getBoundingClientRect();
                  return r.width > 0 && r.right > window.innerWidth + 1;
                })
                .slice(0, 4)
                .map(e => (e.tagName + (e.id ? '#'+e.id : '') + (e.className && typeof e.className === 'string' ? '.'+e.className.trim().split(/\\s+/).join('.') : '')).slice(0, 60));
              return {
                scroll: document.documentElement.scrollWidth,
                win: window.innerWidth,
                desbordan
              };
            }""")

            estado = "OK  " if not medidas["desbordan"] and medidas["scroll"] <= medidas["win"] + 1 else "SALE"
            print(f"  {estado} {pagina:22} scroll={medidas['scroll']} win={medidas['win']}"
                  + (f"  -> {medidas['desbordan']}" if medidas["desbordan"] else ""))

            if etiqueta == "movil":
                pg.screenshot(path=f"{SHOTS}/{etiqueta}_{nombre}.png")

        ctx.close()

    b.close()
