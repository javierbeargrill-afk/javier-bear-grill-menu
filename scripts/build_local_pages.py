"""Build useful local landing pages from the same public catalogue as the menu."""
import html
import json
from urllib.parse import urlsplit

ORIGIN = 'https://menujaviergrill.store'
REVIEW = 'https://g.page/r/CdPB9VECeBD_EBM/review'
WA = 'https://wa.me/50765738924'
ROUTES = ('hamburguesas-la-chorrera', 'delivery-la-chorrera')


def esc(value):
    return html.escape(str(value or ''), quote=True)


def safe_image(value):
    return str(value) if value and urlsplit(str(value)).scheme == 'https' else ''


def shell(route, title, description, body):
    schema = json.dumps({'@context': 'https://schema.org', '@type': 'WebPage',
                         'name': title, 'description': description,
                         'url': f'{ORIGIN}/{route}/', 'inLanguage': 'es-PA',
                         'about': {'@id': f'{ORIGIN}/#restaurant'}}, ensure_ascii=False).replace('<', '\\u003c')
    return f'''<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} | Javier Bear Grill</title><meta name="description" content="{esc(description)}">
<link rel="canonical" href="{ORIGIN}/{route}/"><meta property="og:type" content="website">
<meta property="og:title" content="{esc(title)} | Javier Bear Grill"><meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{ORIGIN}/{route}/"><link rel="stylesheet" href="/assets/local-pages.css">
<script type="application/ld+json">{schema}</script></head>
<body><header><a class="brand" href="/">JAVIER BEAR GRILL<span>LA CHORRERA · PANAMÁ</span></a>
<nav aria-label="Navegación principal"><a href="/">Menú y pedidos</a><a href="/hamburguesas-la-chorrera/">Hamburguesas</a><a href="/delivery-la-chorrera/">Delivery y retiro</a></nav></header>
<main>{body}<section class="review"><h2>¿Ya probaste Javier Bear Grill?</h2><p>Cuéntanos cómo fue tu experiencia. Tu opinión ayuda a otras personas a conocernos y a nosotros a mejorar.</p><a href="{REVIEW}">Compartir mi experiencia en Google ↗</a></section></main>
<footer><strong>Javier Bear Grill · La Chorrera</strong><p>Delivery y retiro coordinado por WhatsApp.</p><a href="{WA}">WhatsApp: 6573-8924</a> · <a href="/">Ver menú, horarios y disponibilidad</a></footer></body></html>
'''


def build_pages(menu, hidden, zones):
    cards = []
    for cat in menu:
        if 'hamburgues' not in str(cat.get('n', '')).lower():
            continue
        for item in cat.get('i') or []:
            if item.get('n') in hidden:
                continue
            image = safe_image(item.get('img'))
            picture = f'<img src="{esc(image)}" alt="{esc(item.get("n"))}" width="640" height="480" loading="lazy">' if image else ''
            cards.append(f'<article class="card">{picture}<div><h3>{esc(item.get("n"))}</h3><p>{esc(item.get("d"))}</p><strong>B/.{float(item.get("p") or 0):.2f}</strong></div></article>')
    burger = '''<section class="hero"><p class="eyebrow">ELIGE TU PRÓXIMA BURGER</p><h1>Hamburguesas smash en La Chorrera</h1><p>Explora las hamburguesas de Javier Bear Grill: compara ingredientes y precios y elige la tuya para delivery o retiro coordinado.</p><a class="button" href="/">Ver menú y hacer mi pedido</a></section>
<section><h2>Encuentra tu hamburguesa</h2><p>Estas son las opciones del catálogo local. Revisa la descripción de cada una para elegir la combinación de carnes, quesos y acompañamientos que prefieras.</p><div class="grid">''' + ''.join(cards) + '''</div><p class="note">Precios del catálogo local. Confirma la disponibilidad y el total en el menú al pedir; el delivery se calcula según la zona.</p></section>
<section class="panel"><h2>¿Cómo pedir?</h2><p>Abre el menú, elige tus productos y revisa el total. Si prefieres retirar tu pedido, coordina el punto y la hora por WhatsApp antes de salir.</p><a href="/delivery-la-chorrera/">Consultar zonas de delivery y retiro →</a></section>'''
    rows = []
    for z in zones:
        if not z.get('activa', True):
            continue
        rate = 'Consultar por WhatsApp' if z.get('fuera') else f'B/.{float(z.get("precio") or 0):.2f}'
        rows.append(f'<tr><th scope="row">{esc(z.get("nombre"))}</th><td>{rate}</td></tr>')
    delivery = f'''<section class="hero"><p class="eyebrow">TU PEDIDO, A TU MANERA</p><h1>Delivery de Javier Bear Grill en La Chorrera</h1><p>Pide hamburguesas y las demás opciones del menú para recibirlas en tu zona, o coordina el retiro por WhatsApp.</p><a class="button" href="/">Elegir mi comida</a></section>
<section><h2>Zonas y tarifas de delivery</h2><p>Consulta la tarifa de tu zona antes de pedir. El costo de entrega se suma al pedido y se confirma al seleccionar la zona en el menú.</p><div class="table-wrap"><table><caption>Tarifas del delivery directo</caption><thead><tr><th scope="col">Zona</th><th scope="col">Entrega</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div><p class="note">La cobertura y disponibilidad se confirman al pedir. Si tu ubicación no aparece, <a href="{WA}">consúltanos por WhatsApp</a> antes de completar el pedido.</p></section>
<section class="panel"><h2>Retiro coordinado</h2><p>Escríbenos por WhatsApp para acordar el punto de retiro y la hora. Espera la confirmación antes de salir.</p><a class="button" href="{WA}">Coordinar retiro</a></section>
<section><h2>Cómo hacer tu pedido</h2><ol><li>Abre el menú y elige tus productos.</li><li>Selecciona tu zona y revisa el costo total.</li><li>Completa los datos solicitados y confirma los detalles del pedido.</li></ol><p>Los horarios y la disponibilidad actual aparecen en el <a href="/">menú principal</a>. Si necesitas confirmar detalles de la entrega, contáctanos al <a href="{WA}">6573-8924</a>.</p><a href="/hamburguesas-la-chorrera/">Explorar nuestras hamburguesas →</a></section>'''
    return {ROUTES[0]: shell(ROUTES[0], 'Hamburguesas smash en La Chorrera', 'Hamburguesas de Javier Bear Grill en La Chorrera: fotos, ingredientes y precios del menú local. Pide delivery o coordina tu retiro.', burger),
            ROUTES[1]: shell(ROUTES[1], 'Delivery y retiro en La Chorrera', 'Consulta zonas y tarifas de delivery de Javier Bear Grill en La Chorrera. Haz tu pedido en el menú o coordina el retiro por WhatsApp.', delivery)}
