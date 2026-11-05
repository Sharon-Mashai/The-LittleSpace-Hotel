# The LittleSpace Hotel

The LittleSpace Hotel is a hotel booking web application that allows guests to explore hotel branches, check room availability, make bookings and pay online. It also provides an administration area where authorised staff can manage bookings.

The application is designed around one hotel brand with multiple branches in different locations.

## Application Screenshots

### Application Overview

![The LittleSpace Hotel Application Overview](docs/screenshots/app-overview.png)

### Guest Application

**Home Page**

![LittleSpace Hotel Home Page](docs/screenshots/home-page.png)

**Hotel Branches**

![Hotel Branches](docs/screenshots/hotel-branches.png)

**Room Details**

![Room Details](docs/screenshots/room-details.png)

**Room Availability**

![Room Availability](docs/screenshots/room-availability.png)

**Booking and Checkout**

![Booking and Checkout](docs/screenshots/booking-checkout.png)

**Payment**

![Paystack Payment](docs/screenshots/payment.png)

**Guest Authentication**

![Guest Authentication](docs/screenshots/guest-authentication.png)

### Admin Application

**Admin Dashboard**

![Admin Dashboard](docs/screenshots/admin-dashboard.png)

**Booking Management**

![Admin Booking Management](docs/screenshots/booking-management.png)


## Features

### Guest Features

- View available LittleSpace Hotel branches.
- Explore branch information and room types.
- Check room availability using check-in and check-out dates.
- Make bookings as a registered guest or without creating an account.
- Enter guest details during checkout.
- Pay for bookings securely using Paystack.
- Register and sign in to a guest account.
- Request a password reset through email.
- Reset an account password using a secure, time-limited link.
- View booking information where supported by the application.

### Admin Features

- Access the administration area.
- View and manage guest bookings.
- Confirm, cancel or reject bookings, subject to booking and payment rules.
- Confirm eligible bookings after successful payment.
- Send booking confirmation emails when an administrator confirms a booking.

## Technologies Used

### Frontend

- React
- TypeScript
- Vite
- React Router
- CSS

### Backend

- Node.js
- Express
- TypeScript
- PostgreSQL
- `pg` (node-postgres)
- Paystack payment integration
- Nodemailer for email delivery
- bcrypt for password hashing

## Project Structure

The project is organised into separate frontend and backend applications.

## Getting Started

Follow these instructions to run the project on your local machine.

### Prerequisites

Install the following before starting:

- [Node.js](https://nodejs.org/)
- npm (included with Node.js)
- PostgreSQL
- A code editor such as [Visual Studio Code](https://code.visualstudio.com/)
- A Paystack test account for testing payments
- SMTP email credentials for email functionality

### 1. Clone the Repository

```bash
git clone https://github.com/Sharon-Mashai/The-LittleSpace-Hotel.git
```

Navigate into the project:

```bash
cd The-LittleSpace-Hotel
```

### 2. Set Up the Backend

Open a terminal and navigate to the backend folder:

```bash
cd backend
```

Install the dependencies:

```bash
npm install
```

Start the backend development server:

```bash
npm run dev
```

### 3. Set Up the Frontend

Open another terminal from the project root and navigate to the frontend folder:

```bash
cd frontend
```

Install the dependencies:

```bash
npm install
```

Configure the frontend API base URL using the environment variable expected by the frontend API service. For local development, it should point to your backend, for example:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal, usually:

```text
http://localhost:5173
```

## Database

The application uses PostgreSQL to store its data.

The database supports information such as:

- Hotel branches
- Room types and accommodation
- Room availability
- Guest accounts
- Bookings
- Payments
- Password reset tokens
- Administrative access

Configure your PostgreSQL connection using the backend environment variables.

Ensure that the database schema has been created before testing the application's database-dependent features.

## Payments

The application integrates with **Paystack** to process booking payments.

The payment process includes:

1. A guest selects a branch, room type and booking dates.
2. The application checks room availability.
3. The guest provides the required personal and contact details.
4. The backend creates the booking and initiates payment.
5. Paystack processes the payment.
6. The backend verifies the payment and processes successful payment notifications through the Paystack webhook.
7. The booking and payment records are updated in the database.

Paystack test credentials should be used during development and testing.

## Email Functionality

The application uses Nodemailer with SMTP to send emails.

Email functionality includes:

- Password reset emails containing secure reset links.
- Booking confirmation emails when an administrator confirms an eligible booking.

Email credentials must be configured in the backend environment file.

## Security

The application includes security-related measures such as:

- Password hashing.
- Time-limited password reset tokens.
- Secure password reset token storage using hashes.
- Payment verification through the backend.
- Paystack webhook signature verification.
- Environment variables for sensitive configuration.
- Validation of booking and payment status before administrative actions.

## Development Scripts

### Backend

Run the development server:

```bash
npm run dev
```

Check TypeScript errors:

```bash
npm run typecheck
```

Build the backend:

```bash
npm run build
```

Run the built backend:

```bash
npm start
```

### Frontend

Run the development server:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

## Author

**Mashai Sharon**

GitHub: [Sharon-Mashai](https://github.com/Sharon-Mashai)

## Project

**The LittleSpace Hotel** — A hotel booking application built to simplify the process of discovering hotel branches, checking room availability and making online reservations.