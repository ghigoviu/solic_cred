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
CREATE INDEX idx_req_country_status_created ON credit_request (country, status, created_at DESC);
CREATE INDEX idx_req_customer_id ON credit_request (customer_id);
CREATE INDEX idx_jobs_queue_status ON jobs (queue, status, created_at) WHERE status = 'pending';
CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id, created_at DESC);

-- Trigger: Status Change Notification
CREATE OR REPLACE FUNCTION f_notify_status() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status <> OLD.status) THEN
     PERFORM pg_notify('status_channel', json_build_object(
        'requestId', NEW.id,
        'country', NEW.country,
        'old', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        'new', NEW.status,
        'ts', now()
     )::text);
     
     -- Insert Timeline record
     INSERT INTO status_timeline (request_id, from_status, to_status)
     VALUES (NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_status_change
AFTER INSERT OR UPDATE ON credit_request
FOR EACH ROW EXECUTE FUNCTION f_notify_status();

-- Trigger: Async Jobs
CREATE OR REPLACE FUNCTION f_insert_job() RETURNS trigger AS $$
BEGIN
  INSERT INTO jobs(queue, payload, created_at)
  VALUES ('risk', row_to_json(NEW)::jsonb, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_insert_job
AFTER INSERT ON credit_request
FOR EACH ROW EXECUTE FUNCTION f_insert_job();
