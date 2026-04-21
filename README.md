# Credit MVP — Sistema de Solicitudes de Crédito Multi-País

Sistema backend + frontend para gestionar solicitudes de crédito en múltiples países (México, Colombia y Brasil), con procesamiento asíncrono, tiempo real y arquitectura orientada a eventos.

---

## Tabla de contenidos

1. [Requisitos previos](#1-requisitos-previos)
2. [Inicio rápido — levantar en local](#2-inicio-rápido--levantar-en-local)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Comandos disponibles (Makefile)](#4-comandos-disponibles-makefile)
5. [Supuestos](#5-supuestos)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Decisiones técnicas](#7-decisiones-técnicas)
8. [Consideraciones de seguridad](#8-consideraciones-de-seguridad)
9. [Escalabilidad y grandes volúmenes](#9-escalabilidad-y-grandes-volúmenes)
10. [Concurrencia, colas y webhooks](#10-concurrencia-colas-y-webhooks)
11. [Caching — qué, por qué y cómo se invalida](#11-caching--qué-por-qué-y-cómo-se-invalida)
12. [Países implementados](#12-países-implementados)

---

## 1. Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Docker | 24+ |
| Docker Compose | v2.20+ |
| Node.js | 20 LTS |
| Make | cualquiera |

No se requiere instalar PostgreSQL, Redis ni ningún otro servicio de forma local; todo corre dentro de Docker.

---

## 2. Inicio rápido — levantar en local

```bash
# 1. Clonar el repositorio
git clone https://github.com/org/credit-mvp.git
cd credit-mvp

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar todos los servicios
make run

# 4. (En otra terminal) Verificar que todo esté sano
make health
```

El comando `make run` ejecuta `docker compose up --build -d` e incluye:

- `core-requests` — API principal en NestJS (puerto 3000)
- `bank-connector-mx` / `-co` / `-br` — Adaptadores bancarios simulados (puerto 8080 cada uno)
- `risk-worker` — Worker de evaluación de riesgo en Node.js + WASM
- `audit-worker` — Worker de auditoría en Node.js
- `webhook-dispatcher` — Despachador de webhooks salientes
- `postgres` — PostgreSQL 15 (puerto 5432)
- `redis` — Redis 7 para Streams y caché (puerto 6379)
- `frontend` — React 18 + Vite (puerto 5173)

Una vez levantado, el sistema completo está disponible en:

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000
- **Swagger / OpenAPI:** http://localhost:3000/api

---

## 3. Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores según tu entorno. Las variables marcadas con `*` son obligatorias para que el sistema arranque.

```dotenv
# Base de datos *
DB_HOST=postgres
DB_PORT=5432
DB_NAME=credit
DB_USER=credituser
DB_PASS=SuperSecret

# Redis *
REDIS_HOST=redis
REDIS_PORT=6379

# JWT *
JWT_SECRET=cambia-esto-en-produccion
JWT_ISSUER=https://auth.credit.local

# Seguridad de webhooks entrantes (HMAC-SHA256, uno por país)
WEBHOOK_SECRET_MX=secreto-mx
WEBHOOK_SECRET_CO=secreto-co
WEBHOOK_SECRET_BR=secreto-br

# Rutas de reglas de negocio
RULES_PATH=./rules

# Entorno
NODE_ENV=development
```

> **Nota de seguridad:** En producción, `JWT_SECRET` y los `WEBHOOK_SECRET_*` deben rotarse y almacenarse en un gestor de secretos (HashiCorp Vault o K8s Secrets sellados). Nunca comitear el `.env` real.

---

## 4. Comandos disponibles (Makefile)

```bash
make run        # Levanta todos los servicios con docker compose up --build -d
make stop       # Detiene todos los servicios
make restart    # stop + run
make logs       # Muestra logs en tiempo real de todos los servicios
make health     # Llama GET /health en core-requests y verifica que responda 200

make migrate    # Ejecuta las migraciones de base de datos (TypeORM)
make seed       # Carga datos de prueba en la base de datos

make test       # Corre la suite de tests (jest --runInBand)
make test:watch # Tests en modo watch
make test:cov   # Tests con reporte de cobertura

make lint       # ESLint sobre todo el monorepo
make build      # Compila TypeScript de todos los servicios

make deploy     # Aplica los manifiestos de Kubernetes (requiere kubectl configurado)
make k8s:rules  # Crea el ConfigMap de reglas YAML en el cluster
```

---

## 5. Supuestos

Los siguientes supuestos fueron tomados para acotar el alcance del MVP dentro del plazo de 1–3 días, sin sacrificar la arquitectura objetivo.

### Proveedores bancarios simulados

Los conectores bancarios (`bank-connector-mx`, `-co`, `-br`) son **servicios HTTP simulados** que implementan la misma interfaz `IBankInfoProvider` pero devuelven datos mock. En producción, cada uno se reemplazaría por la integración real con su proveedor (BBVA REST v3 para MX, Bancolombia SOAP para CO, Itaú REST para BR), sin cambios en el código del `core-requests`.

### Autenticación simplificada para el MVP

El sistema genera JWTs firmados con RS256 directamente en `auth-svc` (un módulo de NestJS incluido en el repo), sin depender de Keycloak ni de un IdP externo. El claim `country` en el token determina a qué país pertenece el usuario. En producción, `auth-svc` se reemplaza por Keycloak u OIDC sin modificar los guards del API.

### Vault sustituido por variables de entorno en local

`HashiCorp Vault` está referenciado en los manifiestos K8s para producción. En local y en CI, las claves simétricas para cifrar PII y los secrets de webhook se cargan como variables de entorno estándar desde `.env`. La columna `encrypted_curp` en la DB usa la extensión `pgcrypto` en ambos casos.

### Debezium no se levanta en local

El stack local no incluye Debezium ni Kafka. La auditoría en el MVP se realiza mediante el trigger PostgreSQL `f_insert_job` que escribe directamente en la tabla `jobs` y el `audit-worker` que la consume. Debezium es la estrategia de producción a gran escala documentada en el documento maestro.

### Unleash (feature flags) no está en el stack local

Los feature flags de Unleash están diseñados para producción. En el MVP, los flags se simulan con variables de entorno booleanas (`ENABLE_MX_RULES_V2=false`). La interfaz de código es idéntica, por lo que activar Unleash real no requiere cambios en la lógica de negocio.

### WASM del Risk-Worker es un stub compilado

El módulo WebAssembly que ejecuta los scorecards de riesgo está incluido en el repo como un binario `.wasm` precompilado con una lógica de scoring simplificada. El scaffold de integración (carga del módulo, llamada desde Node.js, publicación del evento `RiskEvaluated`) es funcional y representativo del flujo real.

### Particionamiento activo solo en la rama de producción

Las tablas particionadas de PostgreSQL descritas en la sección de escalabilidad están disponibles como migraciones opcionales (`make migrate:partitioned`). Las migraciones por defecto (`make migrate`) usan la tabla `credit_request` sin particionar para simplificar el entorno de desarrollo.

### Países implementados

El MVP cubre **México (MX), Colombia (CO) y Brasil (BR)**. La arquitectura permite agregar nuevos países (España, Portugal, Italia) añadiendo un archivo `rules/{COUNTRY}/rules.yaml` y un adaptador bancario, sin tocar el código del core.

---

## 6. Modelo de datos

### Diagrama de entidades

```
credit_request
    id              UUID        PK
    country         CHAR(2)     NOT NULL  -- MX | CO | BR | ...
    status          VARCHAR     NOT NULL  -- VALIDATING | SCORING | APPROVED | REJECTED | FUNDS_SENT
    customer_id     UUID        FK → customer.id
    amount          NUMERIC(14,2)
    currency        CHAR(3)     -- MXN | COP | BRL
    bank_info       JSONB       -- datos normalizados del proveedor bancario
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    updated_at      TIMESTAMPTZ

customer
    id              UUID        PK
    full_name       VARCHAR     NOT NULL
    encrypted_doc   BYTEA       -- CURP / CC / CPF cifrado con pgcrypto
    doc_type        VARCHAR     -- CURP | CC | CPF | DNI | NIF | CF
    doc_masked      VARCHAR     -- ej: "GOMJ9208*****" para display
    monthly_income  NUMERIC(14,2)
    created_at      TIMESTAMPTZ

status_timeline
    id              UUID        PK
    request_id      UUID        FK → credit_request.id
    from_status     VARCHAR
    to_status       VARCHAR     NOT NULL
    changed_by      UUID        -- user_id del actor
    comment         TEXT
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

jobs
    id              BIGSERIAL   PK
    queue           VARCHAR     NOT NULL  -- 'risk' | 'audit' | 'webhook'
    payload         JSONB       NOT NULL
    status          VARCHAR     NOT NULL DEFAULT 'pending'  -- pending | processing | done | failed
    attempts        INT         NOT NULL DEFAULT 0
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    processed_at    TIMESTAMPTZ

audit_log
    id              BIGSERIAL   PK
    entity          VARCHAR     NOT NULL  -- 'credit_request' | 'customer'
    entity_id       UUID        NOT NULL
    action          VARCHAR     NOT NULL  -- INSERT | UPDATE | STATUS_CHANGE
    actor_id        UUID
    payload         JSONB       -- snapshot del row afectado
    tx_id           BIGINT      -- txid_current() de PG
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

### DDL de creación (simplificado)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE customer (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name      VARCHAR(255) NOT NULL,
    encrypted_doc  BYTEA NOT NULL,
    doc_type       VARCHAR(10) NOT NULL,
    doc_masked     VARCHAR(30) NOT NULL,
    monthly_income NUMERIC(14,2) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE credit_request (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country     CHAR(2) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'VALIDATING',
    customer_id UUID NOT NULL REFERENCES customer(id),
    amount      NUMERIC(14,2) NOT NULL,
    currency    CHAR(3) NOT NULL,
    bank_info   JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE status_timeline (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID NOT NULL REFERENCES credit_request(id),
    from_status VARCHAR(20),
    to_status   VARCHAR(20) NOT NULL,
    changed_by  UUID,
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE jobs (
    id           BIGSERIAL PRIMARY KEY,
    queue        VARCHAR(20) NOT NULL,
    payload      JSONB NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts     INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE audit_log (
    id        BIGSERIAL PRIMARY KEY,
    entity    VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action    VARCHAR(30) NOT NULL,
    actor_id  UUID,
    payload   JSONB,
    tx_id     BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices críticos
CREATE INDEX idx_req_country_status_created
    ON credit_request (country, status, created_at DESC);

CREATE INDEX idx_req_customer_id
    ON credit_request (customer_id);

CREATE INDEX idx_jobs_queue_status
    ON jobs (queue, status, created_at)
    WHERE status = 'pending';

CREATE INDEX idx_audit_entity
    ON audit_log (entity, entity_id, created_at DESC);
```

---

## 7. Decisiones técnicas

### Por qué NestJS sobre Express puro

NestJS provee inyección de dependencias, módulos y decoradores que permiten separar claramente controladores, servicios, repositorios e integraciones. Esto hace que agregar un nuevo país sea añadir un módulo sin tocar el resto del sistema. Express puro requeriría esa estructura a mano, sin garantías de consistencia.

### Por qué Redis Streams sobre Kafka

Para el volumen de un MVP (y hasta varios millones de mensajes/mes), Redis Streams ofrece el mismo modelo de grupos de consumidores que Kafka sin el costo operacional de un cluster Kafka. El productor y el consumidor son intercambiables: si el volumen exige Kafka en el futuro, el cambio es de configuración de transporte, no de lógica de dominio.

### Por qué triggers de PostgreSQL para encolamiento

Usar `f_insert_job` como trigger AFTER INSERT garantiza que cada solicitud creada genera exactamente un job en la tabla `jobs`, dentro de la misma transacción. No hay riesgo de que el INSERT ocurra pero el encolamiento falle por un crash de la aplicación entre ambas operaciones.

### Por qué YAML para las reglas de negocio por país

Las reglas son datos de configuración, no lógica de aplicación. Almacenarlas en YAML (montados como ConfigMap en K8s) permite que un analista de negocio modifique umbrales o añada reglas sin tocar código ni hacer un nuevo deploy. El motor las carga al inicio y puede recargarse en caliente.

### Por qué Socket.IO sobre SSE para tiempo real

Socket.IO permite salas (`country:MX`), reconexión automática y comunicación bidireccional. Para este sistema, donde múltiples operadores de un mismo país ven el mismo tablero, las salas son más naturales que canales por usuario. SSE es adecuado para streams unidireccionales por usuario, no para tableros compartidos.

### Patrón de extensibilidad por país

Agregar un país nuevo (por ejemplo, España) requiere exactamente tres artefactos: un archivo `rules/ES/rules.yaml`, un adaptador `EsBankConnector` que implemente `IBankInfoProvider`, y una entrada en el enum `Country`. El core no necesita modificaciones.

---

## 8. Consideraciones de seguridad

### PII (información personal identificable)

Los documentos de identidad (CURP, CPF, CC) se almacenan cifrados en reposo usando `pgcrypto` con AES-256. La clave simétrica vive en variables de entorno en local y en HashiCorp Vault en producción. La API nunca devuelve el documento completo: todas las respuestas incluyen la versión enmascarada (`doc_masked`).

### JWT y autorización

Los tokens se firman con RS256. El claim `country` del token es la fuente de verdad para autorización: el middleware `CountryGuard` rechaza cualquier request donde el `country` del query o body no coincida con el del token. Esto previene que un operador de México acceda a solicitudes de Colombia.

El rol `underwriter` es el único que puede cambiar el estado de una solicitud a `APPROVED` o `REJECTED`. El rol `user` solo puede crear y consultar.

### Webhooks entrantes

Todos los webhooks recibidos en `POST /webhooks/banks/:country` se validan con HMAC-SHA256 antes de procesarse. El secret es distinto por país. Un payload sin firma válida recibe 401 y se loguea como intento no autorizado.

### Datos bancarios

Solo se persisten `last4` (últimos 4 dígitos de cuenta) y `bankName`. Cualquier dato sensible completo que llegue del proveedor bancario se descarta inmediatamente después de extraer lo necesario. Las respuestas de la API incluyen el header `Cache-Control: no-store, private` para prevenir caching en proxies intermedios.

### Secrets en el repositorio

El archivo `.env` está en `.gitignore`. El `secret.yaml` de K8s en este repo contiene valores de ejemplo en base64 únicamente para referencia de estructura; en producción se reemplaza por Sealed Secrets o External Secrets Operator.

---

## 9. Escalabilidad y grandes volúmenes

El sistema está diseñado para escalar desde el MVP hasta decenas de millones de solicitudes al mes sin rediseño estructural.

### Índices recomendados

El índice compuesto `(country, status, created_at DESC)` cubre el 90% de las consultas de listado. El índice parcial en `jobs(queue, status)` filtrado por `status = 'pending'` mantiene el polling de workers eficiente independientemente del volumen histórico de la tabla.

### Particionamiento de tablas

`credit_request` está preparada para particionarse por `RANGE (created_at)` mensual usando `pg_partman`. Cada partición cubre aproximadamente 30 millones de filas. El partition pruning de PostgreSQL hace que las queries con filtro de fecha solo lean las particiones relevantes.

### Consultas críticas y cuellos de botella

La query de listado (`country + status + fecha`) está cubierta por el índice compuesto y se mantiene por debajo de 30 ms hasta 500 millones de filas gracias al partition pruning. El COUNT por mes usa un índice BRIN en `created_at`, que es compacto y eficiente para datos monotónicamente crecientes. Los agregados diarios para BI se calculan con una Materialized View `mv_daily_metrics` refrescada cada hora, evitando scans completos en queries analíticas.

### Archivado y compresión

La política de retención es: 90 días en almacenamiento hot (PostgreSQL activo), hasta 1 año en warm (particiones comprimidas con zstd), hasta 5 años en cold (exportado a S3 en formato Parquet, read-only). Esto cumple con los requisitos de compliance habituales en servicios financieros latinoamericanos y europeos, y reduce el costo de almacenamiento en aproximadamente 70% tras los primeros 6 meses.

### Escalar workers

Los workers (risk, audit, webhook) son stateless y se escalan horizontalmente con K8s HPA basado en CPU y en el lag del stream de Redis. Múltiples instancias del mismo worker pueden correr en paralelo de forma segura porque cada mensaje es procesado por exactamente un consumidor del grupo (`XREADGROUP`), y el `XACK` se envía solo al completar el procesamiento exitosamente.

---

## 10. Concurrencia, colas y webhooks

### Estrategia de concurrencia

Cada tipo de trabajo tiene su propio stream en Redis: `stream:risk`, `stream:audit`, `stream:webhook`. Los workers de cada stream forman un consumer group independiente. Esto permite escalar cada tipo de worker de forma independiente según la presión de su cola, sin que se bloqueen entre sí.

La consistencia ante concurrencia está garantizada por dos mecanismos: el trigger PostgreSQL `f_insert_job` (que inserta el job dentro de la misma transacción que la solicitud, por lo que o ambos ocurren o ninguno), y el `XACK` diferido en Redis Streams (un mensaje no se considera procesado hasta que el worker confirma éxito). Si un worker muere a mitad de procesamiento, el mensaje queda sin ACK y otro worker lo recoge.

### Dead-letter y reintentos

Un mensaje que falla 5 veces consecutivas se mueve al stream `stream:risk:dlq` (dead-letter queue). Un proceso cron diario reintenta el DLQ y genera una alerta en Slack para revisión manual. Este límite de reintentos previene que un mensaje malformado bloquee a todos los workers indefinidamente.

### Flujo de webhook entrante

```
Banco externo → POST /webhooks/banks/MX
  → Validar firma HMAC-SHA256
  → Publicar BankDataUpdated en stream:risk
  → Risk-Worker reconsume y actualiza el score
  → StatusService cambia estado si aplica
  → pg_notify → Socket.IO → Frontend
```

### Flujo de webhook saliente

Cuando una solicitud llega a `FUNDS_SENT`, el `webhook-dispatcher` envía una notificación al endpoint del socio externo con retry exponencial (1s, 2s, 4s, …, hasta 5 intentos). Si todos fallan, el evento queda en el DLQ de webhook y se genera una alerta.

---

## 11. Caching — qué, por qué y cómo se invalida

### Qué se cachea

**Información bancaria por cliente:** La respuesta normalizada del proveedor bancario se cachea en Redis con la clave `bank:{country}:{customerId}` con TTL de 5 minutos. Llamar al proveedor bancario en cada validación sería costoso en latencia y en cuota de API.

**Listado de solicitudes paginado:** Las primeras páginas del listado por país (`GET /requests?country=MX`) se cachean con TTL de 30 segundos. Estas consultas son frecuentes en el tablero de operadores y cambian con relativa baja frecuencia en ventanas cortas.

### Por qué esos TTLs

5 minutos para datos bancarios es un equilibrio entre frescura (una actualización bancaria rara vez es tan urgente como para no poder esperar 5 minutos) y eficiencia (evita llamadas duplicadas en flujos de re-score). 30 segundos para listados refleja que el tablero se actualiza también vía Socket.IO en tiempo casi real, por lo que el caché sirve para reducir carga en picos, no como fuente de verdad de estado.

### Estrategia de invalidación

**Invalidación activa al recibir un webhook bancario:** Cuando llega un `accountUpdated` desde el banco, el handler invalida inmediatamente la clave `bank:{country}:{customerId}` antes de encolar el re-score. Esto asegura que el siguiente ciclo de evaluación use datos frescos.

**Invalidación activa al cambiar estado:** Cuando `StatusService` actualiza el estado de una solicitud, invalida la clave del listado paginado del país correspondiente (`list:{country}:*`). El patrón `SCAN + DEL` en Redis borra todas las páginas cacheadas de ese país.

**TTL como red de seguridad:** Incluso sin invalidación activa, el TTL garantiza que el caché converja a la realidad. Esto cubre edge cases como crashes de la aplicación antes de invalidar.

---

## 12. Países implementados

| País | Código | Documento | Reglas de negocio |
|---|---|---|---|
| México | MX | CURP | Formato CURP, monto ≤ 12 meses de ingreso |
| Colombia | CO | Cédula de Ciudadanía (CC) | Deuda total < 70% del ingreso mensual |
| Brasil | BR | CPF | Validación de dígitos verificadores, score ≥ 600 |

Para agregar un nuevo país, consulta `docs/adding-a-country.md`.