const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]';

export function trapFocus(event: KeyboardEvent) {
	if (event.defaultPrevented || event.key !== 'Tab') return;
	const dialog = event.currentTarget as HTMLElement;
	const controls = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
		.filter((element) => element.tabIndex >= 0
			&& !element.matches(':disabled')
			&& !element.closest('[inert]')
			&& element.getClientRects().length > 0);
	const first = controls[0];
	const last = controls.at(-1);

	if (!first) {
		event.preventDefault();
		dialog.focus();
	} else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
		event.preventDefault();
		last?.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
}
