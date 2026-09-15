# Bot de Telegram — Monitorización de cuentas Polymarket

Bot para consultar y vigilar wallets de Polymarket desde Telegram, pensado como
apoyo a análisis de integridad deportiva (Temis). Usa la API pública de datos
de Polymarket (`data-api.polymarket.com`), que no requiere clave de API para
lectura.

**Aviso importante:** este código se ha escrito siguiendo la documentación
pública de la API, pero no ha podido probarse de extremo a extremo porque el
entorno donde se generó no tiene acceso a red. Antes de confiar en él,
pruébalo con una wallet que conozcas (por ejemplo, la de un mercado reciente
cualquiera) y revisa que los datos que devuelve tienen sentido.

## 1. Requisitos

- Node.js 18 o superior (usa `fetch` nativo).
- Una cuenta de Telegram.

## 2. Crear el bot en Telegram

1. Abre una conversación con **@BotFather** en Telegram.
2. Envía `/newbot` y sigue las instrucciones (nombre y usuario del bot).
3. BotFather te dará un **token** con el formato `123456789:AAExxxxxxxxxxx`.
   Guárdalo, es la única credencial que necesitas.

## 3. Instalación

```bash
cd polymarket-telegram-bot
npm install
cp .env.example .env
```

Edita `.env` y pega tu token:

```
TELEGRAM_BOT_TOKEN=123456789:AAExxxxxxxxxxx
```

## 4. Arrancar

```bash
npm start
```

Si todo va bien verás en consola: `Bot en marcha. Comprobando wallets
vigiladas cada 90 segundos.` A partir de ahí puedes escribirle al bot en
Telegram.

Para que quede funcionando de forma continua (no solo mientras tengas el
terminal abierto), despliégalo en algo persistente: un VPS pequeño con `pm2`
o `systemd`, o un servicio tipo Railway/Render. No necesita un dominio ni
HTTPS porque usa *polling* (el bot pregunta a Telegram, no al revés).

## 5. Comandos disponibles

### Consultas puntuales

| Comando | Qué hace |
|---|---|
| `/wallet 0xdireccion` | Posiciones abiertas y valor total de cartera |
| `/actividad 0xdireccion [n]` | Últimas `n` operaciones (por defecto 10, máx. 20) |
| `/mercado 0xconditionId [n]` | Últimas operaciones registradas en un mercado concreto |
| `/holders 0xconditionId [n]` | Mayores posiciones (por lado) en un mercado |

El `conditionId` de un mercado lo puedes sacar de los propios resultados de
`/wallet` o `/actividad` (aparece como `conditionId` en los datos crudos si
inspeccionas la API directamente; en una futura versión se puede mostrar en
los mensajes si te resulta útil).

### Vigilancia continua

| Comando | Qué hace |
|---|---|
| `/vigilar 0xdireccion [etiqueta]` | Añade una wallet a vigilancia en este chat |
| `/dejar 0xdireccion` | Quita una wallet de vigilancia |
| `/vigilancia` | Lista las wallets vigiladas en este chat |
| `/umbral 500` | Marca como ⚠️ ALERTA cualquier operación igual o superior a ese importe en USD (por defecto 1000) |

Al vigilar una wallet, el bot **no** manda el histórico completo: solo avisa
de actividad que ocurra a partir de ese momento. El bucle de fondo comprueba
todas las wallets vigiladas cada `POLL_INTERVAL_MS` (90 segundos por defecto)
y manda un mensaje por cada operación nueva.

## 6. Cómo encaja con el marco de señales de integridad

Cada alerta de vigilancia incluye tipo de operación, mercado, resultado,
importe y hora. Para aplicar el marco de señales que comentamos
(concentración en mercados de bajo volumen, timing sospechoso, wallets
recién creadas, clustering, etc.), lo más práctico es:

- Vigilar wallets concretas ya identificadas como sospechosas (`/vigilar`).
- Usar `/mercado` sobre el `conditionId` de un partido concreto en los días
  previos, para ver si hay operaciones grandes de wallets nuevas o poco
  habituales.
- Ajustar `/umbral` por debajo de lo normal cuando estés vigilando un
  partido de bajo volumen (ligas menores, filiales), donde una operación
  moderada ya es anómala en términos relativos.

## 7. Limitaciones conocidas / próximos pasos

- Persistencia en un fichero JSON (`data/watchlist.json`). Válido para un
  número moderado de wallets; si esto crece mucho, conviene pasar a SQLite.
- No implementa detección automática de "wallet recién creada" ni
  clustering entre wallets (eso requiere cruzar con Polygonscan). Es un buen
  siguiente paso.
- No filtra por deporte/competición: el filtrado por partido de LaLiga hay
  que hacerlo tú mismo, indicando el `conditionId` correspondiente.
- Respeta límites de la API pública con una pequeña pausa entre peticiones,
  pero si vigilas muchas wallets a la vez, considera subir
  `POLL_INTERVAL_MS`.
