import { rateLimit } from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  // Track request over a 15-minute window
  windowMs: 15 * 60 * 1000, // 1 minute = 60 * 1000

  // Allow at most 5 login request per IP during the window
  limit: 5,

  // Return modern rate-limit headers
  standardHeaders: "draft-8",

  // Disable older X-RateLimit-* headers
  legacyHeaders: false,

  // Count unsuccessful responses, not successful logins
  skipSuccessfulRequests: true,

  // HTTP response when the limit is exceeded
  statusCode: 429,

  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});
