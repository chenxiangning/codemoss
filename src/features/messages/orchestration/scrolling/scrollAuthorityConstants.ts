/**
 * 幕布滚动所有权 — 可编码常量（OpenSpec / DESIGN §4.4）。
 * 调整数值须同步 openspec change 与设计文档，禁止魔法数散落 controller。
 *
 * 2026-08 全砍：不再把 forced 最短保持绑到 Codex 6s / settle 2.4s 时间预算。
 * finalizing 由 geometry.finalizingPresentationActive 单独 hold；
 * re-arm 只认真底（≤1px），120px 仅作「离底释放」滞回，不作 stick 重新武装阈值。
 */

/** 工程真底：distanceToBottom ≤ 此值即贴底完成态 / re-arm stick */
export const TRUE_BOTTOM_EPSILON_PX = 1;

/**
 * 离底释放滞回：distance > 此值才在 scroll 事件上解除 autoScroll。
 * 不得当作 re-arm 或回合结束真底验收。
 */
export const FOLLOW_RELEASE_THRESHOLD_PX = 120;

/**
 * @deprecated 使用 TRUE_BOTTOM_EPSILON_PX 做 re-arm；保留别名以免外部 import 断裂。
 * 语义已改为「真底 re-arm」，不再是 120。
 */
export const FOLLOW_REARM_THRESHOLD_PX = TRUE_BOTTOM_EPSILON_PX;

/** 明确上滚：单次 |deltaY| 下限（滤微抖/噪声） */
export const USER_SCROLL_MIN_DELTA_Y = 4;

/** 明确上滚：累计向上位移阈值 */
export const USER_SCROLL_ACCUM_UP_PX = 40;

/** 累计上滚观测窗 */
export const USER_SCROLL_ACCUM_WINDOW_MS = 320;

/** 用户输入租约（与历史 USER_SCROLL_INTENT_GRACE 同量级） */
export const USER_INPUT_LEASE_MS = 500;

/** WriteTicket applied scrollTop ring 容量 */
export const TICKET_APPLIED_RING_SIZE = 8;

/**
 * forced 最短保持：覆盖发送后乐观气泡/首包布局几帧，禁止绑引擎 6s 长窗。
 * finalizing 呈现窗由 finalizingPresentationActive 单独阻止退役。
 * 用户明确上滚仍可立刻打断 forced。
 */
export const MIN_FORCED_HOLD_MS = 800;

/**
 * forced 安全阀：到点仍未稳态则最后 pin 并退役。
 * 刻意短于旧 8s/6s 组合，避免回合结束后长时间幽灵追底。
 */
export const SAFETY_TIMEOUT_FORCED_MS = 4_000;

/** 高度不变观测窗 */
export const STABLE_HEIGHT_WINDOW_MS = 150;

/** 窗内至少连续一致采样次数 */
export const STABLE_HEIGHT_MIN_SAMPLES = 3;

/** forced/stick 下 scrollTop 写入软上限（Hz） */
export const MAX_STICK_WRITE_HZ = 30;

/** 程序回声位置容差（px） */
export const TICKET_SCROLL_MATCH_TOLERANCE_PX = 1;
