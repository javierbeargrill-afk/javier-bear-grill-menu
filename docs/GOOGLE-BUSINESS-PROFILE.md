# Google Business Profile — piloto del menú local

## Estado

Acceso API aprobado según confirmación del propietario y el seguimiento anterior. Adaptador implementado y probado con el caché actual de Loyverse. **OAuth, elegibilidad del perfil y publicación real aún no verificados.** La aprobación de Google Cloud no concede por sí sola acceso al Perfil de Negocio. No se publica ninguna credencial ni identificador privado en el repositorio.

Loyverse sigue siendo la fuente del catálogo. Se usa el mismo caché público que alimenta la web, con precios locales (no PEYA). No se cambia el frontend, POS, inventario, pedidos, horarios ni dirección residencial.

## Componentes

- `scripts/google_food_menu.py`: adaptador sin dependencias externas, Python 3.10+.
- `tests/test_google_food_menu.py`: pruebas de transformación y publicación con API simulada.
- `Google menu preview`: GitHub Actions para previsualización; no realiza PATCH.

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

El menú gestionado se reconoce por su `sourceUrl` exacta `https://menujaviergrill.store/`. Si no existe, se añade conservando otros menús. Si hay más de uno con esa URL, se aborta para resolver la ambigüedad. No se sustituye silenciosamente un menú de otra fuente, como PEYA. En piloto por sección se mantienen las demás secciones del menú gestionado. En publicación completa se reemplazan sus secciones por el catálogo actual; revisar productos retirados antes de ejecutar.

Fotos/atributos/opciones existentes se conservan cuando categoría y nombre coinciden. Un cambio de nombre requiere revisión del vínculo con su foto. No se inventan alérgenos, nutrición o disponibilidad. Las URLs de imágenes del caché no son `mediaKeys`: subida/mapeo de nuevas fotos queda pendiente para una siguiente etapa. No se utiliza este adaptador para actualizar enlaces de pedidos, horarios, reseñas o Search Console.

## Operación y recuperación

El workflow es de lectura, se activa manualmente tras conectar OAuth. La tarea diaria está desactivada salvo variable `GOOGLE_MENU_PREVIEW_ENABLED=true`. No imprime catálogo, IDs ni secretos; solo conteos, hash y estado. No sube archivos privados como artifacts de un repositorio público. La renovación OAuth permite evitar login en cada ejecución, mientras la autorización siga vigente.

Publicación automática completa queda pendiente hasta verificar OAuth, elegibilidad y piloto real. Los respaldos de publicación deben almacenarse en un servidor privado persistente, no en un runner efímero. La llamada PATCH a Google no ofrece aquí escritura por producto ni comparación atómica: existe una ventana pequeña de carrera entre GET y PATCH, por lo que hay que evitar ediciones paralelas durante el piloto. Si PATCH acaba con error/timeout o readback difiere, inspeccionar el respaldo y volver a leer antes de reintentar; no asumir que no se escribió. La restauración debe partir del archivo before y requerir revisión del estado actual, no un rollback automático que borre cambios de terceros.

## Validación realizada

15 pruebas unitarias con APIs simuladas y transformación offline del caché real (10 categorías/37 artículos al 13-oct-2026). No se llamó a Google con credenciales reales ni se publicó menú. La cuenta Gmail disponible en esta sesión no devolvió el correo de aprobación al buscar el caso anterior; se conserva la aprobación confirmada por el propietario y documentada en el proyecto como contexto, sin afirmar nueva comprobación por correo.

## Referencias oficiales

- https://developers.google.com/my-business/content/basic-setup
- https://developers.google.com/my-business/content/implement-oauth
- https://developers.google.com/my-business/content/update-food-menus
- https://developers.google.com/my-business/reference/rest/v4/FoodMenus
- https://developers.google.com/my-business/reference/rest/v4/accounts.locations/updateFoodMenus
- https://developers.google.com/my-business/reference/businessinformation/rest/v1/locations/get
