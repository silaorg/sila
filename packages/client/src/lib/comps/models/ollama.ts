import { type ModelProviderLocalConfig, proxyFetch } from "@sila/core";

export async function checkOllamaStatus(config?: ModelProviderLocalConfig): Promise<boolean> {
  try {
    const address = config?.apiUrl || "http://localhost:11434";
    const res = await proxyFetch(`${address}/api/tags`);
    return res.status === 200;
  } catch (e) {
    return false;
  }
}
