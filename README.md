# ⚾ ROSMIL LEAGUE 0.2 — Plataforma Oficial de Béisbol

<p align="center">
  <img src="assets/rosmil-logo.png" alt="ROSMIL Baseball League" width="220">
</p>

<p align="center">
  <b>SISTEMA DE PARTIDOS, LINEUPS, ESTADÍSTICAS, RBI, LÍDERES Y ADN</b><br>
  <i>"Tú registras el juego. Nosotros hacemos las estadísticas."</i>
</p>

---

## 📌 Principio Central de ROSMIL LEAGUE 0.2

> **"EL ADMINISTRADOR SOLO REGISTRA LO QUE PASÓ. ROSMIL LEAGUE CALCULA Y ACTUALIZA TODO LO DEMÁS."**

ROSMIL LEAGUE 0.2 elimina por completo la complejidad innecesaria de los scorebooks tradicionales:
- ❌ **Sin conteo de bolas**
- ❌ **Sin conteo de strikes**
- ❌ **Sin conteo manual de lanzamientos**
- ❌ **Sin formularios complejos ni hojas de cálculo**
- ❌ **Sin seleccionar manualmente al bateador ni escribir marcadores**

Por cada turno al bate, la interacción se reduce a:
1. **¿Qué sucedió?** (`HIT` | `DOBLE` | `TRIPLE` | `HOME RUN` | `PONCHE` | `OUT`)
2. **¿Cuántas carreras remolcó?** (`0` | `1` | `2` | `3` | `4` RBI)
3. **Confirmar** ➔ El sistema calcula estadísticas, outs, carreras, actualiza líderes, ranking y ADN, y pasa de forma automática al siguiente bateador.

---

## 🌟 Novedades Principales en la Versión 0.2

### 1. Asistente de Creación de Partido (Wizard de 6 Pasos)
La creación del partido se divide en páginas independientes con navegación guiada:
* **Paso 1 — Datos Generales:** Nombre del partido, competencia/temporada, fecha, hora y estadio.
* **Paso 2 — Configuración del Partido:** Selección interactiva de cantidad de entradas (1 al 9 o personalizado) y límite de outs por media entrada (por defecto: 3).
* **Paso 3 — Selección de Equipos:** Definición de Equipo Local (*Home Team*) y Equipo Visitante (*Away Team*), estableciendo automáticamente el orden del partido (visitante batea en la parte alta; local batea en la parte baja).
* **Paso 4 — Lineup del Equipo Local:** Campo de béisbol interactivo para situar las 9 posiciones en el diamante (`CF`, `LF`, `RF`, `SS`, `2B`, `3B`, `1B`, `P`, `C`) y tabla de orden de bateo del 1 al 9 con botón de autocompletado rápido.
* **Paso 5 — Lineup del Equipo Visitante:** Mismo sistema visual sobre el diamante y orden de bateo oficial para el equipo visitante.
* **Paso 6 — Confirmación y Resumen Oficial:** Tarjeta de verificación completa y botón destacado **`⚾ INICIAR PARTIDO ➔`**.

---

### 2. Consola de Partido en Vivo (Ultra-Rápida y Visual)
Una interfaz táctil diseñada para operar a pie de campo sin fricción:
* **Marcador Superior Dinámico:** Muestra carreras de ambos equipos, estado de bateo ("AL BATE" vs "DEFENSIVA") e indicadores luminosos para los 3 outs de la entrada.
* **Tarjeta de Matchup Activo:** Identifica automáticamente al bateador en turno (según su orden en el lineup) frente al lanzador activo en el montículo.
* **Botones Gigantes de Acción:** Selección con un toque de `HIT`, `DOBLE`, `TRIPLE`, `HOME RUN`, `PONCHE` y `OUT`.
* **Selector Rápido de RBI:** Botones dedicados de `0`, `1`, `2`, `3` y `4` carreras impulsadas. Al seleccionar `PONCHE` u `OUT`, el sistema preselecciona inteligentemente `0 RBI`; en `HOME RUN`, preselecciona `1 RBI`.
* **Continuidad Estricta del Lineup (Regla 26):** El orden al bate nunca se reinicia en el jugador #1 al comenzar una nueva entrada. Si una entrada concluye con el bateador #5, la siguiente entrada para ese equipo inicia automáticamente con el bateador #6.
* **Control Automático de Outs y Fin de Entrada:** Al registrarse el 3er out, se activa la pantalla de transición **`ENTRADA FINALIZADA`** mostrando el marcador parcial y el botón **`SIGUIENTE ENTRADA ➔`**.
* **Sustitución Inmediata de Lanzador:** Botón **`🔄 Cambiar Pitcher`** disponible en todo momento para relevar al lanzador activo sin detener el flujo del juego.
* **Final del Partido:** Al completarse los innings o al pulsar "Finalizar Partido", el sistema proclama al ganador y perdedor y actualiza en cadena toda la base de datos.

---

### 3. ADN del Jugador & Scouting Report Oficial
Cada perfil de atleta cuenta con una sección sabermétrica dinámica inspirada en videojuegos deportivos:
* **Métricas para Bateadores:**
  * 🎯 **Contacto:** Basado en promedio de bateo oficial (AVG) y ratio de hits.
  * 💥 **Poder:** Derivado de cuadrangulares (HR), extrabases y slugging (SLG).
  * 🎯 **Producción:** Eficiencia impulsando carreras (RBI) y carreras anotadas.
  * 🛡️ **Consistencia:** Disciplina en el plato y control de ponches.
  * 🧤 **Defensa:** Asignado según posición defensiva principal.
  * 🔥 **Clutch:** Productividad con corredores y situaciones definitorias.
  * ⚡ **Velocidad:** Basado en bases robadas oficiales.
* **Métricas para Lanzadores:**
  * 🎯 **Control:** Comando de zona y baja tasa de boletos.
  * 🛑 **Ponches:** Ratio de strikeouts conseguidos por outs registrados.
  * 🛡️ **Efectividad (ERA):** Desempeño de carreras limpias permitidas.
  * 🔒 **Dominio (WHIP):** Control de tráfico en bases.
  * ⏳ **Resistencia:** Volumen de entradas lanzadas.
* **Regla Fundamental (Reglas 32 y 39 - No Inventar Estadísticas):** Si un jugador no cuenta con turnos o entradas registradas, el sistema no inventa números y despliega el indicador transparente **`DATOS INSUFICIENTES`**.
* **Diagnóstico de Scouting:** Detección automática de **Fortalezas Principales** (atributos élite) y **Áreas de Desarrollo**.

---

### 4. Líderes de la Liga y Clasificación Automática
Sección de líderes actualizada de inmediato tras cada jugada registrada:
* 👑 **Líder de Bateo (AVG)**
* 💥 **Líder de Hits (H)**
* 🚀 **Líder de Home Runs (HR)**
* 🎯 **Líder de Carreras Impulsadas (RBI)**
* 🛑 **Líder de Ponches Monticulares (SO)**
* 🛡️ **Líderes de Pitcheo / Efectividad (ERA)**

---

### 5. Ranking General de Atletas (Podio de Honor)
Fórmula de valoración integral que pondera el rendimiento ofensivo, defensivo, monticular y logros deportivos:
* **Podio Visual:** Tarjetas destacadas para **#1 ORO 🥇**, **#2 PLATA 🥈** y **#3 BRONCE 🥉** con foto, equipo, puntaje de ADN y líneas principales.
* **Tabla de Clasificación General:** Ranking completo de toda la liga con acceso directo con un clic al ADN de cada deportista.

---

## 🎨 Identidad Visual Oficial

* **Verde Institucional / Diamante (`#06190f` / `#0d2818`):** Fondo principal y estética de estadio nocturno.
* **Amarillo Dorado (`#facc15`):** Acentos, botones de confirmación, podio, indicadores destacados y títulos.
* **Blanco Puro (`#ffffff`):** Tipografía principal, números de marcador y estadísticas sabermétricas.

---

## 📁 Arquitectura del Código

```text
rosmilLeague/
│
├── index.html            # Vistas principales, modal del Wizard (Pasos 1-6), Consola en Vivo y Ranking
├── README.md             # Documentación exhaustiva de ROSMIL LEAGUE 0.2
├── README.txt            # Ficha técnica resumida
│
├── assets/
│   └── rosmil-logo.png   # Logotipo oficial
│
├── css/
│   └── style.css         # Diamante interactivo, luces de outs, barras animadas de ADN, podio y estilos
│
└── js/
    ├── firebase-config.js # Configuración de Google Cloud Firestore
    └── app.js             # Motor central de cálculo, live scoring, continuidad de lineup, ranking y ADN
```

---

## 📊 Fórmulas y Métricas Sabermétricas

### Métricas Ofensivas
| Métrica | Definición | Fórmula |
|---|---|---|
| **PA** | Apariciones al Plato | Total de turnos al bate registrados en la consola |
| **AB** | Turnos Oficiales | `PA - (BB + HBP + SF + SH)` |
| **H** | Hits Conectados | `Sencillos + Dobles + Triples + Cuadrangulares` |
| **TB** | Bases Totales | `(1B × 1) + (2B × 2) + (3B × 3) + (HR × 4)` |
| **AVG** | Promedio de Bateo | `H / AB` (formato `.000`) |
| **SLG** | Slugging | `TB / AB` |
| **OPS** | On-Base Plus Slugging | `OBP + SLG` |
| **RBI** | Carreras Impulsadas | Suma de registros oficiales `0-4 RBI` |

### Métricas de Pitcheo
| Métrica | Definición | Fórmula |
|---|---|---|
| **BF** | Bateadores Enfrentados | Total de turnos registrados frente al pitcher |
| **IP** | Entradas Lanzadas | `(Outs ÷ 3) . (Outs % 3)` (ej. 4.2 entradas) |
| **SO** | Ponches Conectados | Total de strikeouts producidos |
| **ERA** | Efectividad | `(ER × 27) / Outs` (base estándar 9 entradas) |
| **WHIP** | Baserunners por Entrada | `((BB + H) × 9) / Outs` |

---

## ☁️ Sincronización en la Nube (Firebase & Offline-First)

* **Almacenamiento Local Seguro (`LocalStorage`):** Garantiza que todos los datos persistan sin conexión a internet.
* **Cloud Firestore:** Sincronización en tiempo real. Cualquier jugada confirmada en la consola se propaga al instante a todos los dispositivos conectados.

---

## 🚀 Puesta en Marcha

1. Abre el directorio del proyecto:
   ```text
   c:\Users\pinai\Documents\antigravity\rosmilLeague
   ```
2. Ejecuta `index.html` en tu navegador.
3. Para iniciar la creación y gestión de partidos, inicia sesión como **Administrador** pulsando el botón superior con el PIN `admin123`.

---

*ROSMIL LEAGUE 0.2 — Plataforma Oficial de Béisbol.*
