ROSMIL LEAGUE 0.1 — PLATAFORMA OFICIAL DE BÉISBOL (VERSIÓN INTERACTIVA)
======================================================================

DESCRIPCIÓN GENERAL:
ROSMIL LEAGUE 0.1 es una solución completa para la gestión de ligas, temporadas,
equipos con rosters reales, perfiles estadísticos de atletas tipo Baseball-Reference,
comparación cara a cara entre franquicias y anotación jugada a jugada (BAT LOG / iSCORE).

NOVEDADES DE LA VERSIÓN 0.1:
1. Rosters Reales: Los jugadores mostrados en cada equipo son exclusivamente los
   asignados a dicho equipo. Al ser transferidos, conservan su historial en teamHistory.
2. Control de Acceso de Administrador: Modo Espectador (solo lectura) y Modo Administrador
   protegido por PIN (default: admin123). Solo el admin puede crear, editar o eliminar.
3. Perfiles de Equipos: Récord calculado en vivo (G-P, PCT, RS, RA, +/-), listado de juegos
   y roster con enlaces directos a los atletas.
4. Comparador de Equipos y Mejor Rival: Selector de rivales con historial versus directo
   y cálculo automático del rival al que mejor le juega.
5. Perfiles de Jugadores (Baseball-Reference): Desglose por temporadas y totales,
   selector [ BATEO ] [ PITCHEO ], equipo actual clickeable, historial y último partido.
6. Doble Confirmación: Modal obligatorio de 2 pasos para cualquier borrado.
7. Navegación Clickeable: Todo nombre de atleta o franquicia abre su perfil individual.
8. Nueva Identidad Visual: Fondo Verde Béisbol, secciones y tarjetas en Amarillo Dorado,
   y estadísticas y números en Blanco Nítido.

ESTRUCTURA MODULAR DEL PROYECTO:
- index.html            : Estructura semántica, vistas de perfil y modales de seguridad.
- css/style.css         : Identidad visual verde/amarillo/blanco, componentes y perfiles.
- js/firebase-config.js : Credenciales y conexión con la base de datos Firebase Firestore.
- js/app.js             : Motor lógico, cálculo de récords, perfiles, seguridad y eventos.
- assets/               : Logotipo oficial de ROSMIL LEAGUE (rosmil-logo.png).
- README.md             : Documentación completa en formato Markdown.
- README.txt            : Este archivo de resumen.

FILOSOFÍA CENTRAL:
- El marcador general define la tabla de posiciones y el récord de los equipos.
- Las estadísticas individuales y versus directos proceden EXCLUSIVAMENTE de las
  apariciones al plato registradas en el BAT LOG / iSCORE de cada encuentro.
- Los datos son 100% consistentes y no se inventan números.

CÓMO EJECUTAR:
Abre directamente 'index.html' en cualquier navegador web moderno (Chrome, Edge,
Firefox, Brave, Safari).
Para funciones administrativas, haz clic en 'Modo Espectador' en la barra superior
e ingresa el PIN 'admin123'.
