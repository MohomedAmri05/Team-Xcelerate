# High Street API v1

## Base URL

```text
http://localhost:5000/api/v1
```

## Response Format

Successful responses normally contain:

```json
{
  "success": true,
  "message": "Operation completed",
  "data": {},
  "meta": {}
}
```

Error responses normally contain:

```json
{
  "success": false,
  "message": "Error description",
  "errors": []
}
```

Protected routes require:

```http
Authorization: Bearer <accessToken>
```

## Roles

- `Customer`
- `Staff`
- `Admin`

Staff routes may also require an assigned permission.

## Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a Customer account |
| POST | `/auth/login` | Public | Authenticate a user |
| POST | `/auth/refresh` | Public with refresh token | Rotate the session tokens |
| POST | `/auth/logout` | Authenticated | Revoke the current session |
| GET | `/auth/me` | Authenticated | Retrieve the current user and permissions |
| PUT | `/auth/profile` | Authenticated | Update the current user profile |
| PUT | `/auth/change-password` | Authenticated | Change the current password |

## Vehicles

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/vehicles` | Optional authentication | List visible vehicles |
| GET | `/vehicles/:id` | Optional authentication | Retrieve one visible vehicle |
| POST | `/vehicles` | Admin or permitted Staff | Create a Draft vehicle |
| PUT | `/vehicles/:id` | Admin or permitted Staff | Update a vehicle |
| PATCH | `/vehicles/:id/status` | Admin or permitted Staff | Change vehicle status |
| DELETE | `/vehicles/:id` | Admin or Staff with archive permission | Soft-archive a vehicle |

Vehicle statuses:

- `Draft`
- `Available`
- `Sold`
- `Archived`

Visibility rules:

- Guests see Available vehicles.
- Customers see Available and Sold vehicles.
- Admin and authorized Staff can manage operational inventory.
- A vehicle requires at least one image before becoming Available.

### Vehicle Query Parameters

| Parameter | Description |
|---|---|
| `search` | Search by make or model |
| `type` | Filter by vehicle type |
| `make` | Filter by make |
| `model` | Filter by model |
| `minYear` | Minimum year |
| `maxYear` | Maximum year |
| `minPrice` | Minimum price |
| `maxPrice` | Maximum price |
| `condition` | Filter by condition |
| `fuelType` | Filter by fuel type |
| `transmission` | Filter by transmission |
| `status` | Management status filter |
| `sort` | Sort result |
| `page` | Page number |
| `limit` | Records per page, maximum 50 |
| `includeArchived` | Include archived records for authorized management users |

Supported `sort` values:

- `newest`
- `price_asc`
- `price_desc`
- `year`
- `mileage`

## Vehicle Images

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/vehicles/:vehicleId/images` | Public | List a vehicle’s images |
| POST | `/vehicles/:vehicleId/images` | Admin or permitted Staff | Upload vehicle images |
| PATCH | `/vehicle-images/:id` | Admin or permitted Staff | Update image details |
| DELETE | `/vehicle-images/:id` | Admin | Permanently delete an image and stored file |

Image uploads use `multipart/form-data`.

Fields:

- `images` — repeated file field
- `altText` — optional shared alternative text

Restrictions:

- JPEG, PNG and WebP only
- Maximum 5 MB per image
- Maximum 10 images per request

## Customer Wishlist

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/wishlist` | Customer | List the customer’s saved vehicles |
| GET | `/wishlist/:vehicleId/check` | Customer | Check whether a vehicle is saved |
| POST | `/wishlist/:vehicleId` | Customer | Add an Available vehicle |
| DELETE | `/wishlist/:vehicleId` | Customer | Remove a saved vehicle |

## Customer Enquiries

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/enquiries` | Customer | Submit an enquiry |
| GET | `/my/enquiries` | Customer | List the customer’s enquiries |
| GET | `/my/enquiries/:id` | Record owner | Retrieve one customer enquiry |

New enquiries may generate an Admin notification email.

## Enquiry Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/enquiries` | Admin or permitted Staff | List accessible enquiries |
| GET | `/enquiries/:id` | Admin or assigned Staff | Retrieve an enquiry |
| PATCH | `/enquiries/:id` | Admin or assigned Staff | Update enquiry status/details |
| PATCH | `/enquiries/:id/assign` | Admin | Assign an enquiry to Staff |
| DELETE | `/enquiries/:id` | Admin | Permanently delete an enquiry |

Staff can access only enquiries assigned to them.

## Enquiry Responses

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/enquiries/:enquiryId/responses` | Admin or assigned Staff | List responses |
| POST | `/enquiries/:enquiryId/responses` | Admin or assigned Staff | Create a Draft response |
| PUT | `/enquiry-responses/:id` | Admin or assigned Staff | Update a Draft response |
| DELETE | `/enquiry-responses/:id` | Admin | Delete a Draft response |
| POST | `/enquiry-responses/:id/send` | Admin or assigned Staff | Email and mark a response Sent |

A response remains Draft if its email is not delivered.

## Customer Test-Drive Bookings

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/bookings` | Customer | Request a test drive |
| GET | `/my/bookings` | Customer | List the customer’s bookings |
| GET | `/my/bookings/:id` | Record owner | Retrieve one booking |
| PATCH | `/my/bookings/:id/cancel` | Record owner | Cancel an eligible booking |

Test drives can be requested only for Available vehicles.

## Test-Drive Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/bookings` | Admin or permitted Staff | List accessible bookings |
| GET | `/bookings/:id` | Admin or assigned Staff | Retrieve one booking |
| PATCH | `/bookings/:id` | Admin or assigned Staff | Update a booking |
| PATCH | `/bookings/:id/assign` | Admin | Assign a booking to Staff |
| DELETE | `/bookings/:id` | Admin | Delete a booking |

## Users

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/users` | Admin | List users |
| GET | `/users/:id` | Admin | Retrieve one user |
| POST | `/users` | Admin | Create a user |
| PUT | `/users/:id` | Admin | Update a user |
| PATCH | `/users/:id/status` | Admin | Activate or deactivate a user |
| DELETE | `/users/:id` | Admin | Deactivate a user |

The final active Admin cannot be deactivated or changed to another role. Deactivating a user revokes their active sessions.

## Staff Permissions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/users/:id/permissions` | Admin | Retrieve Staff permissions |
| PUT | `/users/:id/permissions` | Admin | Update Staff permissions |

Available Staff permissions:

- `canManageInventory`
- `canManageEnquiries`
- `canViewAssignedContacts`
- `canArchiveRecords`
- `canViewLimitedAnalytics`

## Sessions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/sessions` | Authenticated | List the current user’s active sessions |
| POST | `/sessions/refresh` | Refresh token | Refresh a session |
| DELETE | `/sessions/:id` | Session owner | Revoke one session |
| DELETE | `/sessions` | Authenticated | Revoke all other sessions |

Users can manage only their own sessions.

## Company Content

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/content` | Optional authentication | List visible content |
| GET | `/content/:slug` | Public | Retrieve published content by slug |
| POST | `/content` | Admin | Create content |
| PUT | `/content/:id` | Admin | Update content |
| DELETE | `/content/:id` | Admin | Delete content |

Guests receive published content only. An authenticated Admin can retrieve published and draft records.

## Financing Configurations

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/financing-config/active` | Public | Retrieve the active configuration |
| GET | `/financing-config` | Admin | List all configurations |
| POST | `/financing-config` | Admin | Create a configuration |
| PUT | `/financing-config/:id` | Admin | Update or activate a configuration |
| DELETE | `/financing-config/:id` | Admin | Delete an inactive configuration |

Only one financing configuration can be active at a time. The active configuration cannot be deleted until another configuration is activated.

## Health Check

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Confirm that the API is running |

Example:

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
```
---

# Additions — October 2026

All endpoints below use the same response format and `Authorization: Bearer <accessToken>` header as above.

## Vehicles (additions)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| PATCH | `/vehicles/:id/restore` | Admin or Staff with `canArchiveRecords` | Restore an archived vehicle as Draft |

`GET /vehicles?search=` now:
- treats `%` and `_` literally;
- also matches type and colour;
- supports combined "make model" searches such as `toyota aqua`;
- matches a vehicle ID for management users.

## Test-drive bookings (additions)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| PATCH | `/my/bookings/:id` | Record owner | Reschedule a **Pending** request: `preferredDate`, `preferredTime`, `customerNote` |

Booking creation, status changes and customer cancellations send email notifications. The response includes `meta.emailStatus`.

## Enquiries (additions)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/enquiries?search=` | Admin or permitted Staff | Search by customer name, email, vehicle, message or ID |
| GET | `/enquiries/:id/inbound` | Admin or assigned Staff | Customer replies received by email |

A new enquiry emails the admin notification mailbox (Reply-To: the customer) and sends the customer an acknowledgement (Reply-To: `MAIL_REPLY_TO`). Subjects carry `[HS-ENQ-<id>]` for reply threading. Sending a response is idempotent: the same response is emailed at most once.

## Complaints

Status workflow: `Submitted → Under Review → In Progress → Resolved → Closed`.

**Customer**

| Method | Endpoint | Description |
|---|---|---|
| POST | `/complaints` | Submit: `category`, `subject` (5–180), `description` (20–5000), optional `priority`, `vehicleId`, `bookingId`, `enquiryId`. Returns the `reference`. Rate-limited to 6 per 15 minutes. |
| GET | `/my/complaints?status=&search=` | Own complaints |
| GET | `/my/complaints/:id` | Detail with public messages, status history and visible documents (internal notes excluded) |
| POST | `/my/complaints/:id/messages` | Add a message `{ body }` (not when Closed) |
| PATCH | `/my/complaints/:id/close` | Confirm a Resolved complaint and close it |
| PATCH | `/my/complaints/:id/reopen` | Reopen a Resolved or Closed complaint within 30 days: `{ reason }` |

**Admin, or Staff with `canManageComplaints` (Staff see only complaints assigned to them)**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/complaints` | Query parameters below. `meta.statusCounts` gives the counts for the filter chips. |
| GET | `/complaints/:id` | Full detail including internal notes and `allowedTransitions` |
| PATCH | `/complaints/:id` | `{ status?, priority?, category?, resolutionSummary?, note?, notifyCustomer? }`. Invalid transitions return 422; Resolved requires a summary. |
| PATCH | `/complaints/:id/assign` | Admin only: `{ staffId \| null }` (assignee needs the complaints permission) |
| POST | `/complaints/:id/messages` | `{ body, isInternal }`. Non-internal messages are emailed to the customer. |
| DELETE | `/complaints/:id` | Admin only: permanent delete, including messages, history and documents |

`GET /complaints` query parameters: `search`, `status`, `category`, `priority`, `assignedTo` (`me` / `unassigned` / id), `dateFrom`, `dateTo`, `sort` (`newest` / `oldest` / `activity` / `priority` / `status` / `reference`), `page`, `limit`. `search` matches a reference prefix, subject, description, customer name or email, or an ID.

## Documents (private files)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/documents` | Authenticated | `multipart/form-data` (fields listed below) |
| GET | `/documents` | Authenticated (scoped) | List with filters (below) |
| GET | `/documents/:id` | Authorised viewer | Metadata |
| GET | `/documents/:id/download` | Authorised viewer | File download (`?disposition=inline` previews PDFs and images) |
| PATCH | `/documents/:id` | Uploader or Admin | `{ originalName?, description?, category?, visibility? }` |
| DELETE | `/documents/:id` | Uploader or Admin | Deletes the row and the stored file |

**Upload fields** for `POST /documents`:
- `file` (required);
- one optional link: `complaintId`, `bookingId` or `vehicleId`;
- optional `category`, `description` and `visibility` (`Owner` or `Staff`; staff only).

**Upload rules:**
- Allowed types: PDF, JPEG, PNG, WebP, DOCX, **detected from the file content**. Anything else returns 415.
- Maximum size is `MAX_DOCUMENT_MB` (default 8 MB); larger files return 413.
- Files are stored under random names outside the public folder.

**List filters** for `GET /documents`: `search`, `category`, `linkedType` (Complaint / Booking / Vehicle / None), `fileType`, `complaintId`, `bookingId`, `vehicleId`, `dateFrom`, `dateTo`, `sort`, `page`, `limit`.

**Who can open a document:**
- Customers: their own uploads, plus non-internal documents on their own complaints and bookings.
- Staff: records assigned to them, and vehicle documents if they have the inventory permission.
- Admin: everything.

Unauthorised requests receive 404, so the existence of other people's files is not revealed.

## Reports

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/reports/types` | Admin / Staff | Report catalogue with filter definitions (filtered by permission) |
| GET | `/reports/:type` | Permitted user | Generate: rows (up to 2,000 on screen), totals, summary and breakdown groups |
| GET | `/reports/:type/export/:format` | Permitted user | `csv`, `xlsx` or `pdf` (up to 20,000 rows); `X-Report-Rows` header |
| GET / POST | `/saved-reports` | Admin / Staff | List or create saved report definitions `{ name, reportType, filters }` |
| PUT / DELETE | `/saved-reports/:id` | Owner | Update or delete |
| GET | `/saved-reports/:id/run` | Owner | Run a saved report |

**Report types:** `vehicles`, `vehicle-demand`, `enquiries`, `bookings`, `complaints`, `users`, `sessions`, `documents`, `emails`, `activity`, `finance-applications` (Admin only).

**Common filters:** `dateFrom`, `dateTo` (YYYY-MM-DD, inclusive) and `search`, plus type-specific enumerated filters. Invalid values return 422.

**Access:**
- Admin: all types.
- Staff with `canViewLimitedAnalytics`: vehicles, vehicle demand and bookings, plus enquiries (with the enquiry permission) and complaints (with the complaints permission), limited to records assigned to them.
- Customer email and phone columns are omitted for Staff without `canViewAssignedContacts`.

## Dashboard and notifications

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/dashboard/summary` | Admin / Staff | Live counts by status, upcoming test drives, recent activity, `attention` badges (scoped for Staff) |
| GET | `/my/notifications?since=ISO` | Customer | Complaint status changes and replies, enquiry responses and booking decisions |

## Email delivery

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/emails?status=&search=` | Admin | Outbox log with `meta.configuration` (no secrets) |
| GET | `/emails/config` | Admin | Current SMTP, sender and reply-to configuration |
| POST | `/emails/verify` | Admin | Test the SMTP connection and credentials |
| POST | `/emails/test` | Admin | Send a test message to your own address or the admin mailbox only |
| POST | `/emails/:id/retry` | Admin | Resend a Failed, Preview or Queued message |
| POST | `/emails/process` | Admin | Run the retry queue now (it also runs every minute) |
| GET | `/inbound-emails` | Admin | Replies received through the webhook |
| POST | `/inbound/email` | Shared secret | Inbound webhook (see README › Email › Receiving replies) |


## 16-CRUD completion (October 2026)

Every `:id`-style parameter must be a positive whole number. Anything else gets **404** (it used to cause a server error).

### Wishlists — Amri (UPDATE added)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/wishlist/:vehicleId` | Customer | Save a vehicle; optional body `{ note }` |
| PATCH | `/wishlist/:vehicleId` | Customer | Edit the private note `{ note }` (max 255; empty clears it) |

### Reply templates — Naaziq

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/reply-templates?category=&includeGeneral=true&active=true&search=` | Admin; Staff with enquiry or complaint permission | List; `meta.placeholders` lists the placeholders |
| GET | `/reply-templates/:id` | same | One template |
| POST | `/reply-templates` | same | `{ title, category, subject?, body, isActive? }`; duplicate title → 409 |
| PUT | `/reply-templates/:id` | Admin, or the Staff member who created it | Update |
| DELETE | `/reply-templates/:id` | Admin, or the Staff member who created it | Delete |

### Staff permissions — Ahamed (CREATE and DELETE added)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/users/:id/permissions` | Admin | Create the record (flags optional, default false); 409 if it exists |
| GET | `/users/:id/permissions` | Admin | Read; `data.exists` is false when there is no record (nothing is created) |
| PUT | `/users/:id/permissions` | Admin | Update (creates the record if missing, as before) |
| DELETE | `/users/:id/permissions` | Admin | Delete the record = remove all access; 404 if there is none |

`POST /users` for a Staff account now also creates a no-access permission record.

### Finance applications — Herathge

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/finance-applications` | Customer | `{ vehicleId, downPayment, termMonths, employmentType, monthlyIncome, contactPhone, customerNotes? }`. The server calculates the loan and monthly payment with the active configuration. 422 if under the minimum down payment or over the maximum term; 409 if an open application already exists for that vehicle; 503 if no plan is active. |
| GET | `/my/finance-applications` | Customer | Own applications (no internal notes) |
| GET | `/my/finance-applications/:id` | Customer | One application, with `documents` |
| PUT | `/my/finance-applications/:id` | Customer | Edit while `Submitted`; recalculated |
| PATCH | `/my/finance-applications/:id/withdraw` | Customer | Submitted / Under Review → Withdrawn |
| DELETE | `/my/finance-applications/:id` | Customer | Allowed when Submitted, Withdrawn or Declined; deletes its documents |
| GET | `/finance-applications?status=&search=&from=&to=` | Admin | List; `meta.counts` by status |
| GET | `/finance-applications/:id` | Admin | Details with customer, vehicle and documents |
| PATCH | `/finance-applications/:id` | Admin | `{ status, decisionNote?, staffNotes? }`. Declined needs `decisionNote`; Withdrawn cannot be reopened. The customer is emailed on a status change. |
| DELETE | `/finance-applications/:id` | Admin | Delete with its documents and files |

### Documents

`POST /documents` also accepts `financeApplicationId`: the application's owner or an Admin can attach files, and the category defaults to **Finance Document**. `GET /documents` accepts `financeApplicationId` and `linkedType=Finance`.

### Customer enquiries

`GET /my/enquiries` and `GET /my/enquiries/:id` now include `responses`: the replies that were **sent** (subject, text, sent time). Drafts are never included.

### Dashboard

`GET /dashboard/summary` (Admin) includes `financeApplications` (by status, `awaiting`), `replyTemplates` (active, total) and `attention.awaitingFinance`. `GET /my/notifications` includes finance application decisions.


## Users, Sessions, Staff Permissions and per-vehicle financing (October 2026)

### Passwords – only the account owner

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/forgot-password` | Public (5 requests / 15 min per client) | `{ email }`. Always answers 200 with the same message. If an active account exists, emails a one-time link `<CLIENT_URL>/reset-password?token=…` (expires after `PASSWORD_RESET_MINUTES`). |
| POST | `/auth/reset-password` | Public (same limit) | `{ token, newPassword }`. 400 if the link is invalid, used or expired; 422 for a weak password. Signs out every session and emails a confirmation. |
| PUT | `/auth/change-password` | Signed in | As before. It also clears `mustChangePassword`. |
| PUT | `/users/:id` | Admin | **Changed:** a `password` field is refused with 422. Admins cannot change other people's passwords. |
| POST | `/users` | Admin | **Changed:** the password is temporary. The account gets `mustChangePassword: true`. |

When `mustChangePassword` is true, every request except `/auth/me`, `/auth/change-password`, `/auth/logout` and `/my/notifications` answers **403** with `code: "PASSWORD_CHANGE_REQUIRED"`. The login response's `user.mustChangePassword` tells the website to open Profile › Change password.

**Login lockout:**
- After `LOGIN_LOCK_ATTEMPTS` (5) wrong passwords in a row, the account is locked for `LOGIN_LOCK_MINUTES` (15).
- While it is locked, the right password gets **423** with `code: "ACCOUNT_LOCKED"` and `lockedUntil`.
- A wrong password still gets the usual 401, so the answer never reveals whether an account exists.

### Users

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/users?search=&role=&status=active\|inactive\|locked&sort=newest\|oldest\|name\|lastLogin&page=&limit=` | Admin | `page` is optional; without it, all accounts are returned as before. Each user has `isLocked` and `activeSessions`. `meta.counts` has `__all`, `Admin`, `Staff`, `Customer`, `Active`, `Inactive`, `Locked`. |
| GET | `/users/:id/overview` | Admin | Detail panel: the profile, `permissions`, the last 8 `sessions`, `activeSessions`, `failedLogins30Days`, and the last 15 `activity` entries |
| PATCH | `/users/:id/unlock` | Admin | Clears the lockout |
| POST | `/users/bulk` | Admin | `{ action: "activate"\|"deactivate", userIds: [] }`. Returns `{ updated, skipped }`. Your own account and the final active Admin are skipped. |
| PATCH | `/users/:id/status` | Admin | As before, but an Admin cannot deactivate their own account (409) |

### Sessions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/sessions?scope=all&status=active\|expired\|revoked\|logged_out\|ended\|all&search=&from=&to=&role=&device=desktop\|mobile&sort=newest\|oldest\|lastSeen\|longest&page=&limit=` | Signed in (`scope=all` Admin only) | Without `status`, only active sessions are returned, as before. Each session has `status`, `endedLabel`, `endedByUser`, `device { label, type }`, `lastSeenAt`, `refreshCount`, `durationMs`. `meta.counts` holds the numbers for the status chips. |
| GET | `/sessions/:id/activity` | Owner or Admin | **Check activity:** `session`, `timeline` (login, refreshes, logout / revoke / expiry, with who did it), `otherSessions`, and `failedLogins` from the last 30 days |
| GET | `/sessions/login-history?type=all\|success\|failed\|locked&search=&from=&to=&page=&limit=` | Admin | Sign-in events, including failed attempts and lockouts. `meta.failed24h`, `meta.lockedAccounts` |
| DELETE | `/sessions/:id`, `/sessions` | As before | They now also record who ended the session, and why |

### Staff permissions (8)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/staff-permissions?search=&status=active\|inactive\|missing&has=<permission>` | Admin | Every Staff member with `permissions`, `exists` and `grantedCount`. `meta.counts` and `meta.fields` (8 permissions). |
| PUT/POST | `/users/:id/permissions` | Admin | The new flags `canManageBookings` and `canExportReports` are optional; a missing flag stays unchanged. `undo: true` records the change as `permissions.restored` in the audit log. |

**What the two new permissions control:**
- **`canManageBookings`:** `/bookings` (GET, GET `:id`, PATCH), plus booking documents and booking counts on the dashboard. Before this update, these used `canManageEnquiries`.
- **`canExportReports`:** Staff need it for `GET /reports/:type/export/:format` (otherwise 403). Viewing reports still needs only `canViewLimitedAnalytics`.

### Financing configurations – one plan for one vehicle

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/financing-config` | Admin | `{ count, rows }`. Each plan has `vehicleId`, `vehicle` (name, price, status, images), `scope` (`vehicle` or `general`) and `example` (`minDownPayment`, `fromMonthly`). |
| POST | `/financing-config` | Admin | As before, plus `vehicleId` (null or missing = general plan). Only Available vehicles (422 otherwise). `isActive: true` switches off the other active plan of the same vehicle, or the other general plan. |
| PUT | `/financing-config/:id` | Admin | As before. `vehicleId` can be changed, and a plan may keep a vehicle that has since been sold. Without `vehicleId`, the vehicle stays the same. |
| GET | `/financing-config/active?vehicleId=` | Public | That vehicle's own active plan, otherwise the active general plan. `vehicleSpecific` tells which one it is. |
| GET | `/vehicles`, `/vehicles/:id` | As before | Each vehicle now has `financePlan { configId, name, annualInterestRate, minDownPaymentPct, maxLoanTermMonths, vehicleSpecific, minDownPayment, fromMonthly }`. |

Finance applications are calculated with the vehicle's plan, by the same rule.

## Staff availability, Unarchive and Delete staff (15 October 2026)

### Test-drive staff availability (Amri)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/bookings/staff-availability?ids=1,2,3` | Admin | `{ staff: [{ userId, name, email }], bookings: { <bookingId>: { <userId>: { available, code, reason } } }, slotMinutes }`. `code` is `available`, `busy`, `on_leave`, `no_permission` or `inactive`. |
| GET | `/staff-availability?date=YYYY-MM-DD` | Admin | For every Staff member that day: `{ onLeave, leaveReason, leaveUntil, testDrives: ['10:00', …], state }`, where `state` is `Available`, `Busy` or `On leave`. |
| GET | `/staff-leave?staffId=&from=&upcoming=false` | Admin | Leave entries (upcoming by default) with `staff` and `creator`. |
| POST | `/staff-leave` | Admin | `{ staffId, startDate, endDate, reason? }`. 201, with `meta.affectedBookings` listing test drives already assigned in those days. 409 if it overlaps existing leave; 422 for non-Staff accounts or a last day before the first day. |
| DELETE | `/staff-leave/:id` | Admin | Removes the leave entry. |
| PATCH | `/bookings/:id/assign` | Admin | **New rule:** refuses with 422 (`meta.code`) a Staff member who is busy within `TEST_DRIVE_SLOT_MINUTES` (default 60), on leave that day, or lacks `canManageBookings`. |

### Vehicles: archive and Unarchive (Amri)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| DELETE | `/vehicles/:id` | Admin or Staff with `canArchiveRecords` | Archive (soft delete). The current status is saved in `statusBeforeArchive`. |
| PATCH | `/vehicles/:id/status` | As before | `{ status: 'Archived' }` now does exactly the same as DELETE (same permission, same active-booking / open-application rule, sets `deleted_at`). |
| PUT | `/vehicles/:id` | As before | `status: 'Archived'` in the edit form also archives, with the same rules. |
| PATCH | `/vehicles/:id/restore` | Admin or Staff with `canArchiveRecords` | **Unarchive:** the vehicle returns to `statusBeforeArchive` (Draft / Available / Sold). It becomes a Draft when nothing was saved, or when it would be Available without an image. 409 if it is not archived. |
| GET | `/vehicles?includeArchived=true` | Admin / Staff | Archived vehicles now include `deletedAt` and `statusBeforeArchive` in the JSON. |

### Staff Permissions: Reset and Delete staff (Ahamed)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| PATCH | `/users/:id/permissions/reset` | Admin | **Reset:** every permission set to false. The record is kept (created with no access if missing). Audit log `permissions.reset` with the previous permissions. |
| GET | `/staff-permissions?status=active\|inactive\|locked\|password\|leave\|missing&date=` | Admin | Each row now has `user.accountState` (`Active`, `Inactive`, `Locked`, `Password change needed`) and `availability` for `date` (default today). `meta.counts` adds Locked, Password change needed and On leave. |
| DELETE | `/users/:id/permanent` | Admin | **Delete staff:** permanently deletes one **Staff** account (422 for Admins and Customers). Returns `unassigned { bookings, enquiries, complaints }`. |
| POST | `/users/bulk-delete` | Admin | `{ userIds: [..] }`, 1–200 ids. `{ deleted: [..], skipped: [{ userId, reason }] }`. |

What happens to a deleted Staff member's records is decided by the database foreign keys: sessions, permissions, saved reports and leave are removed; assignments become `NULL` (unassigned); responses, documents, complaint messages, activity and templates are kept with an empty author. `DELETE /users/:id` (without `/permanent`) still only **deactivates** an account, as before.
