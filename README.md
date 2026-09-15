# High Street — Admin Dashboard & Authentication Module

A secure administration and identity-management module developed for the *High Street vehicle sales platform*. It provides authentication, authorization, staff permissions, user administration, profile management and active-session control across the React frontend and Node.js backend.

## Contributor

| Detail                       | Information                      |
| ---------------------------- | -------------------------------- |
| Name                         | M.R. Ahamed                      |
| Student ID                   | SA24611013                       |
| Assigned module              | Admin Dashboard & Authentication |
| Development branch           | feature/ahamed-admin-auth      |
| Individual submission branch | developed/ahamed-admin-auth    |

## Module Responsibilities

This module controls how users securely access the High Street platform and what actions they are permitted to perform.

It covers:

* Frontend authentication interfaces
* Backend authentication APIs
* JWT-based access control
* User and staff account administration
* Role-based and permission-based authorization
* Active login-session management
* Profile management
* Authentication validation and security testing

## Core Features

### Secure Authentication

* Customer registration
* Admin, staff and customer login
* Password hashing and secure credential verification
* JWT access-token generation
* Refresh-token lifecycle management
* Authenticated user retrieval
* Secure logout and session revocation
* Login rate limiting
* Inactive-account protection

### Role-Based Authorization

The system supports three primary roles:

| Role     | Access                                                             |
| -------- | ------------------------------------------------------------------ |
| Admin    | Full dashboard, user, permission and system-management access      |
| Staff    | Access controlled through assigned operational permissions         |
| Customer | Public store, profile, wishlist, booking and enquiry functionality |

Protected routes and middleware prevent unauthorized users from accessing restricted frontend pages and backend endpoints.

### Admin Dashboard

The administration interface provides centralized access to operational modules, including:

* User management
* Staff permission management
* Active-session management
* Vehicle and image administration
* Customer enquiry management
* Booking management
* Company content management
* Financing configuration

The dashboard displays functionality according to the authenticated user’s role and assigned permissions.

### User Management

Administrators can:

* View registered users
* Create staff accounts
* Edit account information
* Assign user roles
* Activate or deactivate accounts
* Review account details
* Manage staff access securely

### Staff Permission Management

Staff accounts can be assigned specific operational permissions, including:

* Inventory management
* Enquiry management
* Record archiving

This prevents staff members from accessing functionality outside their assigned responsibilities.

### Session Management

The system tracks authenticated sessions and allows authorized users to:

* Review active sessions
* Identify the current session
* Revoke individual sessions
* Sign out other devices
* Invalidate expired or unauthorized sessions

### Profile Management

Authenticated users can:

* View their account information
* Update supported profile details
* Change their password securely
* Review their assigned role

## Security Controls

The module implements the following protections:

* Password hashing
* JWT access and refresh tokens
* Hashed refresh-token storage
* Authentication middleware
* Admin-only middleware
* Staff-or-admin middleware
* Customer-only middleware
* Permission-based authorization
* Login rate limiting
* Input validation
* Protected frontend routes
* Inactive-user rejection
* Session expiration
* Session revocation
* Centralized API error handling

Sensitive configuration values are stored in environment variables and are not committed to the repository.

## Authentication Flow

1. The user submits their email and password.
2. The backend validates the submitted information.
3. The account status and password are verified.
4. The server creates an access token and refresh session.
5. The frontend stores the active authentication state.
6. Protected routes verify the user’s role and permissions.
7. Expired sessions can be renewed through the refresh-token process.
8. Logout revokes the relevant session.

## Main API Routes

### Authentication

| Method | Endpoint                | Purpose                         |
| ------ | ----------------------- | ------------------------------- |
| POST   | /api/v1/auth/register | Register a Customer account     |
| POST   | /api/v1/auth/login    | Authenticate a user             |
| POST   | /api/v1/auth/refresh  | Renew authentication            |
| POST   | /api/v1/auth/logout   | End the current session         |
| GET    | /api/v1/auth/me       | Retrieve the authenticated user |

### Administration

The module also supports protected routes for:

* User creation and management
* Account activation and deactivation
* Staff permission management
* Profile management
* Active-session listing and revocation

## Important Files

### Frontend Authentication

text
client/src/features/auth/AuthContext.jsx
client/src/features/auth/ProtectedRoute.jsx
client/src/features/auth/authStorage.js
client/src/pages/Login.jsx
client/src/pages/Register.jsx
client/src/pages/Profile.jsx


### Admin Dashboard

text
client/src/pages/Admin.jsx
client/src/components/UserManager.jsx
client/src/components/SessionManager.jsx
client/src/components/StaffPermissionManager.jsx
client/src/components/Nav.jsx


### Backend Authentication and Authorization

text
server/src/controllers/auth.controller.js
server/src/controllers/permission.controller.js
server/src/controllers/profile.controller.js
server/src/services/auth.service.js
server/src/middleware/core.js


### Shared Backend Integration

text
server/src/app.js
server/src/config/db.js
server/src/controllers/domain.controller.js
server/src/services/resource.service.js
server/src/models/index.js
server/src/routes/index.js
server/src/validators/schemas.js


### Database and Migrations

text
high_street_db.sql
server/migrations/202609120001-create-schema.cjs
server/migrations/202609130001-add-customer-role-and-profile.cjs
server/migrations/202609130002-add-staff-permissions-and-enquiry-assignments.cjs


### Testing

text
server/test/api.test.js


## Validation and Testing

The module was reviewed for:

* Valid and invalid login attempts
* Customer registration validation
* Incorrect-password rejection
* Unauthorized route protection
* Role-based access restrictions
* Staff permission enforcement
* Inactive-account rejection
* Token and session handling
* User-management operations
* Session revocation
* Profile updates
* API validation and error responses

## Branch Structure

### feature/ahamed-admin-auth

Contains the complete runnable project and provides a normal development environment for Admin Dashboard and Authentication work.

### developed/ahamed-admin-auth

Contains the files associated with the individual Admin Dashboard and Authentication contribution. This branch is maintained as academic contribution evidence and is not intended to be merged directly into main.

### main

Contains the complete integrated High Street application developed by the full team.

## Shared Integration Notice

Some files, including App.jsx, Admin.jsx, style.css, models/index.js, routes/index.js, schemas.js and high_street_db.sql, support multiple system modules. They are included because they contain routing, styling, database or authorization logic required by this module.

## Technology Stack

* React
* React Router
* Axios
* Node.js
* Express.js
* MySQL
* Sequelize
* JSON Web Tokens
* Zod validation
* React Hot Toast
* Lucide React

## Project Context

High Street is a full-stack vehicle sales and showroom-management platform developed for *High Street (PVT) Ltd., Katugastota, Kandy*.

The complete integrated and runnable application is maintained in the repository’s main branch.
