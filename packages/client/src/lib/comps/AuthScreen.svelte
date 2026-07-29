<script lang="ts">
	import { authClient } from '../auth-client';

	let mode = $state<'sign-in' | 'sign-up'>('sign-in');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let pending = $state(false);
	let message = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		pending = true;
		message = '';
		try {
			const result =
				mode === 'sign-up'
					? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
					: await authClient.signIn.email({ email: email.trim(), password });
			if (result.error) {
				message = result.error.message ?? 'Authentication failed.';
			}
		} catch (error) {
			message = error instanceof Error ? error.message : 'Authentication failed.';
		} finally {
			pending = false;
		}
	}
</script>

<main class="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
	<section
		class="hidden flex-col justify-between bg-surface-950 p-12 text-surface-50 lg:flex"
	>
		<a href="https://heswe.com" class="text-xl font-semibold tracking-tight">heswe</a>
		<div class="max-w-xl">
			<p class="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-primary-400">
				AI workspaces you control
			</p>
			<h1 class="text-5xl font-semibold leading-[1.05] tracking-tight">
				Your AI agents, conversations, and files, together.
			</h1>
			<p class="mt-6 max-w-lg text-lg leading-relaxed text-surface-300">
				The more your team works with AI, the more valuable its context and output become. Keep
				it in portable workspaces you can move, back up, and run on your own server.
			</p>
		</div>
		<p class="text-sm text-surface-500">heswe.com</p>
	</section>

	<section class="flex items-center justify-center bg-surface-50-950 px-6 py-12">
		<div class="w-full max-w-md">
			<a href="https://heswe.com" class="mb-12 block text-xl font-semibold lg:hidden">heswe</a>
			<p class="text-sm font-medium text-primary-600-400">
				{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
			</p>
			<h2 class="mt-2 text-3xl font-semibold tracking-tight">
				{mode === 'sign-in' ? 'Sign in to Heswe' : 'Start using Heswe'}
			</h2>
			<p class="mt-3 text-surface-600-400">
				{mode === 'sign-in'
					? 'Continue working with your agents, conversations, and files.'
					: 'Create a workspace for your conversations, files, and agents.'}
			</p>

			<form class="mt-8 space-y-5" onsubmit={submit}>
				{#if mode === 'sign-up'}
					<label class="block">
						<span class="mb-2 block text-sm font-medium">Name</span>
						<input
							class="input w-full"
							autocomplete="name"
							required
							bind:value={name}
							placeholder="Your name"
						/>
					</label>
				{/if}
				<label class="block">
					<span class="mb-2 block text-sm font-medium">Email</span>
					<input
						class="input w-full"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						placeholder="you@company.com"
					/>
				</label>
				<label class="block">
					<span class="mb-2 block text-sm font-medium">Password</span>
					<input
						class="input w-full"
						type="password"
						autocomplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
						minlength="8"
						required
						bind:value={password}
						placeholder="At least 8 characters"
					/>
				</label>

				{#if message}
					<p class="rounded-lg bg-error-50-950 p-3 text-sm text-error-700-300" role="alert">
						{message}
					</p>
				{/if}

				<button class="btn preset-filled-primary-500 w-full" type="submit" disabled={pending}>
					{pending ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
				</button>
			</form>

			<button
				class="mt-6 w-full text-center text-sm text-surface-600-400 hover:text-surface-950-50"
				type="button"
				onclick={() => {
					mode = mode === 'sign-in' ? 'sign-up' : 'sign-in';
					message = '';
				}}
			>
				{mode === 'sign-in'
					? 'New to Heswe? Create an account'
					: 'Already have an account? Sign in'}
			</button>
		</div>
	</section>
</main>
