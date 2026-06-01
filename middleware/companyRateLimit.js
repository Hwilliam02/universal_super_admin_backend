import CompanyRateLimit from '../models/CompanyRateLimit.js';

export default async function companyCreationRateLimiter(req, res, next) {;
  try {
    console.log("limiter fired!")
    const ip = req.ip || req.connection.remoteAddress;

    let record = await CompanyRateLimit.findOne({ ip });

    const now = new Date();

    if (!record) {
      // First time this IP is creating a company
      record = await CompanyRateLimit.create({
        ip,
        count: 1,
        lastReset: now,
      });

      return next();
    }

    // Check if 24 hours passed (daily reset)
    const timeSinceLastReset = now - record.lastReset;

    const DAY = 24 * 60 * 60 * 1000;

    if (timeSinceLastReset > DAY) {
      // Reset counter
      record.count = 1;
      record.lastReset = now;
      await record.save();
      return next();
    }

    // If already 10 companies created today → block
    if (record.count >= 10) {
      return res.status(429).json({
        success: false,
        message: "Daily company creation limit reached. Try again tomorrow.",
      });
    }

    // Otherwise increment
    record.count += 1;
    await record.save();

    next();

  } catch (err) {
    console.error("Rate limiter error:", err);
    return res.status(500).json({
      success: false,
      message: "Rate limiting failed",
    });
  }
};
