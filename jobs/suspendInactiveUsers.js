import cron from 'node-cron';
import User from '../models/User.js';

let isRunning = false;

cron.schedule("0 * * * *", async () => {
  if (isRunning) return console.log("[CRON] Skipped — previous job still running.");
  isRunning = true;

  try {
    console.log(`[CRON] Running inactive user suspension job at ${new Date().toISOString()}`);

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await User.updateMany(
      { status: "inactive", createdAt: { $lte: cutoffDate } },
      { $set: { status: "suspended" } }
    );

    console.log(`[CRON] Suspended ${result.modifiedCount || 0} inactive users.`);
  } catch (error) {
    console.error("[CRON] Error suspending inactive users:", error);
  } finally {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`[MEMORY] Heap Used: ${used.toFixed(2)} MB`);
    isRunning = false;
    global.gc && global.gc();
  }
});
