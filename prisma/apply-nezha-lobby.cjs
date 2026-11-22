const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

if (process.env.VERCEL_ENV === "production") {
  if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("The production PostgreSQL connection is not configured.");
  }

  const { error, status } = spawnSync(process.execPath, [
    require.resolve("prisma/build/index.js"), "db", "execute",
    "--schema", join(__dirname, "schema.prisma"),
    "--file", join(__dirname, "sql", "nezha-lobby.sql")
  ], { stdio: "inherit" });
  if (error) throw error;
  if (status !== 0) process.exit(status || 1);
}
