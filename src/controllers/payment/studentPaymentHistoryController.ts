import type { Request, Response } from "express";
import PDFDocument from "pdfkit";

import PaymentTransaction from "../../models/PaymentTransaction.ts";
import {
  getStudentPaymentHistory,
  getStudentPaymentDetails,
} from "../../services/payment/studentPaymentHistory.ts";
import {
  formatNaira,
  formatReceiptDate,
  getUserId,
  isValidObjectId,
  sendError,
} from "../../utils/helperFunctions.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";

const parsePositiveInteger = (value: unknown, fallback: number): number => {
  if (value === undefined) return fallback;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
};

export const getMyPaymentHistory = async (req: Request, res: Response) => {
  try {
    const studentId = getUserId(req);

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const page = parsePositiveInteger(req.query.page, 1);
    const limit = parsePositiveInteger(req.query.limit, 10);

    if (!Number.isFinite(page) || !Number.isFinite(limit)) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers.",
      });
    }

    const status =
      typeof req.query.status === "string"
        ? req.query.status.toUpperCase()
        : undefined;

    const result = await getStudentPaymentHistory({
      studentId,
      page,
      limit,
      status,
    });

    return res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getMyPaymentDetails = async (req: Request, res: Response) => {
  try {
    const studentId = getUserId(req);

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const transaction = await getStudentPaymentDetails(
      studentId,
      req.params.id,
    );

    return res.status(200).json({
      success: true,
      message: "Payment details retrieved successfully.",
      data: transaction,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const downloadMyPaymentReceipt = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const studentId = req.user?.id;
    const { id } = req.params;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!isValidObjectId(studentId) || !isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID.",
      });
    }

    const transaction = await PaymentTransaction.findOne({
      _id: id,
      studentId,
      // status: "SUCCESS",
    })
      .populate({
        path: "studentId",
        select: "firstName lastName email",
      })
      .populate({
        path: "invoiceIds",
        select:
          "invoiceNumber academicSession term totalAmount amountPaid currency",
      })
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message:
          "Successful payment not found. A receipt is available only for confirmed payments belonging to your account.",
      });
    }

    const student = transaction.studentId as unknown as {
      firstName?: string;
      lastName?: string;
      email?: string;
    } | null;

    const invoices = transaction.invoiceIds as unknown as Array<{
      invoiceNumber: string;
      academicSession: string;
      term: string;
    }>;

    const invoice = invoices?.[0];

    if (!invoice) {
      return res.status(409).json({
        success: false,
        message: "The invoice linked to this payment could not be found.",
      });
    }

    const receiptNumber = `RCT-${String(transaction.reference).replace(/[^A-Za-z0-9-]/g, "-")}`;
    const paidAt = transaction.paidAt || transaction.createdAt;
    const schoolName = process.env.SCHOOL_NAME?.trim() || "OpenStudy Academy";
    const studentName =
      [student?.firstName, student?.lastName].filter(Boolean).join(" ") ||
      "Student";

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Payment Receipt ${receiptNumber}`,
        Author: schoolName,
        Subject: "Verified school payment receipt",
      },
    });

    const filename = `${receiptNumber.replace(/[^A-Za-z0-9-]/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");

    doc.on("error", (error) => {
      console.error("Receipt PDF generation failed:", error);
      if (!res.headersSent) res.status(500).end();
      else res.destroy(error);
    });

    doc.pipe(res);

    const left = 50;
    const right = 545;

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#111827")
      .text(schoolName, left, 50, { width: 495, align: "center" });
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#2563EB")
      .text("PAYMENT RECEIPT", left, doc.y, { width: 495, align: "center" });

    doc.moveDown(1.25);
    const verifiedY = doc.y;
    doc
      .roundedRect(left, verifiedY, right - left, 38, 4)
      .fillAndStroke("#ECFDF5", "#A7F3D0");
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#065F46")
      .text("PAYMENT VERIFIED", left + 12, verifiedY + 12, { width: 200 });
    doc.y = verifiedY + 38;
    doc.moveDown(0.75);

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#111827")
      .text("RECEIPT DETAILS", left, doc.y);
    doc
      .moveTo(left, doc.y + 5)
      .lineTo(right, doc.y + 5)
      .strokeColor("#D1D5DB")
      .stroke();
    doc.moveDown(0.75);

    const receiptDetails = [
      ["Receipt number", receiptNumber],
      ["Payment reference", transaction.reference],
      ["Payment date", formatReceiptDate(paidAt)],
      ["Payment method", String(transaction.provider).replace(/_/g, " ")],
      ["Status", transaction.status],
    ];

    doc.fontSize(10).fillColor("#374151");
    for (const [label, value] of receiptDetails) {
      doc
        .font("Helvetica-Bold")
        .text(`${label}:`, left, doc.y, { continued: true });
      doc.font("Helvetica").text(` ${value}`);
    }

    doc.moveDown(1);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#111827")
      .text("STUDENT DETAILS", left, doc.y);
    doc
      .moveTo(left, doc.y + 5)
      .lineTo(right, doc.y + 5)
      .strokeColor("#D1D5DB")
      .stroke();
    doc.moveDown(0.75);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#374151")
      .text("Name:", left, doc.y, { continued: true });
    doc.font("Helvetica").text(` ${studentName}`);
    doc.font("Helvetica-Bold").text("Email:", left, doc.y, { continued: true });
    doc.font("Helvetica").text(` ${student?.email || "Not available"}`);

    doc.moveDown(1);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#111827")
      .text("PAYMENT DESCRIPTION", left, doc.y);
    doc
      .moveTo(left, doc.y + 5)
      .lineTo(right, doc.y + 5)
      .strokeColor("#D1D5DB")
      .stroke();
    doc.moveDown(0.75);

    doc.rect(left, doc.y, right - left, 24).fill("#F3F4F6");
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#111827")
      .text("Description", left + 8, doc.y + 7, { width: 340 });
    doc.text("Amount", right - 112, doc.y + 7, { width: 104, align: "right" });
    doc.moveDown(1.1);

    doc.font("Helvetica").fontSize(10).fillColor("#374151");
    for (const currentInvoice of invoices) {
      const rowY = doc.y;
      const description = `Invoice ${currentInvoice.invoiceNumber} — ${currentInvoice.academicSession}, ${currentInvoice.term} term`;
      doc.text(description, left + 8, rowY, { width: 340 });
      const rowAmount =
        invoices.length === 1 ? formatNaira(transaction.amount) : "—";
      doc.text(rowAmount, right - 112, rowY, { width: 104, align: "right" });
      doc.moveDown(0.6);
    }

    doc.moveDown(0.5);
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .strokeColor("#9CA3AF")
      .stroke();
    doc.moveDown(0.6);

    const totalY = doc.y;
    doc
      .roundedRect(left, totalY, right - left, 38, 4)
      .fillAndStroke("#EFF6FF", "#BFDBFE");
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1D4ED8")
      .text("AMOUNT PAID", left + 12, totalY + 12, { width: 220 });
    doc.text(formatNaira(transaction.amount), right - 170, totalY + 12, {
      width: 158,
      align: "right",
    });
    doc.y = totalY + 38;

    doc.moveDown(2.5);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#6B7280")
      .text(
        "This receipt confirms that the payment above was successfully verified by the payment system. Keep this receipt for your records.",
        left,
        doc.y,
        { width: 495, align: "center" },
      )
      .text("Thank you for choosing our school.", {
        width: 495,
        align: "center",
      });

    doc.end();
  } catch (error) {
    if (res.headersSent) return res.end();
    return sendError(res, error);
  }
};
