type Translate = (key: string, params?: Record<string, unknown>) => string;

const DAY_MS = 24 * 60 * 60 * 1000;

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/**
 * 列表卡片 footer 的相对时间：今天 HH:mm / 昨天 / N 天前（<30 天）/ M月D日（跨年带年份）。
 */
export function formatRelativeCanvasTime(
  updatedAt: string,
  now: Date,
  t: Translate,
): string {
  const updatedTime = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) {
    return updatedAt;
  }
  const updated = new Date(updatedTime);

  if (isSameLocalDay(updated, now)) {
    const timeText = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(updated);
    return t("intentCanvas.manager.timeToday", { time: timeText });
  }

  const yesterday = new Date(now.getTime() - DAY_MS);
  if (isSameLocalDay(updated, yesterday)) {
    return t("intentCanvas.manager.timeYesterday");
  }

  const days = Math.floor((now.getTime() - updatedTime) / DAY_MS);
  if (days < 30) {
    return t("intentCanvas.manager.timeDaysAgo", { count: days });
  }

  const sameYear = updated.getFullYear() === now.getFullYear();
  const dateText = new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(updated);
  return t("intentCanvas.manager.timeOnDate", { date: dateText });
}
