// Validate date format YYYY-MM-DD
export const isValidDateFormat = (dateStr: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// e.g. 2026-11-01_13-45-09
export const formatDateTimeForFilename = (date: Date): string => {
  const [datePart, timePart = ""] = date.toISOString().replace("Z", "").split("T");
  return `${datePart}_${timePart.split(".")[0]?.replace(/:/g, "-")}`;
};
