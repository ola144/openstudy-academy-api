# School Application API

Backend API for the School Application learning platform. The service is an
Express 5 application backed by MongoDB/Mongoose. It handles account access,
school and curriculum data, evaluations, student progress, invoices, Paystack
payments/refunds, teacher banking, and payroll.

> **API reference note:** The route catalog below reflects the routes mounted by
> `src/app.ts` and the middleware declared in each route module. Some older
> resource routes do not declare authentication or role checks consistently.
> Review the corresponding controller and route middleware before relying on
> those routes as a security boundary.

## Contents

- [Requirements](#requirements)
- [Configuration](#configuration)
- [Install and run](#install-and-run)
- [Health check](#health-check)
- [API conventions](#api-conventions)
- [Authentication and roles](#authentication-and-roles)
- [Route reference](#route-reference)
- [Payments and payroll](#payments-and-payroll)
- [Background jobs and external services](#background-jobs-and-external-services)
- [Errors and validation](#errors-and-validation)
- [Seed data](#seed-data)
- [Project structure](#project-structure)
- [Production checklist](#production-checklist)

## Requirements

- A Node.js runtime compatible with the project's TypeScript ESM setup.
- MongoDB. Workflows using Mongoose transactions require a MongoDB deployment
  that supports transactions, such as a replica set.
- Paystack credentials for payment, refund, and bank-transfer features.
- Brevo credentials and a sender address for transactional email.

The project does not declare a Node.js engine constraint. Use a supported,
maintained Node.js release and validate the `start` script in the deployment
runtime.

## Configuration

Create `server/.env` for local development. Do not commit this file or put real
credentials in source control.

| Variable                      | Required                        | Description                                                                                                                                                                            |
| ----------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                        | No                              | HTTP port. Defaults to `7070`.                                                                                                                                                         |
| `NODE_ENV`                    | Recommended                     | Set to `production` in deployed environments. Controls authentication-cookie `Secure` and `SameSite` settings.                                                                         |
| `MONGODB_URI`                 | Yes                             | MongoDB connection URI.                                                                                                                                                                |
| `JWT_SECRET`                  | Yes in production               | Secret used to sign and verify authentication JWTs. The current code has a development fallback; replace it with a strong, unique secret and never rely on the fallback in production. |
| `JWT_EXPIRES_IN`              | No                              | Optional `jsonwebtoken` expiry string, for example `7h`. The authentication cookie currently expires after seven hours.                                                                |
| `CLIENT_URL`                  | Yes for email links             | Frontend origin used to construct email verification and password-setup links.                                                                                                         |
| `BREVO_API_KEY`               | Yes for email delivery          | Brevo API key used to send transactional emails.                                                                                                                                       |
| `EMAIL_FROM`                  | Yes for email delivery          | Verified sender email address configured in Brevo.                                                                                                                                     |
| `PAYSTACK_SECRET_KEY`         | Yes for Paystack features       | Paystack secret key used for API requests and webhook-signature verification. Keep it server-side.                                                                                     |
| `PAYSTACK_CALLBACK_URL`       | No                              | Optional callback URL passed when initializing student payments.                                                                                                                       |
| `BANK_ACCOUNT_ENCRYPTION_KEY` | Yes for bank-account encryption | 64-character hexadecimal key (32 bytes) used with AES-256-GCM for account-number encryption. Keep it stable and backed up securely; rotating it requires a data migration.             |
| `SCHOOL_NAME`                 | No                              | School name printed on payslips and payment receipts. Defaults to `OpenStudy Academy`.                                                                                                 |

Example local `.env` template (replace every placeholder; do not use sample
secrets in production):

```dotenv
PORT=7070
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/school-application
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7h
CLIENT_URL=http://localhost:5173
BREVO_API_KEY=replace-with-your-brevo-api-key
EMAIL_FROM=notifications@example.com
PAYSTACK_SECRET_KEY=replace-with-your-paystack-secret
PAYSTACK_CALLBACK_URL=http://localhost:5173/student/payment/callback
BANK_ACCOUNT_ENCRYPTION_KEY=replace-with-64-hexadecimal-characters
SCHOOL_NAME=Your School
```

The CORS allowlist is currently defined in `src/app.ts` and permits
`http://localhost:7070` and `http://localhost:5173`. Configure the intended
frontend origins in that application code before deploying a frontend at a
different origin. Credentialed requests are enabled.

## Install and run

Run commands from the `server/` directory:

```bash
npm install
npm run dev
```

The development command starts `src/server.ts` with Nodemon and `ts-node`.
`npm start` runs the production entry point configured by the package. Startup
connects to MongoDB, synchronizes overdue invoices, and starts the scheduled
jobs before listening on the configured port.

## Health check

```http
GET /api/v1/health
```

Successful response:

```json
{
  "success": true,
  "message": "Server is running"
}
```

This confirms the HTTP application is responding; it is not a full dependency
health check for Paystack, Brevo, or MongoDB.

## API conventions

- **Base URL:** `http://localhost:7070/api/v1` for the default local setup.
- **Content type:** Send JSON with `Content-Type: application/json` for JSON
  request bodies. The Express JSON parser is configured with a 50 MB limit.
- **Authentication:** Protected endpoints use the `accessToken` HTTP-only cookie
  set on login. The browser client must send credentialed requests. The JWT is
  not returned as a bearer token in the login response.
- **Identifiers:** Resource IDs are generally MongoDB ObjectId strings.
- **Pagination:** List endpoints commonly accept `page` (1-based) and `limit`.
  Supported filters vary by resource; see the route descriptions below and the
  corresponding controller.
- **Money:** Invoice, payment, refund, and payroll monetary values are stored
  and sent in the smallest currency unit: kobo for NGN. `100000` means
  `₦1,000.00`. Periods for payroll use `YYYY-MM`.
- **Dates:** Use ISO-8601 dates/timestamps unless a specific endpoint expects a
  date-only string.
- **CORS:** Credentialed CORS is enabled only for the allowlisted origins
  described in [Configuration](#configuration).

### Cookie-based login example

```bash
curl -i \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"student@example.com","password":"your-password"}' \
  http://localhost:7070/api/v1/auth/login
```

Use the saved cookie for a protected request:

```bash
curl -i \
  -b cookies.txt \
  http://localhost:7070/api/v1/auth/me
```

For browser clients, configure the HTTP client to send credentials and ensure
the frontend origin is on the server's CORS allowlist.

## Authentication and roles

The supported roles are `ADMIN`, `TEACHER`, and `STUDENT`. Protected requests
are authenticated by verifying the JWT stored in the `accessToken` cookie and
looking up the account. Role-restricted route modules additionally use
authorization middleware.

Authentication behavior includes:

- Login requires verified email and an active account.
- Login attempts are limited to five unsuccessful requests per IP per
  15-minute window. Accounts are also blocked after repeated failed
  credentials.
- Successful login sets an HTTP-only cookie. In production the cookie is
  `Secure` and `SameSite=None`; in non-production it uses `SameSite=Lax`.
- Logout clears the cookie.
- Email verification and teacher password setup use expiring, single-use
  tokens sent via transactional email.

### Auth endpoints

| Method | Path                          | Access               | Description                                      |
| ------ | ----------------------------- | -------------------- | ------------------------------------------------ |
| `POST` | `/auth/register`              | Public               | Register an account and send email verification. |
| `POST` | `/auth/login`                 | Public, rate-limited | Authenticate and set the `accessToken` cookie.   |
| `POST` | `/auth/logout`                | Public               | Clear the authentication cookie.                 |
| `POST` | `/auth/create-password`       | Public               | Complete password creation from a setup token.   |
| `GET`  | `/auth/verify-email/:token`   | Public               | Verify an email address.                         |
| `GET`  | `/auth/resend-invitation/:id` | Authenticated        | Resend a password-setup invitation.              |
| `GET`  | `/auth/me`                    | Authenticated        | Return the current authenticated account.        |

All paths in the route tables are relative to `/api/v1`.

## Route reference

Access labels reflect the route-level `protect` and `authorize` middleware:

- **Public:** no authentication middleware is declared for the route.
- **Authenticated:** valid login cookie required; any signed-in role unless an
  additional role is stated.
- **Admin**, **Teacher**, **Student:** authenticated and role restricted.
- **Role varies:** route module authenticates the request but does not apply one
  role uniformly; individual handlers may apply additional checks.

### Users, staff, and classes

| Method  | Path                               | Access                  | Description                                                          |
| ------- | ---------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| `GET`   | `/users`                           | Authenticated           | Get the current user's profile.                                      |
| `PATCH` | `/users/update-user`               | Authenticated           | Update the current user's profile.                                   |
| `PATCH` | `/users/upload-profile-pic`        | Authenticated           | Update the profile picture.                                          |
| `GET`   | `/admin/teacher`                   | Admin                   | List teachers.                                                       |
| `POST`  | `/admin/teacher`                   | Admin                   | Create a teacher and send an invitation.                             |
| `GET`   | `/admin/teacher/:id`               | Admin                   | Get teacher details.                                                 |
| `PATCH` | `/admin/teacher/:id`               | Admin                   | Update teacher details.                                              |
| `PATCH` | `/admin/teacher/update-status/:id` | Admin                   | Activate or deactivate a teacher.                                    |
| `GET`   | `/students`                        | Admin, Teacher, Student | List students (controller applies the requested access logic).       |
| `GET`   | `/students/:id`                    | Admin, Teacher, Student | Get student details (controller applies the requested access logic). |
| `PATCH` | `/students/:id/update-student`     | Admin                   | Update student information.                                          |
| `PATCH` | `/students/update-status/:id`      | Admin                   | Update student status.                                               |
| `GET`   | `/class`                           | No route-level auth     | List classes.                                                        |
| `POST`  | `/class`                           | No route-level auth     | Create a class.                                                      |
| `PATCH` | `/class/:id`                       | Admin                   | Update a class.                                                      |
| `PATCH` | `/class/update-status/:id`         | No route-level auth     | Update class status.                                                 |

The class creation, listing, and status routes do not attach route-level
authentication in the current router. Do not treat those endpoints as
administrator-only unless the controller enforces that separately.

### School information and schedules

| Method  | Path                                    | Access  | Description                            |
| ------- | --------------------------------------- | ------- | -------------------------------------- |
| `GET`   | `/school-info`                          | Public  | Get school information.                |
| `POST`  | `/school-info`                          | Admin   | Create school information.             |
| `PATCH` | `/school-info/:id`                      | Admin   | Update school information.             |
| `PATCH` | `/school-info/:id/upload-logo`          | Admin   | Upload or update the school logo.      |
| `POST`  | `/teaching-schedules`                   | Admin   | Create a teaching schedule.            |
| `PATCH` | `/teaching-schedules/:id`               | Admin   | Update a schedule.                     |
| `PATCH` | `/teaching-schedules/:id/cancel`        | Admin   | Cancel a schedule.                     |
| `GET`   | `/teaching-schedules/all-schedules`     | Admin   | List schedules for administration.     |
| `GET`   | `/teaching-schedules/teacher-schedules` | Teacher | Get the signed-in teacher's schedules. |
| `GET`   | `/teaching-schedules/student-schedules` | Student | Get the signed-in student's schedules. |

### Curriculum and learning

| Method  | Path                             | Access         | Description                            |
| ------- | -------------------------------- | -------------- | -------------------------------------- |
| `GET`   | `/subjects`                      | Authenticated  | List subjects.                         |
| `GET`   | `/subjects/:id`                  | Authenticated  | Get subject details.                   |
| `GET`   | `/subjects/assigned`             | Teacher        | Get subjects assigned to the teacher.  |
| `GET`   | `/subjects/student-assigned`     | Student        | List subjects assigned to the student. |
| `GET`   | `/subjects/student-assigned/:id` | Student        | Get an assigned student subject.       |
| `POST`  | `/subjects`                      | Admin          | Create a subject.                      |
| `PATCH` | `/subjects/:id`                  | Admin          | Update a subject.                      |
| `PATCH` | `/subjects/update-status/:id`    | Admin          | Update subject status.                 |
| `GET`   | `/topics`                        | Authenticated  | List topics.                           |
| `GET`   | `/topics/:id`                    | Authenticated  | Get topic details.                     |
| `GET`   | `/topics/assigned`               | Teacher        | Get topics assigned to the teacher.    |
| `POST`  | `/topics`                        | Admin          | Create a topic.                        |
| `PATCH` | `/topics/:id`                    | Admin          | Update a topic.                        |
| `PATCH` | `/topics/mark-as-completed/:id`  | Student        | Mark a topic complete.                 |
| `GET`   | `/lessons`                       | Authenticated  | List lessons.                          |
| `GET`   | `/lessons/:id`                   | Authenticated  | Get lesson details.                    |
| `POST`  | `/lessons`                       | Admin, Teacher | Create a lesson.                       |
| `PATCH` | `/lessons/:id`                   | Admin, Teacher | Update a lesson.                       |
| `PATCH` | `/lessons/:id/publish`           | Admin, Teacher | Publish a lesson.                      |
| `PATCH` | `/lessons/:id/unpublish`         | Admin, Teacher | Unpublish a lesson.                    |

### Evaluations and progress

| Method  | Path                                                          | Access         | Description                                |
| ------- | ------------------------------------------------------------- | -------------- | ------------------------------------------ |
| `POST`  | `/evaluations`                                                | Teacher        | Create an evaluation.                      |
| `GET`   | `/evaluations`                                                | Teacher        | List teacher evaluations.                  |
| `PATCH` | `/evaluations/:id`                                            | Teacher        | Update an evaluation.                      |
| `PATCH` | `/evaluations/update-status/:id`                              | Teacher        | Update evaluation status.                  |
| `GET`   | `/evaluations/student-evaluation`                             | Student        | List evaluations assigned to the student.  |
| `POST`  | `/questions`                                                  | Teacher        | Create a question.                         |
| `GET`   | `/questions`                                                  | Authenticated  | List questions.                            |
| `GET`   | `/questions/:id`                                              | Authenticated  | Get question details.                      |
| `PATCH` | `/questions/:id`                                              | Teacher        | Update a question.                         |
| `PATCH` | `/questions/update-status/:id`                                | Teacher        | Update question status.                    |
| `POST`  | `/evaluation-attempt/start-evaluation/:evaluationId/:classId` | Student        | Start an evaluation attempt.               |
| `GET`   | `/evaluation-attempt/attempt-history`                         | Authenticated  | Get evaluation attempt history.            |
| `GET`   | `/evaluation-attempt/:attemptId`                              | Authenticated  | Get attempt details.                       |
| `PATCH` | `/evaluation-attempt/submit-evaluation/:attemptId`            | Authenticated  | Submit an evaluation attempt.              |
| `PATCH` | `/evaluation-attempt/:attemptId/manual-grade`                 | Teacher, Admin | Manually grade an attempt.                 |
| `GET`   | `/progress/student-progress`                                  | Authenticated  | Get the signed-in user's student progress. |
| `GET`   | `/progress/student-progress/:studentId`                       | Teacher, Admin | Get progress for a specified student.      |

### Dashboards

| Method | Path                                   | Access  | Description                       |
| ------ | -------------------------------------- | ------- | --------------------------------- |
| `GET`  | `/dashboard/student`                   | Student | Get student dashboard data.       |
| `GET`  | `/dashboard/teacher`                   | Teacher | Get teacher dashboard data.       |
| `GET`  | `/dashboard/admin`                     | Admin   | Get administrator dashboard data. |
| `GET`  | `/dashboard/admin/enrollment-activity` | Admin   | Get enrollment activity data.     |

### Invoices, payments, and refunds

| Method  | Path                                    | Access             | Description                                               |
| ------- | --------------------------------------- | ------------------ | --------------------------------------------------------- |
| `POST`  | `/admin/invoices`                       | Admin              | Create and issue a student invoice.                       |
| `POST`  | `/admin/invoices/drafts`                | Admin              | Create an invoice draft.                                  |
| `POST`  | `/admin/invoices/generate-class`        | Admin              | Generate invoices for a class.                            |
| `GET`   | `/admin/invoices`                       | Admin              | List and filter invoices.                                 |
| `GET`   | `/admin/invoices/:id`                   | Admin              | Get invoice details.                                      |
| `PATCH` | `/admin/invoices/:id`                   | Admin              | Update a draft invoice.                                   |
| `PATCH` | `/admin/invoices/:id/cancel`            | Admin              | Cancel an invoice.                                        |
| `POST`  | `/admin/invoices/issue-class`           | Admin              | Issue eligible draft invoices for a class.                |
| `POST`  | `/admin/invoices/:id/issued`            | Admin              | Issue an invoice draft.                                   |
| `POST`  | `/admin/invoices/:id/unissued`          | Admin              | Unissue an unpaid invoice.                                |
| `POST`  | `/admin/invoices/:invoiceId/refund`     | Admin              | Request an NGN invoice refund.                            |
| `GET`   | `/student/invoices`                     | Student            | List the signed-in student's invoices.                    |
| `GET`   | `/student/invoices/summary`             | Student            | Get invoice totals and outstanding balance.               |
| `GET`   | `/student/invoices/:id`                 | Student            | Get the signed-in student's invoice details.              |
| `POST`  | `/student/payments/initialize`          | Student            | Initialize Paystack checkout for an invoice.              |
| `POST`  | `/student/payments/verify`              | Student            | Verify a payment reference and apply a confirmed payment. |
| `GET`   | `/student/payment-history`              | Student            | List the signed-in student's payment history.             |
| `GET`   | `/student/payment-history/:id`          | Student            | Get payment transaction details.                          |
| `GET`   | `/student/payment-history/:id/receipt`  | Student            | Download a PDF payment receipt.                           |
| `GET`   | `/admin/transactions`                   | Admin              | List and filter payment transactions.                     |
| `GET`   | `/admin/transactions/summary`           | Admin              | Get transaction totals.                                   |
| `GET`   | `/admin/transactions/:id`               | Admin              | Get transaction details.                                  |
| `PATCH` | `/admin/transactions/:id/mark-reviewed` | Admin              | Record an administrator review note.                      |
| `GET`   | `/admin/refunds`                        | Admin              | List and filter refunds.                                  |
| `GET`   | `/admin/refunds/:id`                    | Admin              | Get refund details.                                       |
| `POST`  | `/admin/refunds/:id/reconcile`          | Admin              | Reconcile a refund with Paystack.                         |
| `POST`  | `/webhooks/paystack`                    | Paystack signature | Receive Paystack payment-related webhook events.          |

Invoice list filters include `page`, `limit`, `status`, `studentId`, `classId`,
`academicSession`, `term`, `from`, and `to`. Student invoice lists accept
`page`, `limit`, `status`, `academicSession`, and `term`. Transaction and refund
filter parameters are handled by their respective controllers.

For invoice payment initialization, the request body contains `invoiceId` and
may include `amountKobo` for a permitted partial payment. Refund requests
require `amount` in kobo and a non-empty `reason`. A payment is only recorded
after server-side Paystack verification or a verified webhook event.

#### Create an invoice

Invoice amounts, including item amounts and discounts, are in kobo. The
`category` value must be one of `TUITION`, `REGISTRATION`,
`DEVELOPMENT_LEVY`, `EXAMINATION`, `LEARNING_MATERIALS`,
`DIGITAL_SUBSCRIPTION`, or `OTHER`.

```http
POST /api/v1/admin/invoices
Content-Type: application/json
Cookie: accessToken=<admin-session>
```

```json
{
  "studentId": "65f000000000000000000001",
  "classId": "65f000000000000000000002",
  "academicSession": "2026/2027",
  "term": "FIRST",
  "dueDate": "2026-09-15",
  "items": [
    {
      "description": "Tuition",
      "category": "TUITION",
      "amount": 25000000
    }
  ],
  "discountAmount": 0,
  "allowInstallments": true,
  "installmentCount": 2,
  "notes": ""
}
```

Successful create operations return the created resource in `data`; list
operations generally include a `pagination` object alongside `data`. Exact
response wrappers may vary between route groups.

#### Start and verify a student payment

```http
POST /api/v1/student/payments/initialize
Content-Type: application/json
Cookie: accessToken=<student-session>
```

```json
{
  "invoiceId": "65f000000000000000000003",
  "amountKobo": 12500000
}
```

`amountKobo` is optional; when omitted, the API requests the invoice's full
outstanding amount. The response includes an `authorizationUrl` and a payment
`reference`. After the student returns from checkout, verify the reference:

```http
POST /api/v1/student/payments/verify
Content-Type: application/json
Cookie: accessToken=<student-session>
```

```json
{
  "reference": "EDU-example-reference"
}
```

#### Generate a bulk payroll batch

The period is a calendar month in `YYYY-MM` format. Generation includes the
eligible unbatched draft payrolls for that period; the server rejects an empty
batch or invalid payroll/recipient data.

```http
POST /api/v1/admin/teacher-payroll/batches
Content-Type: application/json
Cookie: accessToken=<admin-session>
```

```json
{
  "period": "2026-11"
}
```

Review the returned batch before approval. Approval and transfer initiation
are separate operations:

```http
PATCH /api/v1/admin/teacher-payroll/batches/:batchId/approve
PATCH /api/v1/admin/teacher-payroll/batches/:batchId/transfer
```

### Teacher payroll and banking

| Method  | Path                                                | Access         | Description                                                        |
| ------- | --------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| `GET`   | `/banks`                                            | Admin, Teacher | List Paystack banks for account setup.                             |
| `GET`   | `/teacher/bank-account`                             | Teacher        | Get the signed-in teacher's bank-account status.                   |
| `POST`  | `/teacher/bank-account`                             | Teacher        | Submit a bank account for verification.                            |
| `PATCH` | `/teacher/bank-account`                             | Teacher        | Update the signed-in teacher's bank-account details.               |
| `GET`   | `/teacher/payroll`                                  | Teacher        | List the signed-in teacher's payroll history.                      |
| `GET`   | `/teacher/payroll/:id`                              | Teacher        | Get the teacher's payroll details.                                 |
| `GET`   | `/teacher/payroll/:id/payslip`                      | Teacher        | Download a PDF payslip.                                            |
| `POST`  | `/admin/teacher-payroll`                            | Admin          | Create an individual payroll draft.                                |
| `GET`   | `/admin/teacher-payroll`                            | Admin          | List and filter payroll records.                                   |
| `GET`   | `/admin/teacher-payroll/summary`                    | Admin          | Get the payroll summary.                                           |
| `GET`   | `/admin/teacher-payroll/:id`                        | Admin          | Get an individual payroll record.                                  |
| `PATCH` | `/admin/teacher-payroll/:id/approve`                | Admin          | Approve an individual payroll.                                     |
| `PATCH` | `/admin/teacher-payroll/:id/cancel`                 | Admin          | Cancel an eligible payroll.                                        |
| `PATCH` | `/admin/teacher-payroll/:id/authorize-transfer`     | Admin          | Authorize a transfer with a Paystack OTP.                          |
| `POST`  | `/admin/teacher-payroll/:id/resend-otp`             | Admin          | Request another transfer authorization OTP.                        |
| `POST`  | `/admin/teacher-payroll/:id/verify`                 | Admin          | Reconcile an individual pending transfer.                          |
| `GET`   | `/admin/teacher-banking/banks`                      | Admin          | List supported banks for payroll banking.                          |
| `GET`   | `/admin/teacher-banking/pending-account`            | Admin          | List teacher bank accounts awaiting verification.                  |
| `PATCH` | `/admin/teacher-banking/teacher/:teacherId/verify`  | Admin          | Verify a teacher bank account.                                     |
| `PATCH` | `/admin/teacher-banking/teacher/:teacherId/reject`  | Admin          | Reject a teacher bank account.                                     |
| `POST`  | `/admin/teacher-banking/payroll/:id/transfer`       | Admin          | Initiate a transfer for one approved payroll.                      |
| `POST`  | `/admin/teacher-payroll/batches`                    | Admin          | Generate a batch from eligible draft payroll records for a period. |
| `GET`   | `/admin/teacher-payroll/batches`                    | Admin          | List/filter payroll batches.                                       |
| `GET`   | `/admin/teacher-payroll/batches/:batchId`           | Admin          | Get batch details and associated payrolls.                         |
| `PATCH` | `/admin/teacher-payroll/batches/:batchId/approve`   | Admin          | Approve a payroll batch.                                           |
| `PATCH` | `/admin/teacher-payroll/batches/:batchId/transfer`  | Admin          | Initiate bulk transfers for an approved batch.                     |
| `POST`  | `/admin/teacher-payroll/batches/:batchId/reconcile` | Admin          | Reconcile batch transfers.                                         |

Payroll periods use `YYYY-MM`. Payroll and bank-account workflows include
approval and reconciliation steps; a successful transfer request is not
necessarily a final settlement. Consult the individual payroll and batch
statuses after initiating a transfer.

## Payments and payroll

### Student invoice payments

1. A student requests checkout with their invoice ID and, when installment
   payments are allowed, an optional amount in kobo.
2. The API validates invoice ownership, status, outstanding balance, and
   installment rules before requesting a Paystack checkout URL.
3. The client redirects the student to Paystack.
4. On return, the client sends the transaction reference to the verification
   endpoint. The server verifies it with Paystack before updating invoice
   balances.
5. Paystack webhook events are checked against the HMAC-SHA512 signature in the
   `x-paystack-signature` header using the raw request body.

Do not treat a client redirect as proof of payment. Only the server's verified
transaction status should be considered authoritative.

### Refunds

Refund initiation reserves the requested amount against the invoice before
requesting the refund from Paystack. Refunds may remain pending and should be
reconciled through the admin refund endpoint or Paystack webhook. Do not
blindly retry an uncertain refund request; reconcile its status first.

### Teacher payroll

Individual payroll drafts can be reviewed and approved, then paid with a
verified teacher bank-account recipient. Batch generation collects eligible
unbatched payroll drafts for a month. An administrator reviews and approves the
batch before the bulk transfer endpoint submits transfer instructions. Bulk
transfers may require Paystack OTP authorization or later reconciliation.

## Background jobs and external services

- **MongoDB/Mongoose:** Primary persistence layer for users, curriculum,
  evaluations, invoices, payment transactions, refunds, and payroll.
- **Paystack:** Payment checkout and verification, refund initiation and
  reconciliation, bank lookup, teacher transfers, and webhook delivery.
- **Brevo:** Transactional messages for account verification and invitations.
- **Overdue invoice job:** Runs once at startup and continues on a schedule to
  synchronize invoice overdue statuses.
- **Payroll reconciliation job:** Runs on a schedule to reconcile outstanding
  payroll transfers.
- **PDFKit:** Generates student payment receipts and teacher payslips.

Configure provider credentials and webhook URLs in the corresponding provider
dashboards. The webhook endpoint requires the exact raw JSON body to validate
the Paystack signature; the application captures the raw body before route
handling.

## Errors and validation

Validation middleware uses Zod where applied. A validation failure returns
HTTP `400` with a `message` and an `errors` array containing field paths and
messages. Authentication failures generally return `401`; role failures return
`403`; unknown routes return `404`.

The centralized error handler returns a JSON object containing `success` and
`message`. Some controllers handle errors directly and may return their own
response shape, so clients should rely on HTTP status and `message` rather
than assuming all endpoints share one exact error schema.

## Seed data

Run the Vitest suite from `server/`:

Available seed scripts:

```bash
npm run seed:classes
npm run seed:subjects
npm run seed:topics
npm run seed:lessons
```

Seed scripts require `MONGODB_URI` and should be used only with a database
intended for seeding.

## Project structure

```text
server/
├── src/
│   ├── app.ts                 # Express middleware and API route mounting
│   ├── server.ts              # Database connection, scheduled jobs, listener
│   ├── config/                # Database configuration
│   ├── controllers/           # HTTP handlers by feature
│   ├── middleware/            # Authentication, authorization, validation
│   ├── models/                # Mongoose schemas and persistence models
│   ├── routes/                # Feature route modules
│   ├── services/              # Business logic and provider integrations
│   ├── jobs/                  # Scheduled invoice/payroll jobs
│   ├── validators/            # Zod schemas
│   ├── utils/                 # Shared helpers, email, crypto, tokens
│   └── seed/                  # Curriculum and class seed scripts
<!-- ├── tests/                     # Vitest/Supertest tests| -->
└── package.json
```

## Production checklist

- Set `NODE_ENV=production`, `MONGODB_URI`, a strong `JWT_SECRET`, and
  `BANK_ACCOUNT_ENCRYPTION_KEY` in the deployment's secret manager.
- Ensure the MongoDB deployment supports transactions and configure backups.
- Update the CORS allowlist in `src/app.ts` for the deployed frontend origin.
- Set up production Brevo and Paystack credentials; never ship provider secrets
  to the frontend.
- Register the HTTPS Paystack webhook URL and verify it uses the correct
  environment's secret.
- Keep credentials stable during deployments and plan encryption-key rotation
  as a data migration.
- Use HTTPS for the API and frontend so production authentication cookies can
  be sent securely.
- Monitor server logs, payment/refund reconciliation, job execution, and
database connectivity.
<!-- - Run `npm test` and validate production startup and provider callbacks in a
  staging environment before releasing. -->
