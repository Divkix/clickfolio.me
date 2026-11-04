import * as z from "zod/mini";

export const analyticsTimezoneSchema = z.catch(
  z.string().check(
    z.refine((timezone) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });

        return true;
      } catch {
        return false;
      }
    }),
  ),
  "UTC",
);
