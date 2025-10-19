<script lang="ts">
  import type { VertexPropertyType } from "reptree/treeTypes";

  let { onCreate, onCancel }: { 
    onCreate: (key: string, value: VertexPropertyType) => void;
    onCancel: () => void;
  } = $props();

  let key = $state("");
  let type = $state<"string" | "number" | "boolean" | "object" | "array">("string");
  let stringValue = $state("");
  let numberValue = $state<number>(0);
  let booleanValue = $state(false);
  let jsonValue = $state("{}");
  let jsonError = $state<string | null>(null);

  $effect(() => {
    // Initialize sensible defaults when switching type
    jsonError = null;
    if (type === "object" && (jsonValue.trim() === "" || jsonValue.trim() === "[]")) {
      jsonValue = "{}";
    }
    if (type === "array" && (jsonValue.trim() === "" || jsonValue.trim() === "{}")) {
      jsonValue = "[]";
    }
  });

  function handleSubmit() {
    if (!key) return;

    let value: VertexPropertyType;
    switch (type) {
      case "string":
        value = stringValue;
        break;
      case "number":
        value = numberValue;
        break;
      case "boolean":
        value = booleanValue;
        break;
      case "object":
      case "array":
        try {
          const parsed = JSON.parse(jsonValue);
          // Ensure type matches selection (object vs array)
          if (type === "object" && (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")) {
            jsonError = "Enter a valid JSON object";
            return;
          }
          if (type === "array" && !Array.isArray(parsed)) {
            jsonError = "Enter a valid JSON array";
            return;
          }
          value = parsed as unknown as VertexPropertyType;
          jsonError = null;
        } catch (e) {
          jsonError = "Invalid JSON";
          return;
        }
        break;
    }

    onCreate(key, value);
  }
</script>

<div class="flex flex-col gap-2 p-2 bg-surface-500/5 rounded-container-token">
  <div class="flex gap-2">
    <input
      type="text"
      class="input input-sm flex-[3] text-left text-xs h-6 px-1"
      placeholder="Property key"
      bind:value={key}
    />
    <select
      class="select text-xs h-6 px-1 flex-1 min-w-[80px]"
      bind:value={type}
    >
      <option value="string">String</option>
      <option value="number">Number</option>
      <option value="boolean">Boolean</option>
      <option value="object">Object (JSON)</option>
      <option value="array">Array (JSON)</option>
    </select>
  </div>

  <div class="flex gap-2">
    {#if type === "string"}
      <input
        type="text"
        class="input input-sm flex-1 text-left text-xs h-6 px-1"
        placeholder="Value"
        bind:value={stringValue}
      />
    {:else if type === "number"}
      <input
        type="number"
        class="input input-sm flex-1 text-left text-xs h-6 px-1"
        placeholder="Value"
        bind:value={numberValue}
      />
    {:else if type === "boolean"}
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="h-3 w-3"
          bind:checked={booleanValue}
        />
        <span class="text-xs">Value</span>
      </label>
    {:else if type === "object" || type === "array"}
      <div class="flex-1 flex flex-col gap-1">
        <textarea
          class="textarea text-xs min-h-[96px] font-mono"
          placeholder={type === 'object' ? '{ }' : '[ ]'}
          bind:value={jsonValue}
        />
        {#if jsonError}
          <div class="text-xs text-error-600">{jsonError}</div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="flex gap-2 justify-end">
    <button
      class="btn btn-sm variant-soft-error"
      onclick={onCancel}
    >
      Cancel
    </button>
    <button
      class="btn btn-sm variant-soft-primary"
      onclick={handleSubmit}
    >
      Create
    </button>
  </div>
</div> 