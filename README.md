# Combwork — frontend del sistema de captación

Prototipo funcional del sistema completo: landing → calculadora → benchmark → reporte institucional → panel interno del equipo. Sin backend: todo el estado vive en el navegador (`localStorage`), lo suficiente para demostrar el flujo end-to-end y para que diseño y backend trabajen sobre algo concreto.

## Desplegar en Netlify

Arrastra la carpeta completa a Netlify Drop, o conéctala como repo. No hay build step ni dependencias.

- Build command: *(vacío)*
- Publish directory: `/` (la raíz de esta carpeta)

`index.html` está en la raíz, así que Netlify lo sirve como página de entrada.

## Archivos

```
combwork-frontend/
├── index.html        Landing pública. Hero con las 4 escenas del producto en loop.
├── flujo.html        Recorrido del operador, 6 etapas en una sola página.
├── reporte.html      Reporte institucional de 8 páginas, listo para imprimir o guardar como PDF.
├── login.html        Acceso al panel interno.
├── panel.html        Panel del equipo: leads, campañas, benchmarks, ajustes.
├── empresa.html      Quiénes somos · Tecnología · Enfriamiento líquido · Insights.
├── sistema.html      Documento interno — NO enlazado desde el sitio público.
├── marca.html        Documento interno — NO enlazado desde el sitio público.
│                     Historia de marca, dirección de imagen y prompts.
└── assets/
    ├── styles.css    Tokens + componentes. Todo lo demás consume de aquí.
    ├── reporte.css   Maqueta A4 e impresión.
    ├── app.js        Lógica del flujo del operador.
    ├── panel.js      Lógica del panel interno.
    └── logo.svg      Logo provisional.
```

## Credenciales de la demo

Panel interno: **equipo@combwork.io** / **colmena**

## Cómo demostrar el producto en 3 minutos

1. `index.html` → botón «Calcular mi costo de ineficiencia».
2. Llena la calculadora. El resultado se actualiza mientras escribes. Prueba a poner un PUE de `0.8` o de `9` para ver la validación de rango.
3. «Ver mi resultado completo» → el radar aparece bloqueado, con el muro de correo **después** del resultado, no antes.
4. Llena los datos → 7 preguntas del benchmark → dashboard con radar, percentil y las 3 brechas principales.
5. «Generar mi reporte» → «Abrir y descargar el PDF». Se abre `reporte.html` y dispara el diálogo de impresión: elige *Guardar como PDF*.
6. `login.html` → entra al panel. **El lead que acabas de crear ya está en la tabla**, con su segmento, su score y su brecha principal. Eso es lo que hace el producto.

## El PDF

Se genera con el motor de impresión del navegador, sin librerías externas. En el diálogo conviene marcar «Gráficos de fondo» y desactivar encabezados y pies del navegador. Es intencionalmente el camino más simple: el contenido y la maqueta ya están definidos, y cuando backend lo mueva a un worker (Puppeteer o similar) la plantilla se reusa tal cual porque es HTML.

## Datos

| Clave de `localStorage` | Qué guarda |
|---|---|
| `combwork.session` | Recorrido en curso del operador |
| `combwork.leads` | Leads del CRM (muestra + los creados en la demo) |
| `combwork.campaigns` | Campañas de outreach |
| `combwork.reporte` | Snapshot que lee `reporte.html` |
| `combwork.config` | Bloque de contacto del fundador |
| `combwork.auth` | Sesión del panel |

En *Panel → Ajustes* hay botones para recargar los leads de muestra o borrar todo.

## Modelo de cálculo

Consumo anual = `carga de TI (kW) × PUE × 8760 h`. El costo sale de multiplicar por el precio de kWh. El *overhead* del facility, que es la capacidad que se paga y no produce carga útil, es la porción de `PUE − 1`. El ahorro compara contra un PUE objetivo derivado de la arquitectura de enfriamiento y el tier declarados.

El único número heurístico es el retorno: asume una inversión de 320,000 USD por MW de TI. **Ese parámetro hay que sustituirlo con dato real de la empresa** antes de mostrarlo a un cliente; está aislado en la constante `CAPEX_PER_MW` de `assets/app.js`.

## Pendientes conocidos

- Logo definitivo (el hexágono actual ocupa el lugar correcto pero es provisional).
- Animación larga del hero: hoy son 4 escenas en loop, la referencia dura ~30 s.
- Envío de correo y de campañas: simulado.
- El percentil sale de una curva paramétrica, no de una base real de respuestas.


---

## v0.2 — pasada de móvil

Auditado con navegador real a 320, 360, 375, 390, 414 y 768 px, con emulación táctil. Lo que estaba mal y ya no:

| Hallazgo | Por qué importaba | Corrección |
|---|---|---|
| Campos de formulario a 14.5 px | **iOS Safari hace zoom automático** en cualquier campo por debajo de 16 px. Es la causa más común de que una página se sienta rota en iPhone. | Todos los campos a 16 px |
| Áreas táctiles de 26–38 px | Debajo de 44 px el pulgar falla. Afectaba a los pasos del hero, la navegación del panel y varios enlaces. | Bloque `@media (pointer:coarse)` que sube todo lo interactivo a 44 px en dispositivos táctiles |
| `reporte.html` desbordaba horizontalmente | La hoja A4 mide 794 px y `transform: scale` no reduce el espacio que el elemento ocupa en el layout, así que quedaba scroll lateral en todos los teléfonos | Escalado por rangos con márgenes negativos compensatorios |
| `min-height: 100vh` | En Safari móvil `100vh` incluye la barra de direcciones, así que el contenido queda cortado | Añadido `100dvh` con `100vh` como respaldo |
| Leyenda del hero encima del dibujo | El texto y el SVG compartían la misma caja absoluta | La leyenda salió de la caja: ahora el SVG tiene proporción propia y el texto su espacio reservado |
| Sin `viewport-fit=cover` ni safe areas | En iPhone con muesca el contenido se metía debajo del sistema | Meta actualizada y `env(safe-area-inset-*)` en header, footer y navegación del panel |

También: `theme-color` para la barra del sistema en Android, orientación horizontal contemplada, y navegación inferior del panel con respeto a la barra de gestos de iOS.

### Cómo reproducir la auditoría

```
python3 -m http.server 8080      # servir la carpeta
```
Luego, en el navegador, herramientas de desarrollo → modo dispositivo → probar 320 / 375 / 390 / 414. El criterio es simple: `document.documentElement.scrollWidth` nunca debe superar a `clientWidth`.

## Novedades de contenido

- Nueva sección **«De dónde viene el nombre»** en la landing: el teorema del panal como argumento de marca, con un diagrama comparando perímetro de círculo, cuadrado y hexágono.
- **`marca.html`**: historia de marca, seis principios de dirección de imagen, anatomía del prompt, dos bloques fijos de estilo y restricciones, doce prompts listos con su destino en el código, set de doce íconos SVG y lista de aceptación.
- Botones redundantes reducidos: se quitó el cuarto CTA de la landing y se diferenciaron las dos acciones de cierre del flujo.


---

## v0.3 — revisión de diseño

### Accesibilidad, medida

Los botones sí tenían un problema, aunque el fallo grave estaba en otro lado:

| Combinación | Antes | Ahora |
|---|---|---|
| Botón dorado + texto | 5.11:1 (AA justo) | **8.40:1** con `#D6B667` |
| Texto de apoyo `.sub` sobre paper | **2.86:1 — reprobaba AA** | 4.70:1 con `#667062` |
| Pasos del hero inactivos | **3.69:1 — reprobaba AA** | 6.46:1 |

El botón se veía apagado porque `gold-500` es un dorado de acento, no de relleno. Ahora el CTA usa un token propio, `--gold-cta`, más claro, con peso 700 y un reflejo interior superior. La tabla completa quedó documentada en `sistema.html`.

### Hero

La animación abre con **el reporte**, no con la calculadora. El orden nuevo es: *qué te llevas → de dónde sale → contra quién te comparas → el número*. Los campos de formulario falsos desaparecieron: invitaban a hacer clic y competían con el titular.

### Navegación

- **Botón de regreso persistente** en el flujo. Dentro del benchmark retrocede pregunta por pregunta conservando la respuesta; entre etapas, una etapa. Se ocultan los tres botones «atrás» sueltos que estaban repartidos.
- **El CTA del header aparece solo cuando el hero sale de vista.** Antes competía con el CTA principal.
- **El footer se ancla abajo** con `.app-shell`; ya no flota a media pantalla cuando la etapa es corta.
- **Las tarjetas angostas van centradas.** La del benchmark dejaba 348 px de hueco a la derecha.

### Estructura de la landing

Nueva sección **«Cómo funciona»** con los cuatro pasos en tarjetas con ícono, antes que el problema. Dos **slots de arte** para fotografía de data center, con marcador de posición vectorial de marca para que la página no se vea rota antes de generar las imágenes.

### Acceso del equipo

Rediseñado: tarjeta centrada, sin el discurso de captación de leads que estaba público, `noindex`, y credenciales de demo dentro de un `<details>` plegado. Los enlaces al panel salieron del sitio público.

## Arte pendiente

Dos slots esperan imagen. Los prompts 13 y 14 de `marca.html` los generan.

| Archivo | Dónde | Proporción |
|---|---|---|
| `assets/img/dc-01-sala.webp` | Sección «El problema» | 4:5 |
| `assets/img/dc-02-pasillo.webp` | Sección de referencia de PUE | 16:9 |

Para activarlos: sustituir el bloque `.ph` del `<figure>` por `<img src="..." alt="">` y borrar el `<span class="tagname">`.


---

## v0.4 — secciones institucionales y sistema de slots

### Nueva página: `empresa.html`

Cuatro secciones, todas enlazadas desde el header y el footer:

1. **Quiénes somos** — visión y tres pilares (diagnóstico primero, proyección no promesa, del dato a la decisión).
2. **Nuestra tecnología** — el método en tres pasos, más el bloque de divulgación progresiva «Cómo calculamos tu resultado» con tres desplegables y la versión del modelo. Es el requisito R-09 implementado como pieza pública.
3. **Enfriamiento líquido** — profundidad técnica con un gráfico propio de densidad por rack (5 → 130 kW) y el umbral donde el aire deja de alcanzar. Dos tarjetas: placa fría y inmersión.
4. **Insights** — artículo ancla sobre enfriamiento líquido y dos teasers.

### Sistema de slots gráficos

Doce huecos declarados en el código, cada uno con `data-slot`, un comentario `▨ SLOT` y un marcador vectorial de marca que mantiene la página presentable mientras la imagen no existe.

| ID | Página · sección | Proporción | Export |
|---|---|---|---|
| `dc-01-sala` | index · El problema | 4:5 | 1200×1500 |
| `dc-02-pasillo` | index · Referencia de PUE | 16:9 | 1600×900 |
| `emp-01-instalacion` | empresa · Quiénes somos | 21:9 | 2100×900 |
| `met-01-sensor` | empresa · Método 01 | 1:1 | 600×600 · recorte |
| `met-02-modelo` | empresa · Método 02 | 1:1 | 600×600 · recorte |
| `met-03-reporte` | empresa · Método 03 | 1:1 | 600×600 · recorte |
| `liq-01-coldplate` | empresa · Enfriamiento líquido | 16:9 | 1600×900 |
| `liq-02-inmersion` | empresa · Enfriamiento líquido | 16:9 | 1600×900 |
| `ins-01-liquido` | empresa · Insights | 16:7 | 1600×700 |
| `panel-01-vacio` | panel · Estado vacío | 1:1 | 600×600 · recorte |
| `login-01-fondo` | login · Fondo | 2:3 | 1200×1800 |
| `pdf-01-portada` | reporte · Portada | 2:3 | 1240×1754 |

**Para activar un slot:** guarda la imagen en `assets/img/{id}.webp`, sustituye el bloque `.slot-ph` por `<img src="assets/img/{id}.webp" alt="">` y borra el `<span class="slot-id">`. El marco, la proporción y el recorte ya los resuelve el CSS. La tabla vive también en `marca.html#registro`.

### Lenguaje de producto

Fuera toda referencia a simulación, prototipo, entrega escolar y datos de demostración. El footer pasó de una línea de crédito a un footer real de cuatro columnas con producto, compañía y recursos.

### QA

Dos fallos de layout encontrados y corregidos:

- **La regla móvil de tablas** quitaba el scroll horizontal a todas, pero solo las que se convierten en tarjetas (`.table-stack`) pueden prescindir de él. Ahora está acotada con `.is-stacked`.
- **`main` se anchaba a su contenido mínimo.** Un ítem flex con márgenes automáticos en el eje transversal deja de estirarse y se dimensiona por contenido; como `.wrap` lleva `margin: 0 auto`, arrastraba la página a 920 px. Corregido con `width: 100%`.

Auditoría: 8 páginas × 6 anchos = **48 combinaciones, cero desbordes, cero footers flotando, cero errores de JS**.


---

## Nota — sistema.html y marca.html no son parte del producto

Estos dos archivos son **documentación de equipo**, no páginas del sitio. Viven en la misma carpeta solo por conveniencia de entrega en un único zip; ningún operador ni visitante público llega a ellos porque **ningún link del producto apunta ahí** — ni el header, ni el footer, ni ninguna otra página. Se verificó con búsqueda exacta en las seis páginas del sitio: cero referencias.

Para consultarlos, ábrelos directamente desde la carpeta (`sistema.html`, `marca.html`), igual que abrirías un PDF de referencia. Si en algún momento quieres que también dejen de vivir junto al código de producto, se pueden mover a una carpeta `docs/` separada, o entregarse aparte del paquete de despliegue — dímelo y lo dejo así desde la próxima entrega.


---

## v0.5 — paleta viva y widgets propios

### La paleta subió de temperatura

El verde de acción pasó de `#2C5B3E` a **`#18844F`** y el dorado de `#B08A34` a **`#E8A317`**. El lienzo dejó de ser crema y pasó a `#F4F8F1`, con tinte vegetal. Se veía a banco privado; ahora se ve a eficiencia energética.

| Par | Contraste | Estado |
|---|---|---|
| CTA ámbar `#F5BC3E` + tinta | 8.89:1 | AAA |
| Botón primario | 13.35:1 | AAA |
| Verde de acción sobre blanco | 4.72:1 | AA |
| Texto de apoyo sobre lienzo | 4.84:1 | AA |
| Número sobre celda ámbar | 7.08:1 | AA |

Ese último se corrigió en el camino: el blanco sobre ámbar daba 2.17:1 y reprobaba, así que sobre relleno claro el número va en tinta oscura.

### Dos widgets propios — `assets/widgets.js`

SVG puro, sin dependencias, sirven igual en pantalla y en la hoja impresa.

**`Combwork.honeycomb(el, dims, opts)`** — siete celdas hexagonales en racimo 2-3-2, verificado geométricamente: la distancia entre centros del mismo renglón y la diagonal son idénticas (100.46), o sea es un panal real y no hexágonos acomodados a ojo. Cada celda se llena de abajo hacia arriba según el score, con la línea punteada del promedio de industria cruzándola. Se llenan en cascada al entrar en pantalla y son tocables: abren una hoja lateral con el detalle de esa dimensión.

**`Combwork.sankey(el, data, opts)`** — flujo de energía con anchos **estrictamente proporcionales** al gasto. El ramal superior es la carga útil, el inferior lo que no produce, y ese se abre en enfriamiento, distribución y otros. Las cintas aparecen escalonadas.

**`Combwork.countUp(el, valor, opts)`** — los números suben al entrar en pantalla.

Los tres respetan `prefers-reduced-motion`.

### Dónde entraron

| Pantalla | Cambio |
|---|---|
| Flujo, etapa 2 | El resultado en texto se volvió número héroe animado + flujo de energía + tres KPIs |
| Flujo, etapa 5 | El radar cedió el protagonismo al panal de score, con detalle al tocar cada celda |
| Reporte, página 3 | Entró el flujo de energía al resumen ejecutivo |
| Reporte, página 4 | El radar se sustituyó por el panal |

Auditoría: 8 páginas × 6 anchos = **48 combinaciones, cero desbordes, cero footers flotando, cero errores de JS**.


## v0.6 — hero de una sola idea

### Qué cambió y por qué

El hero tenía un carrusel de 4 escenas. Un lector externo confundió el subtítulo de la animación con el CTA — esa es la evidencia de que el carrusel competía con el titular en vez de apoyarlo. Además era **redundante**: las mismas 4 etapas ya están, mejor explicadas, en la sección «Cómo funciona» justo debajo.

Se eliminó. En su lugar entra **un solo gráfico estático**: la escala real de PUE con las tres referencias marcadas y la banda recuperable entre mejores prácticas y promedio de industria. Se dibuja una vez al entrar en pantalla y se queda quieto.

### Titular nuevo

| | |
|---|---|
| Antes | «Descubre cuánto te cuesta la capacidad que no usas.» |
| Ahora | «**37% de la energía se va antes de llegar al servidor.**» |

El 37% no es una estimación nuestra: es aritmética directa sobre el PUE promedio de 1.58 publicado por Uptime Institute. `1 − 1/1.58 = 36.7%`. Se cita la fuente en el propio hero.

### Simplificación

Fuera: 4 escenas, 4 botones de etapa, el subtítulo rotativo y las 3 estadísticas sueltas. Dentro: un CTA grande con meta-texto al lado, una línea de fuente, y el gráfico. De 12 elementos compitiendo a 5.

`Combwork.pueGap(el, opts)` es el widget nuevo, en `assets/widgets.js`. Verificado sin colisiones de texto ni desbordes del lienzo.

Auditoría: 8 páginas × 6 anchos = **48 combinaciones, cero hallazgos**.
