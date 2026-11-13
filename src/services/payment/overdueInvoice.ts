import StudentInvoice from "../../models/StudentInvoice.ts";

export const syncOverdueInvoices = async () => {
  const now = new Date();

  // 1. Mark outstanding invoices as overdue
  const overdueResult = await StudentInvoice.updateMany(
    {
      status: { $in: ["UPAID", "PARTIALLY_PAID"] },
      dueDate: { $lt: now },
      outstandingBalance: { $gt: 0 },
    },
    {
      $set: { status: "OVERDUE" },
    },
  );

  // 2. Restore overdue invoices whose due date has been extended into the future.
  const overdueInvoices = await StudentInvoice.find({
    status: "OVERDUE",
    dueDate: { $gte: now },
    outstandingBalance: { $gt: 0 },
  })
    .select("_id amountPaid")
    .lean();

  let restoredToUnpaid = 0;
  let restoredToPartiallyPaid = 0;

  for (const invoice of overdueInvoices) {
    const nextStatus = invoice.amountPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";

    const result = await StudentInvoice.updateOne(
      {
        _id: invoice._id,
        status: "OVERDUE",
        dueDate: { $gte: now },
        outstandingBalance: { $gt: 0 },
      },
      {
        $set: { status: nextStatus },
      },
    );

    if (result.modifiedCount > 0) {
      if (nextStatus === "PARTIALLY_PAID") {
        restoredToPartiallyPaid++;
      } else {
        restoredToUnpaid++;
      }
    }
  }

  return {
    markedOverdue: overdueResult.modifiedCount,
    restoredToUnpaid,
    restoredToPartiallyPaid,
    checkedAt: now,
  };
};
