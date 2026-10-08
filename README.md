# ⚾ ROSMIL LEAGUE 0.3 — Live Scoring, 2D Stadium & Game Replay System

<p align="center">
  <img src="assets/rosmil-logo.png" alt="ROSMIL Baseball League" width="220">
</p>

<p align="center">
  <b>LIVE SCORING + GAME TRACKING + 2D REPLAY SYSTEM CON FOTOS REALES DE JUGADORES</b><br>
  <i>"El partido es la fuente de la verdad: todo lo que ocurre se representa visualmente, se guarda y alimenta las estadísticas de la liga."</i>
</p>

---

## 🚀 Novedades Principales en ROSMIL LEAGUE 0.3

### 1. 🏟️ Mapa 2D Interactivo del Estadio de Béisbol
* Representación limpia y moderna tipo videojuego con:
  * Jardines (LF, CF, RF)
  * Cuadro de arcilla (*Infield*) y diamante
  * Montículo del lanzador
  * Bases claramente distinguidas: **Home Plate ➔ 1B ➔ 2B ➔ 3B**
* Animación sincronizada de trayectoria de la pelota y carteles dinámicos de jugada:
  * `HIT ⚾`, `DOBLE 🔥`, `TRIPLE ⚡`, `HOME RUN 🚀`, `PONCHE ❌`, `OUT 🛑`, `BASE POR BOLAS 🚶`, `ERROR ⚠️`, `SACRIFICIO ✈️`.

---

### 2. 👤 Corredores con Fotos de Perfil Reales
* **Identidad Visual Completa:** Los corredores en las almohadillas no son círculos genéricos; son las **fotografías reales del perfil de cada jugador**.
* **Identificación del Jugador:** Cada foto muestra su nombre/apellido, número de camiseta y base que ocupa.
* **Fallback Elegante:** Si un jugador todavía no tiene fotografía, se genera un avatar con sus iniciales sin romper el diseño.
* **Vinculación por Player ID:** La relación directa `PLAYER ID ➔ PERFIL ➔ FOTO ➔ EVENTO ➔ POSICIÓN EN EL MAPA` garantiza que al actualizar la foto de un jugador, esta se actualice en toda la aplicación.
* **Múltiples Corredores Simultáneos:** Las tres bases pueden estar ocupadas a la vez con las fotos de diferentes jugadores sin intercambiarse.

---

### 3. 🏃‍♂️ Motor Físico de Avance de Corredores
* **Single (Hit):** Bateador avanza a 1B, corredores avanzan y anota el corredor en 3B.
* **Doble (2B):** Bateador avanza a 2B, anotan corredores de 2B y 3B.
* **Triple (3B):** Bateador avanza a 3B, limpian las bases anotando todos los corredores.
* **Home Run (HR):** El bateador y todos los corredores en base recorren el diamante y anotan carreras; las bases se vacían.
* **Base por Bolas (BB) / Golpeado (HBP):** Bateador avanza a 1B y se produce avance forzado de corredores (incluyendo carreras forzadas con bases llenas).
* **Fly de Sacrificio:** Corredor en 3B anota carrera con menos de 2 outs.
* **Carreras Anotadas:** Todo corredor que anota recibe automáticamente su crédito de carrera anotada (`R`) en su perfil.

---

### 4. ↩️ Sistema Multinivel de Deshacer y ↪️ Rehacer
* **↩ Deshacer:** Si el anotador se equivoca de casilla, pulsar "Deshacer" revierte instantáneamente:
  * Outs
  * Carreras y marcador
  * Posiciones de las fotos de los jugadores en las bases
  * Inning y media entrada
  * Estadísticas del bateador y lanzador
  * Registro del evento en el historial
* **Confirmación de Seguridad:** Cuadro interactivo con el detalle de la jugada a deshacer.
* **↪ Rehacer:** Permite volver a aplicar jugadas deshechas si se cambia de opinión.

---

### 5. 💾 Persistencia Real y Resiliencia ante Cierres Accidentales
* **Auto-guardado Inmediato:** Cada jugada se guarda de manera automática en `localStorage` y en **Firebase Firestore**.
* **Protección ante Cierres de Navegador:** Si la ventana se cierra en el 5to inning con 2 outs y corredores en base, al volver a abrir ROSMIL LEAGUE el banner **`PARTIDO EN VIVO ACTIVO`** permite reanudar el juego exactamente en ese instante con sus fotos en las bases.
* **Estados Oficiales del Partido:** `SCHEDULED`, `LIVE` y `FINAL`.

---

### 6. 🎬 Replay 2D del Partido & Resumen Inteligente
* Disponible desde cada partido en la sección de Juegos mediante el botón **`🎬 Ver Replay 2D`**:
  * **Reproductor Interactivo:** Controles `⏪ Anterior`, `▶ Reproducir / ⏸ Pausar`, `⏩ Siguiente` y velocidades `0.5x`, `1x`, `2x`.
  * **Línea de Tiempo (*Timeline Track*):** Barra cronológica con fichas de cada turno para saltar directamente a cualquier jugada.
  * **Tabla Linescore Oficial:** Marcador entrada por entrada con Carreras (C), Hits (H) y Errores (E).
  * **Jugadas Destacadas (*Highlights*):** Cuadrangulares, batazos oportunos con múltiples remolcadas y ponches clave con foto del protagonista.
  * **🏆 MVP del Partido:** Calculado matemáticamente a partir del rendimiento ofensivo y monticular del encuentro.

---

### 7. 📋 Play-by-Play Interactivo con Fotos
* Feed cronológico completo de apariciones al plato en la consola en vivo y en la repetición:
  * Fotografía en miniatura de cada bateador
  * Entrada y parte (Alta / Baja)
  * Resultado con etiqueta de color (`Single`, `Double`, `Triple`, `Home Run`, `Walk`, `Strikeout`, `Out`)
  * Carreras impulsadas (`+1 RBI`, `+2 RBI`, etc.)
  * Al hacer clic sobre cualquier jugada, el estadio 2D se posiciona en ese momento exacto.

---

## 🛠️ Cómo Iniciar la Aplicación

1. Clona el repositorio o abre la carpeta del proyecto.
2. Abre `index.html` en cualquier navegador web moderno.
3. Para operar como Administrador y registrar partidos en vivo, haz clic en el botón superior derecho e introduce el PIN por defecto:
   ```text
   admin123
   ```
