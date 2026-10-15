# High Street Testing Guide

This document records the automated tests, build checks and manual acceptance tests for the High Street vehicle sales platform.

## Test Environment

The final local verification was performed using:

- Windows 11
- Node.js 24
- Vite development server
- Express API on port 5000
- React client on port 5173
- MySQL through XAMPP/phpMyAdmin
- Google Gmail SMTP with an App Password

## Automated Tests

### Backend Tests

Run:

```powershell
npm.cmd --prefix server test
```

Verified result:

```text
Test Files  2 passed
Tests       5 passed
```

Backend tests cover:

- API health endpoint.
- Unauthenticated protected-route rejection.
- JSON response for unknown API routes.
- Amortized finance calculation.
- Zero-interest finance calculation.

### Frontend Tests

Run:

```powershell
npm.cmd --prefix client test -- --run
```

Verified result:

```text
Test Files  1 passed
Tests       1 passed
```

The frontend component test verifies:

- Finance estimate output.
- Finance disclaimer display.

## Production Build Test

Run:

```powershell
npm.cmd --prefix client run build
```

Expected result:

```text
✓ built in ...
```

The build must complete without compilation errors.

## API Health Test

Start the backend:

```powershell
npm.cmd --prefix server run dev
```

Run:

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
```

Expected response:

```text
success : True
message : High Street API is healthy
```

## Authentication Tests

- Register a Customer account with valid information.
- Reject invalid registration data.
- Log in with valid credentials.
- Reject an incorrect email or password.
- Retrieve the authenticated user through `/auth/me`.
- Refresh an authenticated session.
- Log out and confirm the session is revoked.
- Reject expired or revoked access tokens.
- Confirm password hashes and refresh-token hashes are not returned.
- Confirm repeated login attempts are rate-limited.

## Role and Permission Tests

### Guest

- Can view Available vehicles.
- Cannot view Draft, Sold or Archived vehicles.
- Cannot access the Admin dashboard.
- Cannot call protected management endpoints.

### Customer

- Can view Available and Sold vehicles.
- Cannot view Draft or Archived vehicles.
- Can manage only their own wishlist.
- Can view only their own enquiries.
- Can view only their own bookings.
- Cannot access Admin or Staff management endpoints.

### Staff

- Sees only dashboard sections granted by Staff permissions.
- Permission visibility remains correct after refresh.
- Can manage inventory only with `canManageInventory`.
- Can archive vehicles only with `canArchiveRecords`.
- Can manage enquiries only with the required enquiry permissions.
- Can access only enquiries and bookings assigned to them.
- Can manage only their own sessions.
- Cannot access Users, Permissions, Content or Financing.

### Admin

- Can access every dashboard manager.
- Can assign Staff permissions.
- Can assign enquiries and bookings.
- Can manage users.
- Can manage content and financing configurations.
- Cannot deactivate or demote the final active Admin.

## Vehicle Tests

- Create a vehicle as Draft.
- Confirm a new vehicle cannot be created directly as Available.
- Update all editable vehicle fields.
- Search vehicles by make or model.
- Filter by supported vehicle attributes.
- Sort by newest, price, year and mileage.
- Paginate vehicle results.
- Reject publication when the vehicle has no images.
- Publish the vehicle after uploading an image.
- Mark a vehicle Sold.
- Confirm Customers can still view Sold vehicles.
- Confirm Guests cannot view Sold vehicles.
- Soft-archive a vehicle.
- Confirm archived vehicles are hidden from the public store.

## Vehicle Image Tests

- Upload one image.
- Upload multiple images.
- Accept JPEG, PNG and WebP.
- Reject unsupported file formats.
- Reject an image larger than 5 MB.
- Reject more than 10 files in one request.
- Store files using UUID filenames.
- Display uploaded images through `/uploads`.
- Update alternative text.
- Update display order.
- Select a primary image.
- Ensure only one primary image exists per vehicle.
- Permanently delete an image as Admin.
- Confirm deleting the primary image selects a replacement when available.
- Confirm deleting an image removes its stored file.

## Wishlist Tests

- Add an Available vehicle.
- Confirm duplicate wishlist entries are prevented.
- List the Customer’s saved vehicles.
- Check whether a vehicle is saved.
- Remove a saved vehicle.
- Reject wishlist access from another Customer.
- Reject adding an unavailable vehicle.

## Enquiry Tests

- Submit an enquiry for an Available vehicle.
- Reject an enquiry shorter than the validation requirement.
- Reject an enquiry for an unavailable vehicle.
- Store the authenticated Customer as the enquiry owner.
- Preserve the vehicle reference snapshot.
- Send an Admin notification email.
- List the Customer’s own enquiries.
- Prevent one Customer from viewing another Customer’s enquiry.
- List management enquiries newest first.
- Filter enquiries by status.
- Assign an enquiry to Staff.
- Prevent Staff from accessing an unassigned enquiry.
- Update enquiry status.
- Delete an enquiry as Admin.

## Enquiry Response Tests

- Create a Draft response.
- List responses for an enquiry.
- Update a Draft response.
- Prevent editing a Sent response.
- Send a response through configured SMTP.
- Confirm the Customer receives the email.
- Mark the response Sent only after successful delivery.
- Update the enquiry status to Responded.
- Store `sentAt`, `respondedAt` and `respondedBy`.
- Keep the response as Draft if email delivery fails.
- Delete a Draft response as Admin.
- Prevent deletion of a Sent response.

## Test-Drive Booking Tests

- Create a booking for an Available vehicle.
- Reject booking requests for unavailable vehicles.
- List the Customer’s own bookings.
- Prevent Customers from viewing another Customer’s booking.
- Cancel an eligible Customer booking.
- Assign a booking to Staff.
- Prevent Staff from accessing an unassigned booking.
- Update booking status.
- Delete a booking as Admin.

## User Tests

- Create Admin, Staff and Customer accounts through management.
- Hash newly created passwords.
- List users without exposing password hashes.
- Update user information.
- Update a user password securely.
- Activate a user.
- Deactivate a user.
- Revoke active sessions when a user is deactivated.
- Prevent deactivation of the final active Admin.
- Prevent changing the final active Admin to another role.

## Staff Permission Tests

- Retrieve Staff permissions.
- Create default permissions when none exist.
- Update Staff permissions.
- Reject permissions for non-Staff accounts.
- Confirm sidebar visibility reflects saved permissions.
- Refresh the Staff dashboard and confirm permissions remain visible.

## Session Tests

- List only the authenticated user’s sessions.
- Exclude refresh-token hashes from responses.
- Identify the current session.
- Revoke another session.
- Prevent users from revoking another user’s session.
- Revoke all other sessions.
- Keep the current session active when logging out other devices.
- Reject a revoked session token.

## Company Content Tests

- Create a Draft content record.
- List Draft and Published records as Admin.
- Hide Draft content from public requests.
- Publish content.
- Retrieve published content by section slug.
- Update content text, image URL and display order.
- Delete content as Admin.
- Reject Customer and Staff authoring attempts.

## Financing Tests

- Create a financing configuration.
- Update a financing configuration.
- Activate a configuration.
- Ensure only one configuration is active.
- Retrieve the active configuration publicly.
- Disable deletion of the active configuration.
- Reject active configuration deletion at the backend.
- Delete an inactive configuration.
- Validate interest, down-payment and loan-term values.
- Calculate amortized monthly payments.
- Calculate zero-interest monthly payments.
- Display the finance disclaimer.

## Email Tests

With SMTP configured:

- Submit an enquiry.
- Confirm the Admin notification email arrives.
- Send an enquiry response.
- Confirm the Customer response email arrives.
- Confirm no SMTP credentials appear in API responses or logs.

Without SMTP during development:

- Confirm a safe `[mail preview]` appears in the server terminal.
- Confirm enquiry creation does not crash.
- Confirm an undelivered response remains Draft.

## User Interface Tests

Test desktop and mobile layouts.

Verify:

- Responsive navigation.
- Admin mobile-menu toggle.
- Keyboard focus visibility.
- Loading states.
- Empty states.
- Validation errors.
- API error messages.
- Success notifications.
- Delete and archive confirmations.
- Vehicle image galleries.
- Forms and selection controls.
- Unknown-page/404 state.
- Store and dashboard navigation.
- No unexpected browser-console errors.
- No unexpected API `500` responses.

## Security Audit Note

Run:

```powershell
npm.cmd --prefix server audit
npm.cmd --prefix client audit
```

Do not run:

```powershell
npm audit fix --force
```

Major dependency upgrades were deferred to avoid introducing breaking changes before submission. The reported dependency warnings must be reviewed again before public production deployment.

## Final Result

The verified automated result is:

- Backend: 5 tests passed.
- Frontend: 1 test passed.
- Production frontend build: passed.
- API health check: passed.
- Role and permission acceptance testing: passed.
- Primary CRUD workflow testing: passed.

## Vehicle Inventory Management — Manual Verification

**Tester:** M.R.M. Amri  
**Student ID:** SA25610225  
**Date:** 15 September 2026  
**Branch:** `feature/amri-vehicle-inventory`

The Vehicle Inventory Management module was manually verified successfully.

- Public inventory loads correctly.
- Vehicle search and filters work correctly.
- Vehicle details and image galleries render correctly.
- Authorized users can create and update vehicles.
- Vehicle status changes work correctly.
- Vehicle images can be uploaded and managed.
- Invalid vehicle data is rejected by validation.
- Draft and archived vehicles are handled correctly.
- Vehicle and image records are stored in the database.
- Inventory pages work on desktop and mobile layouts.

**Result:** Passed
---

## October 2026 Upgrade — Verification Report

**Date:** 11 October 2026. These are only the tests that were actually executed. See README › Testing report for limitations.

### Environment used

| Item | Used | Note |
|---|---|---|
| OS | Linux (cloud container) | Not Windows 11 |
| Node.js | 22.22 | Project requires 20+ |
| Database | Dolt 1.59.7, a MySQL 8.0-compatible server | MySQL/MariaDB packages could not be downloaded in that environment. **Not yet run on XAMPP MariaDB 10.4.** |
| Data | Your `database backup/high_street_db.sql` imported, then migrated | |
| Email | Local SMTP test server, built into the integration tests | **No real Gmail delivery attempted** |
| Browser | Chromium (Playwright) | |
| Frontend bundling | esbuild 0.28.2 (the same esbuild version Vite uses) | Vite itself could not start because its Linux `rollup` binary was not in the uploaded `node_modules` |

### Automated suites

| Suite | Command | Result |
|---|---|---|
| Backend integration (new): 92 tests across auth, sessions, vehicles, images, enquiries, responses, bookings, complaints, documents, inbound email, email reliability, reports and exports, dashboard and audit | `npm --prefix server run test:integration` | **92 passed, 0 failed** |
| Browser end-to-end (50 checks: guest pages, registration, complaints with uploads, documents, contact, bookings, every dashboard tab, complaint workflow, every report type (11 after the 16-CRUD completion), exports, saved reports, email outbox, mobile layouts, notifications) | test harness, not shipped | **50 passed, 0 failed, 0 browser-console errors, 0 API 500s** |
| Project Playwright smoke tests (`e2e/smoke.spec.js`, 6 tests) | `npm run e2e` | **6 passed** (run against the esbuild bundle) |
| Frontend component checks (the original FinanceCalculator assertions plus new StatusBadge, ProgressSteps and helper tests) | `npm --prefix client test -- --run` | **8/8 assertions passed** using an esbuild + jsdom harness. **Vitest itself was not run** (needs rollup's native binary). |
| Original backend vitest (5 tests) | `npm --prefix server test` | **Not run with vitest** (same reason). The same five assertions are part of the 92-test integration suite and passed. |

### Database checks executed

| Check | Result |
|---|---|
| Import your backup, migrate, roll back: schema identical to the original (indexes per table compared) | Passed |
| Migrate again: record counts in all 10 existing tables unchanged (users 5, vehicles 14, images 40, enquiries 24, …) | Passed |
| Fresh empty database: all 6 migrations and all seeders | Passed |
| Demo complaints seeder run twice (idempotent) | Passed |
| Foreign keys, CHECK constraints and unique constraints reject invalid rows | Passed |
| `db:migrate:undo:all` on a fresh database | Fails inside the **original** migration `202609130002` on Dolt only (its composite index is not created on Dolt). Your MariaDB dump shows that index exists, so this is expected to work on XAMPP, but **not verified there**. |

### Fixed during testing

| Problem found | Fix |
|---|---|
| Notification bell hidden on desktop | Layout fix |
| Register/Profile phone `pattern` was an invalid regular expression in modern browsers (original code), so browser-side validation never ran | Pattern escaped |
| Complaint table squeezed when the detail panel is open | Secondary columns hidden while a complaint is open |
| PDF export truncated short columns ("20…") | Column widths and number formatting |
| Migration rollback could have removed your existing `enquiries_created_at` index | Supporting indexes now reuse existing ones; rollback removes only `hs26_*` indexes |
| Original smoke test broke after footer links were added (ambiguous selector) | Test scoped to the main navigation |
| `DELETE /api/v1/users/:id` (deactivate user) returned **500** when the request had no body. Express 5 leaves `req.body` undefined; this was original code. The dashboard itself uses `PATCH /users/:id/status`, so it was not affected. | The body now defaults to `{}` for every request; regression tests added |
| Sessions tab: switching quickly from "My sessions" to "All users" could show the wrong list, because a slower older response overwrote the newer one | Older responses are now ignored |

### Admin Dashboard & Authentication module — added tests (Ahamed)

19 tests were added to `server/test/integration/api.itest.mjs` for this module. All pass.

| Area | What is checked |
|---|---|
| Users: Create | Admin creates a Staff account; the password is stored as a bcrypt hash and never returned; the new account can log in; duplicate email and weak passwords are rejected |
| Users: Read | List, filter by role, search, get one user, 404 for an unknown id |
| Users: Update | Edit name and phone, reset the password (old password stops working) |
| Users: Delete | Deactivate (soft delete): login is blocked (403), every session is revoked, the old token stops working; then reactivate |
| Users: rules | The final active Admin cannot be deactivated or demoted (409); only Admins can manage users (403/401) |
| Staff permissions | Read, update, saved in the DB, applied immediately (granted → 201, removed → 403); rejected for non-staff (422) |
| Sessions | Login creates a session marked current; revoke one; a user can't revoke another user's session (404); "sign out other devices" keeps only the current one; Admin can revoke anyone's session |
| Authentication | Wrong password and unknown email give the same message; login rate limit returns 429 on the 11th attempt; `/auth/me`; profile update; password change (wrong current password rejected, other sessions revoked, alert email sent) |

**Browser check of this module (dashboard UI, Chromium): 13/13 passed, 0 console errors, 0 server errors.**

Steps checked:

1. Admin logs in.
2. Creates a Staff account, filters by role, renames it.
3. Grants a permission (still saved after a page reload).
4. The new Staff member logs in.
5. Admin revokes that Staff member's session, and the Staff member is sent back to the login page.
6. Admin deactivates the account; login is refused with "deactivated". Then the account is reactivated.
7. The final Admin cannot be deactivated.
8. A newly registered customer cannot open `/admin`.

The project smoke tests (`npm run e2e`, 6/6) and the full 50-step walkthrough (50/50) were re-run after these fixes and passed.


---

## 16-CRUD Completion — Verification Report (11 October 2026, second round)

**Goal:** every team member owns 4 complete CRUD resources (16 in total), each changing both the website and the database. See `docs/CRUD_OPERATIONS.md`.

**Environment:** the same as above (Linux container, Dolt MySQL-compatible server, Chromium, local test SMTP server). Not yet run on XAMPP/Windows.

### Automated results (all executed)

| Suite | Result |
|---|---|
| API integration (`npm run test:integration`), including the **CRUD matrix**: each of the 16 resources' Create/Read/Update/Delete done through the API and checked with a separate SQL query | **110 passed, 0 failed** (run twice, plus once more from a freshly extracted ZIP) |
| Browser CRUD walkthrough of the new operations, with a database check after every step (21 steps) | **21 / 21**, 0 console errors, 0 API 500s |
| Browser walkthrough of the whole site (50 steps) | **50 / 50**, 0 console errors, 0 API 500s |
| Browser test of the Admin & Authentication module (13 steps) | **13 / 13** |
| Project smoke tests (`e2e/smoke.spec.js`) | **6 / 6** |
| Component checks (esbuild + jsdom) | **14 / 14** |
| Frontend compile (esbuild) | 0 errors, 0 warnings |

### Database checks (executed)

| Check | Result |
|---|---|
| Your backup imported → `db:migrate` (both new migrations) | Passed; counts unchanged in all 11 original tables (users 5, vehicles 14, vehicle_images 40, enquiries 24, enquiry_responses 2, test_drive_bookings 2, wishlists 1, company_content 5, financing_configs 1, admin_sessions 77, staff_permissions 1) |
| Roll back both new migrations | Schema identical to the original backup |
| Migrate again | Passed; counts unchanged |
| Fresh empty database: migrate, seed all, re-run seeders | Passed; no duplicates |
| CHECK `chk_finance_amounts`, unique template titles, unique finance references | Exercised by the API tests |

### Problems found and fixed in this round

| Problem | Fix |
|---|---|
| Customers could not see staff replies in the website (only by email) | My enquiries now shows **sent** replies (drafts never) |
| A non-numeric id in a URL (e.g. `/enquiries/undefined/responses`) caused a **500** | All `:id` parameters are validated; anything else returns 404 |
| The document edit validator had its own category list, so the new "Finance Document" could not be edited | Category added; admin filter updated |
| Complaint table squeezed when a complaint was opened (your screenshot) | Detail opens as a drawer on screens up to 1600 px; the table keeps its full width (checked: 994 px table + 620 px drawer at 1366 px) |
| Many pop-ups piled up over the detail panel (your screenshot) | At most 3 at a time, shown at the top centre |
| The drawer was positioned against an animated container instead of the screen | Rendered at page level |
| While a drawer was open the sidebar could not be clicked | The backdrop now starts after the sidebar |
| A red outline button ("Remove", "Delete", "Remove all access") had red text on a red background | Fixed style |

### Not tested

- XAMPP MariaDB 10.4 on Windows.
- Real Gmail delivery: finance application emails were accepted by the local test SMTP server only.

### Follow-up: vehicle archive rule (11 October 2026, evening)

**Rule:** a vehicle cannot be archived while it has an active test-drive booking (Pending/Confirmed) or an open finance application (Submitted/Under Review). This applies both to the Archive button and to choosing "Archived" as the status.

**Checked:**
- API tests: 110 / 110. They try the Archive button and the status change with an active booking, and the Archive button with an open finance application, and confirm in the database that the vehicle is unchanged.
- Dashboard: an Admin clicking **Archive** on a booked vehicle sees "This vehicle cannot be archived because it has 1 active test-drive booking…".
- Browser walkthroughs: 50 / 50 and 21 / 21.

---

## 14 October 2026 update — Verification Report

**Scope:**
- **Users:** red/green status buttons, Undo, search, filters, sort, pages, table view, detail panel, lockout and Unlock, bulk actions, and passwords changeable only by the owner.
- **Passwords:** a temporary password on Admin-created accounts; Forgot / Reset password; show/hide and a strength meter.
- **Sessions:** Check activity, filters, login history, a new-device email and inactivity sign-out.
- **Staff Permissions:** 8 permissions, filters, matrix view and Undo.
- **Financing:** a plan for one chosen vehicle, used by the calculator, the vehicle pages, the Inventory cards and finance applications.
- **Finance applications:** a status drop-down on each row.
- **Database:** migration `202610150001`.

**Environment:**
- Node 22 on Linux, and Dolt (a MySQL-compatible server) instead of XAMPP MariaDB.
- Headless Chromium 141 for the browser checks.
- A fake local SMTP server for the integration tests; SMTP "Preview" mode in the browser walkthrough. **No real email was sent.**

| Check | How | Result |
|---|---|---|
| API integration suite | `npm run test:integration` | **124 / 124 passed** (110 earlier + 13 new tests + 1 new first-sign-in test; 2 older tests updated for the new rules) |
| Browser walkthrough of the new features (26 steps, each checked in the database) | test harness, not shipped | **26 / 26**, three runs in a row; 0 browser-console errors, 0 API 500s |
| Earlier browser walkthroughs | test harness | **50 / 50**, **21 / 21**, **13 / 13** (the module test was updated for the temporary password, the role chips and the disabled own Deactivate) |
| Playwright smoke tests (`e2e/smoke.spec.js`) | `npx playwright test`, pointed at the installed Chromium | **7 / 7** (1 new) |
| Frontend component tests (`*.test.jsx`) | esbuild + jsdom runner with the real React Testing Library | **15 / 15** (6 new). Vitest itself was not run, as before. |
| Server unit tests (`server/test/*.test.js`) | the same files through a small vitest substitute | **5 / 5** |
| Migration on `high_street_db.sql` (both dumps in the project) | import → migrate (all) → compare | every record count unchanged; existing Staff keep all access (new permissions copied); existing users are not forced to change their password |
| Migration undo / redo | `db:migrate:undo`, then `db:migrate` | undo removes exactly 2 tables and 30 columns, with counts unchanged; redo gives an identical schema |
| Frontend build | esbuild | 0 errors, 0 warnings |

**Bug found and fixed during testing:** the new Users and Staff Permissions lists could show an out-of-date result if a search and a filter were changed quickly (a slow, older answer arrived last). Both lists now ignore out-of-date answers, as the Sessions tab already did.

**Not tested:**
- XAMPP / MariaDB on Windows;
- real Gmail delivery of the reset link and the new-device alert;
- Safari and Firefox;
- load testing.

## 15 October 2026 update — Verification Report

**Scope:**
- **Test-drive bookings:** Assigned staff drop-down with availability (busy within an hour, leave days, missing permission), server-side refusal, Staff availability panel (leave days).
- **Vehicles:** archived vehicles show a green Unarchive, which returns them to their previous status; "Archived" from the status drop-down or the edit form is a real archive; the active-test-drive / open-application block still applies.
- **Home page:** the four tiles open Inventory, the new Finance page, the new Book a test drive page and My complaints / Contact.
- **Vehicle drop-downs:** the Finance page, the Book a test drive page and Admin › Financing list every Available vehicle and nothing else.
- **Staff Permissions:** status and today's availability beside each name, new filter chips, Edit / Cancel, Reset, Delete staff (one, or Select all + Delete selected).
- **Database:** migration `202610160001`.

**Environment:** as in the 14 October report (Node 22 on Linux, Dolt instead of XAMPP MariaDB, headless Chromium, a fake SMTP server; no real email sent).

| Check | How | Result |
|---|---|---|
| API integration suite | `npm run test:integration` | **130 / 130 passed** (124 earlier + 6 new tests; 1 older test updated: Unarchive now returns the previous status instead of always Draft) |
| Browser walkthrough of this update (25 steps, each checked in the database) | test harness, not shipped | **25 / 25**; 0 browser-console errors, 0 API 500s |
| Earlier browser walkthroughs | test harness | **50 / 50**, **21 / 21**, **13 / 13**, **26 / 26** (three of them updated to click **Edit** before ticking permissions) |
| Playwright smoke tests (`e2e/smoke.spec.js`) | `npx playwright test`, pointed at the installed Chromium | **8 / 8** (1 new: home tiles) |
| Frontend component tests | esbuild + jsdom runner | **15 / 15** |
| Server unit tests | small vitest substitute | **5 / 5** |
| Migration on both `high_street_db.sql` dumps | import → migrate (all) → undo `202610160001` → migrate | record counts identical before and after the undo/redo |
| Frontend build | esbuild | 0 errors, 0 warnings |

**Database checks done in the walkthrough:** booking created from the new page (Pending, Admin email logged); finance application from the new Finance page (Submitted); `assigned_to` set only for an available Staff member; `staff_leave` row created; a refused assignment leaves `assigned_to` empty; archiving a Sold car stores `status_before_archive = 'Sold'` and `deleted_at`; Unarchive gives `Sold` with `deleted_at` NULL; Edit/Save sets the flag, Cancel saves nothing; Reset leaves all 8 flags at 0 with the record kept; Delete staff removes the `users` row and its leave days; Delete selected removed every selected account.

**Bugs found and fixed during this round:**
- **Archived vehicles still showed "Archive":** the API returned the archive date as `deleted_at`, but the dashboard looked for `deletedAt`, so it never knew a vehicle was archived. The model now returns `deletedAt`.
- **Signed-in customers saw Sold cars in the new vehicle drop-downs:** the vehicle list gives customers Available *and* Sold cars. The drop-downs now keep Available cars only.
- The tick boxes on the permission cards had different sizes when a description wrapped onto two lines.

**Not tested:** XAMPP / MariaDB on Windows; real Gmail delivery; Safari and Firefox; load testing.
