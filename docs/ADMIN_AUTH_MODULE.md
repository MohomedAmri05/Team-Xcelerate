# Admin Dashboard & Authentication Module

**Owner:** Ahamed. This document covers the module's CRUD operations, the files that implement them, and how to check that each one works.

## 1. CRUD resources in this module

The module has **four CRUD resources**, each with Create, Read, Update and Delete in the website and the database:

1. **Users**
2. **Sessions**
3. **Staff Permissions**
4. **Saved Reports**

Authentication / own profile and the Admin dashboard build on them. `docs/CRUD_OPERATIONS.md` shows all 16 resources of the team.

### Users (table `users`): Admin only

| CRUD | What it does | API | Dashboard |
|---|---|---|---|
| **Create** | Create a Staff account with a **temporary password**, stored as a bcrypt hash. At the first sign-in the Staff member must replace it (Profile › Change password), so afterwards only they know it. | `POST /api/v1/users` | Users tab › form › **Create Staff** (strength meter, show/hide) |
| **Read** | List accounts with search (name, email, phone), **role chips** and **status chips** (Active / Inactive / Locked, with counts), sort (newest, oldest, name, last login), pages, and **table or cards**. The **Details** panel shows the profile, last login, password-changed date, active sessions, failed logins (30 days), permissions and recent activity. | `GET /api/v1/users`, `GET /api/v1/users/:id/overview` | Users tab |
| **Update** | Edit name, email, role and active state. **The password cannot be changed by an Admin:** the field is gone and the API refuses it with 422. **Unlock** a locked account. Bulk **Activate**. | `PUT /api/v1/users/:id`, `PATCH /api/v1/users/:id/unlock`, `POST /api/v1/users/bulk` | **Edit** › **Update account**, **Unlock**, tick accounts › **Activate** |
| **Delete** | Soft delete: the account is **deactivated**, its row and history are kept, every session is ended (reason "deactivated") and it can no longer log in. **Undo** within 10 seconds, or reactivate later. Bulk **Deactivate**; **Export CSV** of the ticked accounts. | `DELETE /api/v1/users/:id` or `PATCH /api/v1/users/:id/status`, `POST /api/v1/users/bulk` | **Deactivate** (red hazard button) / **Activate** (green) |

Rules:

- The **final active Admin** cannot be deactivated or changed to another role (409). An Admin cannot deactivate their **own** account (button disabled, API 409).
- **Lockout:** 5 wrong passwords in a row lock the account for 15 minutes. Change this with `LOGIN_LOCK_ATTEMPTS` and `LOGIN_LOCK_MINUTES`. While locked, even the right password gets 423 "locked", and an Admin can **Unlock** the account.
- Passwords need at least 10 characters, with an uppercase letter, a lowercase letter and a number.
- Email addresses must be unique.
- Customers register themselves through `/register`, so Admins create Staff accounts only.

### Sessions (table `admin_sessions`): every signed-in user

| CRUD | What it does | API | Dashboard |
|---|---|---|---|
| **Create** | Logging in creates a session that stores a hashed refresh token, IP address, browser and expiry | `POST /api/v1/auth/login` | Login page |
| **Read** | Your own sessions, or **all users'** sessions for Admins:<br>• status chips: Active / Expired / Logged out / Revoked / All<br>• search by name, email, IP or device<br>• date range, role and device filters, sort, pages<br>**Check activity** works on every session, active or not, and shows:<br>• the device in plain words ("Chrome 129 on Windows 10/11") and the IP address<br>• a timeline: signed in, each token refresh, last seen, then logged out / revoked / expired<br>• how it ended and who ended it; the duration<br>• the user's other sessions and failed sign-ins<br>Admins also get a **Login history** with failed attempts, lockouts and reset requests. | `GET /api/v1/sessions` (`?scope=all&status=…`), `GET /api/v1/sessions/:id/activity`, `GET /api/v1/sessions/login-history` | Sessions tab › My sessions / All users / Login history |
| **Update** | Refresh the session: the refresh token is **rotated** and the old one stops working. Each refresh is counted and recorded. | `POST /api/v1/auth/refresh` | Automatic, in the background |
| **Delete** | Revoke one session, sign out all other devices, or log out. The reason and who did it are stored (`ended_reason`, `ended_by`). There is no Undo: a revoked login is cancelled for good, and the user simply signs in again. | `DELETE /api/v1/sessions/:id`, `DELETE /api/v1/sessions`, `POST /api/v1/auth/logout` | **Revoke** / **Sign out** buttons |

Users can revoke and check only their own sessions. Admins can revoke and check anyone's.

**Automatic sign-out:** Admin and Staff are signed out after 30 minutes without activity, with a warning and a **Stay signed in** button 2 minutes before. Change the time with `VITE_IDLE_MINUTES` in `client/.env`.

**New-device alert:** when an account signs in from a browser and system it has never used before, the owner gets an email.

### Staff Permissions (table `staff_permissions`): Admin only

| CRUD | What it does | API | Dashboard |
|---|---|---|---|
| **Create** | A no-access record is created with every new Staff account. For a Staff member without a record, tick the boxes and click **Create permissions**. | `POST /api/v1/users/:id/permissions` | Permissions tab |
| **Read** | Every Staff member at once, with search, status chips (Active / Inactive / No record yet), a "has permission" filter, sort, a count such as "3 of 8", and **Cards or Matrix** view. Reading never creates a row. | `GET /api/v1/staff-permissions`, `GET /api/v1/users/:id/permissions` | Permissions tab |
| **Update** | Cards and matrix rows are read-only until **Edit**. Tick or untick, then **Save permissions** (or **Save** on a matrix row); **Cancel** drops the changes. **Reset** clears every permission (no access, the record is kept). **Undo** within 10 seconds puts the previous values back (logged as `permissions.restored`). | `PUT /api/v1/users/:id/permissions`, `PATCH /api/v1/users/:id/permissions/reset` | Permissions tab |
| **Delete** | **Remove all access**: the row is deleted, the account is kept, and the Staff member has no access from their next request. Can be undone for 10 seconds. | `DELETE /api/v1/users/:id/permissions` | Permissions tab |

There are **eight** permissions:

- Manage inventory
- Manage enquiries
- **Manage bookings** (October 2026: test-drive bookings now have their own permission; copied from *Manage enquiries* during the upgrade)
- View assigned contacts
- Archive records
- Manage complaints
- View limited analytics
- **Export reports** (October 2026: CSV, Excel and PDF downloads; copied from *View limited analytics* during the upgrade)

Changes apply on the Staff member's next request. Every create, update and delete is written to `activity_logs`.

**Status beside each name (15 October 2026):** Active (green), Inactive (red), Locked (orange) or Password change needed (yellow), plus today's availability: Available, test drives today, or On leave. Filter chips: Active, Inactive, Locked, Password change needed, On leave, No record yet.

**Delete staff (15 October 2026):** permanently deletes the Staff **account** – one card's **Delete staff**, or tick cards (or **Select all**) and **Delete selected**. A confirmation says it cannot be undone. Only Staff accounts can be deleted (`DELETE /api/v1/users/:id/permanent`, `POST /api/v1/users/bulk-delete`). Their sessions, permissions, saved reports and leave days are removed; their assigned test drives, enquiries and complaints become unassigned; their replies and uploaded files are kept as "Deleted staff member"; the audit log keeps their name and email.

### Saved Reports (table `saved_reports`): Admin, and Staff with report access

| CRUD | What it does | API | Dashboard |
|---|---|---|---|
| **Create** | Generate a report, then **Save report** and give it a name | `POST /api/v1/saved-reports` | Reports tab |
| **Read** | Saved reports list; **Run** re-generates it with the saved filters | `GET /api/v1/saved-reports`, `GET /api/v1/saved-reports/:id/run` | Reports tab |
| **Update** | **Edit filters**, change them, **Update saved report** | `PUT /api/v1/saved-reports/:id` | Reports tab |
| **Delete** | **Delete** (only the saved filters are removed; no data) | `DELETE /api/v1/saved-reports/:id` | Reports tab |

There are 11 report types, including the new **Finance applications** report. Each can be exported as CSV, Excel or PDF.

### Authentication and own profile: all users

| Operation | API | Page |
|---|---|---|
| Register (customer) | `POST /api/v1/auth/register` | `/register` |
| Log in / log out | `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` | `/login`, account menu |
| Who am I | `GET /api/v1/auth/me` | Used on every page load |
| Update own profile | `PUT /api/v1/auth/profile` | `/profile` |
| Change own password | `PUT /api/v1/auth/change-password` (other devices are signed out and an alert email is sent; show/hide and strength meter) | `/profile` |
| Forced change of a temporary password | Same endpoint. Until it is done, the API answers 403 `PASSWORD_CHANGE_REQUIRED` to other requests. | `/profile?password=required` (opens automatically) |
| **Forgot password?** – email a one-time link | `POST /api/v1/auth/forgot-password` (the answer is the same whether or not the account exists) | `/forgot-password` (link on the login page) |
| Reset the password with the link | `POST /api/v1/auth/reset-password` (works once, expires after 30 minutes, signs out every device) | `/reset-password?token=…` |

**Who can change a password:** only the account owner. Admins can never see or set another person's password. Passwords are stored only as bcrypt hashes, and the reset token only as a SHA-256 hash.

**Without Gmail set up:** the reset email is printed in the API terminal as "Preview", and you can copy the link from there.

### Admin dashboard

| Feature | API | Where |
|---|---|---|
| Overview: live counts, items needing attention, recent activity | `GET /api/v1/dashboard/summary` (Staff and Admin; Staff see only their sections) | `/admin`, Overview tab |
| Grouped tabs with badge counts, deep links (`/admin?tab=users`) | — | `Admin.jsx` |
| Audit log of admin actions (user created/updated/deactivated, …) | stored in `activity_logs` | Reports › Activity log |

## 2. Files

### Backend (`server/`)

| File | Responsibility |
|---|---|
| `src/routes/index.js` | All the routes above, with `auth`, `adminOnly`, `staffOrAdmin`, the login rate limit and validation |
| `src/controllers/auth.controller.js` | register, login, refresh, logout, me |
| `src/controllers/profile.controller.js` | update profile, change password |
| `src/controllers/domain.controller.js` | `listUsers`, `getUser`, `createUser`, `updateUser`, `userStatus`, `deleteUser`, `listSessions`, `revokeSession`, `revokeAll` |
| `src/controllers/permission.controller.js` | get and update staff permissions |
| `src/controllers/dashboard.controller.js` | dashboard summary, customer notifications |
| `src/controllers/report.controller.js`, `src/services/report.service.js` | reports, exports and **Saved Reports** CRUD |
| `src/services/auth.service.js` | password hashing, JWT access tokens, refresh-token rotation, session creation |
| `src/services/activity.service.js` | audit log entries |
| `src/utils/device.js` | *(new)* readable device names ("Chrome 129 on Windows 10/11") |
| `src/models/extended.js` | *(Oct 2026)* `SessionEvent`, `PasswordResetToken` |
| `migrations/202610150001-users-sessions-permissions-vehicle-finance.cjs` | *(new)* lockout and temporary-password columns, session activity columns, `session_events`, `password_reset_tokens`, the 2 new permissions |
| `src/middleware/core.js` | `auth` (token check, inactive accounts blocked), role checks, `requirePermission`, error handling |
| `src/validators/schemas.js` | `registerSchema`, `loginSchema`, `userSchema`, `profileUpdateSchema`, `passwordChangeSchema`, `staffPermissionSchema` |
| `src/models/index.js` | `User`, `Session` (`admin_sessions`), `StaffPermission` |
| `migrations/202609120001-create-schema.cjs`, `202609130001-…`, `202609130002-…` | create the `users`, `admin_sessions` and `staff_permissions` tables |

### Frontend (`client/src/`)

| File | Responsibility |
|---|---|
| `pages/Login.jsx`, `pages/Register.jsx`, `pages/Profile.jsx` | sign in, sign up, own profile and password |
| `pages/Admin.jsx` | the dashboard shell: tabs, badges, deep links, polling |
| `components/admin/OverviewDashboard.jsx` | Overview tab |
| `components/UserManager.jsx` | Users CRUD |
| `components/SessionManager.jsx` | Sessions list and revoke |
| `components/StaffPermissionManager.jsx` | Permissions (Create / Read / Update / Remove all access), 8 permissions, search, filters, Undo |
| `components/admin/PermissionMatrix.jsx` | *(new)* the matrix view |
| `components/admin/UserDetailDrawer.jsx` | *(new)* the user detail panel |
| `components/admin/SessionActivityDrawer.jsx` | *(new)* "Check activity" |
| `components/ui/PasswordInput.jsx` | *(new)* show/hide and the strength meter |
| `pages/ForgotPassword.jsx`, `pages/ResetPassword.jsx` | *(new)* the owner resets their own password |
| `components/admin/ReportCenter.jsx` | Reports and Saved Reports |
| `features/auth/AuthContext.jsx`, `ProtectedRoute.jsx`, `authStorage.js` | logged-in state, route protection, token storage |
| `services/api.js` | adds the access token and refreshes it automatically when it expires |
| `components/Nav.jsx`, `components/NotificationCenter.jsx` | account menu, notification bell |

## 3. How to check that it works

### A. Automated tests (fastest)

With XAMPP MySQL running, from the project folder:

```powershell
npm.cmd run test:integration
```

The tests use their own database, `high_street_db_test`; your real data is not touched. Look for these groups in the output, all marked `ok`:

- `authentication and sessions`
- `admin module: users CRUD`
- `admin module: staff permissions`
- `CRUD matrix — Ahamed: Staff Permissions and Saved Reports`
- `admin module: sessions CRUD`
- `authentication: profile and password`
- `dashboard and audit`

The last lines should show `# fail 0`.

### B. By hand in the website (for a demo or viva)

Start the API and the website (see the README), then:

1. **Log in** as an Admin. You land on `/admin` › Overview, with counts.
2. **Create:** go to Users. Fill in name, email and a **temporary password** such as `NimalStaff!2026` (watch the strength meter), then click **Create Staff**. The new card appears with the label *Active*.
3. **Read:** click the *Staff* role chip. Only Staff accounts are shown. Also try the search box, the *Locked* status chip, **Sort › Name A–Z**, **Table**, and **Details** on a card.
4. **Update:** click **Edit** on the new card, change the name, then click **Update account**. The card shows the new name. **There is no password field:** only the owner can change a password.
5. **Permissions:** go to Permissions, tick *Manage inventory* for the new account, then click **Save permissions**. Reload the page; the box is still ticked.
6. In a **private/incognito window**, log in as the new Staff member. They are taken to **Profile › Change your temporary password**; even typing `/admin` brings them back there. They change it (for example to `NimalOwnPass!2026`), then reach the dashboard and can see the Vehicles tab.
7. **Sessions:** back as Admin, open Sessions, click **All users**, find the Staff member's session and click **Revoke**. In the incognito window, refresh the page; it goes back to the login page. Click the **Revoked** chip, then **Check activity** on that session: the timeline shows *Signed in → Revoked by Mr. Mudashir*. Open **Login history** too.
8. **Delete (deactivate):** open Users and click the red **Deactivate** on the Staff card. The label changes to *Inactive*. Click **Undo** in the pop-up message, and it is *Active* again. Deactivate it again: logging in as that Staff member now shows "This account has been deactivated". Click the green **Activate** to restore the account.
9. **Protection:** on your own Admin card the **Deactivate** button is disabled; the API also refuses it ("The final active Admin cannot be deactivated").
10. **Security:** log in as a customer and open `/admin`. You are sent away from the dashboard. Type a wrong password 5 times: on the 6th try, even the right password shows "This account is locked…". In Users, click the *Locked* chip, then **Unlock**. Separately, more than 10 attempts from one computer in 15 minutes get "Too many attempts. Please try again later."
11. **Forgot password:** on the login page click **Forgot password?**, enter the customer's email, and open the link from the email. Without Gmail, copy the link from the "Preview" in the API terminal. Choose a new password; the link does not work a second time.
12. **Profile:** open `/profile` and change your phone number, then change your password. Another browser where you were signed in is logged out.
13. **Permissions Delete and Create:** on Permissions, click **Remove all access** on a Staff card and confirm. The card shows "No permission record yet", and in phpMyAdmin the row is gone from `staff_permissions`. Click **Undo**, and the row is back with the same ticks. Then try the search, the "Has permission" filter and the **Matrix** view, where you tick *Export reports* and click **Save** on the row.
14. **Saved Reports:** in Reports choose *Finance applications*, then **Generate report** › **Save report** (Create). Click **Edit filters** on the saved entry, choose a status, then **Update saved report** (Update). Click **Delete** (Delete). Check `saved_reports` in phpMyAdmin after each step.

### C. Check the database in phpMyAdmin

Open `high_street_db` › **SQL** and run:

```sql
-- Users: the new Staff account, active flag and hashed password (starts with $2b$)
SELECT user_id, name, email, role, is_active, LEFT(password_hash, 7) AS hash_prefix, updated_at
FROM users ORDER BY user_id DESC LIMIT 5;

-- Sessions: revoked_at is filled in after Revoke / Deactivate / Logout
SELECT s.session_id, u.email, s.ip_address, s.created_at, s.expires_at, s.revoked_at
FROM admin_sessions s JOIN users u ON u.user_id = s.user_id
ORDER BY s.session_id DESC LIMIT 10;

-- Saved reports
SELECT report_id, name, report_type, filters, last_run_at FROM saved_reports;

-- Permissions: 1 = granted (8 permissions)
SELECT u.email, p.* FROM staff_permissions p JOIN users u ON u.user_id = p.user_id;

-- Lockout, temporary passwords
SELECT email, must_change_password, failed_login_count, locked_until, password_changed_at, last_login_at FROM users;

-- "Check activity": the session timeline and failed sign-ins
SELECT event_id, event_type, session_id, user_id, email, detail, ip_address, device_label, created_at
FROM session_events ORDER BY event_id DESC LIMIT 20;

-- Reset links (only hashes are stored)
SELECT token_id, user_id, expires_at, used_at FROM password_reset_tokens ORDER BY token_id DESC LIMIT 5;

-- Audit trail of what the Admin did
SELECT created_at, action, summary FROM activity_logs
WHERE entity_type = 'User' ORDER BY activity_id DESC LIMIT 10;
```

### D. API directly (optional)

In PowerShell:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/v1/auth/login `
  -ContentType 'application/json' -Body '{"email":"admin@highstreet.lk","password":"<your admin password>"}'
$h = @{ Authorization = "Bearer $($login.data.accessToken)" }

Invoke-RestMethod http://localhost:5000/api/v1/users -Headers $h          # Read users
Invoke-RestMethod "http://localhost:5000/api/v1/sessions?scope=all" -Headers $h   # Read sessions
Invoke-RestMethod http://localhost:5000/api/v1/dashboard/summary -Headers $h      # Dashboard
```

## 4. Test results (15 October 2026)

- **API tests:** 130/130 passed, including new tests for **Reset** (all flags 0, record kept, audit log), the account status and *On leave* filters, **Delete staff** (account removed, enquiry unassigned, response and document kept with an empty author, audit log with name and email; Customers and Admins refused) and **Delete selected** (Staff deleted, Admin and unknown ids skipped).
- **Browser tests:** this module 13/13 (updated to click **Edit** first); the 15 October walkthrough 25/25 (status badges, read-only until Edit, Save, Cancel, Reset, On leave filter, Delete staff, Select all + Delete selected, matrix Edit).

## 4a. Test results (14 October 2026)

- **API tests:** 124/124 passed.
  - 19 of them were written for this module originally, plus the CRUD matrix tests for Staff Permissions and Saved Reports.
  - **13 new tests** cover the lockout and Unlock; the detail panel; sorting, pages and counts; bulk actions; Forgot / Reset password (one-time link, only a hash stored, every session signed out); Check activity (timeline, who revoked it); the session filters and counts; the login history; the staff-permission list and filters; *Manage bookings* and *Export reports*; Undo; and per-vehicle financing.
  - Two older tests were changed because the rules changed on purpose: *"Admin resets the password"* is now *"Admin can never set another user's password"*, and the rate-limit test uses an unknown email so the new lockout does not interfere.
- **Browser tests:**
  - this module: 13/13 (updated for the temporary-password step, the role chips and the disabled own Deactivate);
  - the October walkthrough of every new feature: 26/26, run 3 times in a row;
  - the original 50-step and 21-step walkthroughs: still 50/50 and 21/21;
  - no browser-console errors and no server errors.
- **Bugs found and fixed while testing:**
  - `DELETE /users/:id` returned a server error (500) when the request had no body. This was in the original code; the dashboard uses the Deactivate button, which was not affected.
  - The Sessions tab could show the wrong list if you switched quickly between *My sessions* and *All users*.
  - (October update) The same quick-switching problem could affect the new Users and Permissions searches. Both now ignore late, out-of-date answers.
- **Not tested:** this was not run on your Windows/XAMPP machine, and no real Gmail email was sent. Use section B there.
