import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.ts";
import userRouter from "./routes/user.routes.ts";
import teacherRouter from "./routes/admin.teacher.routes.ts";
import classRouter from "./routes/class.routes.ts";
import subjectRouter from "./routes/curriculum/subject.ts";
import topicRouter from "./routes/curriculum/topic.ts";
import lessonRouter from "./routes/curriculum/lesson.ts";
import studentRouter from "./routes/student.routes.ts";
import evaluationRouter from "./routes/evaluation.routes.ts";
import questionRouter from "./routes/question.routes.ts";
import evaluationAttemptRouter from "./routes/evalutionAttempt.routes.ts";
import progressRouter from "./routes/progress.routes.ts";
import dashboardRouter from "./routes/dashboard.routes.ts";
import schoolInfoRouter from "./routes/schoolInfo.routes.ts";
import scheduleRouter from "./routes/teachingSchedule.routes.ts";
import adminTransactionRouter from "./routes/payment/adminTransaction.routes.ts";
import adminInvoiceRouter from "./routes/payment/adminInvoice.routes.ts";
import studentInvoiceRouter from "./routes/payment/studentInvoice.routes.ts";
import studentPaymentRouter from "./routes/payment/studentPayment.routes.ts";
import paystackWebhookRouter from "./routes/payment/paystackWebhook.routes.ts";
import studentPaymentHistoryRouter from "./routes/payment/studentPaymentHistory.routes.ts";
import adminTeacherPayrollRouter from "./routes/payment/adminTeacherPayroll.routes.ts";
import teacherPayrollRouter from "./routes/payment/teacherPayroll.routes.ts";
import adminTeacherBankRouter from "./routes/payment/adminTeacherBank.routes.ts";
import teacherBankAccoutRouter from "./routes/payment/teacherBankAccount.routes.ts";
import paystackBankRouter from "./routes/payment/paystackBank.routes.ts";
import adminRefundRouter from "./routes/payment/adminRefund.routes.ts";

import { errorHandler } from "./middleware/errorHandler.ts";
import swaggerSpec from "./config/swagger.ts";
import swaggerUi from "swagger-ui-express";

const app = express();

const allowedOrigins = [
  "http://localhost:7070",
  "http://localhost:5173",
  "https://openstudyacademye-leaningplatform.vercel.app",
  "https://openstudy-academy-api.onrender.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Trust requests coming from the local Cloudflare Tunnel connector.
// Set this before rate-limit middleware and route registration.
app.set("trust proxy", "loopback");

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buffer) => {
      (req as typeof req & { rawBody: Buffer }).rawBody = Buffer.from(buffer);
    },
  }),
);

app.use(cookieParser());

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "OpenStudy Academy E-Learning API Documentation",
  }),
);

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// app.use((req, _res, next) => {
//   console.log("REQUEST:", {
//     method: req.method,
//     url: req.originalUrl,
//     ip: req.ip,
//     forwardedFor: req.headers["x-forwarded-for"],
//   });

//   next();
// });

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/admin/teacher", teacherRouter);
app.use("/api/v1/students", studentRouter);
app.use("/api/v1/class", classRouter);
app.use("/api/v1/subjects", subjectRouter);
app.use("/api/v1/topics", topicRouter);
app.use("/api/v1/lessons", lessonRouter);
app.use("/api/v1/evaluations", evaluationRouter);
app.use("/api/v1/questions", questionRouter);
app.use("/api/v1/evaluation-attempt", evaluationAttemptRouter);
app.use("/api/v1/progress", progressRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/school-info", schoolInfoRouter);
app.use("/api/v1/teaching-schedules", scheduleRouter);
app.use("/api/v1/admin/transactions", adminTransactionRouter);
app.use("/api/v1/admin/invoices", adminInvoiceRouter);
app.use("/api/v1/student/invoices", studentInvoiceRouter);
app.use("/api/v1/student/payments", studentPaymentRouter);
app.use("/api/v1/webhooks/paystack", paystackWebhookRouter);
app.use("/api/v1/student/payment-history", studentPaymentHistoryRouter);
app.use("/api/v1/admin/teacher-payroll", adminTeacherPayrollRouter);
app.use("/api/v1/teacher/payroll", teacherPayrollRouter);
app.use("/api/v1/teacher/bank-account", teacherBankAccoutRouter);
app.use("/api/v1/admin/teacher-banking", adminTeacherBankRouter);
app.use("/api/v1/banks", paystackBankRouter);
app.use("/api/v1/admin/refunds", adminRefundRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use(errorHandler);

export default app;
