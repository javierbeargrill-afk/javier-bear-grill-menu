# Javier Bear Grill — Menú web

Sitio de producción: https://menujaviergrill.store/

## Arquitectura

- **GitHub Pages** publica el frontend.
- **Loyverse** es la fuente principal de productos, disponibilidad y precios locales.
- **Supabase** guarda el caché del menú, configuración, pedidos y funciones de backend.
- La función `loyverse-menu` sincroniza Loyverse con `menu_cache`.
- El sitio consulta `menu_cache` para cargar rápido y evitar llamadas directas a Loyverse desde el navegador.

## Automatizaciones

- **Sincronización Loyverse → Supabase:** cada hora, al minuto 7, mediante Supabase Cron.
- **Snapshot HTML para SEO y primera carga:** GitHub Actions lo actualiza diariamente desde el caché de Supabase y solo hace commit si cambió el menú.
- Las imágenes del menú se almacenan en Supabase Storage con caché largo cuando es posible.

## SEO

El sitio incluye:

- URL canónica.
- `robots.txt`.
- `sitemap.xml`.
- datos estructurados Schema.org para `Restaurant` y `Menu`.
- Open Graph.
- menú visible en el HTML inicial para facilitar indexación y mejorar la primera carga.

## Privacidad

Javier Bear Grill opera **solo por delivery**. La web pública muestra zona de servicio y no publica la dirección residencial exacta.

## Seguridad

- Los secretos de Loyverse y las claves de servicio no deben guardarse en este repositorio.
- La clave `anon` de Supabase es pública por diseño y está limitada por RLS/permisos.
- El panel administrativo usa una API separada y sesiones temporales.
- La sincronización automática usa un secreto guardado en Supabase Vault.

## Google Business Profile

El menú nativo se publicó y depuró el **14-oct-2026** desde el catálogo de Loyverse: **1 menú, 10 categorías y 37 productos**, con precios locales en PAB. Dos lecturas posteriores de Google verificaron **35 productos con fotos**, vinculados a 34 imágenes únicas. Quedan pendientes la foto de Coca-Cola 355 ml (original de resolución insuficiente) y la de Pernil por encargo (Kg) (sin imagen de origen).

La publicación y la carga de fotos se ejecutaron con herramientas locales; la sincronización automática con Google sigue pendiente. El workflow de este repositorio solo previsualiza y no publica. La respuesta de la API confirma los datos y asociaciones, pero no la visibilidad inmediata de las fotos en Search/Maps.

Ver [integración de Google Business Profile](docs/GOOGLE-BUSINESS-PROFILE.md) y [log de cambios](docs/LOG-CAMBIOS.md).

