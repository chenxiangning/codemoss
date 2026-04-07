const expectedManager = (process.argv[2] || "npm").trim().toLowerCase();
const userAgent = String(process.env.npm_config_user_agent || "").toLowerCase();

if (!userAgent) {
  process.exit(0);
}

const actualManager = userAgent.split("/")[0] || "";

if (actualManager && actualManager !== expectedManager) {
  console.error(
    `This repository is locked to ${expectedManager}. Detected ${actualManager}. Use ${expectedManager} install instead.`,
  );
  process.exit(1);
}
