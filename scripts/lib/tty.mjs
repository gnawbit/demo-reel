import readline from "node:readline";

export function waitForEnter(message) {
  if (!process.stdin.isTTY) {
    throw new Error("Manual login requires an interactive terminal; pass --storage-state for automated runs.");
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}
