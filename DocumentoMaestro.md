# Documento Maestro – MVP “Solicitudes de Crédito Multi-País”

## Objetivo
Construir un producto mínimo viable (MVP) que cumpla los 8 requisitos funcionales listados abajo, sin sacrificar calidad ni escalabilidad futura.

## 0. Índice de Requisitos

1. Crear solicitudes de crédito.
2. Validar reglas de negocio específicas por país.
3. Integrarse con proveedores bancarios distintos según país.
4. Consultar solicitudes individuales.
5. Listar solicitudes filtradas por país.
6. Actualizar el estado de una solicitud.
7. Procesar lógica de negocio en segundo plano y en paralelo.
8. Mostrar información en tiempo (casi) real en el frontend.

---

## 1. Arquitectura de Alto Nivel (actualizada)
**Patrón:** Event-Driven + Poly-repo (1 repo por servicio)

Stack sugerido:

- Backend: Node 20 + NestJS (TypeScript)
- Cola: Redis Streams (o AWS SQS si usas cloud)
- DB: PostgreSQL (row-level security por país)
- Cache: Redis
- Frontend: React 18 + Vite + Socket.io-client
- Infra: Docker + Terraform + GitHub Actions
- Bank-Connector-Service (Node) – expone puerto 8080 por país
- Risk-Worker (Node.js) – WebAssembly (WASM)
- Audit-Generator (Node.js) – CDC vía Debezium
- Webhook-Dispatcher (Node) – salida hacia bancos / partners

```text
┌-------------┐ HTTPS  ┌--------------┐
│  Front React│<------>│Gateway + WSS │
└------┬------┘        └-----┬--------┘
       │Socket.IO            │REST
       ▼                      ▼
┌--------------┐     ┌-----------------┐
│Core-Requests │     │Bank-Connector-X │
│  Service     │     │(1 por país)     │
└--┬-------┬---┘     └--------┬--------┘
   │PG LISTEN│                │webhook in/out
   └---------┘                ▼
┌----------------┐    ┌------------------┐
│Risk-Worker     │    │Webhook-Dispatcher│
└----------------┘    └------------------┘
```

---

## 2. Modelo de Dominio (DDD)
**Agregado principal:** CreditRequest  
**Entidades:** Customer, Document, BankProvider, CountryRule, StatusTimeline  
**Value-Objects:** Amount, Score, RFC, CURP, IBAN, etc.

**Regla de oro:** Cada agregado tiene un “country” tag que actúa como tenant lógico para filtros y validaciones.

---

## 3. Contratos de API (OpenAPI 3.1)
### 3.1 POST /requests
**Body:**
```json
{
  "country": "MX",
  "customer": { "name": "...", "rfc": "..." },
  "amount": 15000,
  "currency": "MXN",
  "documents": ["base64..."]
}
```
**Response 202:** `{ "requestId": "uuid", "status": "VALIDATING" }`

### 3.2 GET /requests/:id
**Headers:** `X-Country: MX` (middleware de seguridad)  
**Response 200:** objeto completo + timeline de estados.

### 3.3 GET /requests?country=MX&status=APPROVED&from=2026-04-01
Paginado con cursores (último id).

### 3.4 PATCH /requests/:id/status
Body: `{ "status": "APPROVED", "comment": "..." }`  
Sólo usuarios con rol `underwriter` y país coincidente.

---

## 4. Motor de Reglas – Archivos por País
### 4.1 Ubicación
`/rules/{country}/rules.yaml` montados como `ConfigMap` en K8s.

### 4.2 México – MX
```yaml
# rules/MX/rules.yaml
- name: curp_required
  conditions:
    all:
      - fact: customer.curp
        operator: notEqual
        value: null
  event:
    type: reject
    params: { reason: "CURP_MISSING" }

- name: curp_format
  conditions:
    all:
      - fact: customer.curp
        operator: pattern
        value: "^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9]{2}$"
  event:
    type: reject
    params: { reason: "CURP_INVALID_FORMAT" }

- name: income_vs_amount
  conditions:
    all:
      - fact: customer.monthlyIncome
        operator: greaterThan
        value: 0
      - fact: request.amount
        operator: lessThanOrEqual
        value: "{customer.monthlyIncome * 12}"   # máximo 12 meses de sueldo
  event:
    type: reject
    params: { reason: "AMOUNT_EXCEEDS_12_MONTHS" }
```

### 4.3 Colombia – CO
```yaml
# rules/CO/rules.yaml
- name: cc_required
  conditions:
    all:
      - fact: customer.cc
        operator: notEqual
        value: null
  event:
    type: reject
    params: { reason: "CC_MISSING" }

- name: debt_vs_income
  conditions:
    all:
      - fact: bankInfo.totalDebt
        operator: lessThan
        value: "{customer.monthlyIncome * 0.7}"   # deuda < 70 % ingreso
  event:
    type: reject
    params: { reason: "DEBT_TOO_HIGH" }
```

### 4.4 Brasil – BR
```yaml
# rules/BR/rules.yaml
- name: cpf_required
  conditions:
    all:
      - fact: customer.cpf
        operator: notEqual
        value: null
  event:
    type: reject
    params: { reason: "CPF_MISSING" }

- name: cpf_check_digits
  conditions:
    all:
      - fact: customer.cpf
        operator: custom
        value: "validCpfBr"   # función JS registrada en motor
  event:
    type: reject
    params: { reason: "CPF_INVALID" }

- name: min_score
  conditions:
    all:
      - fact: bankInfo.score
        operator: greaterThanOrEqual
        value: 600
  event:
    type: reject
    params: { reason: "SCORE_TOO_LOW" }
```

---

## 5. Conectores Bancarios
### 5.1 Adaptadores por país
Cada país = 1 adaptador que implementa `IBankInfoProvider`:
```ts
interface IBankInfoProvider {
  normalize(raw: unknown): BankInfo;
  fetch(customerId: string): Promise<BankInfo>;
}
```
### 5.2 Cache & Circuit-Breaker
- Redis TTL 5 min por `customerId+country`
- Opossum: 50 % errors → open 30 s

### 5.3 Devolución de información al Core
Una vez normalizada, la información se **encola** (`bank.info.ready` event) y el **Risk-Worker** continúa sin bloquear la API.

---

## 6. Actualización de Estado y Feature-Flags
**Maquina de estados simplificada:**
```
VALIDATING → SCORING → APPROVED|REJECTED → FUNDS_SENT
```
**Feature-Flags (Unleash):**
- `country-MX-rules-v2`
- `bank-co-bancolombia-v1`
Permite activar reglas o proveedores sin deploy.

---

## 7. Procesamiento Asíncrono
### 7.1 Colas
- Redis Streams: `q:risk`, `q:audit`, `q:webhook`
- Dead-letter después de 5 reintentos

### 7.2 Risk-Worker (evaluación de riesgo)
- Consume `q:risk`
- Ejecuta scorecards (Node.js + WebAssembly (WASM)) → publica `RiskEvaluated`
- Paraleliza llamadas a múltiples bancos (Promise.allSettled)

### 7.3 Audit-Worker
- Consume eventos de dominio → genera JSON plano → INSERT en `audit.log`
- Uso de **función PG** para enriquecer con `txid_current()`

---

## 8. Capacidades Nativas de PostgreSQL
### 8.1 Trigger `trg_status_change`
```sql
CREATE OR REPLACE FUNCTION f_notify_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
     PERFORM pg_notify('status_channel', json_build_object(
        'requestId', NEW.id,
        'old', OLD.status,
        'new', NEW.status,
        'ts', now()
     )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_status_change
AFTER UPDATE ON credit_request
FOR EACH ROW EXECUTE FUNCTION f_notify_status();
```

### 8.2 Función `f_insert_job`
```sql
CREATE OR REPLACE FUNCTION f_insert_job() RETURNS trigger AS $$
BEGIN
  INSERT INTO jobs(queue, payload, created_at)
  VALUES ('risk', row_to_json(NEW)::jsonb, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Trigger AFTER INSERT en `credit_request` → encola trabajo sin tocar código aplicación.

---

## 9. Flujo DB-Change → Trabajo Asíncrono
1. Usuario crea solicitud → `INSERT` en `credit_request`
2. Trigger `f_insert_job` → row en tabla `jobs`
3. Core-Requests **no espera** – responde 202
4. Risk-Worker **poll** (o LISTEN) → agarra job → ejecuta → publica evento `RiskEvaluated`
5. StatusService actualiza DB → Trigger `trg_status_change` → notifica a Socket.IO

---

## 10. Webhooks / Callbacks
### 10.1 Entrante – Banco envía supplemento
**Endpoint:** `POST /webhooks/banks/:country`
```json
{
  "eventType": "accountUpdated",
  "customerId": "abc",
  "newBalance": 4200
}
```
**Acciones:**
- Validar firma HMAC SHA-256 (secret por país)
- Publicar evento `BankDataUpdated` → encola `q:risk` (re-score)

### 10.2 Saliente – Notificar a SOCIO externo
Cuando status = `FUNDS_SENT`:
- Webhook-Dispatcher construye payload
- Retry exponencial (1 s, 2 s, 4 s …)
- Timeout 10 s
- Dead-letter después de 5 fallos → alerta Slack

---

## 11. Vista Real-Time (React + Socket.IO)
**Paquetes:** `socket.io-client@4`, `@tanstack/react-query`

**Hook principal:**
```ts
export const useRealTimeRequests = (country: string) => {
  const [rows, setRows] = useState<RequestRow[]>([]);

  useEffect(() => {
    const socket = io('/ws', { auth: { token: getJwt() } });
    socket.emit('join', { country });           // sala por país
    socket.on('status:changed', (ev: StatusEvent) => {
      setRows(prev => prev.map(r => r.id === ev.requestId ? { ...r, status: ev.new } : r));
    });
    return () => socket.disconnect();
  }, [country]);

  return rows;
};
```

**Backend (NestJS gateway):**
```ts
@SubscribeMessage('join')
handleJoin(client, { country }) {
  client.join(`country:${country}`);
}
// al recibir pg_notify
server.to(`country:${country}`).emit('status:changed', payload);
```

---

## 12. Seguridad
### 12.1 Manejo de PII
- PostgreSQL: extensión `pgcrypto` → columns `encrypted_curp`, `encrypted_cpf`
- Claves simétricas en **HashiCorp Vault** (K8s CSI driver)
- API nunca devuelve PII completo: `curp: "GOMJ920815H*****"` (masking)

### 12.2 JWT + RBAC
**Issuer:** `auth-svc` (Keycloak o autogenerado RS256)  
**Claims:** `sub`, `country`, `roles: ["user","underwriter"]`  
**Middleware NestJS:**
```ts
@UseGuards(JwtAuthGuard, CountryGuard)
@Get('/requests')
getRequests(@User() u, @Query('country') c) {
  if (u.country !== c) throw new ForbiddenException();
  ...
}
```

### 12.3 Exposición de datos bancarios
- Solo se guarda `last4` y `bankName`
- Números completos → tokenizado vía **VGS** o **PCI-vault**
- Headers de respuesta: `Cache-Control: no-store, private`

---

## 13. Kubernetes – Manifiestos Básicos
**Estructura:**
```
k8s/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml
├── postgres/
│   ├── pvc.yaml
│   └── statefulset.yaml
├── core-requests/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
├── bank-connector-mx/
│   └── deployment.yaml   (igual para -co, -br)
├── risk-worker/
│   └── deployment.yaml
├── frontend/
│   ├── deployment.yaml
│   └── service.yaml
└── ingress.yaml
```

### 13.1 `namespace.yaml`
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: credit-mvp
```

### 13.2 `configmap.yaml`
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: core-config
  namespace: credit-mvp
data:
  NODE_ENV: "production"
  DB_HOST: "postgres"
  DB_PORT: "5432"
  DB_NAME: "credit"
  REDIS_HOST: "redis"
  VAULT_ADDR: "http://vault:8200"
  JWT_ISSUER: "https://auth.credit.local"
  RULES_PATH: "/rules"
```

### 13.3 `secret.yaml` (base64 – usar sealed-secret en prod)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: core-secret
  namespace: credit-mvp
type: Opaque
data:
  DB_USER: Y3JlZGl0dXNlcg==      # credituser
  DB_PASS: U3VwZXJTZWNyZXQ=     # SuperSecret
  JWT_SECRET: bXktcnMtMjU2LWtleS0wMTIzg...
  VAULT_TOKEN: s.WaKVXh0V...
```

### 13.4 `core-requests/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: core-requests
  namespace: credit-mvp
spec:
  replicas: 3
  selector:
    matchLabels: { app: core-requests }
  template:
    metadata:
      labels: { app: core-requests }
    spec:
      containers:
      - name: api
        image: ghcr.io/org/core-requests:1.0.0
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef: { name: core-config }
        - secretRef: { name: core-secret }
        volumeMounts:
        - name: rules
          mountPath: /rules
        livenessProbe:
          httpGet: { path: /health, port: 3000 }
        readinessProbe:
          httpGet: { path: /ready,  port: 3000 }
      volumes:
      - name: rules
        configMap:
          name: rules-files   # monta rules/MX, CO, BR
```

### 13.5 `rules-files` ConfigMap (ejemplo MX)
```bash
kubectl create configmap rules-files \
  --from-file=MX/rules.yaml \
  --from-file=CO/rules.yaml \
  --from-file=BR/rules.yaml -n credit-mvp
```

### 13.6 `postgres/statefulset.yaml` (fragmento)
```yaml
volumeClaimTemplates:
- metadata: { name: pgdata }
  spec:
    accessModes: ["ReadWriteOnce"]
    resources: { requests: { storage: 20Gi } }
```

### 13.7 `ingress.yaml`
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: credit-ingress
  namespace: credit-mvp
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts: [api.credit.local]
    secretName: credit-tls
  rules:
  - host: api.credit.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: core-requests
            port: { number: 80 }
```

---

## 14. Pipeline CI/CD (GitHub Actions – resumen)
1. **Build & test** (jest)
2. **SonarCloud** (SAST)
3. **Build imágenes** (docker buildx) → push GHCR
4. **Helm chart** `helm upgrade --install credit-mvp ./chart`
5. **Smoke test** contra `https://api.credit.local/health`
6. **Rollback automático** si p95 latency > 2 s (Prometheus + Helm)

---

## 15. Observabilidad
### 15.1 Logs estructurados (JSON)
**Campos obligatorios:**
```json
{"ts":"2026-04-21T02:34:56.789Z","level":"info","trace_id":"a3f1","span_id":"b2","service":"core-requests","country":"MX","request_id":"req-123","user_id":"u-456","msg":"rule_curp_passed"}
```

### 15.2 Trace distribuido
**OpenTelemetry → Jaeger**  
Headers `traceparent`/`tracestate` propagados por HTTP + Redis Streams.

### 15.3 Manejo explícito de errores
```ts
class DomainError extends Error {
  constructor(public code: string, public status: number, cause?: Error) {
    super(code, { cause });
  }
}
throw new DomainError('CURP_INVALID', 422);
```
Middleware central captura y loguea `err.code`, `err.cause`, `stack`.

### 15.4 Flujo asíncrono trazable
**Ejemplo:**  
`RiskEvaluated` event incluye `trace_id` original → worker lo re-usa → aparece en mismo trace de Jaeger.

---

## 16. Escalabilidad
### 16.1 Índices críticos (PostgreSQL)
```sql
-- búsquedas por país+status+fecha
CREATE INDEX idx_req_country_status_created
    ON credit_request (country, status, created_at DESC);

-- filtro por customer
CREATE INDEX idx_req_customer_id
    ON credit_request (customer_id);

-- índice único para evitar duplicados
CREATE UNIQUE INDEX idx_req_unique_external
    ON credit_request (provider_code, external_id);
```

### 16.2 Particionamiento (Declarative PG 15+)
**Criterio:** `RANGE (created_at)` por mes → 1 partición ≈ 30 M rows.  
**DDL:**
```sql
CREATE TABLE credit_request_partitioned (LIKE credit_request)
PARTITION BY RANGE (created_at);

CREATE TABLE credit_request_2026_04 PARTITION OF credit_request_partitioned
FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```
**Script:** `partman` (extension) auto-crea futuras.

### 16.3 Sharding futuro (si > 100 M/year)
- Shard key = `country` (8 bits) + `hash(request_id)` (24 bits)
- Usar **Citus** o **pg_shards** → queries cross-country via coordinator.

### 16.4 Consultas críticas y optimización
| Consulta | Tiempo objetivo | Estrategia |
|----------|-----------------|------------|
| `SELECT * FROM credit_request WHERE country=$1 AND status=$2 ORDER BY created_at DESC LIMIT 20` | <30 ms | Índice 16.1 + partition pruning |
| `SELECT COUNT(*) FROM credit_request WHERE country=$1 AND created_at >= date_trunc('month', now())` | <50 ms | Índice BRIN en `created_at` |
| Agregados diarios para BI | - | Materialized View `mv_daily_metrics` refrescada cada 1 h |

---

## 17. Dashboards & Alertas (Grafana)
| Panel | Query (PromQL) | Umbral |
|-------|----------------|--------|
| Requests/sec | `rate(http_requests_total[1m])` | — |
| Error rate | `rate(http_requests_total{status=~"5.."}[1m])` > 1 % |
| Consumer lag | `redis_stream_length{stream="stream:risk"}` > 10 k |
| P95 latency | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[2m]))` > 500 ms |
| Disk PG partition | `pg_database_size_bytes / (1024^3)` > 80 % |

---