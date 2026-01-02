<script lang="ts">
  import { ChevronLeft, ChevronRight, Check } from "lucide-svelte";
  import type { Snippet } from "svelte";
  import { i18n } from "@sila/client";

  let {
    children,
    step = $bindable(0),
    steps = [],
    titles = [],
    onComplete = () => {},
    onStepChange = undefined,
    onCancel = () => {},
    canAdvance = true,
  } = $props<{
    children: Snippet<[{ currentStep: number }]>;
    step: number;
    steps: string[];
    titles?: string[];
    onComplete?: () => void;
    onStepChange?: (newStep: number) => void;
    onCancel?: () => void;
    canAdvance?: boolean;
  }>();

  // Step management
  let currentStep = $state(step);
  let totalSteps = $derived(steps.length);

  // Handle step changes from props
  $effect(() => {
    currentStep = step;
  });

  // Navigation functions
  function nextStep() {
    if (currentStep < totalSteps - 1) {
      const newStep = currentStep + 1;
      currentStep = newStep;
      if (onStepChange) onStepChange(newStep);
    } else {
      onComplete();
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      currentStep = newStep;
      if (onStepChange) onStepChange(newStep);
    }
  }
</script>

<div class="w-full max-w-3xl mx-auto p-4 flex flex-col h-full">
  <!-- Progress indicator -->
  <div class="flex justify-between items-start mb-4">
    {#each Array(totalSteps) as _, i}
      <div
        class="flex flex-col items-center"
      >
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center mb-2"
          class:bg-success-200-800={i <= currentStep}
          class:bg-surface-100-900={i > currentStep}
          class:opacity-50={i < currentStep}
        >
          <strong class="text-xs">{i + 1}</strong>
        </div>
        <span class="text-sm">
          {titles && titles[i] ? titles[i] : `Step ${i + 1}`}
        </span>
      </div>

      {#if i < totalSteps - 1}
        <div class="flex-1">
          <div class="h-8 flex items-center">
            <div class="h-[2px] w-full mx-1" class:bg-success-200-800={i < currentStep} class:bg-surface-100-900={i >= currentStep}></div>
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Step content -->
  <div
    class="flex-grow overflow-y-auto"
  >
    {@render children({ currentStep })}
  </div>

  <!-- Navigation buttons -->
  <div class="flex justify-between mt-4">
    {#if currentStep === 0}
      <button
        class="btn btn-lg preset-outlined"
        onclick={onCancel}
      >
        {i18n.texts.actions.cancel}
      </button>
    {:else}
      <button
        class="btn btn-lg preset-outlined"
        onclick={prevStep}
      >
        <ChevronLeft size={16} />
        {i18n.texts.actions.back}
      </button>
    {/if}

    <button class="btn btn-lg preset-filled" onclick={nextStep} disabled={!canAdvance}>
      {currentStep < totalSteps - 1 ? i18n.texts.actions.next : i18n.texts.actions.finish}
      {#if currentStep < totalSteps - 1}
        <ChevronRight size={16} />
      {/if}
    </button>
  </div>
</div>
