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