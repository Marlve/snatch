import { createContext } from "react";

// Rows the app keeps for itself below the screen (the downloads list). The banner counts
// them, so it shrinks before the screen would run out of room.
export const ReservedRows = createContext(0);
