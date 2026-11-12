export default {
  "title": "privacidad, sin niebla.",
  "intro": [
    "no queremos tus datos.",
    "las visitas se convierten en totales anónimos, sin cookies de seguimiento.",
    "lo poco que guardamos (un voto o código de acceso) aparece aquí y caduca."
  ],
  "updated": "2026-11-06",
  "sections": [
    [
      "who",
      "¿quién lleva la linterna?",
      "Francisco Gabriel Van Langenhove es responsable de corvus.gent y stats.corvus.gent, incluidos música y juegos. preguntas o solicitudes: <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "qué contamos",
      "PostHog EU cuenta visitas y acciones permitidas por defecto, sin cookies, almacenamiento del navegador, perfiles ni grabaciones. crea temporalmente un seudónimo diario con información de red/navegador; solo los totales son anónimos. no recibe nombres, emails ni formularios. GPC, DNT o ‘no me cuentes’ impiden cargar PostHog: solo aumenta un contador página/día, sin ID, hash ni cabeceras guardadas. esos accesos no son personas únicas."
    ],
    [
      "why",
      "por qué y con qué base",
      "el interés legítimo es la base declarada del conteo básico sin cookies y la prevención de abusos. Spotify requiere tu clic. emails de acceso, votos y reservas cumplen tu petición. puedes rechazar PostHog aquí; solo queda un acceso anónimo. no vendemos datos."
    ],
    [
      "storage",
      "qué queda y cuánto tiempo",
      "código: 3 minutos. sesión: 7 días o hasta cerrar sesión. registros de acceso, solicitudes y predicciones asociadas a un email: máximo 90 días. límites antiabuso: hasta 24 horas, con un hash de IP con sal distinto cada día; nuestra aplicación no guarda IP sin procesar. desafíos antibots: 5 minutos. historial del juego en el servidor: 48 horas tras el uso; rachas y control de votos duplicados: hasta un año. totales anónimos y sugerencias musicales públicas pueden permanecer hasta su eliminación.",
      "la retención de eventos depende del ajuste de PostHog; nuestro objetivo es 90 días, pero falta confirmar ese ajuste. los proveedores de hosting y email tienen plazos propios para registros y copias de seguridad. pídeme los detalles actuales.",
      "Resend: almacenamiento en EE. UU.; emails/registros 30 días en Free/Pro/Scale, copias 7 días; Enterprise puede variar. <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "sf",
      "mensajes del viaje a sf",
      "si envías el formulario sf, solo gabe ve tu nombre, contacto, trabajo, planes, fechas, lugar y mensaje en el panel privado. se usan para organizar el encuentro solicitado (ejecución de tu petición), no para marketing. cada registro se borra automáticamente de Redis 60 días después del envío; marcarlo como hecho no alarga ese plazo.",
      "se envía una copia a gabriel@corvus.gent mediante Resend, la excepción documentada de almacenamiento en ee. uu. Resend tiene su propia retención de registros; gabe debe borrar la notificación de su buzón dentro de esos mismos 60 días. puedes pedir borrarla antes, también si usaste un usuario de x o perfil de linkedin.",
      "la cookie firmada vid también evita abusos del formulario; los retos caducan a los 5 minutos, los hashes ip cambian a diario y caducan en un día, y los recibos de reintento a las 24 horas. la nota usa sessionStorage (sf-note:2026-11) para mostrarse una vez por sesión de pestaña. las estadísticas opcionales cuentan acciones, nunca tus campos."
    ],
    [
      "browser",
      "en tu navegador",
      "cookies necesarias: sess mantiene la sesión; vid evita votos de idioma duplicados; mvid recuerda votos musicales y progreso diario. están firmadas, protegidas y no son accesibles a scripts. sess caduca en 7 días; vid y mvid en un año. nunca las usamos para identificarte en analytics.",
      "una sola marca local privacy-choice recuerda ‘ok’ o ‘no me cuentes’. ‘ok’ añade un soldier por navegador/origen del sitio; borrar los datos puede permitir otro. no se envía esa marca a PostHog. analytics y campañas quedan en memoria, sin almacenamiento del navegador."
    ],
    [
      "outside",
      "otros servicios",
      "Spotify recibe la solicitud de reproducción solo tras tu clic y puede entonces guardar sus cookies. nuestro servidor consulta Spotify o Apple cuando envías el enlace de una canción. los mapas CARTO pasan por nuestro servidor sin enviar tu IP. Leaflet, Sortable y la biblioteca PostHog se alojan aquí.",
      "Buy Me a Coffee y Pidgy son enlaces, no formularios integrados. sus políticas se aplican al visitarlos. /links, /go y nuestros atajos de campaña solo añaden etiquetas UTM y cuentan visitas/clics, sin captar formularios ni identidades.",
      "Notion guarda mi registro manual de X. las estadísticas públicas muestran totales, etiquetas públicas de campañas y voces, y mis propios posts; los textos de respuestas y las URL de destino quedan tras el acceso privado. las campañas aprobadas y franjas región-hora acompañan la analítica opcional. las copias de Corvus caducan en 24 horas; el origen sigue mi retención en Notion. la región está pendiente de confirmar, sin promesa de almacenamiento solo en la UE.",
      "para contar cafés, el servidor lee brevemente los registros de Buy Me a Coffee y reconoce a quienes repiten por su cuenta o correo si está disponible. solo guarda los totales y la fecha del último café durante 30 minutos.",
      "PostHog EU cuenta visitas y acciones permitidas por defecto, sin cookies, almacenamiento del navegador, perfiles ni grabaciones. crea temporalmente un seudónimo diario con información de red/navegador; solo los totales son anónimos. no recibe nombres, emails ni formularios. GPC, DNT o ‘no me cuentes’ impiden cargar PostHog: solo aumenta un contador página/día, sin ID, hash ni cabeceras guardadas. esos accesos no son personas únicas."
    ],
    [
      "where",
      "adónde van los datos",
      "nuestras funciones de Vercel están configuradas en Fráncfort (fra1). los archivos estáticos y el enrutamiento usan una red mundial. PostHog EU está en Fráncfort. Redis también tiene Fráncfort como destino; aún falta verificar su región actual y completar la migración.",
      "Resend sigue como excepción temporal: Irlanda es la región de envío prevista, pendiente de comprobar en la cuenta, pero el contenido de los correos y los registros se guardan en EE. UU. enviar desde Irlanda no cambia eso. <a href=\"https://resend.com/docs/dashboard/domains/regions\" rel=\"noreferrer\">Resend</a>.",
      "Vercel es una empresa estadounidense. su <a href=\"https://vercel.com/legal/dpa\" rel=\"noreferrer\">Vercel DPA</a> y el <a href=\"https://vercel.com/security\" rel=\"noreferrer\">EU–US Data Privacy Framework</a> ofrecen garantías para las transferencias; no significan que todos los registros, accesos de soporte o copias permanezcan en la UE. aún debemos confirmar la configuración y los acuerdos aplicables."
    ],
    [
      "rights",
      "tus derechos",
      "escríbeme para acceder, corregir, borrar, limitar o trasladar tus datos, u oponerte al tratamiento basado en interés legítimo. cerrar el reproductor o la página retira el consentimiento de reproducción; Spotify controla las cookies ya guardadas. normalmente respondemos en un mes. podemos pedir una prueba proporcionada de que los datos son tuyos; no podemos vincularte a totales anónimos.",
      "puedes reclamar ante la Autoridad belga de Protección de Datos: <a href=\"https://www.gegevensbeschermingsautoriteit.be/\" rel=\"noreferrer\">gegevensbeschermingsautoriteit.be</a>."
    ]
  ],
  "providersTitle": "quién ayuda a mantener esto",
  "providersNote": "Vercel aloja el sitio, PostHog EU cuenta, Resend envía códigos y un servicio Redis gestionado guarda registros temporales. falta confirmar el proveedor Redis desplegado y su región; pídeme los detalles actuales. los servicios externos pueden tratar datos fuera del EEE bajo sus contratos y garantías de transferencia. sus políticas también cubren registros y copias de seguridad.",
  "roles": [
    "hosting",
    "analytics",
    "emails de acceso",
    "Redis, si es Upstash",
    "Redis, si es Redis Cloud",
    "mapas",
    "reproducción",
    "consulta musical",
    "aportaciones",
    "reservas",
    "registro manual de x"
  ],
  "consentInfo": "se cuenta por defecto. ‘ok’ cierra el aviso y cuenta un soldier; no es consentimiento para analytics. ‘no me cuentes’, GPC y DNT pasan a totales anónimos de páginas. tu elección queda hasta cambiarla o borrar datos. un rechazo se conserva si cambia el aviso."
};
