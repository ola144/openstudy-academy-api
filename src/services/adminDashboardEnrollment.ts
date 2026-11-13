import User from "../models/User.ts";
import { UserRole } from "../utils/auth.type.ts";

export type EnrollmentPeriod = "weekly" | "twoWeeks" | "monthly" | "twoMonths";
type GroupBy = "day" | "week";

const TIMEZONE = "Africa/Lagos";
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

// Get today's calendar date in Lagos.
const getLagosToday = () => {
  // Get the current date

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  //   Extract the year, month and day
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)!.value);

  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
};

// This function converts our Lagos calendar-date representation into the actual UTC timestamp corresponding to midnight in Lagos.
const toLagosDate = (date: Date) => new Date(date.getTime() - LAGOS_OFFSET_MS);

// This converts a JavaScript date into a simple date string.
const formatDate = (date: Date) => date.toISOString().slice(0, 10);

// Get Monday
const getMonday = (date: Date) => {
  const result = new Date(date);
  const day = (result.getUTCDay() + 6) % 7;

  result.setUTCDate(result.getUTCDate() - day);

  return result;
};

// Add Days - This function adds or subtracts days from a date.
const addDays = (date: Date, days: number) => {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() + days);

  return result;
};

export const getStudentEnrollmentActivity = async (
  period: EnrollmentPeriod,
) => {
  const today = getLagosToday();

  let startDate: Date; // When the period begins
  let endDate: Date; // When the period ends
  let groupBy: GroupBy = "day"; // Whether MongoDB groups
  // records daily or weekly

  switch (period) {
    case "weekly":
      // Current calendar week: Monday through Sunday
      startDate = getMonday(today);
      endDate = addDays(startDate, 7);
      groupBy = "day";
      break;

    case "twoWeeks":
      // Last 14 days, including today
      startDate = addDays(today, -13);
      endDate = addDays(today, 1);
      groupBy = "day";
      break;

    case "monthly":
      // This calculates the first day of the current month and the first day of the next month.
      startDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
      );

      endDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
      );

      groupBy = "day";
      break;

    case "twoMonths":
      // This calculates the previous month and current month.
      startDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
      );
      endDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
      );
      groupBy = "week";
      break;

    default:
      throw new Error("Invalid enrollment period");
  }

  const groupExpression =
    groupBy === "day" // === - This a ternary operator
      ? {
          $dateToString: {
            // $dateToString converts a MongoDB date into a formatted string. e.g. 2026-11-06T08:30:00.000Z could become "2026-11-06"
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: TIMEZONE,
          },
        }
      : {
          $dateToString: {
            format: "%Y-%m-%d",
            date: {
              $dateTrunc: {
                // $dateTrunc rounds a date down to the beginning of a specified time unit.
                date: "$createdAt",
                unit: "week",
                startOfWeek: "monday",
                timezone: TIMEZONE,
              },
            },
            timezone: TIMEZONE,
          },
        };

  const results = await User.aggregate([
    {
      $match: {
        // Stage 1: $match filters the documents - It is similar to using .find().
        role: UserRole.STUDENT,
        createdAt: {
          $gte: toLagosDate(startDate), // $gte means greater than or equal to.
          $lt: toLagosDate(endDate), // $lt means less than
        },
      },
    },
    {
      $group: {
        // State 2: $group - This group the matching stuent records
        _id: groupExpression, // _id represents the grouping key
        value: { $sum: 1 }, // This counts how many documents belong to each group
      },
    },
    {
      $sort: { _id: 1 }, // Stage 3: $sort - This sorts the aggregation results by the _id in ascending order
    },
  ]);

  // Convert aggregation results into a Map
  const statsMap = new Map(results.map((item) => [item._id, item.value]));

  const data: { date: string; value: number }[] = [];

  let currentDate = new Date(startDate);

  if (groupBy === "day") {
    while (currentDate < endDate) {
      const date = formatDate(currentDate);

      data.push({
        date,
        value: statsMap.get(date) ?? 0,
      });

      currentDate = addDays(currentDate, 1);
    }
  } else {
    // Align the first bucket to Monday.
    currentDate = getMonday(currentDate);

    while (currentDate < endDate) {
      const date = formatDate(currentDate);

      data.push({
        date,
        value: statsMap.get(date) ?? 0,
      });

      currentDate = addDays(currentDate, 7);
    }
  }

  return {
    period,
    groupBy,
    data: data,
    totalEnrollments: data.reduce((total, item) => total + item.value, 0),
  };
};
