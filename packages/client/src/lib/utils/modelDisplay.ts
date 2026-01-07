import { Lang } from "aiwrapper";

function toCreatorOrProviderName(id: string): string {
  return (
    Lang.models.getCreator(id)?.name ??
    Lang.models.getProvider(id)?.name ??
    id
  );
}

/**
 * Best-effort friendly model name for a model id.
 * Falls back to the raw id.
 */
export function getModelDisplayName(modelId: string): string {
  const direct = Lang.models.id(modelId);
  if (direct) return direct.name;

  // OpenRouter-style ids: "openai/gpt-5.2"
  const slashIdx = modelId.indexOf("/");
  if (slashIdx !== -1) {
    const tail = modelId.slice(slashIdx + 1);
    const byTail = Lang.models.id(tail);
    if (byTail) return byTail.name;
  }

  return modelId;
}

/**
 * Best-effort friendly provider name for a provider id.
 * Useful for custom providers (pass their configured display name as fallback).
 */
export function getProviderDisplayName(
  providerId: string,
  fallbackName?: string | null,
): string {
  return Lang.models.getProvider(providerId)?.name ?? fallbackName ?? providerId;
}

/**
 * Format a model label for UI.
 * - If the id is "creator/model", it becomes "Creator / Model"
 * - Otherwise it becomes "Model"
 */
export function formatModelLabel(modelId: string): string {
  const slashIdx = modelId.indexOf("/");
  if (slashIdx !== -1) {
    const creator = modelId.slice(0, slashIdx);
    const tail = modelId.slice(slashIdx + 1);
    return `${toCreatorOrProviderName(creator)} / ${getModelDisplayName(tail)}`;
  }
  return getModelDisplayName(modelId);
}

