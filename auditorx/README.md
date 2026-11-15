# AuditorX

Sube un contrato, factura o presupuesto (PDF o foto) y recibe en segundos un semáforo de riesgo
con las trampas detectadas, la comparación con lo legal y un plan de acción.

Next.js 16 (App Router) · Tailwind 4 · Claude Haiku 5.5 · Stripe Checkout. Sin base de datos.

## Arrancar

```bash
cd auditorx
cp .env.example .env.local   # y rellena las claves
npm install
npm run dev                  # http://localhost:3000
```

Para ver la interfaz sin ninguna clave: `AUDITORX_MOCK=1 npm run dev` (devuelve un análisis de ejemplo
y el pago es simulado).

## Variables de entorno

| Variable | Obligatoria | Para qué |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Sí | Clave de la API de Anthropic ([console.anthropic.com](https://console.anthropic.com/settings/keys)). |
| `SESSION_SECRET` | Sí en producción | Firma la cookie de sesión. `openssl rand -hex 32`. |
| `STRIPE_SECRET_KEY` | Para cobrar | Clave secreta de Stripe (`sk_test_…` / `sk_live_…`). Sin ella, el pago es simulado. |
| `STRIPE_PRICE_MONTHLY` | Para cobrar | ID del precio recurrente mensual (0,50 €). |
| `STRIPE_PRICE_YEARLY` | No | ID del precio anual (4,99 €). Si falta, solo se ofrece el mensual. |
| `APP_URL` | Recomendada | URL pública para las redirecciones de Stripe. |
| `FREE_MONTHLY_LIMIT` | No | Auditorías gratis al mes (por defecto 2). |
| `PRO_MONTHLY_LIMIT` | No | Auditorías Pro al mes (por defecto 15; `0` = ilimitadas). |
| `ANTHROPIC_MODEL` | No | Por defecto `claude-haiku-5-5`. |
| `AUDITORX_MOCK` | No | `1` = análisis de ejemplo sin llamar a Claude. |

### Configurar Stripe

1. En el panel de Stripe: **Productos → Añadir producto** "AuditorX Pro".
2. Añade dos precios recurrentes en EUR: 0,50 €/mes y 4,99 €/año. Copia sus IDs (`price_…`).
3. Activa el **Portal de clientes** (Configuración → Facturación) para que puedan cancelar.

No hace falta la clave publicable ni webhook: se usa Checkout alojado por Stripe y el estado de la
suscripción se consulta directamente a Stripe (cacheado una hora).

## Estructura

```
auditorx/
├── .env.example
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Pantalla única
│   │   ├── globals.css                   # Tokens de Tailwind y animaciones
│   │   └── api/
│   │       ├── audit/route.ts            # Recibe el archivo → Claude → JSON del análisis
│   │       ├── me/route.ts               # Estado de la cuenta (plan, uso)
│   │       ├── checkout/route.ts         # Crea la sesión de Stripe Checkout
│   │       ├── checkout/confirm/route.ts # Verifica el pago y activa Pro
│   │       └── portal/route.ts           # Portal de cliente de Stripe
│   ├── components/
│   │   ├── Auditor.tsx                   # Landing, subida, categoría, carga
│   │   ├── ResultView.tsx                # Semáforo + 4 secciones
│   │   ├── TrafficLight.tsx
│   │   └── Paywall.tsx
│   └── lib/
│       ├── audit-prompt.ts               # Prompt de sistema del auditor
│       ├── audit-schema.ts               # Esquema Zod de la respuesta
│       ├── billing.ts                    # Stripe, plan y límites
│       ├── session.ts                    # Cookie firmada (HMAC) con el contador
│       ├── rate-limit.ts                 # Freno por IP en memoria
│       ├── image.ts                      # Compresión de fotos en el navegador
│       └── mock.ts
```

## Cómo funciona

- **Análisis**: `POST /api/audit` valida el archivo, lo envía a Claude como bloque `document` (PDF) o
  `image`, y exige la respuesta con salida estructurada (`output_config.format` + Zod), así que el JSON
  siempre encaja con la interfaz. El archivo solo vive en memoria durante la petición.
- **Velocidad**: las fotos se reducen a 2000 px en el navegador antes de subir y Claude se llama con
  `effort: "low"`.
- **Límites**: el contador mensual va en una cookie `httpOnly` firmada. La cuota se comprueba en el
  servidor antes de gastar tokens y solo cuentan los análisis entregados.
- **Pro**: tras el pago, Stripe redirige a `/api/checkout/confirm`, que verifica la sesión contra la
  API de Stripe y guarda el `customerId` en la cookie.

## Limitaciones conocidas

- **Sin cuentas de usuario**: Pro va ligado al navegador donde se pagó. Si el usuario borra las cookies
  o cambia de dispositivo, pierde el acceso (y el contador gratuito se reinicia). El siguiente paso
  natural es un login por enlace mágico + webhook de Stripe con una base de datos pequeña.
- **Rate limit en memoria**: en serverless con varias instancias, sustitúyelo por Upstash/KV.
- **Tamaño de subida**: el límite es 10 MB, pero Vercel corta el cuerpo de las funciones en 4,5 MB.
  Las fotos se comprimen solas; los PDF grandes necesitarían subida directa a almacenamiento.
- **Márgenes**: Stripe cobra una comisión fija por transacción que se come buena parte de 0,50 €.
  El plan anual es el que sale rentable; por eso aparece preseleccionado.
- El análisis es orientativo y está enfocado a normativa española; no sustituye a un abogado.
