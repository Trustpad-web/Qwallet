const wasmManager = require("./managers/wasmManager");
const stateManager = require("./managers/stateManager");
const rn_bridge = require("rn-bridge");
const socketManager = require("./managers/socketManager");
const { delay, socketSync } = require("./utils/helpers");
const liveSocketController = require("./liveSocketController");

exports.login = async ({ password }) => {
  try {
    let liveSocket = socketManager.initLiveSocket();
    liveSocketController(liveSocket);
    await delay(1000);
    let realPassword;
    stateManager.init();
    const resultFor24words = await wasmManager.ccall({
      command: `checkavail ${password}`,
      flag: "login",
    });
    const resultFor55chars = await wasmManager.ccall({
      command: `checkavail Q${password}`,
      flag: "login",
    });
    const passwordExistCode = -24;
    if (
      resultFor24words.value.result != passwordExistCode &&
      resultFor55chars.value.result != passwordExistCode
    ) {
      return "Password does not exist.";
    } else if (resultFor24words.value.result == passwordExistCode) {
      realPassword = password;
    } else if (resultFor55chars.value.result == passwordExistCode) {
      realPassword = `Q${password}`;
    }

    let listResult;

    async function checkSubshash() {
      listResult = await wasmManager.ccall({
        command: `list ${realPassword}`,
        flag: "login",
      });
      // const socket = socketManager.getIO();
      const localSubshash = listResult.value.display.subshash;
      stateManager.setLocalSubshash(localSubshash);

      const addresses = listResult.value.display.addresses;
      const addressesResp = await socketSync(addresses[0]);
      if (!addressesResp) {
        return "Socket server error";
      }
      const hexResult = await wasmManager.ccall({
        command: `logintx ${realPassword}`,
        flag: "logintx",
      });
      const hexLive = await socketSync(hexResult.value.display);
      if (!hexLive) {
        return "Socket server error";
      }
      const remoteSubshas = stateManager.getRemoteSubshash();
      return localSubshash != "" && remoteSubshas == localSubshash;
    }

    const matchStatus = await checkSubshash();

    if (matchStatus) {
      stateManager.setRemoteSubshash("");
      stateManager.setLocalSubshash("");
      const userState = stateManager.setUserState({
        password: realPassword,
        accountInfo: listResult.value.display,
        isAuthenticated: true,
      });
      return userState;
    } else if (matchStatus == "Socket server error") {
      return "Socket server error";
    } else {
      const clearResult = await socketSync("clearderived");
      if (!clearResult) {
        return "Socket server error";
      }
      listResult = await wasmManager.ccall({
        command: `list ${realPassword}`,
        flag: "login",
      });
      const addresses = listResult.value.display.addresses;
      for (let idx = 1; idx < addresses.length; idx++) {
        if (addresses[idx] && addresses[idx] != "") {
          const plusResult = await socketSync(`+${idx} ${addresses[idx]}`);
          if (!plusResult) {
            return "Socket server error";
          }
        }
      }
      if (
        stateManager.getLocalSubshash() != "" &&
        stateManager.getRemoteSubshash() == stateManager.getLocalSubshash()
      ) {
        stateManager.setRemoteSubshash("");
        stateManager.setLocalSubshash("");
        const userState = stateManager.setUserState({
          password: realPassword,
          accountInfo: listResult.value.display,
          isAuthenticated: true,
        });
        return userState;
      } else {
        return "not synced";
      }
    }
  } catch (err) {
    return err.message;
  }
};

exports.create = async ({ command }) => {
  const result = await wasmManager.ccall({
    command,
    flag: "create",
  });
  return result;
};

exports.addAccout = async ({ password, index }) => {
  // const socket = socketManager.getIO();

  const addResult = await wasmManager.ccall({
    command: `login ${password},${index},derivation${index}`,
    flag: "addaccount",
  });
  if (addResult.value.result != 0) {
    rn_bridge.channel.send(
      JSON.stringify({
        action: "S2C/add-account",
        data: addResult.value.display,
      })
    );
    return;
  }
  const result = await wasmManager.ccall({
    command: `list ${password}`,
    flag: "login",
  });
  const localSubshash = result.value.display.subshash;
  stateManager.setLocalSubshash(localSubshash);

  const hexResult = await wasmManager.ccall({
    command: `logintx ${password}`,
    flag: "logintx",
  });
  const hexSocketResult = await socketSync(hexResult.value.display);
  if (!hexSocketResult) {
    rn_bridge.channel.send(
      JSON.stringify({
        action: "S2C/add-account",
        data: "Socket server error",
      })
    );
    return;
  }

  const plusResult = await socketSync(`+${index} ${addResult.value.display}`);
  if (!plusResult) {
    rn_bridge.channel.send(
      JSON.stringify({
        action: "S2C/err",
        data: "Socket server error",
      })
    );
    return;
  }
  const remoteSubshas = stateManager.getRemoteSubshash();

  if (localSubshash != "" && remoteSubshas == localSubshash) {
    stateManager.setRemoteSubshash("");
    stateManager.setLocalSubshash("");
    const userState = stateManager.setUserState({
      password,
      accountInfo: result.value.display,
      isAuthenticated: true,
    });
    rn_bridge.channel.send(
      JSON.stringify({
        action: "S2C/add-account",
        data: userState,
      })
    );
  } else {
    rn_bridge.channel.send(
      JSON.stringify({
        action: "S2C/add-account",
        data: "not-synced",
      })
    );
  }
};
