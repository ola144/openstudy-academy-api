import type { Response } from "express";
import PDFDocument from "pdfkit";
import TeacherPayroll from "../../models/TeacherPayroll.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";
import {
  formatNaira,
  formatReceiptDate,
  isValidObjectId,
} from "../../utils/helperFunctions.ts";

const formatPeriod = (period: string) => {
  const date = new Date(`${period}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const paymentStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    APPROVED: "Approved — awaiting payment",
    TRANSFER_PENDING: "Transfer pending confirmation",
    PAID: "Paid successfully",
    REVERSED: "Payment reversed — contact the school",
  };
  return labels[status] || status;
};

export async function downloadMyPayslip(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const teacherId = req.user?.id;
    const payrollId = req.params.id;

    if (
      !teacherId ||
      !isValidObjectId(teacherId) ||
      !isValidObjectId(payrollId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher or payroll ID.",
      });
    }

    const payroll = await TeacherPayroll.findOne({
      _id: payrollId,
      teacherId,
      status: { $in: ["APPROVED", "TRANSFER_PENDING", "PAID", "REVERSED"] },
    }).populate("teacherId", "firstName lastName email");

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payslip not found.",
      });
    }

    const teacher = payroll.teacherId as unknown as {
      firstName?: string;
      lastName?: string;
      email?: string;
    } | null;

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher record not found.",
      });
    }

    const schoolName = process.env.SCHOOL_NAME?.trim() || "OpenStudy Academy";
    const teacherName =
      [teacher.firstName, teacher.lastName].filter(Boolean).join(" ") ||
      "Teacher";
    const safePeriod = payroll.period.replace(/[^0-9-]/g, "");

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Payslip - ${formatPeriod(payroll.period)}`,
        Author: schoolName,
        Subject: "Teacher payroll statement",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payslip-${safePeriod}.pdf"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");

    doc.on("error", (error) => {
      console.error("Payslip PDF generation failed:", error);
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(error);
      }
    });

    doc.pipe(res);

    const left = 50;
    const right = 545;
    const valueRight = 545;

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#111827")
      .text(schoolName, left, 50, { width: 495, align: "center" });
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#2563EB")
      .text("TEACHER PAYSLIP", { align: "center" });

    doc.moveDown(1.25);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#111827")
      .text("PAYSLIP INFORMATION", left, doc.y);
    doc
      .moveTo(left, doc.y + 5)
      .lineTo(right, doc.y + 5)
      .strokeColor("#D1D5DB")
      .stroke();
    doc.moveDown(0.8);

    const details = [
      ["Employee", teacherName],
      ["Employee email", teacher.email || "N/A"],
      ["Pay period", formatPeriod(payroll.period)],
      ["Payslip reference", String(payroll._id)],
      ["Generated", formatReceiptDate(new Date())],
    ];

    doc.font("Helvetica").fontSize(10).fillColor("#374151");
    for (const [label, value] of details) {
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
      .text("EARNINGS & DEDUCTIONS", left, doc.y);
    doc
      .moveTo(left, doc.y + 5)
      .lineTo(right, doc.y + 5)
      .strokeColor("#D1D5DB")
      .stroke();
    doc.moveDown(0.9);

    const drawAmountRow = (label: string, amount: string, bold = false) => {
      const y = doc.y;
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10)
        .fillColor("#374151")
        .text(label, left, y, { width: 300 });
      doc.text(amount, valueRight - 120, y, { width: 120, align: "right" });
      doc.moveDown(0.55);
    };

    drawAmountRow("Basic salary", formatNaira(payroll.baseSalary));
    drawAmountRow("Allowances", formatNaira(payroll.allowances));
    drawAmountRow("Deductions", `- ${formatNaira(payroll.deductions)}`);

    doc.moveDown(0.35);
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .strokeColor("#9CA3AF")
      .stroke();
    doc.moveDown(0.65);

    const netPayY = doc.y;
    doc
      .rect(left, netPayY, right - left, 38)
      .fillAndStroke("#EFF6FF", "#BFDBFE");
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1D4ED8")
      .text("NET PAY", left + 12, netPayY + 12, { width: 220 });
    doc.text(formatNaira(payroll.netAmount), valueRight - 170, netPayY + 12, {
      width: 158,
      align: "right",
    });
    doc.y = netPayY + 38;

    doc.moveDown(4);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#111827")
      .text("PAYMENT STATUS", left, doc.y);
    doc
      .moveTo(left, doc.y + 5)
      .lineTo(right, doc.y + 5)
      .strokeColor("#D1D5DB")
      .stroke();
    doc.moveDown(0.8);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#374151")
      .text(paymentStatusLabel(payroll.status));

    const paymentReference =
      payroll.paymentReference || payroll.transferReference;
    if (paymentReference) doc.text(`Payment reference: ${paymentReference}`);
    if (payroll.status === "PAID") {
      doc.text(
        `Payment date: ${formatReceiptDate(payroll.paidAt || payroll.transferCompletedAt)}`,
      );
    }
    if (payroll.status === "REVERSED") {
      doc.text(`Reversed: ${formatReceiptDate(payroll.transferReversedAt)}`);
    }

    doc.moveDown(3);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#6B7280")
      .text(
        "This is a computer-generated document and does not require a physical signature.",
        left,
        doc.y,
        { width: 495, align: "center" },
      )
      .text(
        "Please contact the school if any payroll details appear incorrect.",
        { width: 495, align: "center" },
      );

    doc.end();
  } catch (error) {
    console.error("Payslip download failed:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Could not generate payslip.",
      });
    }
    return res.destroy(error instanceof Error ? error : undefined);
  }
}
