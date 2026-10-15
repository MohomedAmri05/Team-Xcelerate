# The 16 CRUD Resources — 4 per Team Member

This guide is for the viva and for checking the system. For every resource it lists:

- **where** each operation is in the website;
- the **API** endpoint (all paths start with `/api/v1`);
- the **database table** that changes;
- the **code files**: search the code for `VIVA` to find every labelled function.

| Member | Module | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| **M.R.M. Amri** | Vehicle Inventory | Vehicles | Vehicle Images | Wishlists | Test-Drive Bookings |
| **H.F. Naaziq** | Customer Enquiry | Enquiries | Enquiry Responses | Complaints | Reply Templates |
| **M.R. Ahamed** | Admin Dashboard & Authentication | Users | Sessions | Staff Permissions | Saved Reports |
| **S.N. Herathge** | Financing & Company | Company Content | Financing Configurations | Finance Applications | Customer Documents |

What the October 2026 completion added:

- **Wishlists:** the Update operation (a private note on each saved vehicle).
- **Staff Permissions:** explicit Create and Delete.
- **Reply Templates:** a new resource.
- **Finance Applications:** a new resource.
- **Customer Documents:** can be linked to finance applications.
- **My Enquiries:** customers now see the replies that were sent to them (Enquiry Responses, Read).

Nothing that existed before was removed.

> **Soft delete.** Two "Delete" operations keep the row for record-keeping, which the business needs:
> - A vehicle is **archived**: `status = 'Archived'` and `deleted_at` is set, so enquiries and bookings that point to it stay valid. It can be restored.
> - A user is **deactivated**: `is_active = 0` and all sessions are revoked, so their history is kept.
>
> Every other Delete removes the row (and any stored file).

---

## M.R.M. Amri — Vehicle Inventory

### 1. Vehicles · table `vehicles`

| Op | Website | API |
|---|---|---|
| Create | Dashboard › Vehicles › **Add a vehicle** › **Create vehicle** (saved as Draft) | `POST /vehicles` |
| Read | Inventory page (search, filters), vehicle page; dashboard list | `GET /vehicles`, `GET /vehicles/:id` |
| Update | **Edit** › **Update vehicle**; status buttons (Draft / Available / Sold) | `PUT /vehicles/:id`, `PATCH /vehicles/:id/status` |
| Delete | **Archive** (soft delete); **Restore as Draft** undoes it. **Blocked (409)** while the vehicle has an active test drive (Pending/Confirmed) or an open finance application (Submitted/Under Review); the same rule applies when choosing "Archived" as the status | `DELETE /vehicles/:id`, `PATCH /vehicles/:id/restore` |

- **Files:** `server/src/controllers/vehicle.controller.js`, `client/src/components/VehicleManager.jsx`, `client/src/pages/Inventory.jsx`, `client/src/pages/VehicleDetails.jsx`
- **Check:** `SELECT vehicle_id, make, model, price, status, deleted_at FROM vehicles ORDER BY vehicle_id DESC LIMIT 5;`

### 2. Vehicle Images · table `vehicle_images` + files in `server/uploads`

| Op | Website | API |
|---|---|---|
| Create | Dashboard › Images › choose vehicle › **Upload images** | `POST /vehicles/:vehicleId/images` |
| Read | Gallery on the vehicle page and in the dashboard | `GET /vehicles/:vehicleId/images` |
| Update | Alt text, display order, primary photo | `PATCH /vehicle-images/:id` |
| Delete | **Delete** (Admin only; removes the file too) | `DELETE /vehicle-images/:id` |

- **Files:** `image.controller.js`, `VehicleImageManager.jsx`
- **Check:** `SELECT image_id, vehicle_id, url, is_primary, sort_order FROM vehicle_images ORDER BY image_id DESC LIMIT 5;`

### 3. Wishlists · table `wishlists`

| Op | Website | API |
|---|---|---|
| Create | Heart button on a vehicle (customer) | `POST /wishlist/:vehicleId` |
| Read | **My account › Wishlist** | `GET /wishlist`, `GET /wishlist/:vehicleId/check` |
| Update | **Add note / Edit note** under a saved vehicle *(new)* | `PATCH /wishlist/:vehicleId` |
| Delete | **Remove** under the vehicle, or the heart button again | `DELETE /wishlist/:vehicleId` |

- **Files:** `wishlist.controller.js`, `WishlistButton.jsx`, `WishlistNote.jsx`, `pages/Wishlist.jsx`
- **Check:** `SELECT wishlist_id, customer_id, vehicle_id, note FROM wishlists ORDER BY wishlist_id DESC LIMIT 5;`

### 4. Test-Drive Bookings · table `test_drive_bookings`

| Op | Website | API |
|---|---|---|
| Create | Vehicle page › **Book a test drive** | `POST /bookings` |
| Read | **My account › Test drives**; Dashboard › Bookings | `GET /my/bookings`, `GET /bookings(/:id)` |
| Update | Customer **Change date or time** / **Cancel booking**; staff Confirmed / Completed / Cancelled, assign | `PATCH /my/bookings/:id(/cancel)`, `PATCH /bookings/:id(/assign)` |

Staff need the **Manage bookings** permission (new in October 2026) and *View assigned contacts* for the Bookings tab. Staff who had *Manage enquiries* got Manage bookings automatically when the database was upgraded.
| Delete | Dashboard › Bookings › permanent delete (Admin) | `DELETE /bookings/:id` |

- **Files:** `booking.controller.js`, `TestDriveBookingForm.jsx`, `pages/MyBookings.jsx`, `BookingManager.jsx`
- **Check:** `SELECT booking_id, vehicle_reference, preferred_date, preferred_time, status FROM test_drive_bookings ORDER BY booking_id DESC LIMIT 5;`

---

## H.F. Naaziq — Customer Enquiry

### 1. Enquiries · table `enquiries`

| Op | Website | API |
|---|---|---|
| Create | Vehicle page enquiry form, or the Contact page | `POST /enquiries` |
| Read | **My account › My enquiries**; Dashboard › Enquiries (search, filters) | `GET /my/enquiries`, `GET /enquiries(/:id)` |
| Update | Status buttons (In Progress / Responded / Archived), assign | `PATCH /enquiries/:id`, `PATCH /enquiries/:id/assign` |
| Delete | **Permanently delete enquiry** (Admin) | `DELETE /enquiries/:id` |

- **Files:** `enquiry.controller.js`, `EnquiryManager.jsx`, `pages/MyEnquiries.jsx`, `pages/Contact.jsx`
- **Check:** `SELECT enquiry_id, customer_name, vehicle_reference, status, assigned_to FROM enquiries ORDER BY enquiry_id DESC LIMIT 5;`

### 2. Enquiry Responses · table `enquiry_responses`

| Op | Website | API |
|---|---|---|
| Create | Dashboard › Enquiries › open one › **Create response draft** | `POST /enquiries/:enquiryId/responses` |
| Read | Responses under the enquiry; the customer sees **sent** replies in My enquiries *(new)* | `GET /enquiries/:enquiryId/responses`, `GET /my/enquiries` |
| Update | **Edit** the draft; **Send** (status becomes Sent only if the mail server accepts) | `PUT /enquiry-responses/:id`, `POST /enquiry-responses/:id/send` |
| Delete | **Delete** a draft | `DELETE /enquiry-responses/:id` |

- **Files:** `response.controller.js`, `EnquiryResponsePanel.jsx`
- **Check:** `SELECT response_id, enquiry_id, subject, status, sent_at FROM enquiry_responses ORDER BY response_id DESC LIMIT 5;`

### 3. Complaints · tables `complaints`, `complaint_messages`, `complaint_status_history`

| Op | Website | API |
|---|---|---|
| Create | **My account › Complaints › New complaint** (with evidence); replies | `POST /complaints`, `POST /my/complaints/:id/messages`, `POST /complaints/:id/messages` |
| Read | Customer timeline; Dashboard › Complaints (search, filters, detail drawer) | `GET /my/complaints(/:id)`, `GET /complaints(/:id)` |
| Update | Status, priority, category, assignment; customer **Confirm resolved / Reopen** | `PATCH /complaints/:id(/assign)`, `PATCH /my/complaints/:id/close|reopen` |
| Delete | **Delete complaint** (Admin; removes messages, history and files) | `DELETE /complaints/:id` |

- **Files:** `complaint.controller.js`, `ComplaintManager.jsx`, `pages/MyComplaints.jsx`, `pages/ComplaintDetail.jsx`
- **Check:** `SELECT complaint_id, reference, status, priority, assigned_to FROM complaints ORDER BY complaint_id DESC LIMIT 5;`

### 4. Reply Templates · table `reply_templates` *(new)*

| Op | Website | API |
|---|---|---|
| Create | Dashboard › **Reply templates** › **Create template** | `POST /reply-templates` |
| Read | Template list (search, category chips); **Insert template…** picker in enquiry responses and complaint replies | `GET /reply-templates(/:id)` |
| Update | **Edit** › **Save template** (title, category, subject, text, active) | `PUT /reply-templates/:id` |
| Delete | **Delete** | `DELETE /reply-templates/:id` |

Rules:

- Admins, and Staff with *Manage enquiries* or *Manage complaints*, can use templates.
- Staff can change only templates they created; Admins can change any.
- Titles must be unique.
- Placeholders `{{customer_name}}`, `{{reference}}`, `{{vehicle}}` and `{{staff_name}}` are filled in when a template is inserted.
- Optional starter templates: `npm --prefix server run db:seed:templates`.

- **Files:** `replyTemplate.controller.js`, `ReplyTemplateManager.jsx`, `TemplatePicker.jsx`, `utils/templates.js`
- **Check:** `SELECT template_id, title, category, is_active, created_by FROM reply_templates;`

---

## M.R. Ahamed — Admin Dashboard & Authentication

### 1. Users · table `users`

| Op | Website | API |
|---|---|---|
| Create | Dashboard › Users › **Create Staff** with a **temporary password**, which the Staff member must replace at the first sign-in; customers use `/register` | `POST /users`, `POST /auth/register` |
| Read | Users list: search, **role and status chips** (Active / Inactive / Locked), sort, pages, **table or cards**; **Details** panel (sessions, permissions, activity); `/profile` | `GET /users(/:id)`, `GET /users/:id/overview`, `GET /auth/me` |
| Update | **Edit** › **Update account** (name, email, role, active). **No password field:** only the owner changes a password, on Profile or with **Forgot password?**. Also **Unlock** a locked account, and bulk **Activate** | `PUT /users/:id`, `PATCH /users/:id/unlock`, `POST /users/bulk`, `PUT /auth/profile`, `PUT /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Delete | **Deactivate** (red hazard button; soft delete) with **Undo** for 10 seconds; bulk **Deactivate**; **Activate** (green) | `PATCH /users/:id/status`, `DELETE /users/:id`, `POST /users/bulk` |

**Security rules:**
- Passwords are stored only as bcrypt hashes, and no Admin can see or set one.
- After 5 wrong passwords the account is locked for 15 minutes; an Admin can unlock it.
- Reset links work once and expire after 30 minutes.
- An Admin cannot deactivate their own account, and the final active Admin is protected.

- **Files:** `domain.controller.js`, `auth.controller.js`, `profile.controller.js`, `UserManager.jsx`, `pages/Profile.jsx`
- **Check:** `SELECT user_id, name, email, role, is_active, LEFT(password_hash, 7) FROM users ORDER BY user_id DESC LIMIT 5;`

### 2. Sessions · table `admin_sessions`

| Op | Website | API |
|---|---|---|
| Create | Logging in | `POST /auth/login` |
| Read | Dashboard › Sessions › **My sessions / All users**:<br>• status chips (Active / Expired / Logged out / Revoked / All)<br>• search by name, email, IP or device<br>• dates, role and device filters, sort, pages<br>• **Check activity** on every session: device, IP, timeline, how and by whom it ended, duration, other sessions, failed sign-ins<br>• **Login history** (Admin), including failed attempts and lockouts | `GET /sessions(?scope=all&status=…)`, `GET /sessions/:id/activity`, `GET /sessions/login-history` |
| Update | Automatic refresh with a rotated token (counted, and shown in the timeline) | `POST /auth/refresh` |
| Delete | **Revoke**, **Sign out other devices**, log out. Each one records the reason and who did it. No Undo: a revoked session is cancelled for good | `DELETE /sessions/:id`, `DELETE /sessions`, `POST /auth/logout` |

- **Files:** `auth.controller.js`, `domain.controller.js`, `services/auth.service.js`, `SessionManager.jsx`
- **Check:** `SELECT session_id, user_id, device_label, ip_address, created_at, last_seen_at, refresh_count, revoked_at, ended_reason, ended_by FROM admin_sessions ORDER BY session_id DESC LIMIT 5;` and `SELECT event_type, email, detail, ip_address, created_at FROM session_events ORDER BY event_id DESC LIMIT 10;`

### 3. Staff Permissions · table `staff_permissions`

| Op | Website | API |
|---|---|---|
| Create | Automatic when an Admin creates a Staff account; **Create permissions** for staff with no record *(new)* | `POST /users/:id/permissions` |
| Read | Dashboard › Permissions: **8 permissions**, search, status chips, a "has permission" filter, sort, and **Cards or Matrix** view | `GET /staff-permissions`, `GET /users/:id/permissions` |
| Update | Tick boxes › **Save permissions** (or **Save** on a matrix row), with **Undo** for 10 seconds | `PUT /users/:id/permissions` |
| Delete | **Remove all access**: the row is deleted and the account kept, with **Undo** | `DELETE /users/:id/permissions` |

The two new permissions:
- **Manage bookings:** the test-drive Bookings tab, booking documents and booking counts.
- **Export reports:** the CSV, Excel and PDF downloads. Viewing reports on screen still needs only *View limited analytics*.

- **Files:** `permission.controller.js`, `StaffPermissionManager.jsx`, `middleware/core.js` (`requirePermission`)
- **Check:** `SELECT u.email, p.* FROM staff_permissions p JOIN users u ON u.user_id = p.user_id;`

### 4. Saved Reports · table `saved_reports`

| Op | Website | API |
|---|---|---|
| Create | Dashboard › Reports › generate › **Save report** | `POST /saved-reports` |
| Read | Saved reports list; **Run** | `GET /saved-reports`, `GET /saved-reports/:id/run` |
| Update | **Edit filters** › **Update saved report** | `PUT /saved-reports/:id` |
| Delete | **Delete** | `DELETE /saved-reports/:id` |

- **Files:** `report.controller.js`, `services/report.service.js`, `ReportCenter.jsx`
- **Check:** `SELECT report_id, name, report_type, filters, last_run_at FROM saved_reports;`

---

## S.N. Herathge — Financing & Company

### 1. Company Content · table `company_content`

| Op | Website | API |
|---|---|---|
| Create | Dashboard › Content › **Add company content** › **Create content** | `POST /content` |
| Read | About, Services, FAQ, Contact pages; dashboard list | `GET /content`, `GET /content/:slug` |
| Update | **Edit** › **Update content** | `PUT /content/:id` |
| Delete | **Delete** | `DELETE /content/:id` |

- **Files:** `domain.controller.js` (`contents`, `listContent`), `ContentManager.jsx`, `pages/ContentPage.jsx`
- **Check:** `SELECT content_id, section_slug, title, is_published FROM company_content;`

### 2. Financing Configurations · table `financing_configs`

| Op | Website | API |
|---|---|---|
| Create | Dashboard › Financing › **Add financing configuration**: choose **one vehicle** in the **Vehicle** drop-down (search, photo, price; only vehicles in the store), or **General plan – all other vehicles**. Then the name, interest rate, minimum down payment and maximum term › **Create configuration** | `POST /financing-config` (`vehicleId`) |
| Read | Each record shows its vehicle (name, photo, price, status) and an example monthly payment; filters: All / General / Vehicle plans / Active. On the website, that car's page and calculator show "Special finance for this vehicle", and its Inventory card shows "Finance from LKR … / month" | `GET /financing-config`, `GET /financing-config/active?vehicleId=`, `GET /vehicles(/:id)` (`financePlan`) |
| Update | **Edit** (change the vehicle or the figures) › **Update configuration**; **Make active** / **Switch off**. One active plan per vehicle, plus one active general plan | `PUT /financing-config/:id` |
| Delete | **Delete** (an active plan is protected: switch it off first) | `DELETE /financing-config/:id` |

- **Files:** `domain.controller.js` (`createFinance`, `activateFinance`, `deleteFinance`), `FinanceManager.jsx`, `FinanceCalculator.jsx`
- **Check:** `SELECT f.config_id, f.name, f.vehicle_id, CONCAT(v.year,' ',v.make,' ',v.model) AS vehicle, f.annual_interest_rate, f.min_down_payment_pct, f.max_loan_term_months, f.is_active FROM financing_configs f LEFT JOIN vehicles v ON v.vehicle_id = f.vehicle_id;`

### 3. Finance Applications · table `finance_applications` *(new)*

| Op | Website | API |
|---|---|---|
| Create | Vehicle page › calculator › **Apply for this finance** › **Submit application** | `POST /finance-applications` |
| Read | **My account › Finance applications**; Dashboard › **Finance applications** (status chips, search, dates, detail drawer) | `GET /my/finance-applications(/:id)`, `GET /finance-applications(/:id)` |
| Update | Customer **Edit** (while Submitted, recalculated) and **Withdraw**. Admin, two ways:<br>• the **status drop-down on each table row** (Submitted / Under Review / Approved in Principle / Declined; Declined asks for the note to the customer)<br>• **Save review** in the detail panel (status, note to customer, internal notes) | `PUT /my/finance-applications/:id`, `PATCH /my/finance-applications/:id/withdraw`, `PATCH /finance-applications/:id` |
| Delete | Customer **Delete** (Submitted / Withdrawn / Declined); Admin **Delete application** (removes its documents) | `DELETE /my/finance-applications/:id`, `DELETE /finance-applications/:id` |

Business rules, all enforced on the server:

- Uses the **active** financing configuration **of that vehicle** (its own plan, otherwise the general plan): minimum down payment %, maximum term and interest rate.
- The monthly payment is calculated on the server and stored as a snapshot.
- Only one open application per customer per vehicle.
- Declining needs a note to the customer.
- A withdrawn application cannot be reopened.
- Customers never see internal notes.
- The customer is emailed and notified on each decision.
- Approval is **"in principle"**, not a loan offer.
- There is also a **Finance applications** report (Reports tab), which can be saved as a Saved Report.

- **Files:** `financeApplication.controller.js`, `FinanceApplicationForm.jsx`, `pages/MyFinanceApplications.jsx`, `FinanceApplicationManager.jsx`, `FinanceCalculator.jsx`
- **Check:** `SELECT reference, status, vehicle_price, down_payment, loan_amount, term_months, annual_interest_rate, monthly_payment, reviewed_by FROM finance_applications ORDER BY application_id DESC;`

### 4. Customer Documents · table `documents` + private files in `server/storage/documents`

| Op | Website | API |
|---|---|---|
| Create | Upload on a finance application (payslip, bank statement, NIC), booking, complaint or **My documents** | `POST /documents` |
| Read | Document lists, preview, download (authorised only) | `GET /documents(/:id)`, `GET /documents/:id/download` |
| Update | **Rename** (the API also changes category / description) | `PATCH /documents/:id` |
| Delete | **Delete** (removes the stored file) | `DELETE /documents/:id` |

- **Files:** `document.controller.js`, `services/file.service.js`, `DocumentUploader.jsx`, `DocumentList.jsx`, `pages/MyDocuments.jsx`, `DocumentManager.jsx`
- **Check:** `SELECT document_id, category, original_name, finance_application_id, booking_id, complaint_id, size_bytes FROM documents ORDER BY document_id DESC LIMIT 5;`

---

## How to prove an operation works (any resource)

1. Do the operation in the website. A green message confirms it, for example "Template created".
2. Refresh the page. The change is still there, because it was read back from the database.
3. In **phpMyAdmin** › `high_street_db` › **SQL**, run the "Check" query for that resource and see the new or changed row, or that the row is gone.
4. Optional: `SELECT created_at, action, summary FROM activity_logs ORDER BY activity_id DESC LIMIT 10;` shows who did what.

## Automated proof

`npm.cmd run test:integration` runs **110 API tests**. They include a **CRUD matrix**: for each of the 16 resources, Create, Read, Update and Delete are done through the API, and each result is checked with a separate SQL query.

The tests use their own database, `high_street_db_test`, so your data is never touched. Look for the groups that start with `CRUD matrix —` in the output.

## 15 October 2026 additions

| Member | Resource | Operation | Website | API | Database |
|---|---|---|---|---|---|
| Amri | Staff leave (part of Test-Drive Bookings) | CREATE / READ / DELETE | Dashboard › Bookings › Staff availability | `POST/GET /staff-leave`, `DELETE /staff-leave/:id` | `staff_leave` |
| Amri | Test-Drive Bookings | UPDATE (assign) – now only to an available Staff member | Bookings › Assigned staff drop-down | `PATCH /bookings/:id/assign`, `GET /bookings/staff-availability` | `test_drive_bookings.assigned_to` |
| Amri | Vehicles | UPDATE – **Unarchive** to the previous status | Vehicles › Include archived › green Unarchive | `PATCH /vehicles/:id/restore` | `vehicles.status`, `status_before_archive`, `deleted_at` |
| Amri / Herathge | Test drive and finance from the home page | CREATE | `/book-test-drive`, `/finance` | `POST /bookings`, `POST /finance-applications` | `test_drive_bookings`, `finance_applications` |
| Ahamed | Staff Permissions | UPDATE – **Edit** (read-only until Edit) and **Reset** (no access) | Permissions › Edit / Reset | `PUT /users/:id/permissions`, `PATCH /users/:id/permissions/reset` | `staff_permissions` |
| Ahamed | Users (Staff) | DELETE – **permanent**, one or several | Permissions › Delete staff / Select all › Delete selected | `DELETE /users/:id/permanent`, `POST /users/bulk-delete` | `users` row removed |
