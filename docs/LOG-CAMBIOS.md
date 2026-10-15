# Log de cambios — menú y Google

Este registro conserva cambios comprobados. Documentar un resultado operativo no implica que todas las herramientas utilizadas estén incorporadas al repositorio.

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
