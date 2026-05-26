const { spawn } = require("child_process");

const commands = [
  { name: "next", command: process.platform === "win32" ? "npx.cmd" : "npx", args: ["next", "dev"] },
  { name: "realtime", command: "node", args: ["scripts/realtime-server.js"] },
];

const children = commands.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  child.stdout.on("data", (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${name}] ${data}`));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
      for (const other of children) {
        if (other !== child && !other.killed) other.kill();
      }
    }
  });
  return child;
});

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
