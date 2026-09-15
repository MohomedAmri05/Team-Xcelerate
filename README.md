# Vehicle Inventory Management

## Contributor

- Name: M.R.M. Amri
- Student ID: SA25610225
- Branch: `developed/amri-vehicle-inventory`

## Assigned Function

This branch contains the files developed for the Vehicle Inventory Management module of the High Street vehicle sales system.

## Implemented Features

- Public vehicle inventory
- Vehicle search and filtering
- Vehicle details and specifications
- Vehicle availability and status management
- Administrative vehicle CRUD operations
- Multiple vehicle image uploads
- Primary image selection and image ordering
- Frontend and backend validation
- Vehicle and image database integration
- Responsive inventory and vehicle-detail interfaces

## Important Files

### Frontend

- `client/src/pages/Inventory.jsx`
- `client/src/pages/VehicleDetails.jsx`
- `client/src/components/VehicleCard.jsx`
- `client/src/components/VehicleManager.jsx`
- `client/src/components/VehicleImageManager.jsx`
- `client/src/components/VehicleShowcase.jsx`

### Backend

- `server/src/controllers/vehicle.controller.js`
- `server/src/controllers/image.controller.js`

### Database and Integration

- `high_street_db.sql`
- `server/migrations/202609120001-create-schema.cjs`
- `server/src/models/index.js`
- `server/src/routes/index.js`
- `server/src/validators/schemas.js`

Some shared integration files contain code required by multiple team modules. The complete runnable and integrated application is available in the `main` branch.