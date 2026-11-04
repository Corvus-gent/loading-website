export default {
  "title": "privacidad, sin niebla.",
  "intro": [
    "no queremos tus datos.",
    "con tu permiso, las visitas se convierten en totales anónimos, sin cookies de rastreo.",
    "lo poco que guardamos (un voto o código de acceso) aparece aquí y caduca."
  ],
  "updated": "actualizado el 4 de noviembre de 2026",
  "sections": [
    [
      "who",
      "¿quién lleva la linterna?",
      "Francisco Gabriel Van Langenhove es responsable de corvus.gent y stats.corvus.gent, incluidos música y juegos. preguntas o solicitudes: <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "qué contamos",
      "solo tras permitir analytics opcional: visitas, categorías generales de país y navegador, destinos conocidos y acciones sencillas de música y juegos. PostHog EU cuenta sin cookies de rastreo ni perfiles personales. procesa brevemente información de red y navegador para obtener un seudónimo diario; solo los totales resultantes son anónimos. no enviamos nombres, emails, formularios, búsquedas ni grabaciones a analytics. el mapa público y pingle solo usan ciudades con coordenadas redondeadas y al menos dos visitantes contados."
    ],
    [
      "why",
      "por qué y con qué base",
      "consentimiento: analytics opcional de PostHog y, por separado, pulsar reproducir para Spotify. interés legítimo: prevenir abusos y usar totales anónimos. ejecución de tu solicitud: acceso, votos, juegos, solicitudes y reservas. cierra Spotify o la página para detener la reproducción. no vendemos tus datos. respetamos do-not-track y global privacy control."
    ],
    [
      "storage",
      "qué queda y cuánto tiempo",
      "código: 3 minutos. sesión: 7 días o hasta cerrar sesión. registros de acceso, solicitudes y predicciones asociadas a un email: máximo 90 días. límites antiabuso: hasta 24 horas, con un hash de IP con sal distinto cada día; nuestra aplicación no guarda IP sin procesar. desafíos antibots: 5 minutos. historial del juego en el servidor: 48 horas tras el uso; rachas y control de votos duplicados: hasta un año. totales anónimos y sugerencias musicales públicas pueden permanecer hasta su eliminación.",
      "la retención de eventos depende del ajuste de PostHog; nuestro objetivo es 90 días, pero falta confirmar ese ajuste. los proveedores de hosting y email tienen plazos propios para registros y copias de seguridad. pídeme los detalles actuales.",
      "Resend: almacenamiento en EE. UU.; emails/registros 30 días en Free/Pro/Scale, copias 7 días; Enterprise puede variar. <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "browser",
      "en tu navegador",
      "cookies necesarias: sess mantiene la sesión; vid evita votos de idioma duplicados; mvid recuerda votos musicales y progreso diario. están firmadas, protegidas y no son accesibles a scripts. sess caduca en 7 días; vid y mvid en un año. nunca las usamos para identificarte en analytics.",
      "tu elección de analytics y la versión de privacidad se guardan en este navegador durante 180 días o hasta que cambie la política. localStorage guarda tu voto de idioma, idioma, preferencia de entrada, plumas, resultados e instrucciones leídas hasta un año después de guardarlos. borrar datos del sitio elimina preferencias, no votos ya enviados."
    ],
    [
      "outside",
      "otros servicios",
      "Spotify recibe la solicitud de reproducción solo tras tu clic y puede entonces guardar sus cookies. nuestro servidor consulta Spotify o Apple cuando envías el enlace de una canción. los mapas CARTO pasan por nuestro servidor sin enviar tu IP. Leaflet, Sortable y la biblioteca PostHog se alojan aquí.",
      "Buy Me a Coffee y Pidgy son enlaces, no formularios integrados. sus políticas se aplican al visitarlos. /links, /go y nuestros atajos de campaña solo añaden etiquetas UTM y cuentan visitas/clics, sin captar formularios ni identidades. (analytics solo con consentimiento)."
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
    "reservas"
  ],
  "consentInfo": "analytics opcional permanece desactivado hasta que lo permitas. cambia tu elección aquí cuando quieras. cada origen del sitio recuerda su propia elección 180 días. rechazar no limita el sitio; solo se cuentan visitantes que aceptan. retirar el permiso detiene el tratamiento futuro, sin anular el ya realizado."
};
