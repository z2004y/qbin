/**
 * 多级缓存管理
 * - 内存 (memCache)
 * - Deno KV (for meta) + Postgres (最终存储)
 */
import {
  CACHE_CHANNEL,
  DENO_KV_ACCESS_TOKEN,
  DENO_KV_PROJECT_ID,
  DENO_KV_PROJECT_ID_REGEX,
  MAX_CACHE_SIZE,
  PASTE_STORE
} from "../config/constants.ts";
import { KVMeta, Metadata } from "../utils/types.ts";
import { checkPassword } from "./validator.ts";


export const memCache = new Map<string, Metadata | Record<string, unknown>>();
export const kv = await ((() => {
  const projectId = DENO_KV_PROJECT_ID?.trim() || "";
  const accessToken = DENO_KV_ACCESS_TOKEN?.trim() || "";

  if (projectId && accessToken && DENO_KV_PROJECT_ID_REGEX.test(projectId)) {
    return Deno.openKv(`https://api.deno.com/databases/${projectId}/connect`, {
      accessToken: accessToken,
    });
  }
  return Deno.openKv();
})());
export const cacheBroadcast = new BroadcastChannel(CACHE_CHANNEL);

function normalizeKVMeta(key: string, raw: Partial<KVMeta> & Record<string, unknown>): KVMeta {
  return {
    fkey: key,
    email: typeof raw.email === "string" ? raw.email : "",
    title: typeof raw.title === "string" ? raw.title : "",
    uname: typeof raw.uname === "string" ? raw.uname : "",
    ip: typeof raw.ip === "string" ? raw.ip : "",
    mime: typeof raw.mime === "string" ? raw.mime : "",
    len: Number(raw.len ?? 0),
    expire: Number(raw.expire ?? 0),
    hash: Number(raw.hash ?? 0),
    pwd: typeof raw.pwd === "string" ? raw.pwd : "",
  };
}


cacheBroadcast.onmessage = async (event: MessageEvent) => {
  const { type, key, metadata } = event.data;
  if (!key) return;
  if (type === "update" && key) {
    await deleteCache(key, metadata);
  } else if (type === "delete" && key) {
    await deleteCache(key, metadata);
  }
};

export async function isCached(key: string, pwd?: string | undefined): Promise<Metadata | null> {
  const memData = memCache.get(key);
  if (memData && "pwd" in memData) {
    if ("pwd" in memData) return memData as Metadata;
  }

  const kvResult = await kv.get([PASTE_STORE, key]);
  if (!kvResult.value){
    return null;
  }

  const kvMeta = normalizeKVMeta(key, kvResult.value as Partial<KVMeta> & Record<string, unknown>);
  memCache.set(key, kvMeta);   // 减少内查询
  return kvMeta as Metadata;
}

export async function checkCached(key: string, pwd?: string | undefined): Promise<Metadata | null> {
  const memData = memCache.get(key);
  if (memData && "pwd" in memData) {
    if (!checkPassword(memData.pwd, pwd)) return null;
    if ("content" in memData) return memData as Metadata;
  }

  const kvResult = await kv.get([PASTE_STORE, key]);
  if (!kvResult.value){
    return null;
  }
  const kvMeta = normalizeKVMeta(key, kvResult.value as Partial<KVMeta> & Record<string, unknown>);
  if (!checkPassword(kvMeta.pwd || "", pwd)){
    return null;
  }
  memCache.set(key, kvMeta);
  return kvMeta as Metadata;
}

/**
 * 从缓存中获取数据，如果缓存未命中，则从 KV 中获取并缓存
 */
export async function getCachedContent(key: string, pwd?: string, repo): Promise<Metadata | null> {
  try {
    const cache = await checkCached(key, pwd);
    if (cache && "content" in cache) return cache;

    // KV 缓存未命中或仅命中 meta 时，回落到 Postgres（源存储）读取
    const dbData = await repo.getByFkey(key);
    if (!dbData) return null;
    await updateCache(key, dbData);
    return dbData;
  } catch (error) {
    console.error('Cache fetch error:', error);
    return null;
  }
}

/**
 * 更新缓存（写入内存和 Cache API）
 */
export async function updateCache(key: string, metadata: Metadata): Promise<void> {
  try {
    if(metadata.len <= MAX_CACHE_SIZE) memCache.set(key, metadata);
  } catch (error) {
    console.error('Cache update error:', error);
  }
}

/**
 * 删除缓存 (内存 + Cache API)
 */
export async function deleteCache(key: string, meta) {
  try {
    memCache.delete(key);
  } catch (error) {
    console.error('Cache deletion error:', error);
  }
}
