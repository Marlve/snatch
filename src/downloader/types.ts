export type DownloadPhase = "downloading" | "processing" | "done" | "failed";

export type DownloadUpdate = {
  phase: DownloadPhase;
  // Overall progress from 0 to 1, across every stream and the final processing step.
  percent: number;
  speed: string;
  error?: string;
};
