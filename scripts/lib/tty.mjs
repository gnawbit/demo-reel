import readline from "node:readline";

export function waitForEnter(message) {
  if (!process.stdin.isTTY) {
    console.warn("Non-interactive terminal; skipping the manual login wait.");
    return Promise.resolve();
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
