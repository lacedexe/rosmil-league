ROSMIL LEAGUE — PLATAFORMA OFICIAL DE BÉISBOL (VERSIÓN INTERACTIVA)
======================================================================

DESCRIPCIÓN GENERAL:
ROSMIL LEAGUE es una solución completa para la gestión de ligas, temporadas,
equipos, atletas y anotación jugada por jugada (BAT LOG / iSCORE). 

ESTRUCTURA MODULAR DEL PROYECTO:
- index.html            : Estructura semántica, vistas del sistema y ventanas modales.
- css/style.css         : Estilos visuales, tema oscuro deportivo y diseño responsivo.
- js/firebase-config.js : Credenciales y conexión con la base de datos Firebase Firestore.
- js/app.js             : Lógica interactiva, sincronización en la nube y fórmulas sabermétricas.
- assets/               : Logotipo oficial de ROSMIL LEAGUE (rosmil-logo.png).
- README.md             : Documentación exhaustiva en formato Markdown con tabla de métricas y manual.

FILOSOFÍA CENTRAL:
- El marcador final del juego (visitante vs local) define únicamente la tabla
  de posiciones (G, P, PCT) y las series de playoffs (mejor de 3, 5 o 7).
- Las estadísticas individuales (AVG, OBP, SLG, OPS, ERA, WHIP, etc.) y los
  enfrentamientos cara a cara (Bateador vs Lanzador) nacen EXCLUSIVAMENTE de las
  apariciones al plato registradas en el BAT LOG / iSCORE de cada encuentro.

MÓDULOS INCLUIDOS Y FUNCIONAMIENTO:
1. Inicio (Dashboard):
   - Contadores en tiempo real de equipos, jugadores, temporadas y juegos.
   - Acceso rápido a temporadas activas y partidos recientes.
   - Logotipo oficial de la liga.

2. Temporadas:
   - Formato Liga: Control por número total de juegos programados.
   - Formato Eliminatoria (Playoffs): Series al mejor de 3, 5 o 7 encuentros con
     cálculo automático de victorias y definición de clasificados.

3. Posiciones (Standings):
   - Tabla oficial clasificada por porcentaje de victorias (PCT).

4. Juegos y Calendario:
   - Programación con fecha, hora, estadio, número de juego y rivales.
   - Acceso directo a la hoja de anotación (BAT LOG / iSCORE).

5. Equipos y Rosters:
   - Registro de franquicias, ciudad, manager, carga de logo y vinculación de jugadores.

6. Jugadores y Repertorio:
   - Perfil de atletas con dorsal, posición defensiva, lados B/T (batea y tira),
     rol (bateador, lanzador o two-way), edad, altura, peso y foto.
   - Selección de repertorio de picheos para lanzadores (Recta, Cutter, Sinker,
     Slider, Sweeper, Curva, Cambio, Splitter, Nudillera, etc.).

7. BAT LOG / iSCORE (Anotador Oficial):
   - Registro turno a turno con entrada, mitad alta/baja, bateador y lanzador.
   - Selección de resultado de la jugada (hits, outs, boletos, ponches, sacrificios, errores).
   - Selección del lanzamiento decisivo del pitcher.
   - Registro de outs, carreras impulsadas (RBI), anotadas (R), bases robadas (SB),
     golpeados (HBP) y carreras limpias (ER).
   - Edición y eliminación de jugadas en vivo.
   - Resumen estadístico del juego en tiempo real para ambos equipos.

8. Estadísticas Sabermétricas:
   - Ofensiva: PA, AB, R, H, TB, HR, RBI, BB, SO, SB, AVG, OBP, OPS, K%.
   - Pitcheo: BF, IP (entradas y tercios), H, ER, BB, SO, ERA (a 9 innings), WHIP.

9. Cara a Cara (Bateador vs Lanzador):
   - Análisis de duelos directos con historial de enfrentamientos, promedio,
     frecuencia de ponches y desglose de jugadas.

10. Líderes de la Liga:
    - Tabla de líderes individuales de bateo por AVG.

11. Administración y Almacenamiento:
    - Persistencia 100% en el navegador vía LocalStorage (clave: rosmilLeagueDataV4).
    - Migración automática transparente desde versiones anteriores.
    - Botón de borrado seguro con confirmación previa.

CÓMO EJECUTAR:
Abre directamente 'index.html' en cualquier navegador web moderno (Chrome, Edge,
Firefox, Brave, Safari). No requiere instalación de dependencias ni servidor web.

Para más detalles, consulta el archivo README.md.
