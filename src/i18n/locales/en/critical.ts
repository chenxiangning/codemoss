import common from "./common";
import app from "./app";
import layout from "./layout";
import menu from "./menu";
import sidebar from "./sidebar";
import home from "./home";
import homeChat from "./homeChat";
import runtimeNotice from "./runtimeNotice";
import errors from "./errors";
import lockScreen from "./lockScreen";
import update from "./update";
import composer from "./composer";
import workspace from "./workspace";
import threads from "./threads";
import tabbar from "./tabbar";
import panels from "./panels";
import shortcutsGuide from "./shortcutsGuide";
import sharedSend from "./sharedSend";
import time from "./time";
import chat from "./chat";
import models from "./models";
import modes from "./modes";
import providers from "./providers";
import approval from "./approval";
import config from "./config";
import files from "./files";
import messages from "./messages";
import git from "./git";
import tools from "./tools";
import statusPanel from "./statusPanel";
import prompts from "./prompts";
import terminal from "./terminal";
import plan from "./plan";
import noteCards from "./noteCards";
import searchPalette from "./searchPalette";
import threadCompletion from "./threadCompletion";
import usage from "./usage";
import taskCenter from "./taskCenter";

const critical = {
  ...common,
  ...app,
  ...layout,
  ...menu,
  ...sidebar,
  ...home,
  ...homeChat,
  ...runtimeNotice,
  ...errors,
  ...lockScreen,
  ...update,
  ...composer,
  ...workspace,
  ...threads,
  ...tabbar,
  ...panels,
  ...shortcutsGuide,
  ...sharedSend,
  ...time,
  ...chat,
  ...models,
  ...modes,
  ...providers,
  ...approval,
  ...config,
  ...files,
  ...messages,
  ...git,
  ...tools,
  ...statusPanel,
  ...prompts,
  ...terminal,
  ...plan,
  ...noteCards,
  ...searchPalette,
  ...threadCompletion,
  ...usage,
  ...taskCenter,
};

export default critical;
