<svelte:head>
	<title>Silaland App</title>
	<meta
		name="description"
		content="Simple SvelteKit and Skeleton starter for the hosted Silaland app."
	/>
</svelte:head>

<script lang="ts">
	const pillars = [
		'Browser chat lives in its own app channel.',
		'Users see only their own threads.',
		'Admins can grow into broader channel visibility.'
	];
</script>

<div class="min-h-screen bg-surface-50-950 text-surface-950-50">
	<div class="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:px-10">
		<header class="flex flex-col gap-6 border-b border-surface-200-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-3xl">
				<p class="text-xs font-medium uppercase tracking-[0.28em] text-surface-600-400">
					Silaland
				</p>
				<h1 class="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
					SvelteKit app starter with Skeleton wired in.
				</h1>
				<p class="mt-4 max-w-2xl text-base leading-7 text-surface-700-300">
					This is a minimal base for the hosted land app. It keeps the first screen small while
					establishing the theme, layout, and package setup we can build on.
				</p>
			</div>

			<div class="rounded-full border border-surface-200-800 bg-surface-100-900 px-4 py-2 text-sm text-surface-700-300">
				Draft UI shell
			</div>
		</header>

		<main class="grid flex-1 gap-6 py-10 lg:grid-cols-[1.7fr_1fr]">
			<section class="rounded-3xl border border-surface-200-800 bg-surface-100-900/70 p-8 shadow-xl shadow-black/10">
				<div class="flex flex-col gap-6">
					<div>
						<p class="text-sm font-medium uppercase tracking-[0.22em] text-surface-600-400">
							First slice
						</p>
						<h2 class="mt-3 text-2xl font-semibold">Keep the first implementation narrow.</h2>
					</div>

					<div class="grid gap-4 sm:grid-cols-3">
						<div class="rounded-2xl border border-surface-200-800 bg-surface-50-950 p-4">
							<p class="text-sm text-surface-600-400">Channel</p>
							<p class="mt-2 text-lg font-medium">app</p>
						</div>
						<div class="rounded-2xl border border-surface-200-800 bg-surface-50-950 p-4">
							<p class="text-sm text-surface-600-400">Theme</p>
							<p class="mt-2 text-lg font-medium">Cerberus</p>
						</div>
						<div class="rounded-2xl border border-surface-200-800 bg-surface-50-950 p-4">
							<p class="text-sm text-surface-600-400">Runtime</p>
							<p class="mt-2 text-lg font-medium">SvelteKit</p>
						</div>
					</div>

					<div class="rounded-2xl border border-dashed border-surface-300-700 p-5">
						<p class="text-sm leading-7 text-surface-700-300">
							Next up: auth, current-user loading, thread list, thread detail, and the first
							Neorest-backed chat flow.
						</p>
					</div>
				</div>
			</section>

			<aside class="rounded-3xl border border-surface-200-800 bg-surface-100-900/70 p-8">
				<h2 class="text-lg font-semibold">Guiding rules</h2>
				<ul class="mt-5 space-y-3">
					{#each pillars as pillar}
						<li class="rounded-2xl border border-surface-200-800 bg-surface-50-950 px-4 py-3 text-sm leading-6 text-surface-700-300">
							{pillar}
						</li>
					{/each}
				</ul>
			</aside>
		</main>
	</div>
</div>
