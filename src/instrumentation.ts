export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { processOutbox } = await import("./server/mail");
    const timer = setInterval(() => {
      void processOutbox();
    }, 30000);
    timer.unref();
    if (process.env.NODE_ENV === "production") {
      const { dailyBackup } = await import("./server/backup");
      void dailyBackup();
      const backupTimer = setInterval(() => {
        void dailyBackup();
      }, 3600000);
      backupTimer.unref();
    }
  }
}
