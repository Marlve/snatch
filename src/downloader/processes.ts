import type { ChildProcess } from "node:child_process";

const running = new Set<ChildProcess>();

export function track(child: ChildProcess): void {
  running.add(child);
  const forget = () => running.delete(child);
  child.once("close", forget);
  child.once("error", forget);
}

export function killAll(): void {
  for (const child of running) child.kill();
  running.clear();
}
