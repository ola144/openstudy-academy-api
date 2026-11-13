import swaggerJsdoc from "swagger-jsdoc";

type HttpMethod = "get" | "post" | "patch";

type QueryParameter = {
  name: string;
  example: string | number | boolean;
  description?: string;
};

type OperationOptions = {
  body?: Record<string, unknown>;
  query?: QueryParameter[];
  public?: boolean;
  description?: string;
  responseCode?: number;
};

const paths: Record<string, Record<string, unknown>> = {};
const id = "65f000000000000000000001";

const schemaForExample = (value: unknown): Record<string, unknown> => {
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length ? schemaForExample(value[0]) : {},
    };
  }

  if (value !== null && typeof value === "object") {
    const properties: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      properties[key] = schemaForExample(nestedValue);
    }

    return { type: "object", properties, additionalProperties: true };
  }

  return { type: typeof value, example: value };
};

const add = (
  path: string,
  method: HttpMethod,
  summary: string,
  tag: string,
  access: string,
  options: OperationOptions = {},
) => {
  //   Extracting dynamic path parameters
  const pathParameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1], //Gets the captured parameter name.
    in: "path", //Tells Swagger that this parameter belongs to the URL path.
    required: true, //Path parameters must always be provided.
    schema: { type: "string" }, // Defines the parameter's expected data type.
    example: id, // Provides an example ID to Swagger.
  }));

  //   Creating query parameters
  const parameters = [
    ...pathParameters,
    ...(options.query ?? []).map((parameter) => ({
      name: parameter.name,
      in: "query",
      required: false,
      description: parameter.description,
      schema: { type: typeof parameter.example },
      example: parameter.example,
    })),
  ];

  const responses: Record<string, unknown> = {
    [options.responseCode ?? (method === "post" ? 201 : 200)]: {
      description: "Request completed successfully.",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: {
                type: "string",
                example: "Request completed successfully.",
              },
              data: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    "400": {
      description: "Invalid request or business rule validation error.",
    },
    "401": { description: "Authentication is required." },
    "403": {
      description:
        "The authenticated user is not permitted to access this resource.",
    },
    "500": { description: "Unexpected server error." },
  };

  //   This creates the complete OpenAPI operation documentation for an individual endpoint.
  const operation: Record<string, unknown> = {
    tags: [tag],
    summary,
    description: [options.description, `Access: ${access}.`]
      .filter(Boolean)
      .join(" "),
    ...(parameters.length ? { parameters } : {}),
    ...(options.body
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: schemaForExample(options.body),
                example: options.body,
              },
            },
          },
        }
      : {}),
    security: options.public ? [] : [{ sessionCookie: [] }],
    responses,
  };

  paths[path] = { ...paths[path], [method]: operation };
};

const query = (...names: string[]): QueryParameter[] =>
  names.map((name) => {
    const example: Record<string, string | number | boolean> = {
      page: 1,
      limit: 10,
      search: "sample",
      status: "ACTIVE",
      from: "2026-01-01",
      to: "2026-12-31",
      period: "2026-11",
      term: "FIRST",
      academicSession: "2026/2027",
      classId: "65f000000000000000000001",
      studentId: "65f000000000000000000002",
      teacherId: "65f000000000000000000003",
      subjectId: "65f000000000000000000004",
      topicId: "65f000000000000000000005",
      lessonId: "65f000000000000000000006",
      includeInactive: false,
      type: "QUIZ",
      difficulty: "MEDIUM",
      provider: "PAYSTACK",
      reference: "EDU-example-reference",
      invoiceId: "65f000000000000000000007",
    };

    return {
      name,
      example: example[name] ?? "sample",
      description:
        name === "page" || name === "limit"
          ? "Pagination parameter."
          : undefined,
    };
  });

add("/health", "get", "Check API health", "System", "Public", { public: true });

add("/auth/register", "post", "Register a user", "Authentication", "Public", {
  public: true,
  body: {
    firstName: "Ada",
    lastName: "Okafor",
    email: "ada@example.com",
    password: "StrongPassword123!",
    role: "STUDENT",
    classId: id,
    department: "Science",
  },
});

add(
  "/auth/login",
  "post",
  "Sign in and set the authToken cookie",
  "Authentication",
  "Public",
  {
    public: true,
    responseCode: 200,
    body: { email: "ada@example.com", password: "StrongPassword123!" },
  },
);
add(
  "/auth/logout",
  "post",
  "Sign out and clear the authToken cookie",
  "Authentication",
  "Public",
  {
    public: true,
    responseCode: 200,
  },
);
add(
  "/auth/create-password",
  "post",
  "Create an invited user's password",
  "Authentication",
  "Public",
  {
    public: true,
    body: { token: "invitation-token", password: "StrongPassword123!" },
  },
);
add(
  "/auth/verify-email/{token}",
  "get",
  "Verify an email address",
  "Authentication",
  "Public",
  {
    public: true,
  },
);
add(
  "/auth/resend-invitation/{id}",
  "get",
  "Resend a password invitation",
  "Authentication",
  "Authenticated",
);
add(
  "/auth/me",
  "get",
  "Get the signed-in user",
  "Authentication",
  "Authenticated",
);

add(
  "/users",
  "get",
  "Get the signed-in user's profile",
  "Users",
  "Authenticated",
);
add(
  "/users/update-user",
  "patch",
  "Update the signed-in user's profile or password",
  "Users",
  "Authenticated",
  {
    body: {
      firstName: "Ada",
      lastName: "Okafor",
      oldPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
    },
  },
);
add(
  "/users/upload-profile-pic",
  "patch",
  "Update the signed-in user's profile picture",
  "Users",
  "Authenticated",
  {
    body: { image: "data:image/png;base64,..." },
  },
);

add("/admin/teacher", "post", "Create a teacher", "Teachers", "Admin", {
  body: {
    firstName: "Ada",
    lastName: "Okafor",
    email: "ada@example.com",
    assignedSubjectIds: [id],
  },
});
add("/admin/teacher", "get", "List teachers", "Teachers", "Admin", {
  query: query("page", "limit", "search", "status"),
});
add("/admin/teacher/{id}", "get", "Get a teacher", "Teachers", "Admin");
add("/admin/teacher/{id}", "patch", "Update a teacher", "Teachers", "Admin", {
  body: {
    firstName: "Ada",
    lastName: "Okafor",
    email: "ada@example.com",
    assignedSubjectIds: [id],
  },
});
add(
  "/admin/teacher/update-status/{id}",
  "patch",
  "Update teacher active status",
  "Teachers",
  "Admin",
  {
    body: { isActive: true },
  },
);

add(
  "/students",
  "get",
  "List students",
  "Students",
  "Authenticated users with permitted role",
  {
    query: query("page", "limit", "search", "classId"),
  },
);
add(
  "/students/{id}",
  "get",
  "Get a student",
  "Students",
  "Authenticated users with permitted role",
);
add(
  "/students/{id}/update-student",
  "patch",
  "Update a student's profile",
  "Students",
  "Admin",
  {
    body: { firstName: "Sam", lastName: "Student", classId: id },
  },
);
add(
  "/students/update-status/{id}",
  "patch",
  "Update student active status",
  "Students",
  "Admin",
  {
    body: { isActive: true },
  },
);

add(
  "/class",
  "post",
  "Create a class",
  "Classes",
  "Route currently has no authentication middleware",
  {
    body: {
      name: "JSS 1",
      level: "JUNIOR",
      description: "Junior secondary year one",
      order: 1,
    },
  },
);
add(
  "/class",
  "get",
  "List classes",
  "Classes",
  "Route currently has no authentication middleware",
);
add("/class/{id}", "patch", "Update a class", "Classes", "Admin", {
  body: {
    name: "JSS 1",
    level: "JUNIOR",
    description: "Updated class description",
    order: 1,
  },
});
add(
  "/class/update-status/{id}",
  "patch",
  "Update class status",
  "Classes",
  "Route currently has no authentication middleware",
  {
    body: { isActive: true || false },
  },
);

add(
  "/subjects/assigned",
  "get",
  "List subjects assigned to the signed-in teacher",
  "Subjects",
  "Teacher",
);
add(
  "/subjects/student-assigned",
  "get",
  "List subjects assigned to the signed-in student's class",
  "Subjects",
  "Student",
  {
    query: query("page", "limit", "search"),
  },
);
add(
  "/subjects/student-assigned/{id}",
  "get",
  "Get a subject assigned to the signed-in student",
  "Subjects",
  "Student",
);
add("/subjects", "get", "List subjects", "Subjects", "Authenticated", {
  query: query("page", "limit", "classId", "search", "includeInactive"),
});
add("/subjects/{id}", "get", "Get a subject", "Subjects", "Authenticated");
add("/subjects", "post", "Create a subject", "Subjects", "Admin", {
  body: {
    name: "Mathematics",
    classId: id,
    category: "CORE",
    description: "Core mathematics",
    order: 1,
  },
});
add("/subjects/{id}", "patch", "Update a subject", "Subjects", "Admin", {
  body: {
    name: "Mathematics",
    classId: id,
    category: "CORE",
    description: "Updated description",
    order: 1,
    isActive: true,
  },
});
add(
  "/subjects/update-status/{id}",
  "patch",
  "Update subject status",
  "Subjects",
  "Admin",
  {
    body: { isActive: true || false },
  },
);

add(
  "/topics/assigned",
  "get",
  "List topics assigned to the signed-in teacher",
  "Topics",
  "Teacher",
);
add("/topics", "get", "List topics", "Topics", "Authenticated", {
  query: query(
    "page",
    "limit",
    "subjectId",
    "classId",
    "term",
    "search",
    "includeInactive",
  ),
});
add("/topics/{id}", "get", "Get a topic", "Topics", "Authenticated");
add("/topics", "post", "Create a topic", "Topics", "Admin", {
  body: {
    title: "Fractions",
    subjectId: id,
    classId: id,
    term: "FIRST",
    description: "Introduction to fractions",
    order: 1,
  },
});
add("/topics/{id}", "patch", "Update a topic", "Topics", "Admin", {
  body: {
    title: "Fractions",
    subjectId: id,
    classId: id,
    description: "Updated topic description",
    order: 1,
    isActive: true,
  },
});
add(
  "/topics/mark-as-completed/{id}",
  "patch",
  "Mark a topic complete",
  "Topics",
  "Student",
);

add("/lessons", "get", "List lessons", "Lessons", "Authenticated", {
  query: query("page", "limit", "topicId", "search", "status"),
});
add("/lessons/{id}", "get", "Get a lesson", "Lessons", "Authenticated");
add("/lessons", "post", "Create a lesson", "Lessons", "Admin or Teacher", {
  body: {
    title: "Introduction to fractions",
    topicId: id,
    summary: "Learn the basics of fractions.",
    objectives: ["Identify numerator and denominator"],
    content: [{ type: "TEXT", text: "A fraction represents part of a whole." }],
    estimatedMinutes: 30,
  },
});
add(
  "/lessons/{id}",
  "patch",
  "Update a lesson",
  "Lessons",
  "Admin or Teacher",
  {
    body: {
      title: "Fractions overview",
      summary: "Updated summary",
      objectives: ["Compare fractions"],
      estimatedMinutes: 35,
    },
  },
);
add(
  "/lessons/{id}/publish",
  "patch",
  "Publish a lesson",
  "Lessons",
  "Admin or Teacher",
);
add(
  "/lessons/{id}/unpublish",
  "patch",
  "Unpublish a lesson",
  "Lessons",
  "Admin or Teacher",
);

add("/evaluations", "post", "Create an evaluation", "Evaluations", "Teacher", {
  body: {
    topicId: id,
    subjectId: id,
    lessonId: id,
    classId: id,
    questionIds: [id],
    type: "QUIZ",
    title: "Fractions quiz",
    durationMinutes: 30,
    passMark: 50,
    maxAttempts: 2,
    availableFrom: "2026-11-15T09:00:00.000Z",
    availableUntil: "2026-11-20T17:00:00.000Z",
    shuffleQuestions: true,
    showResultsImmediately: true,
  },
});
add("/evaluations", "get", "List evaluations", "Evaluations", "Teacher", {
  query: query("page", "limit", "topicId", "classId", "search", "status"),
});
add(
  "/evaluations/student-evaluation",
  "get",
  "List evaluations for the signed-in student",
  "Evaluations",
  "Student",
  {
    query: query("page", "limit", "topicId", "search"),
  },
);
add(
  "/evaluations/{id}",
  "patch",
  "Update an evaluation",
  "Evaluations",
  "Teacher",
  {
    body: {
      title: "Fractions quiz",
      questionIds: [id],
      durationMinutes: 30,
      passMark: 60,
      maxAttempts: 2,
      shuffleQuestions: true,
      showResultsImmediately: false,
    },
  },
);
add(
  "/evaluations/update-status/{id}",
  "patch",
  "Update evaluation status",
  "Evaluations",
  "Teacher",
  {
    body: { isPublished: true || false },
  },
);

add("/questions", "post", "Create a question", "Questions", "Teacher", {
  body: {
    prompt: "What is 1/2 + 1/4?",
    type: "MULTIPLE_CHOICE",
    options: [
      { label: "A", value: "1/4" },
      { label: "B", value: "3/4" },
    ],
    correctAnswers: ["3/4"],
    explanation: "Use a common denominator.",
    marks: 1,
    difficulty: "EASY",
    subjectId: id,
    topicId: id,
    lessonId: id,
  },
});
add("/questions", "get", "List questions", "Questions", "Authenticated", {
  query: query(
    "page",
    "limit",
    "topicId",
    "subjectId",
    "lessonId",
    "type",
    "difficulty",
    "search",
  ),
});
add("/questions/{id}", "get", "Get a question", "Questions", "Authenticated");
add("/questions/{id}", "patch", "Update a question", "Questions", "Teacher", {
  body: {
    prompt: "What is 2/3 + 1/3?",
    options: [
      { label: "A", value: "1" },
      { label: "B", value: "2/3" },
    ],
    correctAnswers: ["1"],
    marks: 1,
  },
});
add(
  "/questions/update-status/{id}",
  "patch",
  "Update question status",
  "Questions",
  "Teacher",
  {
    body: { isActive: true || false },
  },
);

add(
  "/evaluation-attempt/start-evaluation/{evaluationId}/{classId}",
  "post",
  "Start an evaluation attempt",
  "Evaluation attempts",
  "Student",
  {
    responseCode: 201,
  },
);
add(
  "/evaluation-attempt/attempt-history",
  "get",
  "Get the signed-in user's evaluation history",
  "Evaluation attempts",
  "Authenticated",
);
add(
  "/evaluation-attempt/{attemptId}",
  "get",
  "Get an evaluation attempt",
  "Evaluation attempts",
  "Authenticated",
);
add(
  "/evaluation-attempt/submit-evaluation/{attemptId}",
  "patch",
  "Submit an evaluation attempt",
  "Evaluation attempts",
  "Authenticated",
  {
    body: { answers: [{ questionId: id, answer: "3/4" }] },
  },
);
add(
  "/evaluation-attempt/{attemptId}/manual-grade",
  "patch",
  "Manually grade an attempt",
  "Evaluation attempts",
  "Teacher or Admin",
  {
    body: {
      answers: [{ questionId: id, marksAwarded: 1, feedback: "Correct" }],
    },
  },
);

add(
  "/progress/student-progress",
  "get",
  "Get the signed-in student's progress",
  "Progress",
  "Authenticated",
);
add(
  "/progress/student-progress/{studentId}",
  "get",
  "Get a student's progress",
  "Progress",
  "Teacher or Admin",
);

add(
  "/dashboard/student",
  "get",
  "Get the student dashboard",
  "Dashboards",
  "Student",
);
add(
  "/dashboard/admin",
  "get",
  "Get the admin dashboard",
  "Dashboards",
  "Admin",
);
add(
  "/dashboard/admin/enrollment-activity",
  "get",
  "Get enrollment activity",
  "Dashboards",
  "Admin",
  {
    query: query("from", "to"),
  },
);
add(
  "/dashboard/teacher",
  "get",
  "Get the teacher dashboard",
  "Dashboards",
  "Teacher",
);

add(
  "/school-info",
  "get",
  "Get school information",
  "School information",
  "Public",
  { public: true },
);
add(
  "/school-info",
  "post",
  "Create school information",
  "School information",
  "Admin",
  {
    body: {
      name: "OpenStudy Academy",
      term: "FIRST",
      address: "Lagos, Nigeria",
      email: "info@example.com",
      phoneNumber: "+2348000000000",
    },
  },
);
add(
  "/school-info/{id}",
  "patch",
  "Update school information",
  "School information",
  "Admin",
  {
    body: {
      name: "OpenStudy Academy",
      term: "SECOND",
      address: "Lagos, Nigeria",
      email: "info@example.com",
      phoneNumber: "+2348000000000",
    },
  },
);
add(
  "/school-info/{id}/upload-logo",
  "patch",
  "Upload the school logo",
  "School information",
  "Admin",
  {
    body: { logo: "data:image/png;base64,..." },
  },
);

add(
  "/teaching-schedules",
  "post",
  "Create a teaching schedule",
  "Teaching schedules",
  "Admin",
  {
    body: {
      teacherId: id,
      classId: id,
      subjectId: id,
      dayOfWeek: "MONDAY",
      startTime: "09:00",
      endTime: "10:00",
      room: "Room 1",
    },
  },
);
add(
  "/teaching-schedules/{id}",
  "patch",
  "Update a teaching schedule",
  "Teaching schedules",
  "Admin",
  {
    body: {
      teacherId: id,
      classId: id,
      subjectId: id,
      dayOfWeek: "TUESDAY",
      startTime: "10:00",
      endTime: "11:00",
      room: "Room 2",
    },
  },
);
add(
  "/teaching-schedules/{id}/cancel",
  "patch",
  "Cancel a teaching schedule",
  "Teaching schedules",
  "Admin",
);
add(
  "/teaching-schedules/all-schedules",
  "get",
  "List all teaching schedules",
  "Teaching schedules",
  "Admin",
  {
    query: query("teacherId", "classId", "subjectId", "status", "from", "to"),
  },
);
add(
  "/teaching-schedules/teacher-schedules",
  "get",
  "List the signed-in teacher's schedules",
  "Teaching schedules",
  "Teacher",
  {
    query: query("from", "to", "status"),
  },
);
add(
  "/teaching-schedules/student-schedules",
  "get",
  "List the signed-in student's schedules",
  "Teaching schedules",
  "Student",
  {
    query: query("from", "to", "status"),
  },
);

add(
  "/admin/invoices",
  "post",
  "Create and issue a student invoice",
  "Invoices",
  "Admin",
  {
    body: {
      studentId: id,
      classId: id,
      academicSession: "2026/2027",
      term: "FIRST",
      dueDate: "2026-09-15",
      items: [
        { description: "Tuition", category: "TUITION", amount: 25000000 },
      ],
      discountAmount: 0,
      allowInstallments: true,
      installmentCount: 2,
      notes: "First term fees",
    },
  },
);
add(
  "/admin/invoices/drafts",
  "post",
  "Create an invoice draft",
  "Invoices",
  "Admin",
  {
    body: {
      studentId: id,
      classId: id,
      academicSession: "2026/2027",
      term: "FIRST",
      dueDate: "2026-09-15",
      items: [
        { description: "Tuition", category: "TUITION", amount: 25000000 },
      ],
      discountAmount: 0,
      allowInstallments: false,
      installmentCount: 1,
    },
  },
);
add(
  "/admin/invoices/generate-class",
  "post",
  "Generate invoices for a class",
  "Invoices",
  "Admin",
  {
    body: {
      classId: id,
      academicSession: "2026/2027",
      term: "FIRST",
      dueDate: "2026-09-15",
      items: [
        { description: "Tuition", category: "TUITION", amount: 25000000 },
      ],
    },
  },
);
add("/admin/invoices", "get", "List and filter invoices", "Invoices", "Admin", {
  query: query(
    "page",
    "limit",
    "status",
    "studentId",
    "classId",
    "academicSession",
    "term",
    "from",
    "to",
  ),
});
add("/admin/invoices/{id}", "get", "Get invoice details", "Invoices", "Admin");
add(
  "/admin/invoices/{id}",
  "patch",
  "Update an invoice draft",
  "Invoices",
  "Admin",
  {
    body: {
      items: [
        { description: "Tuition", category: "TUITION", amount: 25000000 },
      ],
      discountAmount: 0,
      dueDate: "2026-09-15",
      allowInstallments: false,
      installmentCount: 1,
      notes: "Updated",
    },
  },
);
add(
  "/admin/invoices/{id}/cancel",
  "patch",
  "Cancel an invoice",
  "Invoices",
  "Admin",
  {
    body: { reason: "Created in error" },
  },
);
add(
  "/admin/invoices/issue-class",
  "post",
  "Issue eligible class invoice drafts",
  "Invoices",
  "Admin",
  {
    body: { classId: id, academicSession: "2026/2027", term: "FIRST" },
  },
);
add(
  "/admin/invoices/{id}/issued",
  "post",
  "Issue an invoice draft",
  "Invoices",
  "Admin",
);
add(
  "/admin/invoices/{id}/unissued",
  "post",
  "Unissue an unpaid invoice",
  "Invoices",
  "Admin",
);
add(
  "/admin/invoices/{invoiceId}/refund",
  "post",
  "Request an invoice refund",
  "Invoices",
  "Admin",
  {
    body: { amount: 5000000, reason: "Duplicate payment" },
  },
);
add(
  "/student/invoices",
  "get",
  "List the signed-in student's invoices",
  "Invoices",
  "Student",
  {
    query: query("page", "limit", "status", "academicSession", "term"),
  },
);
add(
  "/student/invoices/summary",
  "get",
  "Get the student's invoice summary",
  "Invoices",
  "Student",
);
add(
  "/student/invoices/{id}",
  "get",
  "Get a student invoice",
  "Invoices",
  "Student",
);
add(
  "/student/payments/initialize",
  "post",
  "Initialize Paystack checkout",
  "Payments",
  "Student",
  {
    responseCode: 200,
    body: { invoiceId: id, amountKobo: 12500000 },
  },
);
add(
  "/student/payments/verify",
  "post",
  "Verify a Paystack payment reference",
  "Payments",
  "Student",
  {
    responseCode: 200,
    body: { reference: "EDU-example-reference" },
  },
);
add(
  "/webhooks/paystack",
  "post",
  "Receive a signed Paystack webhook",
  "Payments",
  "Paystack webhook signature",
  {
    public: true,
    responseCode: 200,
    body: {
      event: "charge.success",
      data: {
        reference: "EDU-example-reference",
        amount: 12500000,
        currency: "NGN",
        status: "success",
      },
    },
  },
);
add(
  "/student/payment-history",
  "get",
  "List the student's payment history",
  "Payments",
  "Student",
  {
    query: query("page", "limit", "from", "to"),
  },
);
add(
  "/student/payment-history/{id}",
  "get",
  "Get payment transaction details",
  "Payments",
  "Student",
);
add(
  "/student/payment-history/{id}/receipt",
  "get",
  "Download a payment receipt",
  "Payments",
  "Student",
);
add(
  "/admin/transactions",
  "get",
  "List payment transactions",
  "Transactions",
  "Admin",
  {
    query: query(
      "page",
      "limit",
      "status",
      "provider",
      "reference",
      "studentId",
      "from",
      "to",
    ),
  },
);
add(
  "/admin/transactions/summary",
  "get",
  "Get transaction totals",
  "Transactions",
  "Admin",
  {
    query: query("from", "to"),
  },
);
add(
  "/admin/transactions/{id}",
  "get",
  "Get transaction details",
  "Transactions",
  "Admin",
);
add(
  "/admin/transactions/{id}/mark-reviewed",
  "patch",
  "Mark a transaction as reviewed",
  "Transactions",
  "Admin",
  {
    body: { reviewNote: "Matched to bank settlement" },
  },
);
add("/admin/refunds", "get", "List refunds", "Refunds", "Admin", {
  query: query("page", "limit", "status", "studentId", "invoiceId", "search"),
});
add("/admin/refunds/{id}", "get", "Get refund details", "Refunds", "Admin");
add(
  "/admin/refunds/{id}/reconcile",
  "post",
  "Reconcile a pending refund",
  "Refunds",
  "Admin",
);

add("/banks", "get", "List supported NGN banks", "Banking", "Admin or Teacher");
add(
  "/teacher/bank-account",
  "get",
  "Get the signed-in teacher's bank account",
  "Banking",
  "Teacher",
);
add(
  "/teacher/bank-account",
  "post",
  "Submit bank account details",
  "Banking",
  "Teacher",
  {
    body: {
      bankCode: "058",
      bankName: "Guaranty Trust Bank",
      accountNumber: "0123456789",
      accountName: "John Doe",
    },
  },
);
add(
  "/teacher/bank-account",
  "patch",
  "Update bank account details",
  "Banking",
  "Teacher",
  {
    body: {
      bankCode: "058",
      bankName: "Guaranty Trust Bank",
      accountNumber: "0123456789",
      accountName: "Ada Okafor",
    },
  },
);
add(
  "/teacher/payroll",
  "get",
  "List the signed-in teacher's payroll",
  "Payroll",
  "Teacher",
  {
    query: query("page", "limit", "period", "status"),
  },
);
add(
  "/teacher/payroll/{id}",
  "get",
  "Get a teacher payroll record",
  "Payroll",
  "Teacher",
);
add(
  "/teacher/payroll/{id}/payslip",
  "get",
  "Download a teacher payslip",
  "Payroll",
  "Teacher",
);
add(
  "/admin/teacher-payroll",
  "post",
  "Create a teacher payroll draft",
  "Payroll",
  "Admin",
  {
    body: {
      teacherId: id,
      period: "2026-11",
      baseSalary: 30000000,
      allowances: 2000000,
      deductions: 1000000,
      notes: "November salary",
    },
  },
);
add(
  "/admin/teacher-payroll",
  "get",
  "List payroll records",
  "Payroll",
  "Admin",
  {
    query: query("page", "limit", "period", "status", "teacherId"),
  },
);
add(
  "/admin/teacher-payroll/summary",
  "get",
  "Get payroll summary",
  "Payroll",
  "Admin",
  {
    query: query("period"),
  },
);
add(
  "/admin/teacher-payroll/{id}",
  "get",
  "Get a payroll record",
  "Payroll",
  "Admin",
);
add(
  "/admin/teacher-payroll/{id}/approve",
  "patch",
  "Approve a payroll record",
  "Payroll",
  "Admin",
);
add(
  "/admin/teacher-payroll/{id}/cancel",
  "patch",
  "Cancel a payroll record",
  "Payroll",
  "Admin",
  {
    body: { reason: "Payroll was created in error" },
  },
);
add(
  "/admin/teacher-payroll/{id}/authorize-transfer",
  "patch",
  "Authorize a payroll transfer with Paystack OTP",
  "Payroll",
  "Admin",
  {
    body: { otp: "123456" },
  },
);
add(
  "/admin/teacher-payroll/{id}/resend-otp",
  "post",
  "Resend a payroll transfer OTP",
  "Payroll",
  "Admin",
);
add(
  "/admin/teacher-payroll/{id}/verify",
  "post",
  "Reconcile an individual payroll transfer",
  "Payroll",
  "Admin",
);
add(
  "/admin/teacher-payroll/batches",
  "post",
  "Generate a payroll batch",
  "Payroll batches",
  "Admin",
  {
    body: { period: "2026-11" },
  },
);
add(
  "/admin/teacher-payroll/batches",
  "get",
  "List payroll batches",
  "Payroll batches",
  "Admin",
  {
    query: query("page", "limit", "period", "status"),
  },
);
add(
  "/admin/teacher-payroll/batches/{batchId}",
  "get",
  "Get payroll batch details",
  "Payroll batches",
  "Admin",
);
add(
  "/admin/teacher-payroll/batches/{batchId}/approve",
  "patch",
  "Approve a payroll batch",
  "Payroll batches",
  "Admin",
);
add(
  "/admin/teacher-payroll/batches/{batchId}/transfer",
  "patch",
  "Initiate payroll batch transfers",
  "Payroll batches",
  "Admin",
);
add(
  "/admin/teacher-payroll/batches/{batchId}/reconcile",
  "post",
  "Reconcile payroll batch transfers",
  "Payroll batches",
  "Admin",
);
add(
  "/admin/teacher-banking/banks",
  "get",
  "List banks for payroll banking",
  "Banking",
  "Admin",
);
add(
  "/admin/teacher-banking/pending-account",
  "get",
  "List pending teacher bank accounts",
  "Banking",
  "Admin",
);
add(
  "/admin/teacher-banking/teacher/{teacherId}/verify",
  "patch",
  "Verify a teacher bank account",
  "Banking",
  "Admin",
);
add(
  "/admin/teacher-banking/teacher/{teacherId}/reject",
  "patch",
  "Reject a teacher bank account",
  "Banking",
  "Admin",
  {
    body: { reason: "Account name does not match teacher record" },
  },
);
add(
  "/admin/teacher-banking/payroll/{id}/transfer",
  "post",
  "Initiate an individual payroll transfer",
  "Banking",
  "Admin",
);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "OpenStudy Academy E-Learning Platform API",
      version: "1.0.0",
      description:
        "API reference for the OpenStudy Academy server. Protected endpoints authenticate with the HTTP-only authToken cookie set by POST /auth/login. Monetary amounts are in kobo unless otherwise stated.",
    },
    servers: [
      {
        url: "http://localhost:7070/api/v1",
        description: "Development server",
      },
    ],
    tags: [
      { name: "System" },
      { name: "Authentication" },
      { name: "Users" },
      { name: "Teachers" },
      { name: "Students" },
      { name: "Classes" },
      { name: "Subjects" },
      { name: "Topics" },
      { name: "Lessons" },
      { name: "Evaluations" },
      { name: "Questions" },
      { name: "Evaluation attempts" },
      { name: "Progress" },
      { name: "Dashboards" },
      { name: "School information" },
      { name: "Teaching schedules" },
      { name: "Invoices" },
      { name: "Payments" },
      { name: "Transactions" },
      { name: "Refunds" },
      { name: "Banking" },
      { name: "Payroll" },
      { name: "Payroll batches" },
    ],
    paths,
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "authToken",
          description:
            "HTTP-only session cookie set by POST /auth/login. Browser clients send it automatically when credentials are included.",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
