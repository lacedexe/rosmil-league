ROSMIL LEAGUE 0.3 — LIVE SCORING + GAME TRACKING + 2D REPLAY SYSTEM
================================================================================

DESCRIPCIÓN GENERAL:
ROSMIL LEAGUE 0.3 es una actualización mayor que transforma el sistema en una
plataforma completa de transmisión en vivo, seguimiento visual 2D y repetición
interactiva con fotos reales de los atletas.

NOVEDADES DE LA VERSIÓN 0.3:

1. MAPA 2D DEL ESTADIO EN VIVO:
   - Representación gráfica 2D del diamante de béisbol (outfield, infield de arcilla,
     líneas de foul, montículo y almohadillas Home, 1B, 2B, 3B).
   - Animación de trayectoria de pelota y cartel dinámico emergente según la jugada
     (HIT, DOBLE, TRIPLE, HOME RUN, PONCHE, OUT, BB, ERROR, SACRIFICIO).

2. CORREDORES CON FOTOS DE PERFIL REALES:
   - Los jugadores en las bases aparecen con su fotografía oficial registrada en la liga,
     acompañados de su nombre y número de camiseta.
   - Fallback automático con iniciales e identidad de equipo para jugadores sin foto.
   - Soporte para múltiples corredores simultáneos en las almohadillas sin mezclar fotos.
   - Vinculación estricta por PLAYER ID: los cambios de foto se reflejan automáticamente.

3. MOTOR FÍSICO DE AVANCE DE CORREDORES:
   - Single: Bateador a 1B y avance de corredores.
   - Doble: Bateador a 2B, anotan corredores avanzados.
   - Triple: Bateador a 3B, vacía bases anotando carreras.
   - Home Run: Cuadrangular de vuelta completa que limpia las almohadillas.
   - Base por Bolas (BB) / Golpeado (HBP): Avance forzado (incluyendo carrera forzada con bases llenas).
   - Fly de Sacrificio: Carrera impulsada desde 3B con menos de 2 outs.

4. SISTEMA MULTINIVEL DE DESHACER (↩) Y REHACER (↪):
   - Si se comete un error al anotar, el botón "↩ Deshacer" regresa al estado exacto previo:
     outs, carreras, marcador, posiciones de fotos en las bases y estadísticas.
   - Confirmación interactiva previa con foto y detalle de la jugada a revertir.
   - Soporte complementario de "↪ Rehacer".

5. PERSISTENCIA REAL Y RECUPERACIÓN ANTE CIERRES ACCIDENTALES:
   - Solución definitiva al guardado de partidos: auto-guardado en LocalStorage y Firestore en cada acción.
   - Si el usuario recarga o cierra el navegador durante un juego en vivo, el banner
     "PARTIDO EN VIVO ACTIVO" permite reanudarlo exactamente en la entrada, out y corredores donde quedó.
   - Estados de partido: SCHEDULED, LIVE y FINAL.

6. 2D GAME REPLAY & RESUMEN INTELIGENTE:
   - Experiencia de repetición visual en el estadio 2D con fotos de perfil de los jugadores.
   - Controles de reproducción: ⏪ Anterior, ▶ Reproducir / ⏸ Pausar, ⏩ Siguiente y velocidades (0.5x, 1x, 2x).
   - Timeline cronológico clickeable para saltar a cualquier jugada del partido.
   - Tabla Linescore oficial por entradas (Carreras, Hits, Errores).
   - Jugadas Destacadas (Highlights) automáticas (HRs, extrabases, ponches).
   - MVP del Partido calculado matemáticamente a partir del rendimiento real del juego.

7. PLAY-BY-PLAY CON FOTOGRAFÍAS:
   - Lista interactiva de todas las acciones con avatar del bateador, clickeable para posicionar el mapa 2D.

CÓMO EJECUTAR:
Abre el archivo 'index.html' en tu navegador web.
Para acceder a la administración y anotación en vivo, utiliza tu usuario y contraseña configurados de forma privada en Firebase Firestore.

