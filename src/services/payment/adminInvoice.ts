import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import StudentInvoice, {
  FEE_CATEGORIES,
  INVOICE_STATUSES,
} from "../../models/StudentInvoice.ts";

import User from "../../models/User.ts";
import Refund, { RefundStatus } from "../../models/Refund.ts";

import { isValidObjectId } from "../../utils/helperFunctions.ts";
import { fail, parseDate } from "../../utils/helperFunctions.ts";

type InvoiceItemInput = {
  description: string;
  category: string;
  amount: number;
};

type CreateInvoiceInput = {
  studentId: string;
  classId: string;
  academicSession: string;
  term: string;
  items: InvoiceItemInput[];
  discountAmount?: number;
  dueDate: string;
  allowInstallments?: boolean;
  installmentCount?: number;
  notes?: string;
  status?: "DRAFT" | "UNPAID";
};

type UpdateDraftInput = {
  items?: InvoiceItemInput[];
  discountAmount?: number;
  dueDate?: string;
  allowInstallments?: boolean;
  installmentCount?: number;
  notes?: string;
};

type InvoiceFilters = {
  page?: number;
  limit?: number;
  status?: string;
  studentId?: string;
  classId?: string;
  academicSession?: string;
  term?: string;
  from?: string;
  to?: string;
};

const calculateTotals = (items: InvoiceItemInput[], discountAmount = 0) => {
  if (!Array.isArray(items) || items.length === 0) {
    fail("An invoice must contain at least one fee item");
  }

  for (const item of items) {
    if (
      typeof item.description !== "string" ||
      !item.description.trim() ||
      item.description.trim().length > 200
    ) {
      fail("Every invoice item needs a valid description");
    }

    if (
      !FEE_CATEGORIES.includes(item.category as (typeof FEE_CATEGORIES)[number])
    ) {
      fail(`Invalid fee category: ${item.category}`);
    }

    if (!Number.isSafeInteger(item.amount) || item.amount < 0) {
      fail("Item amounts must be non-negative integer kobo values");
    }
  }

  if (!Number.isSafeInteger(discountAmount) || discountAmount < 0) {
    fail("Discount must be a non-negative integer kobo value");
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  if (!Number.isSafeInteger(subtotal)) {
    fail("Invoice subtotal exceeds the supported amount");
  }

  if (discountAmount > subtotal) {
    fail("Discount cannot exceed the invoice subtotal");
  }

  return {
    subtotal,
    discountAmount,
    totalAmount: subtotal - discountAmount,
  };
};

const makeInvoiceNumber = () =>
  `INV-${new Date().getFullYear()}-${randomUUID()
    .replace(/-/g, "")
    .slice(0, 16)
    .toUpperCase()}`;

const validateTerm = (term: string) => {
  if (!["FIRST", "SECOND", "THIRD"].includes(term)) {
    fail("Term must be FIRST, SECOND, or THIRD");
  }
};

const validateAcademicSession = (session: string) => {
  if (!/^\d{4}\/\d{4}$/.test(session)) {
    fail("Academic session must use the format YYYY/YYYY");
  }

  const [startYear, endYear] = session.split("/").map(Number);

  if (endYear !== startYear + 1) {
    fail("Academic session must contain consecutive years");
  }
};

const validateStudent = async (studentId: string, classId: string) => {
  if (!isValidObjectId(studentId) || !isValidObjectId(classId)) {
    fail("Invalid student ID or class ID");
  }

  const student = await User.findOne({
    _id: studentId,
    role: "STUDENT",
  })
    .select("_id firstName lastName email classId role")
    .lean();

  if (!student) {
    fail("Student not found", 404);
  }

  if (String(student?.classId) !== classId) {
    fail("The student does not belong to the selected class");
  }

  return student;
};

const checkDuplicateInvoice = async (
  studentId: string,
  academicSession: string,
  term: string,
) => {
  const existingInvoice = await StudentInvoice.findOne({
    studentId,
    academicSession,
    term,
    status: { $ne: "CANCELLED" },
  })
    .select("_id invoiceNumber")
    .lean();

  if (existingInvoice) {
    fail(
      `An invoice already exists for this student, session, and term (${existingInvoice.invoiceNumber})`,
      409,
    );
  }
};

export const createStudentInvoice = async (
  input: CreateInvoiceInput,
  adminId: string,
) => {
  if (!isValidObjectId(adminId)) {
    fail("Invalid admin ID", 401);
  }

  validateTerm(input.term);
  validateAcademicSession(input.academicSession);

  const student = await validateStudent(input.studentId, input.classId);

  const dueDate = parseDate(input.dueDate, "due date");

  const installmentCount = input.installmentCount ?? 1;

  if (!Number.isSafeInteger(installmentCount) || installmentCount < 1) {
    fail("Installment count must be a positive integer");
  }

  if (input.allowInstallments && installmentCount < 2) {
    fail("Installment plans must contain at least two installments");
  }

  if (!input.allowInstallments && installmentCount !== 1) {
    fail("Set allowInstallments to true to configure multiple installments");
  }

  await checkDuplicateInvoice(
    String(student?._id),
    input.academicSession,
    input.term,
  );

  const totals = calculateTotals(input.items, input.discountAmount ?? 0);

  const invoice = await StudentInvoice.create({
    invoiceNumber: makeInvoiceNumber(),
    studentId: student?._id,
    classId: input.classId,
    academicSession: input.academicSession,
    term: input.term,
    items: input.items.map((item) => ({
      ...item,
      description: item.description.trim(),
    })),
    ...totals,
    amountPaid: 0,
    outstandingBalance: totals.totalAmount,
    currency: "NGN",
    issuedAt: new Date(),
    dueDate,
    status: input.status ?? "UNPAID",
    allowInstallments: input.allowInstallments ?? false,
    installmentCount,
    notes: input.notes?.trim() ?? "",
    createdBy: adminId,
  });

  return invoice.populate("studentId", "firstName lastName email");
};

export const generateClassInvoices = async (
  input: Omit<CreateInvoiceInput, "studentId">,
  adminId: string,
) => {
  if (!isValidObjectId(adminId) || !isValidObjectId(input.classId)) {
    fail("Invalid admin or class ID");
  }

  validateTerm(input.term);
  validateAcademicSession(input.academicSession);

  const dueDate = parseDate(input.dueDate, "due date");

  const installmentCount = input.installmentCount ?? 1;

  if (
    !Number.isSafeInteger(installmentCount) ||
    installmentCount < 1 ||
    (input.allowInstallments && installmentCount < 2) ||
    (!input.allowInstallments && installmentCount !== 1)
  ) {
    fail("Invalid installment configuration");
  }

  const totals = calculateTotals(input.items, input.discountAmount ?? 0);

  const students = await User.find({
    role: "STUDENT",
    classId: input.classId,
  })
    .select("_id")
    .lean();

  if (!students.length) {
    fail("No students were found in this class", 404);
  }

  const results: {
    studentId: string;
    invoiceNumber?: string;
    status: "CREATED" | "SKIPPED" | "FAILED";
    reason?: string;
  }[] = [];

  // Sequential processing makes the result of each student explicit.
  // For very large classes, use a controlled bulk-write workflow.
  for (const student of students) {
    try {
      await checkDuplicateInvoice(
        String(student._id),
        input.academicSession,
        input.term,
      );

      const invoiceNumber = makeInvoiceNumber();

      await StudentInvoice.create({
        invoiceNumber,
        studentId: student._id,
        classId: input.classId,
        academicSession: input.academicSession,
        term: input.term,
        items: input.items.map((item) => ({
          ...item,
          description: item.description.trim(),
        })),
        ...totals,
        amountPaid: 0,
        outstandingBalance: totals.totalAmount,
        currency: "NGN",
        issuedAt: new Date(),
        dueDate,
        status: "UNPAID",
        allowInstallments: input.allowInstallments ?? false,
        installmentCount,
        notes: input.notes?.trim() ?? "",
        createdBy: adminId,
      });

      results.push({
        studentId: String(student._id),
        invoiceNumber,
        status: "CREATED",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create invoice";

      results.push({
        studentId: String(student._id),
        status:
          (error as { statusCode?: number }).statusCode === 409
            ? "SKIPPED"
            : "FAILED",
        reason: message,
      });
    }
  }

  return {
    totalStudents: students.length,
    created: results.filter((item) => item.status === "CREATED").length,
    skipped: results.filter((item) => item.status === "SKIPPED").length,
    failed: results.filter((item) => item.status === "FAILED").length,
    results,
  };
};

export const getAdminInvoices = async (filters: InvoiceFilters) => {
  const page = Number(filters.page) || 1;
  // const page = Math.max(1, Number(filters.page) || 1);
  const limit = Number(filters.limit) || 10;
  // const limit = Math.min(100, Math.max(1, Number(filters.limit) || 10));

  const query: Record<string, any> = {};

  if (filters.status) {
    if (
      !INVOICE_STATUSES.includes(
        filters.status as (typeof INVOICE_STATUSES)[number],
      )
    ) {
      fail("Invalid invoice status");
    }

    query.status = filters.status;
  }

  if (filters.studentId) {
    if (!isValidObjectId(filters.studentId)) fail("Invalid student ID");
    query.studentId = filters.studentId;
  }

  if (filters.classId) {
    if (!isValidObjectId(filters.classId)) fail("Invalid class ID");
    query.classId = filters.classId;
  }

  if (filters.academicSession) {
    validateAcademicSession(filters.academicSession);
    query.academicSession = filters.academicSession;
  }

  if (filters.term) {
    validateTerm(filters.term);
    query.term = filters.term;
  }

  const from = filters.from ? parseDate(filters.from, "start date") : undefined;

  const to = filters.to ? parseDate(filters.to, "end date") : undefined;

  if (from && to && from > to) {
    fail("Start date cannot be later than end date");
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const [invoicesQuery, total] = await Promise.all([
    StudentInvoice.find(query)
      .populate("studentId", "firstName lastName email")
      .populate("classId", "name level")
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    StudentInvoice.countDocuments(query),
  ]);

  const invoices = invoicesQuery.map((i) => {
    const invoiceObj = i.toObject();

    const { studentId, classId, createdBy, ...invoiceRest } = invoiceObj;

    return {
      student: studentId,
      class: classId,
      createdBy,
      ...invoiceRest,
    };
  });

  return {
    invoices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

export const getAdminInvoiceById = async (id: string | string[]) => {
  if (!isValidObjectId(id)) fail("Invalid invoice ID");

  const invoiceQuery = await StudentInvoice.findById(id)
    .populate("studentId", "firstName lastName email classId")
    .populate("classId", "name level")
    .populate("createdBy", "firstName lastName email")
    .populate("cancelledBy", "firstName lastName email");

  if (!invoiceQuery) fail("Invoice not found", 404);

  const invoiceObj = invoiceQuery.toObject();

  const { studentId, classId, createdBy, cancelledBy, ...invoiceRest } =
    invoiceObj;

  const invoice = {
    student: studentId,
    class: classId,
    createdBy,
    cancelledBy,
    ...invoiceRest,
  };

  return invoice;
};

export const updateDraftInvoice = async (
  id: string | string[],
  input: UpdateDraftInput,
) => {
  if (!isValidObjectId(id)) fail("Invalid invoice ID");

  const invoice = await StudentInvoice.findById(id);

  if (!invoice) fail("Invoice not found", 404);

  if (invoice.status !== "DRAFT" || invoice.amountPaid > 0) {
    fail(
      "Only unpaid draft invoices can be edited. Create an adjustment for an issued invoice.",
      409,
    );
  }

  const nextItems = input.items ?? invoice.items;
  const nextDiscount = input.discountAmount ?? invoice.discountAmount;

  const totals = calculateTotals(
    nextItems as unknown as InvoiceItemInput[],
    nextDiscount,
  );

  if (input.dueDate !== undefined) {
    invoice.dueDate = parseDate(input.dueDate, "due date");
  }

  if (input.items !== undefined) {
    invoice.items = input.items as typeof invoice.items;
  }

  if (input.discountAmount !== undefined) {
    invoice.discountAmount = input.discountAmount;
  }

  if (input.allowInstallments !== undefined) {
    invoice.allowInstallments = input.allowInstallments;
  }

  if (input.installmentCount !== undefined) {
    if (
      !Number.isSafeInteger(input.installmentCount) ||
      input.installmentCount < 1
    ) {
      fail("Installment count must be a positive integer");
    }

    invoice.installmentCount = input.installmentCount;
  }

  if (invoice.allowInstallments && invoice.installmentCount < 3) {
    fail("Installment plans must contain at least three installments");
  }

  if (!invoice.allowInstallments && invoice.installmentCount !== 1) {
    fail("Disable multiple installments or configure an installment plan");
  }

  if (input.notes !== undefined) {
    invoice.notes = input.notes.trim();
  }

  invoice.subtotal = totals.subtotal;
  invoice.discountAmount = totals.discountAmount;
  invoice.totalAmount = totals.totalAmount;
  invoice.amountPaid = 0;
  invoice.outstandingBalance = totals.totalAmount;

  await invoice.save();

  return invoice;
};

export const cancelAdminInvoice = async (
  id: string | string[],
  adminId: string,
  reason: string,
) => {
  if (!isValidObjectId(id) || !isValidObjectId(adminId)) {
    fail("Invalid invoice or admin ID");
  }

  if (!reason?.trim() || reason.trim().length > 1000) {
    fail("Cancellation reason is required and must not exceed 1000 characters");
  }

  const invoice = await StudentInvoice.findById(id);

  if (!invoice) fail("Invoice not found", 404);

  if (invoice.status === "CANCELLED") {
    fail("Invoice is already cancelled", 409);
  }

  if (invoice.amountPaid > 0 || invoice.status === "PAID") {
    fail(
      "An invoice with payments cannot be cancelled directly. Process a refund or financial adjustment first.",
      409,
    );
  }

  invoice.status = "CANCELLED";
  invoice.cancelledAt = new Date();
  invoice.cancelledBy = new mongoose.Types.ObjectId(adminId);
  invoice.cancellationReason = reason.trim();

  await invoice.save();

  return invoice;
};

export const issueDraftInvoice = async (id: string | string[]) => {
  if (!isValidObjectId(id)) {
    fail("Invalid invoice ID");
  }

  // Atomic transition: only a DRAFT invoice can be issued.
  const invoice = await StudentInvoice.findOneAndUpdate(
    {
      _id: id,
      status: "DRAFT",
      amountPaid: 0,
    },
    {
      $set: {
        status: "UNPAID",
        issuedAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate("studentId", "firstName lastName email")
    .populate("classId", "name level");

  if (invoice) {
    return invoice;
  }

  const existing = await StudentInvoice.findById(id)
    .select("status amountPaid")
    .lean();

  if (!existing) {
    fail("Invoice not found", 404);
  }

  fail(
    `Invoice cannot be issued because its current status is ${existing.status}`,
    409,
  );
};

export const unIssueUnpaidInvoice = async (id: string | string[]) => {
  if (!isValidObjectId(id)) {
    fail("Invalid invoice ID");
  }

  // Atomic transition: only a UNPAID invoice can be unissued.
  const invoice = await StudentInvoice.findOneAndUpdate(
    {
      _id: id,
      status: "UNPAID",
      amountPaid: 0,
    },
    {
      $set: {
        status: "DRAFT",
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  )
    .populate("studentId", "firstName lastName email")
    .populate("classId", "name level");

  if (invoice) {
    return invoice;
  }

  const existing = await StudentInvoice.findById(id)
    .select("status amountPaid")
    .lean();

  if (!existing) {
    fail("Invoice not found", 404);
  }

  fail(
    `Invoice cannot be unissued because its current status is ${existing.status}`,
    409,
  );
};

export const issueClassDraftInvoices = async (input: {
  classId: string;
  academicSession: string;
  term: string;
}) => {
  if (!mongoose.Types.ObjectId.isValid(input.classId)) {
    fail("Invalid class ID");
  }

  validateAcademicSession(input.academicSession);
  validateTerm(input.term);

  const result = await StudentInvoice.updateMany(
    {
      classId: input.classId,
      academicSession: input.academicSession,
      term: input.term,
      status: "DRAFT",
      amountPaid: 0,
    },
    {
      $set: {
        status: "UNPAID",
        issuedAt: new Date(),
      },
    },
    {
      runValidators: true,
    },
  );

  return {
    matchedCount: result.matchedCount,
    issuedCount: result.modifiedCount,
    message: `${result.modifiedCount} draft invoice(s) issued`,
  };
};

interface GetAdminRefundsParams {
  page?: number;
  limit?: number;
  status?: string;
  studentId?: string;
  invoiceId?: string;
  search?: string;
}

const validStatuses = Object.values(RefundStatus);

export const getAdminRefundInvoiceHistory = async ({
  page = 1,
  limit = 10,
  status,
  studentId,
  invoiceId,
  search,
}: GetAdminRefundsParams) => {
  const currentPage = Math.max(1, page);
  const pageLimit = Math.min(100, Math.max(1, limit));

  const filter: Record<string, unknown> = {};

  if (status) {
    if (!validStatuses.includes(status as never)) {
      return fail("Invalid refund status");
    }

    filter.status = status;
  }

  if (studentId) {
    if (!isValidObjectId(studentId)) {
      return fail("Invalid student ID");
    }

    filter.studentId = new mongoose.Types.ObjectId(studentId);
  }

  if (invoiceId) {
    if (!isValidObjectId(invoiceId)) {
      return fail("Invalid invoice ID");
    }

    filter.invoiceId = new mongoose.Types.ObjectId(invoiceId);
  }

  if (search?.trim()) {
    const term = search.trim();

    filter.$or = [
      { refundReference: { $regex: term, $options: "i" } },
      { paymentReference: { $regex: term, $options: "i" } },
    ];
  }

  const [refundsQuery, total] = await Promise.all([
    Refund.find(filter)
      .populate("studentId", "firstName lastName email")
      .populate("invoiceId", "invoiceNumber totalAmount amountPaid status")
      .populate("initiatedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageLimit)
      .limit(pageLimit),

    Refund.countDocuments(filter),
  ]);

  const refunds = refundsQuery.map((refund) => {
    const refundObj = refund.toObject();

    const { studentId, invoiceId, ...refundRest } = refundObj;

    return {
      ...refundRest,
      student: studentId,
      invoice: invoiceId,
    };
  });

  return {
    refunds,
    pagination: {
      total,
      page: currentPage,
      limit: pageLimit,
      totalPages: Math.ceil(total / pageLimit),
      hasNextPage: currentPage * pageLimit < total,
      hasPreviousPage: currentPage > 1,
    },
  };
};

export const getAdminRefundInvoiceById = async (
  refundId: string | string[],
) => {
  if (!isValidObjectId(refundId)) {
    return fail("Invalid refund ID");
  }

  const refundQuery = await Refund.findById(refundId)
    .populate("studentId", "firstName lastName email")
    .populate("invoiceId")
    .populate("paymentTransactionId")
    .populate("initiatedBy", "firstName lastName email");

  const refundObj = refundQuery?.toObject();

  const { studentId, invoiceId, paymentTransactionId, ...refundRest } =
    refundObj as unknown as any;

  const refund = {
    ...refundRest,
    paymentTransaction: paymentTransactionId,
    student: studentId,
    invoice: invoiceId,
  };

  if (!refund) {
    return fail("Refund not found", 404);
  }

  return refund;
};
