/**
 * @arkmp/api — 源码侧 API 命名空间（仿鸿蒙 kit 风格）+ wx.* 映射表。
 *
 * 命名空间对象仅供 .ets 源码获得类型提示；所有方法在编译期被改写为 wx.* 调用
 * （映射关系见 mapping.ts，对应设计文档 06 篇），直接运行会抛出明确错误。
 */

import type { ApiCategory, ApiMapping } from './mapping.js';
import { apiMappings } from './mapping.js';

export type { ApiCategory, ApiMapping, ParamAdapter } from './mapping.js';
export { apiMappings, routerMappings, systemMappings, unsupportedMappings } from './mapping.js';

// ---------------------------------------------------------------------------
// 映射表访问函数
// ---------------------------------------------------------------------------

const mappingIndex: ReadonlyMap<string, ApiMapping> = new Map(
  apiMappings.map((entry) => [entry.source, entry]),
);

/** 按源码侧 API 路径查询映射，如 getApiMapping('http.request') */
export function getApiMapping(source: string): ApiMapping | undefined {
  return mappingIndex.get(source);
}

/** 列出映射条目；可按类别过滤（'router' / 'system'），缺省返回全部 */
export function listApiMappings(category?: ApiCategory): readonly ApiMapping[] {
  if (category === undefined) {
    return apiMappings;
  }
  return apiMappings.filter((entry) => entry.category === category);
}

// ---------------------------------------------------------------------------
// 源码侧 API 命名空间（类型 + 编译期占位实现）
// ---------------------------------------------------------------------------

/** 命名空间方法被直接运行时的占位错误（正常链路下编译期已被改写，不会执行到） */
function compileTimeOnly(name: string): never {
  throw new Error(
    `@arkmp/api: '${name}' 仅供 ArkMP 源码侧编码使用，编译期会被改写为 wx.* 调用，不可直接运行`,
  );
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';

export interface HttpRequestOptions {
  method?: HttpMethod;
  header?: Record<string, string>;
  data?: unknown;
  timeout?: number;
}

export interface HttpResponse {
  statusCode: number;
  header: Record<string, string>;
  data: unknown;
}

/** http 命名空间（→ wx.request，Promise 风格） */
export interface HttpNamespace {
  request(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
}

export const http: HttpNamespace = {
  request: () => compileTimeOnly('http.request'),
};

/** storage 命名空间（→ wx.setStorageSync 等，值自动 JSON 序列化） */
export interface StorageNamespace {
  set(key: string, value: unknown): Promise<void>;
  get<T = unknown>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
}

export const storage: StorageNamespace = {
  set: () => compileTimeOnly('storage.set'),
  get: () => compileTimeOnly('storage.get'),
  remove: () => compileTimeOnly('storage.remove'),
};

export interface ShowToastOptions {
  message: string;
  duration?: number;
}

export interface DialogButton {
  text: string;
  color?: string;
}

export interface ShowDialogOptions {
  title: string;
  message: string;
  buttons: [DialogButton, DialogButton?];
}

export interface ShowActionMenuOptions {
  items: string[];
}

/** prompt 命名空间（→ wx.showToast / wx.showModal / wx.showActionSheet） */
export interface PromptNamespace {
  showToast(options: ShowToastOptions): Promise<void>;
  /** resolve 被点击按钮的下标 */
  showDialog(options: ShowDialogOptions): Promise<number>;
  /** resolve 被点击项的下标 */
  showActionMenu(options: ShowActionMenuOptions): Promise<number>;
}

export const prompt: PromptNamespace = {
  showToast: () => compileTimeOnly('prompt.showToast'),
  showDialog: () => compileTimeOnly('prompt.showDialog'),
  showActionMenu: () => compileTimeOnly('prompt.showActionMenu'),
};

export interface PickImageOptions {
  count?: number;
}

/** media 命名空间（→ wx.chooseMedia / wx.previewImage） */
export interface MediaNamespace {
  /** resolve 选中图片的临时文件路径数组 */
  pickImage(options?: PickImageOptions): Promise<string[]>;
  previewImage(urls: string[], current?: string): Promise<void>;
}

export const media: MediaNamespace = {
  pickImage: () => compileTimeOnly('media.pickImage'),
  previewImage: () => compileTimeOnly('media.previewImage'),
};

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/** location 命名空间（→ wx.getLocation；编译器自动生成 app.json permission） */
export interface LocationNamespace {
  getCurrent(): Promise<GeoLocation>;
}

export const location: LocationNamespace = {
  getCurrent: () => compileTimeOnly('location.getCurrent'),
};

export interface ShareOptions {
  title: string;
  path?: string;
  imageUrl?: string;
}

/** share 命名空间（编译为页面 onShareAppMessage 配置 + button open-type 提示） */
export interface ShareNamespace {
  share(options: ShareOptions): Promise<void>;
}

export const share: ShareNamespace = {
  share: () => compileTimeOnly('share.share'),
};

export interface LoginResult {
  code: string;
}

/** auth 命名空间（→ wx.login） */
export interface AuthNamespace {
  login(): Promise<LoginResult>;
}

export const auth: AuthNamespace = {
  login: () => compileTimeOnly('auth.login'),
};

export type NetworkType = 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none';

/** device 命名空间（→ wx.getNetworkType） */
export interface DeviceNamespace {
  getNetworkType(): Promise<NetworkType>;
}

export const device: DeviceNamespace = {
  getNetworkType: () => compileTimeOnly('device.getNetworkType'),
};

export interface PayRequestParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'MD5' | 'HMAC-SHA256' | 'RSA';
  paySign: string;
}

/** pay 命名空间（→ wx.requestPayment） */
export interface PayNamespace {
  request(params: PayRequestParams): Promise<void>;
}

export const pay: PayNamespace = {
  request: () => compileTimeOnly('pay.request'),
};
