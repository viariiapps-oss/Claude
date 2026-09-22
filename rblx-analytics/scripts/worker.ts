import "./env";
import { trigger } from "./refresh-once";

/**
 * Self-hosted scheduler (for platforms without sub-daily cron):
 *   realtime every 5 minutes · hourly at :00 · daily at 03:00 UTC.
 * Run alongside the app: `npm run worker`.
 */
const FIVE_MIN = 5 * 60_000;
let lastHour = -1;
let lastDay = "";

async function tick() {
  const now = new Date();
  try {
    await trigger("realtime");
    if (now.getUTCHours() !== lastHour) {
      lastHour = now.getUTCHours();
      await trigger("hourly");
    }
    const day = now.toISOString().slice(0, 10);
    if (now.getUTCHours() >= 3 && day !== lastDay) {
      lastDay = day;
      await trigger("daily");
    }
  } catch (e) {
    console.error(`[worker] ${e instanceof Error ? e.message : e}`);
  }
}

console.log("[worker] started — realtime every 5 min, hourly, daily at 03:00 UTC");
void tick();
setInterval(tick, FIVE_MIN);
