var rn_bridge = require("rn-bridge");
const { login, create } = require("./controller");
const wasmManager = require("./managers/wasmManager");
const stateManager = require("./managers/stateManager");
const path = require("path");
const fs = require("fs").promises;

const createDirectoryIfNotExists = async (directoryPath) => {
  try {
    await fs.mkdir(directoryPath, { recursive: true });
    console.log(directoryPath)
  } catch (error) {
    console.log(`Error creating directory ${directoryPath}:${error}`);
  }
};

const init = async () => {
  const keyDirectoryPath = path.join(__dirname, "keys");
  await createDirectoryIfNotExists(keyDirectoryPath);
  // const result = await wasmManager.ccall({command:`keysdir ${path.join(__dirname, 'keys')}`, flag: "keysdir"})
  wasmManager.init();
  stateManager.init();
};

init();

rn_bridge.channel.on("message", async (msg) => {
  try {
    const message = JSON.parse(msg);

    if (message.action === "C2S/login") {
      const success = await login({ password: message.data?.password });
      if (typeof success != "string") {
        rn_bridge.channel.send(
          JSON.stringify({
            action: "S2C/login",
            success: true,
            data: success,
          })
        );
      } else {
        rn_bridge.channel.send(
          JSON.stringify({
            action: "S2C/login",
            success: false,
            error: "Invalid password",
          })
        );
      }
    } else if (message.action === "C2S/create") {
      console.log(message.data?.command);
      const result = await create({ command: message.data?.command });
      console.log(result);
      rn_bridge.channel.send(
        JSON.stringify({
          action: "S2C/create",
          data: result,
        })
      );
    }
  } catch (err) {
    rn_bridge.channel.send(
      JSON.stringify({
        action: "S2C/error",
        error: err.message,
      })
    );
  }
});

rn_bridge.channel.send("Node was initialized.");
