export function formatFileSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${Math.round(bytes / 1024 / 1024 * 10) / 10} MB`;
}
