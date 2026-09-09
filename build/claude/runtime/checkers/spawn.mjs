import { execFile } from "node:child_process";

// A single place every adapter's run() goes through, so "the binary is not
// on PATH" is detected once, the same way, everywhere: never a crash, never
// mistaken for the contract failing.
export function spawnTool(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    execFile(command, args, { cwd: options.cwd, maxBuffer: 1024 * 1024 * 32 }, (error, stdout, stderr) => {
      if (error && error.code === "ENOENT") {
        resolvePromise({ available: false, exitCode: null, stdout: "", stderr: "" });
        return;
      }
      resolvePromise({
        available: true,
        exitCode: error && typeof error.code === "number" ? error.code : (error ? 1 : 0),
        stdout: stdout ?? "",
        stderr: stderr ?? "",
      });
    });
  });
}
