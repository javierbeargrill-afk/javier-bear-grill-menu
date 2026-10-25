# Log de cambios — menú y Google

Este registro conserva cambios comprobados. Documentar un resultado operativo no implica que todas las herramientas utilizadas estén incorporadas al repositorio.

## 2026-10-24 — Primer bloque de SEO local

Preparadas mejoras de título/descripción local, delivery y retiro coordinado, texto visible de servicio y menú JSON-LD completo desde el HTML inicial. La generación diaria actualiza también el schema y la fecha real de cambio del sitemap. Productos, precios, recetas y pedidos conservados. Seguridad, sintaxis JavaScript y 18 pruebas locales aprobadas. Search Console requiere acceso del propietario; no se han leído métricas ni enviado sitemaps. Estado de publicación y verificaciones posteriores: consultar PR y Bitácora. Detalle en [auditoría SEO](SEO-2026-10-24.md).

## 2026-10-15 — Información del negocio actualizada por API

**Estado: aplicado y verificado por dos lecturas posteriores a las 08:47:15 de Panamá (13:47:15 UTC).**

- Descripción actualizada al catálogo actual y a la operación con delivery local y retiro coordinado.
- Horario regular: lunes a viernes 15:30–23:30; sábado y domingo 13:00–23:30, hora de Panamá. Se corrigieron cierres y tramos nocturnos antiguos.
- Categoría principal conservada: Hamburguesería. Categorías adicionales: Comida a domicilio y Restaurante de comida rápida. Se retiraron Tienda de aves de corral, Comida hindú para llevar y Restaurante especializado en chuletas.
- El propietario confirmó que no hay consumo en el local. Se desactivaron Comer allí y Servicio en mesa, conservando delivery y comida para llevar.
- WhatsApp quedó configurado como chat principal y se añadió el enlace de pedidos anticipados a https://menujaviergrill.store/.
- Teléfono, web, enlace de menú, WhatsApp e Instagram ya coincidían con las fuentes vigentes y se verificaron sin reemplazarlos.
- **Confirmación posterior del propietario:** El propietario confirmó el 15-oct-2026 que son correctos el estacionamiento propio gratuito y el acceso de perros al interior y exterior. Esos atributos ya estaban activos en la lectura verificada y se conservaron; no se realizó una nueva escritura en Google ni se renovó OAuth por esta confirmación.

La propuesta de descripción, horarios y categorías pasó primero por `validateOnly=true`. Se conservaron respaldos privados y se comprobaron los campos no seleccionados. `getGoogleUpdated` devolvió `pendingMask` y `diffMask` vacíos al verificar; esto no sustituye una comprobación visual de Search/Maps.

La consulta separada de Place Actions devolvió 403; no se alteraron enlaces de proveedores desde esa API. El atributo disponible `url_order_ahead` sí permitió guardar y verificar el enlace propio. No se inventaron horarios festivos ni otros servicios sin confirmación. La sesión OAuth fue temporal, con credenciales solo en memoria; no se instaló sincronización automática.

Las herramientas locales de la sesión pasaron 8 pruebas de límites de solicitudes. Esta entrada registra una operación real; no incorpora esas herramientas al código versionado.

## 2026-10-14 — Menú nativo publicado, depurado y con fotos

**Estado: aplicado y verificado por API.**

| Comprobación final | Resultado |
| --- | --- |
| Menús gestionados en la colección leída | 1 |
| Categorías | 10 |
| Artículos | 37 |
| Artículos con fotos asociadas | 35 |
| Imágenes únicas creadas por esta integración | 34 |
| Moneda | PAB, precios locales de Loyverse |
| Verificación final de fotos | 17:01:06 Panamá / 22:01:06 UTC |
| Lecturas posteriores de la verificación final | 2 |

Se publicó el catálogo vigente desde el mismo caché de Loyverse que alimenta la web. La primera carga conservó el menú manual anterior y añadió el nuevo; tras autorización expresa se retiró solo el anterior y se verificó un único menú de 37 artículos. El propietario confirmó que el menú cargó bien.

Las imágenes se cargaron como bytes de formato real PNG/JPEG y se vincularon por categoría y nombre. Dos artículos comparten una imagen idéntica, por lo que 34 imágenes únicas cubren 35 productos. La recodificación de Agua en botella conservó los píxeles originales. Se recuperó un bloqueo temporal de escritura del registro privado y se reutilizaron las referencias ya creadas.

### Pendientes concretos

- **Coca-Cola 355 ml:** sustituir el original de 197×197 por una foto de al menos 250×250.
- **Pernil por encargo (Kg):** añadir una foto de origen.
- Comprobar la visibilidad de las fotos en Search/Maps después del procesamiento de Google; las asociaciones por API ya están verificadas.
- Incorporar y revisar las herramientas operativas locales antes de programar sincronización automática. No se instaló publicación periódica en Google.

### Evidencia y límites

- Respaldos privados antes/propuesta/después y registro de medios por URL/SHA-256; no se publican identificadores de cuenta, ficha o medios.
- 36 pruebas automatizadas locales aprobadas, piloto real de foto y dos GET posteriores a la carga final; textos y precios preservados.
- La actualización de este log, del README y de la guía de Google es documental. El adaptador original sigue en el repositorio; el publicador, limpiador y cargador de fotos usados hoy y sus correcciones siguen locales.
- Los estados del 13-oct «404» y «menú no publicado» son antecedentes históricos superados por las lecturas y escrituras reales del 14-oct. No se confirmó la causa del 404.
- No se modificaron precios comerciales, recetas ni inventario de Loyverse; no se borraron fotos existentes del perfil.
- No se guardaron tokens en código, documentación, respaldos o logs. La autorización temporal usada para esta ejecución no instala renovación automática.

Detalles: [Google Business Profile](GOOGLE-BUSINESS-PROFILE.md).

## 2026-10-13 — Adaptador inicial y comprobaciones de acceso

El [PR #9](https://github.com/javierbeargrill-afk/javier-bear-grill-menu/pull/9) incorporó el adaptador y un workflow de previsualización. Se registraron OAuth manual, elegibilidad del perfil y URL de menú correcta. Al cierre de esas pruebas FoodMenus devolvía 404 y no había publicación nativa. Ese corte histórico no describe el estado operativo posterior del 14-oct.


### 2026-10-24 — SEO-003: páginas locales y reseñas
- Páginas de hamburguesas y delivery/retiro con datos del catálogo y configuración existentes.
- Enlaces internos, sitemap de tres URLs y actualización diaria idempotente.
- Enlace oficial de reseñas con invitación neutral. Sin cambios a precios, stock, DB, horarios ni datos privados.
- 20 pruebas locales y controles de seguridad/JS aprobados; despliegue por PR.
