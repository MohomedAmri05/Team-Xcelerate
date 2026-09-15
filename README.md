# High Street – Full-Stack Vehicle Sales Platform

High Street is a full-stack vehicle sales platform developed for High Street (PVT) Ltd., Katugastota, Kandy.

The application includes a responsive public vehicle showroom, customer accounts, role-based staff operations, an Admin dashboard, vehicle image management, enquiries, test-drive bookings, wishlist functionality and a financing calculator.

## Technology Stack

### Frontend

- React 19
- Vite
- React Router
- Axios
- React Hook Form
- Zod
- Framer Motion
- React Three Fiber
- Lucide React
- React Hot Toast

### Backend

- Node.js
- Express.js
- Sequelize ORM
- MySQL
- JSON Web Tokens
- bcrypt
- Nodemailer
- Multer
- Helmet
- Express Rate Limit
- Zod

## Architecture

```text
React/Vite
    ↓
Axios
    ↓
Express REST API (/api/v1)
    ↓
Routes and middleware
    ↓
Controllers and services
    ↓
Sequelize ORM
    ↓
MySQL
```

## User Roles

### Customer

Customers can:

- Register and log in.
- View Available and Sold vehicles.
- View individual vehicle details.
- Maintain a wishlist.
- Submit enquiries for Available vehicles.
- View their own enquiries and responses.
- Request test-drive bookings.
- View and cancel eligible bookings.
- Update their profile and password.

### Staff

Staff access is controlled through permissions assigned by an Admin.

Depending on their permissions, Staff can:

- Manage vehicle inventory.
- Upload and update vehicle images.
- Archive vehicles.
- View assigned enquiries.
- Create and send enquiry responses.
- Manage assigned test-drive bookings.
- View and revoke their own sessions.

### Admin

Admins have access to:

- Vehicle management.
- Vehicle image management.
- Enquiry and response management.
- Test-drive booking management.
- User management.
- Staff permission management.
- Session management.
- Company content management.
- Financing configuration management.

## CRUD Resources

The project contains eight primary assigned CRUD resources:

1. Vehicles
2. Vehicle Images
3. Enquiries
4. Enquiry Responses
5. Users
6. Sessions
7. Company Content
8. Financing Configurations

It also contains two supplementary customer resources:

- Wishlists
- Test-Drive Bookings

## Security Features

The application includes:

- Password hashing with bcrypt.
- Short-lived JWT access tokens.
- Hashed rotating refresh tokens.
- Revocable user sessions.
- Role-based authorization.
- Staff permission checks.
- Customer record ownership checks.
- Zod request validation.
- Helmet security headers.
- Restricted CORS configuration.
- Login and enquiry rate limiting.
- Image MIME-type validation.
- Image size and quantity restrictions.
- UUID image filenames.
- Protection against deactivating the final active Admin.
- Protection against deleting the active financing configuration.
- Soft archiving for vehicles.
- Draft response protection when email delivery fails.

## Requirements

- Node.js 20 or newer
- npm
- MySQL 8 or compatible MariaDB version
- XAMPP or another MySQL server
- A modern web browser

The project was tested locally with Node.js 24.

## Database Setup

Create the development database:

```sql
CREATE DATABASE high_street_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

Select it:

```sql
USE high_street_db;
```

Configure the database connection inside the local `.env` file.

Run the migrations:

```powershell
npm.cmd --prefix server run db:migrate
```

Run the seeders if demonstration records are required:

```powershell
npm.cmd --prefix server run db:seed
```

## Environment Configuration

Copy:

```text
.env.example
```

to:

```text
.env
```

Set the database credentials, JWT secrets and optional SMTP configuration.

Example:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=high_street_db
DB_USER=root
DB_PASSWORD=

JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-another-long-random-secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_DAYS=7

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM="High Street <no-reply@highstreet.lk>"
ADMIN_NOTIFICATION_EMAIL=

VITE_API_URL=http://localhost:5000/api/v1
```

Never commit the real `.env` file, Gmail App Password, database password or JWT secrets.

## Installation

From the project root, install the backend dependencies:

```powershell
npm.cmd --prefix server install
```

Install the frontend dependencies:

```powershell
npm.cmd --prefix client install
```

## Running the Application

Start the backend in the first terminal:

```powershell
npm.cmd --prefix server run dev
```

Expected address:

```text
http://localhost:5000
```

Start the frontend in a second terminal:

```powershell
npm.cmd --prefix client run dev
```

Open:

```text
http://localhost:5173
```

## API Health Check

Open:

```text
http://localhost:5000/api/v1/health
```

Or run in PowerShell:

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
```

## Testing

Run the backend tests:

```powershell
npm.cmd --prefix server test
```

The backend tests cover:

- API health.
- Protected-route rejection.
- JSON 404 responses.
- Amortized loan calculations.
- Zero-interest loan calculations.

Run the frontend tests:

```powershell
npm.cmd --prefix client test -- --run
```

The frontend component test verifies:

- Finance estimate output.
- Finance disclaimer display.

Create a production frontend build:

```powershell
npm.cmd --prefix client run build
```

## Vehicle Image Uploads

Vehicle images are stored in:

```text
server/uploads
```

Supported file types:

- JPEG
- PNG
- WebP

Upload restrictions:

- Maximum 5 MB per image.
- Maximum 10 images per request.
- UUID-based filenames.
- Only Admin can permanently delete image records and stored files.

The backend serves uploaded files through:

```text
http://localhost:5000/uploads/
```

## Email Configuration

Nodemailer sends:

- Admin notifications for new customer enquiries.
- Customer emails for sent enquiry responses.

For Gmail SMTP, enable Google 2-Step Verification and use a dedicated App Password. Do not use the normal Gmail password.

When SMTP is unavailable during development, the application creates a safe terminal preview. An enquiry response remains a Draft if it was not delivered.

## Financing Calculator

The calculator provides an estimated monthly payment using the active database financing configuration.

The calculated value is illustrative only and is not a formal loan offer or financial approval.

## Production Recommendations

Before production deployment:

- Use HTTPS.
- Use high-entropy JWT secrets.
- Use a managed MySQL database with backups.
- Restrict `CLIENT_URL` to the deployed frontend.
- Replace local image storage with persistent object storage.
- Configure a production transactional email provider.
- Run migrations before starting the API.
- Review dependency security warnings.
- Never deploy demonstration passwords.
- Never commit `.env` or private credentials.

## Project Status

The application currently includes:

- Working frontend and backend integration.
- Working MySQL persistence.
- Role and permission authorization.
- Complete primary CRUD workflows.
- Customer wishlist and booking workflows.
- Real email delivery with safe failure handling.
- Passing backend and frontend automated tests.
- Successful frontend production build.