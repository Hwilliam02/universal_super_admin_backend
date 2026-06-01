// cron/cleanupLogs.js
import cron from 'node-cron';
import ActivityLog from '../models/ActivityLog.js';
import ExceptionLog from '../models/ExceptionLog.js';

// Run every day at 3 AM
cron.schedule("0 3 * * *", async () => {
    try {
        console.log("⏳ Starting log cleanup cron job at 3 AM...");

        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Delete Activity Logs older than 1 week
        const activityResult = await ActivityLog.deleteMany({
            createdAt: { $lte: oneWeekAgo }
        });

        // Delete Exception Logs older than 1 week
        const exceptionResult = await ExceptionLog.deleteMany({
            createdAt: { $lte: oneWeekAgo }
        });

        console.log("✅ Log cleanup completed:");
        console.log(`🗑️ Activity Logs removed: ${activityResult.deletedCount}`);
        console.log(`🗑️ Exception Logs removed: ${exceptionResult.deletedCount}`);

    } catch (err) {
        console.error("❌ Error in log cleanup cron job:", err.message);
    }
});
