# AuditorX

Sube un contrato, factura o presupuesto (PDF o foto) y recibe un semáforo de riesgo con las trampas
detectadas, la comparación con lo legal y un plan de acción.

Next.js 16 (App Router) · Tailwind 4 · Claude Haiku 5.5 · Auth.js · Stripe Checkout · Upstash Redis.

## Arrancar

```bash
cd auditorx
cp .env.example .env.local   # y rellena las claves
npm install
npm run dev                  # http://localhost:3000
```

Para probarlo todo sin ninguna clave: `AUDITORX_MOCK=1 npm run dev` (análisis de ejemplo, login con
cualquier correo y pagos simulados).

## Qué activa cada variable

La app funciona por capas: cada bloque de `.env.example` enciende una parte y el resto sigue
funcionando sin él.

| Bloque | Variables | Sin ellas |
| --- | --- | --- |
| Análisis | `ANTHROPIC_API_KEY`, `SESSION_SECRET` | No arranca |
| Base de datos | `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Solo visitantes anónimos con 2 auditorías gratis; no hay login, compras ni captura de correos |
| Login | `AUTH_GOOGLE_*`, `AUTH_GITHUB_*`, `AUTH_APPLE_*`, `AUTH_RESEND_KEY` + `AUTH_EMAIL_FROM` | No aparece el botón de ese proveedor |
| Pagos | `STRIPE_SECRET_KEY` (+ `STRIPE_WEBHOOK_SECRET`) | La ventana de precios se ve, pero sin botón de compra |
| Informe de interesados | `ADMIN_SECRET` | `/api/admin/leads` responde 401 |

### Base de datos

En Vercel: **Storage → Create Database → Upstash for Redis** y conéctala al proyecto. Las variables
`KV_REST_API_*` se añaden solas.

### Inicio de sesión

URL de retorno que pide cada proveedor: `https://TU-DOMINIO/api/auth/callback/<proveedor>`.

- **Google**: Google Cloud Console → APIs y servicios → Credenciales → ID de cliente OAuth (aplicación web).
- **GitHub**: Settings → Developer settings → OAuth Apps → New OAuth App.
- **Apple**: requiere el Apple Developer Program (de pago). `AUTH_APPLE_ID` es el Services ID y
  `AUTH_APPLE_SECRET` un JWT firmado con tu clave, que caduca como máximo a los 6 meses.
- **Correo**: cuenta en resend.com con un dominio propio verificado (no sirve `*.vercel.app`). El usuario
  recibe un enlace y entra sin contraseña.

### Pagos

Solo hace falta `STRIPE_SECRET_KEY`: los productos y precios se definen en `src/lib/plans.ts` y se
envían a Stripe en cada compra. Activa el **Portal de clientes** en Stripe para que puedan cancelar.
El webhook es opcional: entrega la compra aunque el usuario cierre la pestaña antes de volver.

## Precios (`src/lib/plans.ts`)

| Plan | Auditorías/mes | Mensual | Anual |
| --- | --- | --- | --- |
| Gratis | 2 | — | — |
| Pro | 15 | 0,50 € | 4,99 € |
| Plus | 25 | 0,99 € | 8,99 € |
| Premium | 35 | 1,49 € | 12,99 € |
| Max | 50 | 1,99 € | 17,99 € |

Packs de pago único (no caducan): 10 → 0,50 € · 25 → 0,99 € · 50 → 1,79 € · 100 → 2,99 €.

Stripe no admite cobros inferiores a 0,50 €, por eso no hay pack de 0,30 € y el descuento del 30 % no
se aplica al plan Pro mensual.

## Funciones «próximamente» (fake doors)

Ocho botones (`COMING_SOON` en `src/lib/plans.ts`) abren un aviso de «en construcción» que pide el
correo a cambio de un 30 % de descuento en la primera suscripción. El descuento se aplica solo en el
checkout cuando la cuenta usa ese mismo correo.

Para ver qué funciones interesan más:

```bash
curl -H "Authorization: Bearer $ADMIN_SECRET" https://TU-DOMINIO/api/admin/leads            # clics y correos por función
curl -H "Authorization: Bearer $ADMIN_SECRET" "https://TU-DOMINIO/api/admin/leads?format=csv" # lista de correos
```

## Estructura

```
src/
├── app/
│   ├── page.tsx, layout.tsx, globals.css
│   └── api/
│       ├── audit/route.ts               # archivo → Claude (streaming) → análisis
│       ├── refund/route.ts              # devuelve la auditoría gratis si el análisis falla
│       ├── me/route.ts                  # estado de la cuenta
│       ├── auth/[...nextauth]/route.ts  # inicio de sesión
│       ├── checkout/route.ts            # crea la compra en Stripe
│       ├── checkout/confirm/route.ts    # entrega la compra al volver
│       ├── stripe/webhook/route.ts      # entrega y cancelaciones (opcional)
│       ├── portal/route.ts              # portal de cliente de Stripe
│       ├── interest/route.ts            # clics y correos de «próximamente»
│       └── admin/leads/route.ts         # informe de interesados
├── components/
│   ├── Auditor.tsx                      # pantalla principal
│   ├── ResultView.tsx                   # semáforo + 4 secciones
│   ├── Pricing.tsx, LoginModal.tsx, ComingSoon.tsx, Modal.tsx, TrafficLight.tsx
└── lib/
    ├── audit-prompt.ts, audit-schema.ts # prompt y formato de la respuesta
    ├── plans.ts                         # planes, packs y funciones «próximamente»
    ├── auth.ts                          # Auth.js y proveedores
    ├── account.ts                       # plan, uso y créditos de cada usuario
    ├── billing.ts                       # Stripe
    ├── leads.ts                         # correos de interesados
    ├── store.ts                         # Redis (o memoria en desarrollo)
    ├── session.ts                       # cookie firmada del visitante anónimo
    └── partial-json.ts, image.ts, rate-limit.ts, mock.ts
```

## Limitaciones conocidas

- **Cambio de plan**: para pasar de un plan a otro hay que cancelar el actual desde «Gestionar» y
  suscribirse de nuevo.
- **Visitantes sin cuenta**: su contador gratuito va en una cookie; borrarla lo reinicia.
- **Rate limit en memoria**: protege de ráfagas por instancia, no es un límite global.
- **Tamaño de subida**: Vercel corta el cuerpo de las funciones en 4,5 MB. Las fotos se comprimen
  solas; los PDF grandes no pasan.
- **Textos legales**: la app recoge correos y documentos con datos personales y no incluye política de
  privacidad, aviso legal ni condiciones. Hay que añadirlos antes de captar usuarios reales.
- El análisis es orientativo y está enfocado a normativa española; no sustituye a un abogado.
