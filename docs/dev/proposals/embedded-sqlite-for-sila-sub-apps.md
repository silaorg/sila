### Embedded SQLite for Sila Sub‑Apps with UUID‑Based Workspace FS

**Goal**: Enable Sila sub‑apps to use embedded SQLite databases stored in the workspace filesystem, with strict isolation, quotas, and a simple, safe API. This benefits apps that are inefficient with plain text storage by providing transactions, indexes, and efficient queries—while preserving Sila’s security and operability.

---

## 1) High‑Level Architecture

- **SQLite Embedded in Sila Runtime**
  - Link `libsqlite3` into the Sila host runtime (preferred) or load as a shared library.
  - Provide a Sila API surface that brokers all DB access. Sub‑apps do not link SQLite directly.

- **Per‑App Databases**
  - Each sub‑app gets one or more DB files, scoped under a per‑app workspace root (UUID‑based).
  - DB filenames are unique, stable logical names; physical storage uses UUIDs to avoid path reuse and enable atomic swaps/snapshots.

- **Workspace FS (UUID‑based)**
  - Non‑immutable but versioned by UUID: write operations produce new file objects with new UUIDs; app‑visible logical paths are updated atomically to point to new UUIDs.
  - Enables crash‑safe updates, snapshotting, rollbacks, and garbage collection of old versions.

- **Brokered Access**
  - All DB operations run in Sila‑managed worker threads, with strict capability checks, quotas, and auditing.
  - The broker enforces serialized write access and safe shared reads via WAL mode.

---

## 2) Storage Layout

- **Logical Path for Apps**
  - `sila://db/<dbName>` or `sila://app/<appId>/db/<dbName>`

- **Physical Path (internal)**
  - `/workspace/apps/<app_uuid>/db/<dbName>/<file_uuid>.sqlite`
  - Symlink/pointer file: `/workspace/apps/<app_uuid>/db/<dbName>/current` → `<file_uuid>.sqlite`
  - WAL and SHM sit adjacent to the current file, managed atomically on rotation.

- **Snapshots**
  - Point‑in‑time snapshots: `/workspace/apps/<app_uuid>/db/<dbName>/snapshots/<snapshot_uuid>.sqlite`
  - Created via SQLite Online Backup API; marked read‑only.

- **Garbage Collection**
  - Background GC reclaims unreferenced UUID files beyond retention window.

---

## 3) Runtime Configuration

- **SQLite Pragmas (defaults)**
  - `journal_mode=WAL` for concurrent reads and durability.
  - `synchronous=NORMAL` (MVP), `FULL` optional per app tier.
  - `temp_store=MEMORY`, `cache_size` capped per app.
  - `busy_timeout=5000ms`, retry policy in broker.

- **Connection Management**
  - One writer connection per DB (serialized), small read pool (e.g., 4) with WAL.
  - Queries executed off the main thread to avoid event‑loop blocking.

- **Limits & Quotas**
  - Max DB size per app (e.g., 256 MB MVP; configurable).
  - Max number of DBs per app (e.g., 3 MVP).
  - Max concurrent queries, max transaction duration, statement timeouts.
  - Row/byte return limits to prevent over‑large responses.

---

## 4) Security and Isolation

- **Capabilities**
  - Sub‑app manifest declares `capability.sqlite` with requested limits:
    - `dbs: ["analytics", "cache"]`, `max_size_mb`, `read_only` flags.

- **Path Isolation**
  - Apps cannot specify arbitrary file paths. Only logical DB names mapped by Sila.
  - No `ATTACH` to arbitrary filesystem paths; broker validates and rewrites to approved DBs.

- **SQL Safety**
  - Allow raw SQL; optionally expose a higher‑level query builder in SDK to reduce foot‑guns.
  - Block PRAGMAs that break durability/security unless allowed by policy.

- **Encryption (Optional Phase 2)**
  - Integrate SQLCipher or OS‑level encryption at rest.
  - KMS‑managed keys, per‑app key rotation, and encrypted backups.

---

## 5) API Design

- **Concepts**
  - Database handle bound to `<appId, dbName>`.
  - Operations: `query`, `exec`, `transaction`, `migrate`, `backup`, `restore`, `snapshot`, `import`.

- **Example (TypeScript SDK)**

```ts
// Acquire a handle
const db = await sila.sqlite.open({ dbName: "analytics" });

// Simple query with params
const rows = await db.query("SELECT * FROM events WHERE user_id = ?", [userId]);

// Exec for DDL/DML
await db.exec("CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, user_id TEXT, ts INTEGER, data JSON)");

// Transaction wrapper
await db.transaction(async (tx) => {
  await tx.exec("INSERT INTO events (id, user_id, ts, data) VALUES (?, ?, ?, ?)", [id, userId, Date.now(), JSON.stringify(payload)]);
  const count = await tx.queryValue<number>("SELECT COUNT(*) FROM events WHERE user_id = ?", [userId]);
});

// Migrations
await db.migrate({
  currentVersion: 2,
  steps: [
    { from: 0, to: 1, up: "CREATE TABLE events (...)" , down: "DROP TABLE events" },
    { from: 1, to: 2, up: "CREATE INDEX idx_events_user ON events(user_id)", down: "DROP INDEX idx_events_user" },
  ],
});

// Backup and restore
const snapshotId = await db.snapshot(); // returns UUID
await db.backup({ destination: "app://backups/analytics/" }); // exported file URI
await db.restore({ snapshotId });
```

- **API Behavior**
  - All operations are cancellable; broker enforces statement timeout.
  - Result sets streamed and size‑limited by default; cursors optional later.

---

## 6) Migrations

- **Strategy**
  - App supplies declarative steps with `from → to`. Broker runs steps within a transaction.
  - Lock DB to migration only; fail fast with clear diagnostics.
  - On success, write version metadata into a reserved table: `_sila_meta(version INTEGER, applied_at TEXT, ... )`.

- **Safety**
  - Pre‑checks on disk space availability vs expected migration growth.
  - Auto‑snapshot before migration; automatic rollback to snapshot on failure.

---

## 7) Backups, Export/Import, and Data Portability

- **Backups**
  - Online backup API to produce consistent `.sqlite` files while live.
  - Stored under `/backups/<snapshot_uuid>.sqlite` with retention policy.

- **Export/Import**
  - Export to app‑readable URI, optionally compressed.
  - Import validates schema, size, and integrity (`PRAGMA integrity_check`), then swaps `current` pointer atomically.

- **Snapshots**
  - Lightweight point‑in‑time capture, listable and restorable via API.

---

## 8) Observability and Operations

- **Metrics**
  - Per‑app: query count, error rate, p50/p95 latency, active connections, DB size, cache hits.
  - WAL checkpoint frequency and durations.

- **Logging**
  - Slow query log (threshold configurable).
  - Migration audit trail.
  - Backup/snapshot/restore events.

- **Tracing**
  - Distributed tracing hooks with query spans (SQL redacted by default; optional parameter/SQL capture under dev mode).

- **Health and Maintenance**
  - Periodic `PRAGMA integrity_check`.
  - Auto‑VACUUM (as needed) outside peak hours.
  - WAL checkpoints on size thresholds (e.g., 64 MB).

---

## 9) Performance Considerations

- **Concurrency**
  - WAL allows many readers, single writer. The broker serializes writes and batches small writes.
  - Background worker threads for CPU‑heavy queries.

- **Scaling**
  - Encourage one DB per sub‑app domain. For sharding, allow multiple DBs with namespacing, not one giant DB.
  - Offer advisory indices tooling in dev mode (explain plans, missing indexes detection).

- **Limits**
  - Enforce statement timeouts (e.g., 5s default) and result size caps (e.g., 1 MB JSON) to protect the platform.

---

## 10) Workspace FS: UUID‑Based Semantics

- **Write Model**
  - New writes generate new file UUIDs. `current` pointer flips atomically on success.
  - WAL/SHM are recreated as needed; flips include clean checkpointing to avoid orphan WALs.

- **Snapshots**
  - Snapshots are immutable UUIDs. Restoration is pointer swap; no in‑place mutation.

- **GC**
  - Retain N snapshots or up to retention window; GC older UUID files when not referenced by `current` or snapshot manifests.

- **Benefits**
  - Crash safety, atomic upgrades, and straightforward rollbacks.
  - Clean isolation between app‑visible logical names and physical storage.

---

## 11) Security Review and Risks

- **Risks**
  - Unbounded growth from large blobs: mitigate with quotas and `PRAGMA max_page_count`.
  - Long‑running queries blocking writer: enforce timeouts and plan kill switches.
  - Path traversal via `ATTACH`: block raw paths; only allow logical `ATTACH sila://db/<name>`.
  - Data exfiltration via large result sets: enforce size/row caps and per‑minute budgets.

- **Mitigations**
  - Capability gating + audit.
  - Brokered SQL parse gate to identify dangerous PRAGMAs.
  - Optional encryption at rest and encrypted exports.

---

## 12) Rollout Plan

- **MVP (2–4 weeks)**
  - Embed SQLite, broker API: `open`, `query`, `exec`, `transaction`.
  - WAL mode, quotas, timeouts, basic metrics, slow query log.
  - UUID FS pointer model with `current` and manual snapshots.
  - One DB per app, size cap 256 MB, 4 read connections, 1 writer.

- **Phase 2**
  - Migrations API, online backup, import/export, snapshot retention & GC.
  - Observability: tracing, integrity checks, auto‑vacuum scheduling.
  - Multiple DBs per app; configurable performance tiers.

- **Phase 3**
  - Encryption with SQLCipher, KMS integration.
  - Advisory indexing, query plan insights, background reindexing.
  - Cursor‑style streaming results for large queries.

---

## 13) Developer Experience

- **Manifests**
  - Example:
    ```json
    {
      "capabilities": {
        "sqlite": {
          "enabled": true,
          "dbs": [{ "name": "analytics", "maxSizeMB": 256 }],
          "tier": "standard"
        }
      }
    }
    ```

- **Local Dev**
  - Same API with local file paths; dev tooling to inspect DB with `sqlite3` CLI.
  - Redacted SQL logs, optional full SQL capture behind a dev flag.

- **Docs and Guides**
  - Cookbook: schema design, indices, migrations, backups, and performance tips.
  - Examples: event log, cache layer, key‑value store over SQLite.

---

## 14) Alternatives Considered

- **Plain Files**: Simpler but lacks transactions, indexing, queries.
- **External DBs (Postgres)**: Powerful but overkill for many sub‑apps; adds deployment and multi‑tenant complexity.
- **SQLite WASM (in‑process)**: Useful in browser/serverless contexts but harder to enforce quotas and persistence in our server runtime.

---

## 15) Success Criteria

- 95th percentile query latency < 50 ms for indexed lookups on medium datasets.
- Zero cross‑app data leaks; strict path isolation validated via tests.
- No unbounded disk growth; quotas and GC verified.
- Developer adoption: ≥30% of new sub‑apps with structured data choose SQLite within 2 months.

---

If you want, we can next draft the manifest schema, the SDK surface, and the broker interface, plus a minimal reference implementation plan for the MVP.

