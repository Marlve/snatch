import { homedir } from "node:os";
import { join } from "node:path";

// snatch's own per-user folder (history now, presets later). Created on the first write.
export const CONFIG_DIR = join(homedir(), ".snatch");
