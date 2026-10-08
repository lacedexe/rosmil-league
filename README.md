# ⚾ ROSMIL LEAGUE 0.1 — Plataforma Oficial de Gestión & iSCORE de Béisbol

<p align="center">
  <img src="assets/rosmil-logo.png" alt="ROSMIL Baseball League" width="220">
</p>

<p align="center">
  <b>Sistema integral para la administración de torneos, temporadas, franquicias, rosters reales, perfiles estadísticos tipo Baseball-Reference, comparación entre equipos y anotación jugada a jugada (BAT LOG / iSCORE).</b>
</p>

---

## 📌 Tabla de Contenidos
1. [Novedades en ROSMIL LEAGUE 0.1](#-novedades-en-rosmil-league-01)
2. [Identidad Visual Oficial](#-identidad-visual-oficial)
3. [Filosofía Central del Sistema](#-filosofía-central-del-sistema)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Módulos y Funcionalidades](#-módulos-y-funcionalidades)
   - [Seguridad y Control de Acceso (Modo Administrador vs Espectador)](#1-seguridad-y-control-de-acceso)
   - [Perfiles de Equipos y Roster Real](#2-perfiles-de-equipos-y-roster-real)
   - [Comparador de Equipos y Mejor Rival](#3-comparador-de-equipos-y-mejor-rival)
   - [Perfiles Estadísticos de Jugadores (Estilo Baseball-Reference)](#4-perfiles-estadísticos-de-jugadores)
   - [Sistema de Doble Confirmación](#5-sistema-de-doble-confirmación)
   - [Navegación Global Clickeable](#6-navegación-global-clickeable)
   - [Temporadas y Playoffs](#7-temporadas-y-playoffs)
   - [Tabla de Posiciones (Standings)](#8-tabla-de-posiciones-standings)
   - [Juegos y Calendario](#9-juegos-y-calendario)
   - [Anotador Oficial (BAT LOG / iSCORE)](#10-anotador-oficial-bat-log--iscore)
   - [Líderes de la Liga y Sabermetría](#11-líderes-de-la-liga-y-sabermetría)
6. [Fórmulas y Métricas Implementadas](#-fórmulas-y-métricas-implementadas)
7. [Conexión en la Nube con Firebase](#-conexión-con-firebase-base-de-datos-en-la-nube)
8. [Cómo Ejecutar el Proyecto](#-cómo-ejecutar-el-proyecto)

---

## 🌟 Novedades en ROSMIL LEAGUE 0.1

La versión **0.1** incorpora una actualización estructural profunda:
* **Rosters Reales por Equipo:** Cada jugador pertenece de forma estricta a un equipo asignado (`p.team === teamId`). Si es transferido, el cambio se actualiza inmediatamente en el equipo actual y se preserva el historial en `teamHistory` sin perder estadísticas pasadas.
* **Sistema de Roles y Control de Acceso:** Modo **Espectador** (lectura general) y Modo **Administrador** protegido con PIN (por defecto `admin123`). Únicamente el Administrador puede crear, editar o eliminar temporadas, equipos, atletas o partidos. Las mutaciones son validadas en la interfaz y en el motor lógico.
* **Perfiles Completos de Franquicia:** Cada equipo cuenta con su propia vista detallada que incluye récord automático (`G - P`, `PCT`, carreras anotadas, permitidas y diferencial), roster de atletas y listado de juegos.
* **Comparador Head-to-Head:** Herramienta interactiva para enfrentar dos equipos, ver su balance histórico directo, tendencia reciente y detectar de forma automática al **"Mejor Rival"** (el equipo contra el cual tiene mejor porcentaje de victorias).
* **Perfiles Estadísticos de Jugadores (Baseball-Reference Style):** Estadísticas desglosadas por temporada y acumuladas de carrera, selector interactivo `[ BATEO ] [ PITCHEO ]`, enlace directo a su equipo actual, historial de equipos y resumen de actuación en su último partido.
* **Doble Confirmación Obligatoria:** Modal de dos pasos antes de ejecutar cualquier eliminación de temporadas, equipos, jugadores, juegos o jugadas.
* **Navegación Fluida:** Todos los nombres de jugadores y equipos en cualquier vista (tablas, clasificaciones, resultados, BAT LOG) son clickeables y abren su perfil al instante.

---

## 🎨 Identidad Visual Oficial

El diseño sigue una paleta cromática deportiva de alto contraste y legibilidad óptima:
* **Verde Institucional / Verde Oscuro (`#06190f` / `#0d2818`):** Fondo principal y base de toda la aplicación.
* **Amarillo Dorado (`#facc15`):** Encabezados importantes, títulos de sección, tarjetas principales, acentos destacados y badges.
* **Blanco Nítido (`#ffffff`):** Tipografía principal, números estadísticos, tablas de métricas y datos de alto impacto.

---

## 🧠 Filosofía Central del Sistema

> **"El marcador define quién gana; el BAT LOG define la historia y las estadísticas."**

1. **El marcador general** (`homeScore` vs `awayScore`) alimenta la tabla de posiciones, los récords de los equipos y las series de playoffs.
2. **Las estadísticas individuales de jugadores** proceden de las apariciones al plato registradas en el módulo **BAT LOG / iSCORE**.
3. **No se inventan datos:** Si no hay partidos registrados para un jugador o equipo, el sistema muestra honestamente `0` o `-` sin datos ficticios.

---

## 📁 Estructura del Proyecto

```text
rosmilLeague/
│
├── index.html            # Estructura semántica, vistas de perfil, modales de seguridad y PIN
├── README.md             # Documentación completa de ROSMIL LEAGUE 0.1
├── README.txt            # Resumen en texto plano
│
├── assets/
│   └── rosmil-logo.png   # Logotipo oficial del programa
│
├── css/
│   └── style.css         # Identidad visual (verde, amarillo, blanco), componentes y perfiles
│
└── js/
    ├── firebase-config.js # Configuración y credenciales de Cloud Firestore
    └── app.js             # Motor de cálculo sabermétrico, perfiles, seguridad y eventos
```

---

## 🚀 Módulos y Funcionalidades

### 1. Seguridad y Control de Acceso
- **Botón de Modo en la Barra Superior:** Permite alternar entre `👁️ Modo Espectador` y `🛡️ Modo Administrador`.
- **Autenticación con PIN:** Para pasar a modo Administrador se solicita un PIN de seguridad (por defecto `admin123`, personalizable en la configuración).
- **Protección Visual y Lógica:**
  - En modo Espectador se ocultan visualmente todos los botones de creación, edición y eliminación.
  - Si se intenta invocar una función de guardado o borrado desde código o consola, el sistema rechaza la operación informando que solo el Administrador tiene permisos.

### 2. Perfiles de Equipos y Roster Real
- Al hacer clic en cualquier equipo se abre su perfil con:
  - Logo oficial, nombre y ciudad.
  - **Récord Oficial:** Victorias, Derrotas, PCT, Carreras Anotadas (RS), Carreras Permitidas (RA) y Diferencial (+/-).
  - **Roster Actual:** Lista de jugadores asignados con dorsal, posición, rol y enlace a sus perfiles.
  - **Historial de Partidos:** Encuentros disputados por el equipo con resultados finales.

### 3. Comparador de Equipos y Mejor Rival
- Dentro del perfil de cada equipo se incluye un selector para elegir un rival y compararlos:
  - **Récord General:** Comparativa de victorias, derrotas y efectividad de ambos.
  - **Historial Directo (Versus):** Partidos disputados entre ellos, victorias de cada uno, carreras anotadas y carreras permitidas.
  - **Mejor Rival Detectado:** Cálculo automático del equipo frente al cual tiene mejores resultados históricos (mínimo 1 juego disputado).

### 4. Perfiles Estadísticos de Jugadores
- Vista inspirada en Baseball-Reference:
  - Foto, número de dorsal, posición habitual, lado de bateo y tiro.
  - Enlace al **Equipo Actual** con navegación directa.
  - **Historial de Equipos (`teamHistory`):** Tabla con las temporadas y los equipos en los que ha militado.
  - **Selector [ BATEO ] [ PITCHEO ]:** Permite alternar entre métricas ofensivas y de lanzador en atletas de rol lanzador o Two-Way.
  - **Líneas por Temporada y Totales de Carrera:** Tablas completas con todas las categorías ofensivas y de pitcheo calculadas a partir del BAT LOG.
  - **Resumen del Último Partido:**
    - Bateo: Turnos oficiales, hits (ej. `4-2`), HR, RBI, R, etc.
    - Pitcheo: Entradas lanzadas, carreras limpias, ponches, boletos y efectividad del encuentro.

### 5. Sistema de Doble Confirmación
- Toda acción de borrado requiere pasar por dos confirmaciones en modal:
  1. **Paso 1:** Alerta inicial con opción de Cancelar o Continuar.
  2. **Paso 2:** Advertencia de impacto permanente con botón explícito **"ELIMINAR DEFINITIVAMENTE"**.

### 6. Navegación Global Clickeable
- Cualquier nombre de jugador o equipo que aparezca en el sistema (tablas, partidos, líderes, alineaciones) es interactivo (`.player-link` y `.team-link`) y abre su perfil correspondiente.

### 7. Temporadas y Playoffs
- Creación y edición de temporadas regulares y playoffs al mejor de 3, 5 o 7 juegos.
- Soporte para eliminación de temporadas exclusivo para el administrador con doble confirmación.

### 8. Tabla de Posiciones (Standings)
- Tabla oficial ordenada por porcentaje de victorias (`PCT = G / (G + P)`).

### 9. Juegos y Calendario
- Programación de encuentros por temporada, estadio y fecha con acceso directo al anotador oficial.

### 10. Anotador Oficial (BAT LOG / iSCORE)
- Registro turno por turno de apariciones al plato con outs, carreras, impulsadas, bases robadas y lanzamientos decisivos.

### 11. Líderes de la Liga y Sabermetría
- Ranking dinámico de mejores bateadores y lanzadores según sus métricas acumuladas.

---

## 📊 Fórmulas y Métricas Implementadas

### Métricas Ofensivas
| Sigla | Nombre | Fórmula / Criterio |
|---|---|---|
| **PA** | Plate Appearances | Total de apariciones al plato registradas |
| **AB** | At Bats (Turnos Oficiales) | `PA - (BB + HBP + SF + SH)` |
| **H** | Hits | `Sencillos + Dobles + Triples + Home Runs` |
| **TB** | Total Bases | `(1B × 1) + (2B × 2) + (3B × 3) + (HR × 4)` |
| **AVG** | Batting Average (Promedio) | `H / AB` (mostrado en formato `.000`) |
| **OBP** | On-Base Percentage | `(H + BB + HBP) / (AB + BB + HBP + SF)` |
| **SLG** | Slugging Percentage | `TB / AB` |
| **OPS** | On-Base Plus Slugging | `OBP + SLG` |
| **K%** | Strikeout Rate | `SO / PA` |

### Métricas de Pitcheo
| Sigla | Nombre | Fórmula / Criterio |
|---|---|---|
| **BF** | Batters Faced | Total de bateadores enfrentados |
| **IP** | Innings Pitched | `(Outs ÷ 3) . (Outs % 3)` (ej. 5.1 = 5 entradas y 1 tercio) |
| **ERA** | Earned Run Average (Efectividad) | `(ER × 27) / Outs` (base a 9 innings) |
| **WHIP** | Walks + Hits per Inning | `((BB + H) × 9) / Outs` |

---

## 🔥 Conexión con Firebase (Base de Datos en la Nube)

Arquitectura **híbrida (Offline-First + Cloud Realtime Sync)**:
- **Almacenamiento Local:** Funciona sin internet vía `LocalStorage`.
- **Sincronización en la Nube:** Conectado a **Cloud Firestore** para actualizar cambios en tiempo real entre múltiples dispositivos.
- Configuración en el archivo `js/firebase-config.js`.

---

## 💻 Cómo Ejecutar el Proyecto

1. Abre la carpeta del proyecto en tu equipo:
   ```text
   c:\Users\pinai\Documents\antigravity\rosmilLeague
   ```
2. Abre `index.html` en tu navegador web.
3. Para acceder a las funciones administrativas, haz clic en **`👁️ Modo Espectador`** en la esquina superior e ingresa el PIN `admin123`.

---

*ROSMIL LEAGUE 0.1 — Diseñado para la excelencia del béisbol.*

