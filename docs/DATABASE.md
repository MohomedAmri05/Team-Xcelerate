# High Street — Database Documentation

**Engine:** MySQL 8 or MariaDB 10.4+ (XAMPP). Character set: `utf8mb4`.

**Access:** Sequelize ORM (`server/src/models`). Every query is parameterised by Sequelize; raw SQL is only used inside migrations.

**Schema changes:** made only through migrations in `server/migrations`, applied with `npm --prefix server run db:migrate`.

## 1. Entity overview

```text
users ─┬─< admin_sessions                    (login sessions, refresh-token hashes)
       ├─── staff_permissions (1:1)          (Staff permission flags)
       ├─< vehicles.created_by
       ├─< enquiries (customer / assigned staff / assigned by / responded by)
       ├─< enquiry_responses.admin_id
       ├─< test_drive_bookings (customer / assigned staff)
       ├─< wishlists
       ├─< complaints (customer / assigned staff)          NEW
       ├─< complaint_messages.author_id                    NEW
       ├─< complaint_status_history.changed_by             NEW
       ├─< documents.uploaded_by                           NEW
       ├─< email_logs.created_by                           NEW
       ├─< activity_logs.actor_id                          NEW
       ├─< saved_reports.created_by                        NEW
       ├─< reply_templates (created_by / updated_by)       NEW (16-CRUD)
       └─< finance_applications (customer / reviewed_by)   NEW (16-CRUD)

vehicles ─┬─< vehicle_images
          ├─< enquiries ─< enquiry_responses
          ├─< test_drive_bookings
          ├─< wishlists
          ├─< complaints.vehicle_id                        NEW
          ├─< documents.vehicle_id                         NEW
          └─< finance_applications.vehicle_id              NEW (16-CRUD)

financing_configs ─< finance_applications.config_id        NEW (16-CRUD)
finance_applications ─< documents.finance_application_id   NEW (16-CRUD)

complaints ─┬─< complaint_messages
            ├─< complaint_status_history
            ├─< documents.complaint_id
            └─< inbound_emails.complaint_id
test_drive_bookings ─┬─< complaints.booking_id
                     └─< documents.booking_id
enquiries ─┬─< complaints.enquiry_id
           └─< inbound_emails.enquiry_id
```

## 2. Migrations

| Migration | Purpose |
|---|---|
| `202609120001-create-schema.cjs` | Users, sessions, vehicles, images, enquiries, responses, company content, financing configurations |
| `202609130001-add-customer-role-and-profile.cjs` | Customer role and profile columns |
| `202609130002-add-staff-permissions-and-enquiry-assignments.cjs` | Staff permissions and enquiry assignment |
| `202609130003-create-wishlists.cjs` | Customer wishlists |
| `202609130004-create-test-drive-bookings.cjs` | Test-drive bookings |
| **`202610110001-create-complaints-documents-reports.cjs`** | **New:** complaints, complaint messages, complaint status history, documents, email log, inbound email, activity log, saved reports, `can_manage_complaints` permission, supporting indexes |
| **`202610110002-add-reply-templates-finance-applications.cjs`** | **New (16-CRUD completion):** `reply_templates`, `finance_applications`, `wishlists.note`, `documents.finance_application_id`, document category "Finance Document" |
| **`202610150001-users-sessions-permissions-vehicle-finance.cjs`** | **New (Users / Sessions / Permissions / per-vehicle financing):** `session_events`, `password_reset_tokens`; new columns on `users`, `admin_sessions`, `staff_permissions` and `financing_configs` (see §4) |

**Migration `202610150001` was tested** (on Dolt, a MySQL-compatible server) against both `high_street_db.sql` dumps in the project:

- every record count stayed the same after migrating;
- the existing Staff member kept all access, because the new permissions are copied from the old ones;
- undo removes exactly its 2 tables and 30 columns, with record counts unchanged;
- migrating again gives an identical schema.

**The new migration is additive.** It never drops, renames or rewrites existing tables, columns or data. It was tested against a copy of `database backup/high_street_db.sql`:

- migrate, then roll back: the schema is identical to the original afterwards (every index of every table compared);
- migrate again: record counts in every existing table are unchanged.

**Supporting indexes** (`hs26_*`) are only created when no existing index already covers the same columns. Rolling back removes only `hs26_*` indexes, never the original ones.

**Back up before migrating.** In phpMyAdmin use Export › Quick › SQL. From the command line:

```powershell
C:\xampp\mysql\bin\mysqldump.exe -u root high_street_db > high_street_db-before-2026-10.sql
```

## 3. New tables

### 3.1 `complaints`

One row per customer complaint.

| Column | Type | Constraints / default | Notes |
|---|---|---|---|
| `complaint_id` | INT | **PK**, auto increment | |
| `reference` | VARCHAR(40) | NOT NULL, **UNIQUE** | `HS-CMP-YYYY-NNNNN`, generated from the ID inside the same transaction |
| `customer_id` | INT | NOT NULL, **FK → users** ON DELETE RESTRICT | Customer who submitted it. Users are deactivated, never deleted, so records are kept |
| `category` | ENUM | NOT NULL | Vehicle Condition, Test Drive, Enquiry Handling, Staff Conduct, Website, Financing, Other |
| `subject` | VARCHAR(180) | NOT NULL | 5–180 characters (validated) |
| `description` | TEXT | NOT NULL | 20–5000 characters (validated) |
| `priority` | ENUM | NOT NULL, default `Medium` | Low, Medium, High, Urgent |
| `status` | ENUM | NOT NULL, default `Submitted` | Submitted → Under Review → In Progress → Resolved → Closed |
| `vehicle_id` | INT | NULL, FK → vehicles ON DELETE SET NULL | Optional related vehicle |
| `booking_id` | INT | NULL, FK → test_drive_bookings ON DELETE SET NULL | Must belong to the same customer (checked in the API) |
| `enquiry_id` | INT | NULL, FK → enquiries ON DELETE SET NULL | Must belong to the same customer |
| `assigned_to` | INT | NULL, FK → users ON DELETE SET NULL | Staff (with `can_manage_complaints`) or Admin |
| `assigned_at` | DATETIME | NULL | |
| `resolution_summary` | TEXT | NULL | Required before status Resolved |
| `resolved_at`, `closed_at` | DATETIME | NULL | Set by the workflow |
| `reopened_count` | INT | NOT NULL, default 0 | Incremented on reopen |
| `last_activity_at` | DATETIME | NOT NULL | Updated on every message or change (sorting) |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

Indexes: `status`, `category`, `customer_id`, `assigned_to`, `created_at`, unique `reference`.

### 3.2 `complaint_messages`

The conversation on a complaint.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `message_id` | INT | **PK** | |
| `complaint_id` | INT | NOT NULL, **FK → complaints ON DELETE CASCADE** | |
| `author_id` | INT | NULL, FK → users ON DELETE SET NULL | Null for system messages |
| `author_role` | ENUM | NOT NULL | Customer, Staff, Admin, System, Email |
| `body` | TEXT | NOT NULL | |
| `is_internal` | BOOLEAN | NOT NULL, default false | **Internal notes are never returned to customers** |
| `source` | ENUM | NOT NULL, default `Web` | Web, or Email (inbound reply) |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

Index: (`complaint_id`, `created_at`).

### 3.3 `complaint_status_history`

Audit trail of every complaint status change (from, to, who, when, note).

| Column | Type | Constraints |
|---|---|---|
| `history_id` | INT | **PK** |
| `complaint_id` | INT | NOT NULL, FK → complaints ON DELETE CASCADE |
| `from_status` | VARCHAR(30) | NULL (first entry) |
| `to_status` | VARCHAR(30) | NOT NULL |
| `changed_by` | INT | NULL, FK → users ON DELETE SET NULL |
| `note` | VARCHAR(500) | NULL |
| `created_at` | DATETIME | NOT NULL |

### 3.4 `documents`

Metadata for private uploaded files. The files themselves are stored in `server/storage/documents`, outside the public `uploads` folder.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `document_id` | INT | **PK** | |
| `uploaded_by` | INT | NOT NULL, FK → users ON DELETE RESTRICT | |
| `category` | ENUM | NOT NULL, default `Other` | Complaint Evidence, Booking Document, Vehicle Document, Identity Document, Other |
| `complaint_id` | INT | NULL, FK → complaints ON DELETE CASCADE | |
| `booking_id` | INT | NULL, FK → test_drive_bookings ON DELETE CASCADE | |
| `vehicle_id` | INT | NULL, FK → vehicles ON DELETE CASCADE | |
| `original_name` | VARCHAR(255) | NOT NULL | Sanitised display name |
| `storage_key` | VARCHAR(100) | NOT NULL, **UNIQUE** | `<uuid>.<detected extension>`; never exposed by the API |
| `mime_type` | VARCHAR(100) | NOT NULL | From the detected content, not the browser |
| `extension` | VARCHAR(10) | NOT NULL | pdf, jpg, png, webp, docx |
| `size_bytes` | INT | NOT NULL, **CHECK > 0** | |
| `checksum_sha256` | CHAR(64) | NOT NULL | Integrity check |
| `description` | VARCHAR(500) | NULL | |
| `visibility` | ENUM | NOT NULL, default `Owner` | Owner (customer and staff) or Staff (internal only) |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

- **`finance_application_id`** (added in the 16-CRUD completion): INT NULL, FK → finance_applications ON DELETE SET NULL. The API deletes an application's documents and files before it deletes the application. Category **Finance Document** was added to the ENUM.
- **CHECK `chk_documents_single_link`:** a document links to at most one of complaint, booking or vehicle. The finance link is also limited to one record by the API.
- **Indexes:** `uploaded_by`, `complaint_id`, `booking_id`, `vehicle_id`, `category`.
- **Deleting a document** removes the row and the file inside one transaction. If the file cannot be removed, the row is kept.
- **Deleting a complaint or booking** removes its document rows by cascade, and the API deletes the stored files.

### 3.5 `email_logs`

The outbound email log and retry queue.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `email_id` | INT | **PK** | |
| `message_key` | VARCHAR(191) | NOT NULL, **UNIQUE** | Deduplication key, e.g. `complaint-12-status-40`; the same notification is never sent twice |
| `recipient`, `reply_to` | VARCHAR(150) | recipient NOT NULL | |
| `subject` | VARCHAR(255) | NOT NULL | |
| `template` | VARCHAR(60) | NOT NULL | e.g. `enquiry-admin`, `complaint-status` |
| `related_type`, `related_id` | VARCHAR(30), INT | NULL | Linked record (Enquiry, Booking, Complaint, User) |
| `status` | ENUM | NOT NULL, default `Queued` | Queued, Sending, **Accepted** (SMTP server accepted), Failed, **Preview** (SMTP not configured, not sent) |
| `attempts`, `max_attempts` | INT | NOT NULL, defaults 0 and 3 | |
| `next_attempt_at` | DATETIME | NULL | Retry back-off: 1, 5, 15 and 60 minutes |
| `last_error` | VARCHAR(500) | NULL | SMTP error code and message (never credentials) |
| `provider_message_id` | VARCHAR(255) | NULL | SMTP Message-ID |
| `accepted_at` | DATETIME | NULL | |
| `payload` | TEXT | NULL | Message content kept **only until accepted**, for retries; then cleared |
| `created_by` | INT | NULL, FK → users ON DELETE SET NULL | |

Indexes: (`status`, `next_attempt_at`), (`related_type`, `related_id`).

### 3.6 `inbound_emails`

Customer email replies received through the inbound webhook.

| Column | Type | Constraints |
|---|---|---|
| `inbound_id` | INT | **PK** |
| `provider_message_id` | VARCHAR(255) | **UNIQUE** (duplicate deliveries are ignored) |
| `from_address`, `subject`, `body` | | NOT NULL (body has quoted history stripped) |
| `status` | ENUM | Matched, Unmatched, Rejected (sender is not the record owner) |
| `complaint_id` | INT | NULL, FK → complaints ON DELETE SET NULL |
| `enquiry_id` | INT | NULL, FK → enquiries ON DELETE SET NULL |
| `complaint_message_id` | INT | NULL, FK → complaint_messages ON DELETE SET NULL |
| `received_at`, `created_at`, `updated_at` | DATETIME | NOT NULL |

### 3.7 `activity_logs`

Audit log of who changed what. It feeds the dashboard "Recent activity" panel and the Activity audit report.

| Column | Type | Constraints |
|---|---|---|
| `activity_id` | INT | **PK** |
| `actor_id` | INT | NULL, FK → users ON DELETE SET NULL |
| `actor_role` | VARCHAR(20) | |
| `action` | VARCHAR(60) | NOT NULL, e.g. `complaint.status_changed` |
| `entity_type`, `entity_id` | VARCHAR(40), INT | Indexed together |
| `summary` | VARCHAR(500) | NOT NULL |
| `ip_address` | VARCHAR(45) | |
| `created_at` | DATETIME | Indexed |

### 3.8 `saved_reports`

Saved report definitions (report CRUD).

| Column | Type | Constraints |
|---|---|---|
| `report_id` | INT | **PK** |
| `name` | VARCHAR(120) | NOT NULL; **UNIQUE together with `created_by`** |
| `report_type` | VARCHAR(40) | NOT NULL (validated against the report catalogue) |
| `filters` | TEXT | JSON of validated filters |
| `created_by` | INT | NOT NULL, FK → users ON DELETE CASCADE |
| `last_run_at` | DATETIME | NULL |

### 3.9 `reply_templates` — Naaziq, CRUD resource 4 (added in the 16-CRUD completion)

Saved replies that staff insert into enquiry responses and complaint replies.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `template_id` | INT | **PK** | |
| `title` | VARCHAR(120) | NOT NULL, **UNIQUE** | |
| `category` | ENUM | NOT NULL, default `General` | Enquiry, Complaint, General |
| `subject` | VARCHAR(180) | NULL | Optional email subject |
| `body` | TEXT | NOT NULL | May contain `{{customer_name}}`, `{{reference}}`, `{{vehicle}}`, `{{staff_name}}` |
| `is_active` | BOOLEAN | NOT NULL, default true | Inactive templates are hidden from the picker |
| `created_by`, `updated_by` | INT | NULL, FK → users ON DELETE SET NULL | Staff may change only their own templates |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

Indexes: unique `title`, (`category`, `is_active`).

### 3.10 `finance_applications` — Herathge, CRUD resource 3 (added in the 16-CRUD completion)

Customer applications for vehicle financing. The figures are a **snapshot** calculated by the server from the active financing configuration, so a later configuration change never alters an application already submitted.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `application_id` | INT | **PK** | |
| `reference` | VARCHAR(24) | **UNIQUE** | `HS-FIN-YYYY-NNNNN`, set in the same transaction as the insert |
| `customer_id` | INT | NOT NULL, FK → users ON DELETE CASCADE | |
| `vehicle_id` | INT | NULL, FK → vehicles ON DELETE SET NULL | |
| `vehicle_reference` | VARCHAR(180) | NOT NULL | e.g. "2020 Toyota Aqua S"; kept if the vehicle is removed |
| `config_id` | INT | NULL, FK → financing_configs ON DELETE SET NULL | Plan used for the calculation |
| `vehicle_price`, `down_payment`, `loan_amount`, `monthly_payment`, `monthly_income` | DECIMAL(14,2) | NOT NULL | |
| `term_months` | INT | NOT NULL | |
| `annual_interest_rate` | DECIMAL(6,3) | NOT NULL | Snapshot |
| `employment_type` | ENUM | NOT NULL | Salaried, Self-employed, Business owner, Other |
| `contact_phone` | VARCHAR(30) | NOT NULL | |
| `customer_notes` | TEXT | NULL | |
| `status` | ENUM | NOT NULL, default `Submitted` | Submitted, Under Review, Approved in Principle, Declined, Withdrawn |
| `decision_note` | TEXT | NULL | Shown to the customer |
| `staff_notes` | TEXT | NULL | Internal; never returned to the customer |
| `reviewed_by` | INT | NULL, FK → users ON DELETE SET NULL | |
| `reviewed_at` | DATETIME | NULL | |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

- **CHECK `chk_finance_amounts`:**
  - price > 0;
  - 0 ≤ down payment < price;
  - loan > 0;
  - term between 1 and 360 months;
  - income ≥ 0.
- **Indexes:** unique `reference`, `customer_id`, (`status`, `created_at`), `vehicle_id`.
- **API rules:**
  - minimum down payment % and maximum term come from the active configuration;
  - one open application per customer and vehicle;
  - the customer may edit only while the status is Submitted;
  - declining needs a decision note;
  - a withdrawn application cannot be reopened.

### 3.11 `session_events` — Ahamed, Sessions › "Check activity" (migration 202610150001)

One row per sign-in event: `login`, `login_failed`, `locked`, `unlocked`, `refresh`, `logout`, `revoked`, `signed_out_others`, `password_changed`, `password_reset`, `password_reset_requested`, `deactivated`.

| Column | Type | Notes |
|---|---|---|
| `event_id` | INT PK | |
| `session_id` | INT NULL → `admin_sessions` ON DELETE CASCADE | NULL for failed logins (no session was created) |
| `user_id` | INT NULL → `users` ON DELETE SET NULL | NULL when the email has no account |
| `actor_id` | INT NULL → `users` ON DELETE SET NULL | Who did it (for example the Admin who revoked the session) |
| `email` | VARCHAR(150) NULL | The email typed at sign-in (failed logins) |
| `event_type` | VARCHAR(30) | See the list above |
| `detail` | VARCHAR(255) NULL | For example "Wrong password", "Revoked by Mr. Mudashir" |
| `ip_address`, `user_agent`, `device_label` | | `device_label` is the readable form, e.g. "Chrome 129 on Windows 10/11" |
| `created_at` | DATETIME | |

Indexes: `session_events_session` (session_id), `session_events_user_time` (user_id, created_at), `session_events_type_time` (event_type, created_at).

### 3.12 `password_reset_tokens` — Ahamed, "Forgot password?" (migration 202610150001)

| Column | Type | Notes |
|---|---|---|
| `token_id` | INT PK | |
| `user_id` | INT → `users` ON DELETE CASCADE | |
| `token_hash` | CHAR(64) UNIQUE | SHA-256 of the emailed token. The token itself is never stored. |
| `expires_at` | DATETIME | `PASSWORD_RESET_MINUTES` after the request (default 30) |
| `used_at` | DATETIME NULL | Set when used. Older links are also closed when a new link is requested, so only the newest works. |
| `ip_address` | VARCHAR(45) NULL | |
| `created_at` | DATETIME | |

The reset email is stored in the outbox (`email_logs.payload`) only until the mail server accepts it; after that the payload is cleared, so the link is not kept in the database.

## 4. Modified tables

| Table | Change |
|---|---|
| `staff_permissions` | New column `can_manage_complaints` BOOLEAN NOT NULL DEFAULT false |
| `vehicles` | Index `hs26_vehicles_make_model` (make, model), and `hs26_vehicles_created_at` if no `created_at` index exists |
| `enquiries` | `hs26_enquiries_created_at` only if no `created_at` index exists (your database already has one, so it is skipped) |
| `test_drive_bookings` | `hs26_bookings_status_date` (status, preferred_date), skipped if already covered |
| `admin_sessions` | `hs26_sessions_created_at`, used by the sessions report |
| `wishlists` | New column `note` VARCHAR(255) NULL: the customer's private note (Wishlists UPDATE). Added in the 16-CRUD completion |
| `documents` | New column `finance_application_id` and the "Finance Document" category. Added in the 16-CRUD completion |
| `users` | **202610150001:** `must_change_password` BOOLEAN DEFAULT false (set for Admin-created accounts: the temporary password must be replaced at the first sign-in), `failed_login_count` INT DEFAULT 0, `locked_until` DATETIME NULL (account lockout), `password_changed_at` DATETIME NULL |
| `admin_sessions` | **202610150001:** `last_seen_at`, `refresh_count`, `ended_reason` (logout / revoked / signed_out_others / password_changed / password_reset / deactivated), `ended_by` → `users` ON DELETE SET NULL, `device_label` |
| `staff_permissions` | **202610150001:** `can_manage_bookings` (copied from `can_manage_enquiries` during the migration) and `can_export_reports` (copied from `can_view_limited_analytics`), so nobody loses access on the day of the upgrade |
| `financing_configs` | **202610150001:** `vehicle_id` INT NULL → `vehicles` ON DELETE CASCADE, with index `financing_configs_vehicle_active` (vehicle_id, is_active). NULL = the general plan; otherwise the plan belongs to that ONE vehicle |

## 5. Business rules enforced by the database and the API

| Rule | Where it is enforced |
|---|---|
| A complaint reference is unique | UNIQUE index, plus generation inside a transaction |
| A complaint, document or message cannot reference a missing user, vehicle or booking | Foreign keys |
| Deleting a complaint removes its messages, history and documents | ON DELETE CASCADE, plus file clean-up in the API |
| A customer account with complaints or documents cannot be hard-deleted | ON DELETE RESTRICT (accounts are deactivated instead) |
| A document belongs to at most one record and is never empty | CHECK constraints |
| The same email notification is never sent twice | UNIQUE `message_key` |
| An inbound email is processed once | UNIQUE `provider_message_id` |
| Multi-step changes are all-or-nothing (create complaint + reference + history + audit; status change + history; uploads; deletions; retries) | `sequelize.transaction(...)` |
| Status workflows (complaints, bookings, vehicles, responses) | Validated in controllers, with HTTP 422 for invalid transitions |
| A vehicle with an active test drive (Pending/Confirmed) or an open finance application (Submitted/Under Review) cannot be archived | `vehicle.controller.js` `archiveBlockedResponse()`, HTTP 409, for both the Archive button and the status change |
| One active financing plan per vehicle, plus one active general plan; activating a plan switches off the other active plan of the same vehicle (or the other general plan) | `domain.controller.js` `createFinance` / `activateFinance`, in a transaction |
| Only Available vehicles can be chosen for a new plan; an active plan cannot be deleted | `resolvePlanVehicle()` (422) and `deleteFinance` (409) |
| The plan used for a vehicle = its own active plan, otherwise the active general plan (calculator, vehicle cards, finance applications) | `services/finance.service.js` `activePlanFor()` |
| Admins cannot set or change another user's password; Admin-created accounts must change the temporary password first | `domain.controller.js` `updateUser` (422), `middleware/core.js` (403 `PASSWORD_CHANGE_REQUIRED`) |
| `LOGIN_LOCK_ATTEMPTS` (5) wrong passwords lock an account for `LOGIN_LOCK_MINUTES` (15) | `services/auth.service.js` `login()`, HTTP 423 `ACCOUNT_LOCKED` |

## 6. Seed data

| Command | Seeds |
|---|---|
| `npm --prefix server run db:seed` | Everything: the original demo data (admin, staff, 12 vehicles, enquiries, content, financing plan) **and** the demo complaints below. Use only on an empty database. |
| `npm --prefix server run db:seed:templates` | Five starter reply templates. Safe on an existing database: it skips any title that already exists. |
| `npm --prefix server run db:seed:complaints` | Only the demo complaints seeder. Safe on an existing database: it creates `customer@highstreet.lk` only if that account does not exist (password from `SEED_CUSTOMER_PASSWORD` in `.env`, or a random one printed once), never changes existing data, and does nothing if that customer already has complaints. |

> Note: if `customer@highstreet.lk` already exists in your database, the demo complaints are attached to that account and its password is left unchanged.

## 7. Time zone

Sequelize stores `DATETIME` values in UTC (`+00:00`), as before. When writing raw SQL, compare against `UTC_TIMESTAMP()` rather than `NOW()`.

## 8. Migration `202610160001` (15 October 2026)

**Staff availability, Unarchive and permanent Staff deletion.** Additive: existing rows are kept.

| Change | Details |
|---|---|
| New table `staff_leave` | `leave_id` PK; `staff_id` → `users.user_id` (ON DELETE CASCADE); `start_date`, `end_date` (DATE); `reason` VARCHAR(150) NULL; `created_by` → `users.user_id` (ON DELETE SET NULL); `created_at`, `updated_at`. Index `staff_leave_staff_dates (staff_id, start_date, end_date)`. |
| `vehicles.status_before_archive` | VARCHAR(20) NULL. The status a vehicle had when it was archived; Unarchive puts it back and clears it. |
| `enquiry_responses.admin_id` | Was NOT NULL with ON DELETE NO ACTION. Now NULL allowed, ON DELETE SET NULL (FK `enquiry_responses_admin_id_fk`). |
| `documents.uploaded_by` | Was NOT NULL with ON DELETE RESTRICT. Now NULL allowed, ON DELETE SET NULL (FK `documents_uploaded_by_fk`). |

**Rules enforced (API + database):**
- A test drive can be assigned only to an active Staff member with `can_manage_bookings`, who is not on leave that day (`staff_leave`) and has no other Pending/Confirmed test drive within `TEST_DRIVE_SLOT_MINUTES` (default 60) of it.
- Leave entries of one Staff member cannot overlap.
- Only Staff accounts can be permanently deleted. Their `staff_permissions`, `admin_sessions`, `saved_reports`, `staff_leave` and `password_reset_tokens` rows go with them (CASCADE); assignment columns become NULL; responses and documents are kept with a NULL author.

`down()` removes `staff_leave` and `status_before_archive`, and puts the two foreign keys back to their old rules. NOT NULL is put back only if no row was left without an author.
