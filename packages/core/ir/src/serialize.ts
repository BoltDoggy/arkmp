import type { ComponentModel } from './types';

/**
 * IR 序列化 / 反序列化。
 *
 * IR 只含纯数据（不引用 `ts.Node`），JSON 往返无损。
 * 用于增量编译的 ComponentModel 缓存（02 篇⑥）。
 */

/** 序列化为格式化 JSON 文本（便于缓存文件 diff）。 */
export function serializeIR(model: ComponentModel): string {
  return JSON.stringify(model, null, 2);
}

/** 从 JSON 文本还原 ComponentModel。 */
export function deserializeIR(json: string): ComponentModel {
  return JSON.parse(json) as ComponentModel;
}
