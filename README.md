# Admin Dashboard and Authentication

## Contributor

- Name: M.R. Ahamed
- Student ID: SA24611013
- Branch: developed/ahamed-admin-auth

## Assigned Function

This branch contains the files developed for the Admin Dashboard and Authentication module of the High Street vehicle sales system.

## Implemented Features

- User registration and secure login
- JWT access and refresh-token authentication
- Role-based route protection
- Admin and staff authorization
- User account management
- Staff permission management
- Active-session management
- User profile management
- Account activation and deactivation
- Login rate limiting and security validation
- Protected Admin Dashboard navigation
- Authentication and API testing

## Important Files

### Frontend

- client/src/pages/Admin.jsx
- client/src/pages/Login.jsx
- client/src/pages/Register.jsx
- client/src/pages/Profile.jsx
- client/src/features/auth/
- client/src/components/UserManager.jsx
- client/src/components/SessionManager.jsx
- client/src/components/StaffPermissionManager.jsx

### Backend

- server/src/controllers/auth.controller.js
- server/src/controllers/permission.controller.js
- server/src/controllers/profile.controller.js
- server/src/services/auth.service.js
- server/src/middleware/core.js

### Database and Integration

- high_street_db.sql
- Authentication and user migrations
- server/src/models/index.js
- server/src/routes/index.js
- server/src/validators/schemas.js

Some shared integration files contain code required by multiple team modules. The complete runnable application is maintained in the main branch.