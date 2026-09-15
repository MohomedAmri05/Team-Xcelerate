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