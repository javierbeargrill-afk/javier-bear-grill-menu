# Google Business Profile — publicación del menú local

## Estado

**Menú nativo publicado y verificado por API el 14-oct-2026: 1 menú, 10 categorías, 37 artículos y 35 artículos con fotos.** Se usó OAuth autorizado por el propietario y el catálogo vigente de Loyverse. La sincronización automática con Google continúa pendiente. La última verificación de las fotos fue a las 17:01:06 de Panamá (22:01:06 UTC), mediante dos lecturas posteriores.

La descripción, horarios, categorías y atributos de atención también se actualizaron y verificaron el **15-oct-2026**; ver el registro siguiente.

Este documento distingue el estado real en Google, el adaptador ya incorporado al repositorio y las herramientas operativas que permanecen locales. No se publican credenciales, identificadores privados ni respaldos de Google.

Loyverse sigue siendo la fuente del catálogo. Se usa el mismo caché público que alimenta la web, con precios locales (no PEYA). No se cambia el frontend, POS, inventario, pedidos, horarios ni dirección residencial.


## Información del negocio actualizada por API

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

## Antecedentes — 13-oct-2026 (registro histórico)

- Se completó manualmente el consentimiento OAuth `business.manage` con cuenta de prueba y se obtuvo `200 OK` en My Business Account Management API v1.
- La consulta de ubicaciones Business Information API v1 usando `accounts/-/locations` devolvió la ficha de **Javier Bear Grill — Hamburguesas y Parrilla en La Chorrera**.
- `locations.get` confirmó `metadata.canHaveFoodMenus: true` para esa ubicación.
- `locations/{locationId}/attributes` devolvió `200 OK` y **`attributes/url_menu` ya configurado exactamente como `https://menujaviergrill.store/`**. No reescribir el atributo: ya está correcto.
- La lista de atributos disponibles también incluye `url_menu` de tipo URL.
- Al cierre del 13-oct, los intentos manuales de lectura de FoodMenus v4 devolvieron **404**, pese a constar Google My Business API v4 habilitada. El 14-oct se consiguieron lecturas y escrituras reales con OAuth operativo. No se confirmó la causa de aquel 404; no atribuirla a un proyecto o cliente concreto. Que la URL del menú exista por sí sola no demuestra importación de artículos.
- **Seguridad:** un client secret OAuth y un access token se expusieron en la conversación/capturas. Antes de configurar automatización, revocar autorización/tokens comprometidos, rotar secreto y configurar nuevas credenciales solo en gestor de secretos; no pedir que se peguen en el chat ni en GitHub.
- **Estado histórico al cierre del 13-oct:** todavía no se había publicado el menú nativo. Este estado queda actualizado por la ejecución real del 14-oct descrita a continuación.

## Resultado real — 14-oct-2026

- **Publicación:** se obtuvo el caché vivo de Loyverse y se enviaron 10 categorías y 37 artículos con precios locales en PAB. Se guardaron respaldos privados antes/propuesta/después y se verificó con GET.
- **Limpieza autorizada:** la primera publicación conservó el menú manual anterior y añadió el gestionado, dejando dos conjuntos de 37 artículos. Con autorización expresa se retiró únicamente el menú antiguo, identificado contra el respaldo. Dos lecturas confirmaron un solo menú de 37 artículos a las 16:45:31 de Panamá. El propietario confirmó después que el menú cargó bien.
- **Fotos:** se inspeccionaron 36 imágenes de origen; 35 eran elegibles tras preparación y una tenía resolución insuficiente. Se cargaron 34 imágenes únicas y se vincularon a 35 artículos, porque dos productos comparten exactamente los mismos bytes. Se usaron los bytes reales, su formato PNG/JPEG y referencias de medios de Google; una URL de origen no se trató como `mediaKey`.
- **Preparación sin alterar contenido:** la imagen de Agua en botella se volvió a codificar sin pérdida para superar el tamaño mínimo; se comprobó identidad de píxeles. La extensión original no se tomó como prueba del formato.
- **Pendientes:** Coca-Cola 355 ml tiene una imagen de 197×197 y necesita un original de al menos 250×250; Pernil por encargo (Kg) no tiene foto de origen.
- **Verificación final:** dos GET posteriores independientes confirmaron 1 menú, 37 artículos y 35 artículos con fotos, conservando textos y precios, a las 17:01:06 de Panamá (22:01:06 UTC). La asociación por API no confirma aprobación ni visibilidad inmediata en Search/Maps.
- **Recuperación:** un bloqueo temporal de Windows/OneDrive interrumpió la actualización del registro privado después de crear medios. Se recuperó el registro temporal, se incorporó reintento acotado y se reanudó reutilizando las 12 referencias ya creadas; no se repitieron esas cargas.
- **Alcance:** no se modificó el catálogo de Loyverse ni se configuró publicación periódica. No se cambió la fuente preferida de menú mediante esta integración. Se conservaron las fotos preexistentes del perfil; retirar la referencia del menú antiguo no borró el archivo de foto.
- **Seguridad de ejecución:** solo se usó un access token temporal en memoria, sin guardarlo en archivos o logs. No se utilizó el refresh token ni se configuraron credenciales persistentes.

Ver también el [log de cambios](LOG-CAMBIOS.md). Los respaldos y el registro de medios se conservan fuera del repositorio público.

## Componentes

- `scripts/google_food_menu.py`: adaptador sin dependencias externas, Python 3.10+.
- `tests/test_google_food_menu.py`: pruebas de transformación y publicación con API simulada.
- `Google menu preview`: GitHub Actions para previsualización; no realiza PATCH.

La ejecución del 14-oct usó además herramientas locales de publicación, limpieza, carga de fotos y verificación. Sus correcciones para UTF-8, normalización de Money y recuperación del registro de medios **no están incorporadas al código de este repositorio en esta actualización documental**. Antes de repetir el flujo desde GitHub, portar y revisar esas correcciones, conservar el registro privado y comparar el estado vigente. No confundir documentación actualizada con despliegue de esas herramientas.

Modos: `offline` transforma un archivo de caché; `discover` descubre cuentas/perfiles en archivo privado; `preview` comprueba elegibilidad y compara; `publish` permite una actualización controlada con respaldo y huella revisada.

El modo online exige caché de menos de dos horas y encabezado de frescura. Rechaza valores variables, negativos, inválidos, sin precio o con más de dos decimales, categorías vacías y nombres duplicados. Las descripciones HTML se limpian, los textos tienen los límites de Google y los precios se representan como Money exacto con moneda PAB por defecto. USD solo mediante selección explícita, sin convertir cifras.

## Conexión inicial de Google (una vez)

En el proyecto Cloud aprobado, habilitar Google My Business API, My Business Account Management API y My Business Business Information API. Configurar OAuth con el alcance `https://www.googleapis.com/auth/business.manage`, según documentación oficial. Autorizar la cuenta propietaria/administradora del perfil, con acceso offline para poder renovar tokens. El estado Testing de una app OAuth externa puede hacer caducar la autorización; revisar las reglas de Google antes de pretender una sincronización permanente.

Guardar en un entorno protegido `google-business-profile` de GitHub o en el servidor privado que ejecute el script:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_ACCOUNT_ID`
- `GOOGLE_LOCATION_ID`

No enviar secretos por chat ni guardarlos en archivos versionados, frontend, logs o parámetros URL. Los permisos de Drive/Gmail de ChatGPT no sustituyen el alcance Business Profile. No se crean cuentas de servicio para simular autorización del propietario.

El adaptador renueva OAuth en memoria y no registra respuestas OAuth. Para obtener IDs, ejecutar `--mode discover --output /ruta/privada/perfiles.json` con las primeras tres variables configuradas. El archivo incluye solo la selección de campos `name,title,metadata`; nunca una dirección. No subirlo a un repositorio público.

## Prueba controlada

1. Ejecutar `--mode preview`. Se comprueba `metadata.canHaveFoodMenus` en Business Information v1 y se lee FoodMenus v4. No se escribe.
2. Revisar el catálogo con `--mode offline --cache-file /ruta/privada/cache.json --output /ruta/privada/menu-propuesto.json`. Si se quiere limitar el piloto, usar `--section` con el nombre exacto de una categoría del caché (incluye emoji). El caché offline nunca puede usarse para publicar.
3. Con OAuth e IDs ya configurados, ejecutar `--mode preview --section 'nombre exacto'`. Registrar `current_hash` y `proposed_hash` de esa lectura.
4. Publicar la misma selección con `--mode publish --section 'nombre exacto' --expected-hash HUELLA_REVISADA --expected-proposed-hash HUELLA_PROPUESTA --backup-dir /ruta/privada/respaldo`. El directorio debe ser persistente y externo al repositorio. Revisar el menú propuesto del caché fresco antes de ejecutar.
5. El script guarda antes/propuesta/después en archivos privados 0600, vuelve a leer el menú, aborta si cambió la huella remota o el catálogo propuesto, aplica `updateMask=menus` y verifica la respuesta con GET. Revisar también visualmente el resultado en Google Search/Maps: aceptar la API no garantiza publicación inmediata.

El menú gestionado se reconoce por su `sourceUrl` exacta `https://menujaviergrill.store/`. Si no existe, el adaptador del repositorio añade uno conservando otros menús; esto puede dejar un menú manual anterior junto al nuevo, como ocurrió en la primera publicación. Antes de ejecutar, revisar todos los menús y evitar repetir esa duplicación. Si hay más de uno con esa URL, se aborta para resolver la ambigüedad. No se sustituye silenciosamente un menú de otra fuente, como PEYA. El menú antiguo ya fue retirado en la limpieza autorizada del 14-oct; no repetir esa eliminación sobre un estado distinto. En piloto por sección se mantienen las demás secciones del menú gestionado. En publicación completa se reemplazan sus secciones por el catálogo actual; revisar productos retirados antes de ejecutar.

Fotos/atributos/opciones existentes se conservan cuando categoría y nombre coinciden. Un cambio de nombre requiere revisión del vínculo con su foto. No se inventan alérgenos, nutrición o disponibilidad. Las URLs de imágenes del caché no son `mediaKeys`. La carga del 14-oct se realizó con una herramienta local separada mediante upload de bytes, creación de medios FOOD_AND_DRINK y asociación por categoría/nombre normalizados. El registro privado reutiliza referencias según URL de origen y SHA-256; no comprueba duplicados visuales de toda la galería. El adaptador versionado todavía no implementa esa carga. No se utiliza para actualizar enlaces de pedidos, horarios, reseñas o Search Console.

## Operación y recuperación

El workflow es de lectura, se activa manualmente tras conectar OAuth. La tarea diaria está desactivada salvo variable `GOOGLE_MENU_PREVIEW_ENABLED=true`. No imprime catálogo, IDs ni secretos; solo conteos, hash y estado. No sube archivos privados como artifacts de un repositorio público. La renovación OAuth permite evitar login en cada ejecución, mientras la autorización siga vigente.

Publicación automática completa queda pendiente: OAuth, elegibilidad, publicación y fotos ya se probaron en ejecución manual, pero faltan incorporar las herramientas locales, gestionar renovación de credenciales de forma protegida y validar reintentos y operación desatendida. Los respaldos de publicación deben almacenarse en un servidor privado persistente, no en un runner efímero. La llamada PATCH a Google no ofrece aquí escritura por producto ni comparación atómica: existe una ventana pequeña de carrera entre GET y PATCH, por lo que hay que evitar ediciones paralelas durante el piloto. Si PATCH acaba con error/timeout o readback difiere, inspeccionar el respaldo y volver a leer antes de reintentar; no asumir que no se escribió. La restauración debe partir del archivo before y requerir revisión del estado actual, no un rollback automático que borre cambios de terceros.

## Validación realizada

El adaptador original del repositorio tiene 15 pruebas unitarias con APIs simuladas y transformación offline del caché real. Las herramientas locales usadas el 14-oct finalizaron con **36 pruebas automatizadas aprobadas**, además del piloto real de una foto y las verificaciones de publicación, limpieza y carga general con Google.

El comparador local normaliza ceros omitidos por Google y admite como máximo una nanounidad de diferencia alrededor de un centavo exacto; rechaza diferencias mayores o de moneda. La primera verificación estricta detectó ese redondeo, se inspeccionó el estado antes de corregir el comparador y no se repitió el PATCH a ciegas. Las pruebas locales no sustituyen las verificaciones reales ni significan que su código se haya desplegado desde este repositorio.

La aprobación inicial se conserva como confirmación del propietario y contexto del proyecto; no se afirma haber recuperado el correo original de aprobación.

## Referencias oficiales

- https://developers.google.com/my-business/content/basic-setup
- https://developers.google.com/my-business/content/implement-oauth
- https://developers.google.com/my-business/content/update-food-menus
- https://developers.google.com/my-business/reference/rest/v4/FoodMenus
- https://developers.google.com/my-business/reference/rest/v4/accounts.locations/updateFoodMenus
- https://developers.google.com/my-business/reference/businessinformation/rest/v1/locations/get
- https://developers.google.com/my-business/content/upload-photos
- https://support.google.com/business/answer/6103862
