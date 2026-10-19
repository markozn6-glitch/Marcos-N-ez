# Billetera Virtual (ERROSYSTEM)

Billetera virtual web, en etapa inicial, que permite guardar y gestionar dinero de
forma segura, ver en un gráfico en qué se gasta y recibir ayuda de un asistente
financiero (chatbot) para dar los primeros pasos. A futuro se proyecta una versión
como aplicación móvil.

Proyecto desarrollado por **SegurityByte**, consultora de desarrollo de software a
medida con seguridad por diseño, como parte de Práctica Profesionalizante.

## Objetivo
Ofrecer una billetera simple y segura para que cualquier persona pueda ordenar sus
finanzas: cargar saldo, registrar gastos, fijar metas de ahorro y transferir a
contactos, todo desde una sola pantalla.

## Público destinatario
Personas que quieren empezar a organizar su dinero, en especial jóvenes y usuarios
sin experiencia previa en billeteras virtuales.

## Funcionalidades
- Registro e inicio de sesión, con recuperación de contraseña por pregunta de seguridad.
- Saldo actual, carga de saldo y simulación de rendimiento (4%).
- Registro de gastos por categoría e historial de movimientos.
- Gráfico de gastos (torta, dona o barras) con vista diaria, semanal y mensual.
- Metas de ahorro.
- Contactos favoritos y transferencias.
- Perfil con alias, CVU y código QR ilustrativo.
- Asistente financiero (chatbot) para consultar saldo, ahorros, transferencias y gastos.
- Ajustes: modo oscuro, temas de color, estilo del gráfico y modo incógnito (oculta el saldo).

## Seguridad
- Validación de fondos: no se puede gastar, ahorrar ni transferir más que el saldo.
- Contraseñas guardadas con hash (SHA-256), no en texto plano.
- Cambio de contraseña y registro de los últimos 3 inicios de sesión.

> Aviso: es un prototipo educativo. Usa datos de prueba y no maneja dinero real.

## Tecnologías utilizadas
- HTML5, CSS3 y JavaScript
- Chart.js 4.4.1 (gráficos)
- Font Awesome 6.5.1 (íconos)
- Google Fonts (Manrope)
- Git y GitHub (control de versiones)
- Trello (gestión del sprint)

## Cómo ejecutar el proyecto
1. Clonar el repositorio:
   `git clone https://github.com/markozn6-glitch/Marcos-N-ez.git`
2. Entrar a la carpeta del proyecto.
3. Abrir `index.html` en el navegador (Chrome, Edge o Firefox).

No requiere instalación. Hace falta conexión a internet para cargar los gráficos,
íconos y tipografías.

## Integrantes
- Nuñez Marcos: Frontend
- Villalba Luciano: UX/UI
- Gomez Matias: DevOps / Infraestructura

Docente: Prof. Martín Frette

## Enlace al sitio


## Estado actual
Prototipo inicial en desarrollo, Sprint [N].
