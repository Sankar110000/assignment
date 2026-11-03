-- Shared Bill Splitter: initial schema.
-- All money is stored as integer cents. All ids are TEXT (UUIDs made in the API).

PRAGMA foreign_keys = ON;

CREATE TABLE homes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT homes_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  -- 1, 2, 3 ... per home. This is the "order members were added" used for the
  -- cent split and for listing balances.
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT members_home_fk FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,
  CONSTRAINT members_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT members_position_positive CHECK (position >= 1),
  CONSTRAINT members_home_position_unique UNIQUE (home_id, position)
);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT bills_home_fk FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,
  CONSTRAINT bills_title_not_blank CHECK (length(trim(title)) > 0),
  -- typeof() stops 10.5 or '10' from sneaking in; SQLite is loosely typed.
  CONSTRAINT bills_total_positive_int CHECK (typeof(total_cents) = 'integer' AND total_cents > 0)
);

CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,          -- NULL = unpaid
  payment_key TEXT,          -- the Idempotency-Key that paid it
  CONSTRAINT shares_bill_fk FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE,
  CONSTRAINT shares_member_fk FOREIGN KEY (member_id) REFERENCES members (id),
  CONSTRAINT shares_amount_non_negative_int CHECK (typeof(amount_cents) = 'integer' AND amount_cents >= 0),
  -- One share per member per bill.
  CONSTRAINT shares_bill_member_unique UNIQUE (bill_id, member_id),
  -- paid_at and payment_key are set together or not at all.
  CONSTRAINT shares_paid_consistent CHECK ((paid_at IS NULL) = (payment_key IS NULL))
);

CREATE INDEX idx_members_home ON members (home_id, position);
CREATE INDEX idx_bills_home ON bills (home_id, created_at);
CREATE INDEX idx_shares_bill ON shares (bill_id);
CREATE INDEX idx_shares_member_unpaid ON shares (member_id) WHERE paid_at IS NULL;