// Validate date format YYYY-MM-DD
export const isValidDateFormat = (dateStr: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// e.g. 2026-11-01_13-45-09
export const formatDateTimeForFilename = (date: Date): string => {
  const [datePart, timePart = ""] = date.toISOString().replace("Z", "").split("T");
  return `${datePart}_${timePart.split(".")[0]?.replace(/:/g, "-")}`;
};

// First and last word of a full name; either is empty when the name has fewer than two words
export const splitFullNames = (fullNames?: string | null): { firstName: string; lastName: string } => {
  const parts = (fullNames ?? "").trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.length > 1 ? (parts[parts.length - 1] ?? "") : "" };
};
