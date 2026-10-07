# ⚾ ROSMIL LEAGUE — Plataforma Oficial de Gestión & iSCORE de Béisbol

<p align="center">
  <img src="assets/rosmil-logo.png" alt="ROSMIL Baseball League" width="220">
</p>

<p align="center">
  <b>Sistema integral para la administración de torneos, temporadas, franquicias, rosters, anotación de partidos jugada a jugada (BAT LOG / iSCORE) y métricas sabermétricas avanzadas.</b>
</p>

---

## 📌 Tabla de Contenidos
1. [Descripción General](#-descripción-general)
2. [Filosofía Central del Sistema](#-filosofía-central-del-sistema)
3. [Estructura del Proyecto](#-estructura-del-proyecto)
4. [Módulos y Funcionalidades](#-módulos-y-funcionalidades)
   - [Inicio (Dashboard)](#1-inicio-dashboard)
   - [Temporadas y Playoffs](#2-temporadas-y-playoffs)
   - [Tabla de Posiciones (Standings)](#3-tabla-de-posiciones-standings)
   - [Juegos y Calendario](#4-juegos-y-calendario)
   - [Anotador Oficial (BAT LOG / iSCORE)](#5-anotador-oficial-bat-log--iscore)
   - [Gestión de Equipos y Roster](#6-gestión-de-equipos-y-roster)
   - [Ficha de Jugadores y Repertorio](#7-ficha-de-jugadores-y-repertorio)
   - [Estadísticas Sabermétricas](#8-estadísticas-sabermétricas)
   - [Cara a Cara (Bateador vs Lanzador)](#9-cara-a-cara-bateador-vs-lanzador)
   - [Líderes de la Liga](#10-líderes-de-la-liga)
   - [Administración y Datos Locales](#11-administración-y-datos-locales)
5. [Fórmulas y Métricas Implementadas](#-fórmulas-y-métricas-implementadas)
6. [Cómo Ejecutar el Proyecto](#-cómo-ejecutar-el-proyecto)
7. [Próximas Mejoras (Roadmap)](#-próximas-mejoras-roadmap)

---

## 📖 Descripción General

**ROSMIL LEAGUE** es una aplicación web interactiva desarrollada para ligas, torneos y academias de béisbol. Su diseño está inspirado en interfaces deportivas de primer nivel, con un tema oscuro moderno, detalles en rojo vibrante, tipografía nítida (*Inter*) y una arquitectura modular desacoplada en archivos limpios de **HTML5**, **CSS3** y **JavaScript (ES6+)**.

La plataforma permite gestionar todo el ciclo de vida de un campeonato: desde la fundación de equipos y registro de atletas con fotos y logos, hasta la programación del calendario, control de series de postemporada y la anotación turno por turno de cada partido.

---

## 🧠 Filosofía Central del Sistema

> **"El marcador define quién gana; el BAT LOG define la historia y las estadísticas."**

A diferencia de sistemas genéricos donde el usuario ingresa números arbitrarios para cada jugador, en **ROSMIL LEAGUE**:
1. **El marcador general** (`homeScore` vs `awayScore`) únicamente alimenta la tabla de posiciones (ganados, perdidos y porcentaje de victorias) y el estado de las series de postemporada.
2. **Las estadísticas individuales y enfrentamientos directos** se derivan **exclusivamente** de las apariciones al plato registradas en el módulo **BAT LOG / iSCORE**.
3. Si un partido termina 10 - 2 pero no se ha cargado el BAT LOG, los jugadores no acumulan hits, turnos ni carreras limpias hasta que se registre cada jugada. Esto garantiza la integridad y veracidad de cada número.

---

## 📁 Estructura del Proyecto

El código está organizado de manera modular y limpia:

```text
rosmilLeague/
│
├── index.html            # Estructura semántica, vistas y modales interactivos
├── README.md             # Documentación exhaustiva en formato Markdown
├── README.txt            # Resumen en texto plano
│
├── assets/
│   └── rosmil-logo.png   # Logotipo oficial del programa
│
├── css/
│   └── style.css         # Hoja de estilos completa, variables CSS y diseño responsivo
│
└── js/
    └── app.js            # Motor lógico, almacenamiento, cálculos sabermétricos y DOM
```

---

## 🚀 Módulos y Funcionalidades

### 1. Inicio (Dashboard)
- Resumen en tiempo real mediante tarjetas de métricas: número total de equipos, jugadores inscritos, temporadas y juegos registrados.
- Banner institucional de bienvenida con el logotipo oficial de **ROSMIL LEAGUE**.
- Vista rápida de las temporadas activas y de los partidos más recientes.

### 2. Temporadas y Playoffs
- **Modalidad Liga:** Definición de temporadas regulares especificando fechas de inicio, culminación y número total de juegos pactados.
- **Modalidad Eliminatoria:** Creación de fases de playoffs y series al mejor de **3**, **5** o **7** encuentros.
- **Seguimiento dinámico de series:** El sistema calcula automáticamente las victorias de cada equipo en la serie (`winsA` vs `winsB`) a partir de los resultados de los juegos asociados y declara al ganador cuando alcanza la mayoría necesaria.

### 3. Tabla de Posiciones (Standings)
- Tabla oficial ordenada dinámicamente por porcentaje de victorias (`PCT = G / (G + P)`).
- Registro de Juegos Ganados (G), Juegos Perdidos (P) y Porcentaje de Efectividad.

### 4. Juegos y Calendario
- Registro completo de enfrentamientos: selección de temporada, serie vinculada (si aplica), fecha, hora, estadio, número de juego y equipos (local y visitante).
- Visualización de tarjetas de partido con marcadores, estatus del BAT LOG (pendiente o completo) y acceso inmediato a la hoja de anotación.

### 5. Anotador Oficial (BAT LOG / iSCORE)
El corazón estadístico del sistema:
- **Registro de Apariciones al Plato (PA):**
  - Entrada (*Inning*) y Mitad (Alta / Visitante vs. Baja / Local).
  - Selección inteligente de bateador según el equipo al bate.
  - Selección inteligente de lanzador según el equipo a la defensiva.
  - Resultado de la jugada: Sencillo, Doble, Triple, Home Run, Base por bolas, Golpeado por lanzamiento, Ponche tirándole, Ponche cantado, Rodado, Elevado, Línea, Sacrificio de fly, Toque de sacrificio, Error o Fielder's Choice.
  - Selección del picheo decisivo según el repertorio real del lanzador en turno.
  - Outs generados (calculados automáticamente con posibilidad de ajuste manual).
  - Carreras anotadas (R), Carreras impulsadas (RBI), Bases robadas (SB), Golpeados (HBP) y Carreras limpias permitidas (ER).
- **Libro de jugadas:** Visualización cronológica del partido con opciones para editar o eliminar cada aparición.
- **Resumen en vivo:** Tarjetas estadísticas de bateadores y lanzadores del partido en tiempo real.

### 6. Gestión de Equipos y Roster
- Creación y edición de franquicias deportivas: nombre, ciudad, manager y carga de logo personalizado en formato de imagen (almacenado en Base64).
- Asignación interactiva del roster: vinculación de jugadores creados a cada equipo.

### 7. Ficha de Jugadores y Repertorio
- Perfiles de atletas completos:
  - Nombre completo y número de dorsal.
  - Rol deportivo: **Bateador**, **Lanzador** o **Two-Way** (lanzador y bateador).
  - Posición defensiva habitual (P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH).
  - Lados de bateo y fildeo: Batea (Derecho / Izquierdo / Ambidiestro) y Tira (Derecho / Izquierdo).
  - Datos biométricos: Edad, Altura y Peso.
  - Foto del jugador con vista previa instantánea.
  - **Catálogo de lanzamientos:** Para los pitchers, selección de su repertorio personal (Recta de 4 costuras, 2 costuras, Sinker, Cutter, Slider, Sweeper, Curva, Knuckle Curve, Cambio, Circle Change, Splitter, Forkball, Nudillera). Estos lanzamientos alimentan el selector del BAT LOG.

### 8. Estadísticas Sabermétricas
- Tabla consolidada de métricas individuales calculadas en tiempo real.
- Columnas detalladas tanto para ofensiva como para pitcheo.
- Acceso directo a la herramienta comparativa Cara a Cara.

### 9. Cara a Cara (Bateador vs Lanzador)
- Selector cruzado entre cualquier bateador y lanzador de la liga.
- Análisis de duelos directos:
  - Total de apariciones entre ambos (`PA`).
  - Turnos oficiales (`AB`), Hits conectados (`H`), Promedio de bateo en el duelo (`AVG`).
  - Ponches propinados (`SO`), Cuadrangulares (`HR`), Boletos (`BB`) y Porcentaje de ponches (`K%`).
  - Resumen visual de distribución de resultados.
  - Historial detallado con fecha, partido, entrada, resultado y tipo de picheo.

### 10. Líderes de la Liga
- Ranking dinámico de los mejores bateadores por promedio de bateo (`AVG`), mostrando hits, jonrones, carreras impulsadas y ponches.

### 11. Administración y Datos Locales
- Panel centralizado con accesos rápidos para registrar equipos, jugadores, temporadas y partidos.
- **Persistencia en LocalStorage:** Clave `rosmilLeagueDataV4`, sin necesidad de servidores externos ni configuraciones complejas de base de datos.
- **Migración inteligente:** Si existen registros de versiones previas (`V2` o `V3`), la aplicación los migra automáticamente preservando franquicias y jugadores.
- **Botón de Borrado Seguro:** Permite reiniciar la base de datos previa confirmación del usuario.

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
| **OBP** | On-Base Percentage (Porcentaje de embasado) | `(H + BB + HBP) / (AB + BB + HBP + SF)` |
| **SLG** | Slugging Percentage | `TB / AB` |
| **OPS** | On-Base Plus Slugging | `OBP + SLG` |
| **K%** | Strikeout Rate | `SO / PA` (expresado en porcentaje) |

### Métricas de Pitcheo
| Sigla | Nombre | Fórmula / Criterio |
|---|---|---|
| **BF** | Batters Faced (Bateadores enfrentados) | Total de apariciones contra el lanzador |
| **IP** | Innings Pitched (Entradas lanzadas) | `(Outs ÷ 3) . (Outs % 3)` (ej. 5.1 = 5 entradas y 1 tercio) |
| **ERA** | Earned Run Average (Efectividad) | `(ER × 27) / Outs` (calculado a base de 9 innings) |
| **WHIP** | Walks and Hits per Inning Pitched | `((BB + H) × 9) / Outs` |

---

## 🔥 Conexión con Firebase (Base de Datos en la Nube)

El sistema cuenta con una arquitectura **híbrida (Offline-First + Cloud Realtime Sync)**:
- **Sin configurar Firebase:** Funciona automáticamente con almacenamiento local en el navegador (`LocalStorage`).
- **Con Firebase configurado:** Sincroniza todos los datos en tiempo real en la nube con **Cloud Firestore**, permitiendo que varios dispositivos (computadoras, tablets o celulares) anoten o consulten partidos simultáneamente.

### Pasos para conectar tu proyecto de Firebase:

1. **Crear la base de datos Firestore en Firebase:**
   - Entra a tu proyecto en la [Consola de Firebase](https://console.firebase.google.com/).
   - En el menú lateral izquierdo, haz clic en **Compilación (Build)** -> **Firestore Database**.
   - Haz clic en **Crear base de datos**.
   - Selecciona la ubicación de tu preferencia (ej. `nam5 (us-central)`).
   - En **Reglas de seguridad**, selecciona **Comenzar en modo de prueba** (permite lectura y escritura inmediata mientras configuras tu liga) y presiona **Habilitar**.

2. **Obtener las credenciales de tu aplicación Web:**
   - En la página principal de tu proyecto en Firebase, haz clic en el ícono de engranaje ⚙️ (Configuración del proyecto) -> **General**.
   - Desplázate hacia abajo hasta la sección **Tus apps** y haz clic en el ícono Web `</>`.
   - Escribe un nombre para la app (ejemplo: `ROSMIL League Web`) y haz clic en **Registrar app**.
   - Verás un bloque de código con un objeto llamado `firebaseConfig`.

3. **Pegar las credenciales en el archivo de configuración:**
   - Abre el archivo `js/firebase-config.js` en tu editor de código.
   - Reemplaza los valores con las credenciales que te proporcionó Firebase:
     ```javascript
     const firebaseConfig = {
       apiKey: "AIzaSy...",
       authDomain: "tu-proyecto.firebaseapp.com",
       projectId: "tu-proyecto",
       storageBucket: "tu-proyecto.appspot.com",
       messagingSenderId: "123456789...",
       appId: "1:123456789:web:abcdef..."
     };
     ```
   - Guarda el archivo.

4. **¡Listo!**
   - Abre o recarga `index.html`.
   - En la barra superior verás el indicador cambiar a: **`🟢 En la nube (Firebase)`**.
   - Todos los cambios, equipos, partidos y anotaciones del BAT LOG se sincronizarán en vivo en la nube.

---

## 💻 Cómo Ejecutar el Proyecto

No se requiere instalar Node.js, PHP ni ninguna base de datos externa. 

1. Abre la carpeta del proyecto en tu equipo:
   ```text
   c:\Users\pinai\Documents\antigravity\rosmilLeague
   ```
2. Haz doble clic en el archivo `index.html` para abrirlo en tu navegador favorito (Google Chrome, Microsoft Edge, Firefox, Brave o Safari).
3. ¡Listo! Comienza creando tus equipos, añadiendo jugadores y registrando tus temporadas y partidos.

---

## 🗺️ Próximas Mejoras (Roadmap)

- [ ] **Hoja de anotación visual de diamantes:** Representación gráfica de corredores en base (1B, 2B, 3B) y conteo de bolas y strikes en vivo.
- [ ] **Spray Chart (Mapa de batazos):** Coordenadas de dispersión de batazos hacia el cuadro y los jardines.
- [ ] **Exportación / Importación:** Guardar copias de respaldo completas en archivos `.json` para compartir entre diferentes dispositivos.
- [ ] **Box Score Imprimible:** Generación de hojas oficiales en formato PDF o vista de impresión para planilleros y prensa.
- [ ] **Pitch Count & Rest Days:** Alertas automáticas de conteo de lanzamientos y días de descanso reglamentarios para lanzadores jóvenes.

---

*Desarrollado para la excelencia del béisbol con **ROSMIL LEAGUE**.*
