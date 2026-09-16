# High Street — Financing & Company Module

A full-stack module developed for the **High Street vehicle sales platform**, providing illustrative vehicle-finance calculations, finance configuration management, public company information, administrative content management, responsive company pages, system integration and final testing support.

## Contributor

| Detail                       | Information                          |
| ---------------------------- | ------------------------------------ |
| Name                         | S.N. Herathge                        |
| Student ID                   | SA25610135                           |
| Assigned module              | Financing & Company Module           |
| Development branch           | `feature/herathge-finance-company`   |
| Individual submission branch | `developed/herathge-finance-company` |

## Module Responsibilities

This module manages the company-facing information and finance functionality of the High Street platform.

It covers:

* Vehicle finance calculations
* Administrative finance configuration
* Active finance-plan management
* Company content administration
* Public About, Services and FAQ pages
* Contact and showroom information
* Dynamic content retrieval
* Published and draft content states
* Responsive cinematic page design
* Backend APIs and database integration
* System documentation
* Integration and final testing

## Core Features

### Illustrative Finance Calculator

The finance calculator allows users to estimate vehicle-financing values using:

* Vehicle price
* Minimum down-payment percentage
* Annual interest rate
* Maximum loan term
* Selected repayment duration

The result is presented as an illustrative estimate and does not represent loan approval, a quotation or a guaranteed financial offer.

### Finance Configuration Management

Authorized administrators can:

* Create finance configurations
* View existing configurations
* Edit interest rates
* Set minimum down-payment percentages
* Set maximum loan terms
* Activate a selected configuration
* Deactivate outdated configurations
* Remove configurations when permitted

The public finance calculator uses the currently active configuration.

### Company Content Management

The Content Manager allows authorized users to maintain company information without editing source code.

Administrators can manage:

* Section slug
* Section title
* Body content
* Image URL
* Display order
* Published or draft state

Supported public content sections include:

* About
* Services
* FAQ
* Contact

### Dynamic Company Pages

Public company pages retrieve their content through the backend API. This allows text and images to be updated from the Admin Dashboard.

The pages include:

* Loading states
* Error states
* Dynamic titles and descriptions
* Managed images
* Responsive layouts
* Reusable animation variants
* Vehicle showcases
* Calls to action
* FAQ accordions
* Company and showroom information

### Contact and Showroom Information

The Contact page presents:

* Company contact information
* Showroom location
* Telephone and email actions
* Business hours
* Customer contact interface
* Responsive map integration

The customer-enquiry form is integrated with the Customer Enquiry module. That enquiry-processing functionality is a shared team dependency rather than the sole responsibility of this module.

### Cinematic User Interface

The public company pages follow the High Street visual system through:

* Dark automotive styling
* Responsive editorial layouts
* Premium typography
* Image-based hero sections
* Scroll-triggered animations
* Hover effects
* Responsive vehicle showcases
* Accessible reduced-motion support
* Reusable calls to action

## Finance Calculation Flow

1. The frontend requests the active finance configuration.
2. The vehicle price is used as the base amount.
3. The minimum down payment is calculated.
4. The financed balance is determined.
5. Interest is calculated using the configured annual rate.
6. The selected loan duration is applied.
7. The estimated monthly payment is displayed.
8. A disclaimer explains that the result is illustrative.

## Content Retrieval Flow

1. A public page requests content using its slug.
2. The React frontend sends an Axios request.
3. The Express route receives the request.
4. The controller queries the content resource.
5. Sequelize retrieves the published record from MySQL.
6. The API returns the content as JSON.
7. React renders the title, body and managed image.
8. Loading and error states are displayed when required.

## Main Files

### Finance Frontend

```text
client/src/components/FinanceCalculator.jsx
client/src/components/FinanceCalculator.test.jsx
client/src/components/FinanceManager.jsx
client/src/utils/finance.js
```

### Company Content Frontend

```text
client/src/components/ContentManager.jsx
client/src/pages/ContentPage.jsx
client/src/pages/Contact.jsx
client/src/components/VehicleShowcase.jsx
```

### Content Assets

```text
client/public/images/content/
```

### Shared Frontend Integration

```text
client/src/App.jsx
client/src/components/Nav.jsx
client/src/hooks/useApi.js
client/src/services/api.js
client/src/utils/mediaUrl.js
client/src/utils/motionVariants.js
client/src/style.css
```

### Backend and Business Logic

```text
server/src/controllers/domain.controller.js
server/src/services/resource.service.js
server/src/utils/finance.js
server/src/models/index.js
server/src/routes/index.js
server/src/validators/schemas.js
```

### Database and Seed Data

```text
high_street_db.sql
server/migrations/202609120001-create-schema.cjs
server/seeders/202609120001-demo-data.cjs
```

### Documentation and Testing

```text
docs/API.md
docs/TESTING.md
server/test/api.test.js
server/test/finance.test.js
e2e/smoke.spec.js
playwright.config.js
```

## Validation

Finance configuration validation protects fields such as:

* Configuration name
* Annual interest rate
* Minimum down-payment percentage
* Maximum loan term
* Active configuration state

Content validation protects fields such as:

* Valid section slug
* Required title
* Body-content length
* Image URL
* Display order
* Published status

Validation is applied on the backend because frontend validation alone can be bypassed through direct API requests.

## Access Control

### Public users

Public users can:

* View published company content
* Access the About, Services, FAQ and Contact pages
* Use the illustrative finance calculator
* View the active finance configuration indirectly through calculator results

### Authorized administrators

Administrators can:

* Create, edit and remove content records
* Publish or unpublish company content
* Create and update finance configurations
* Select the active finance configuration
* Manage site-wide company information

Protected backend routes verify authentication and authorization before permitting administrative operations.

## Database Design

### Content Records

Content records store:

* Slug
* Title
* Body
* Image URL
* Display order
* Published status
* Creation and update timestamps

### Finance Records

Finance configurations store:

* Configuration name
* Annual interest rate
* Minimum down-payment percentage
* Maximum loan term
* Active status
* Creation and update timestamps

Only the active finance configuration should control the current public estimate.

## Error Handling

The module handles:

* Network failures
* Missing content records
* Missing active finance configurations
* Invalid percentages
* Invalid loan terms
* Unauthorized administration requests
* Database errors
* Loading and empty states
* Image fallback behavior
* Unexpected API errors

The frontend presents readable feedback instead of exposing internal server details.

## Testing

The module includes or supports:

* Finance calculation unit tests
* API integration tests
* Public content retrieval tests
* Finance configuration validation
* Content publication checks
* Responsive page testing
* Loading and error-state testing
* End-to-end smoke testing
* Final system integration testing

## Branch Structure

### `feature/herathge-finance-company`

Contains the complete runnable project and provides the normal development environment for Financing and Company Module work.

### `developed/herathge-finance-company`

Contains the files associated with the individual Financing and Company Module contribution. It is maintained as academic contribution evidence and should not be merged directly into `main`.

### `main`

Contains the complete integrated High Street platform developed by the full team.

## Shared Integration Notice

Several files are shared across team modules, including:

```text
App.jsx
Nav.jsx
Contact.jsx
style.css
models/index.js
routes/index.js
schemas.js
high_street_db.sql
```

They are included because they contain routes, styles, models, validation or integration logic required by the Financing and Company Module. Shared functionality remains part of the complete system maintained in `main`.

## Technology Stack

* React
* React Router
* Framer Motion
* Axios
* Node.js
* Express.js
* MySQL
* Sequelize
* Zod
* Vitest
* Playwright
* CSS responsive design

## Project Context

High Street is a full-stack vehicle sales and showroom-management platform developed for **High**
