import about from "./about";
import activityPanel from "./activityPanel";
import askUserQuestion from "./askUserQuestion";
import browserAgent from "./browserAgent";
import claudeModes from "./claudeModes";
import clientDocumentation from "./clientDocumentation";
import codexModes from "./codexModes";
import debug from "./debug";
import engineTaskOutput from "./engineTaskOutput";
import intentCanvas from "./intentCanvas";
import kanban from "./kanban";
import memory from "./memory";
import multiAgent from "./multiAgent";
import projectMap from "./projectMap";
import promptDistill from "./promptDistill";
import promptEnhancer from "./promptEnhancer";
import reasoning from "./reasoning";
import rewind from "./rewind";
import settings from "./settings";
import specHub from "./specHub";
import subagentUi from "./subagentUi";

const deferred = {
  ...about,
  ...activityPanel,
  ...askUserQuestion,
  ...browserAgent,
  ...claudeModes,
  ...clientDocumentation,
  ...codexModes,
  ...debug,
  ...engineTaskOutput,
  ...intentCanvas,
  ...kanban,
  ...memory,
  ...multiAgent,
  ...projectMap,
  ...promptDistill,
  ...promptEnhancer,
  ...reasoning,
  ...rewind,
  ...settings,
  ...specHub,
  ...subagentUi,
};

export default deferred;
