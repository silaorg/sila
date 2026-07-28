import {
	createTtabs,
	type TilePanel,
	type TileState,
	type TTabs,
	type TtabsTheme
} from 'ttabs-svelte';
import ConversationView from './comps/ConversationView.svelte';
import DefaultWorkspacePage from './comps/DefaultWorkspacePage.svelte';
import SidebarToggle from './comps/SidebarToggle.svelte';
import WorkspaceSidebar from './comps/WorkspaceSidebar.svelte';
import WorkspaceSettingsButton from './comps/WorkspaceSettingsButton.svelte';
import TabBarNewThreadButton from './ttabs/TabBarNewThreadButton.svelte';
import TabCloseButton from './ttabs/TabCloseButton.svelte';
import { SKELETON_THEME } from './ttabs/theme';
import type { ThreadSummary } from './api-client';

type LayoutRefs = {
	contentGrid?: string;
	sidebarColumn?: string;
};

export class WorkspaceLayout {
	ttabs: TTabs;
	private layoutRefs: LayoutRefs = {};
	private workspaceId: string | null = null;
	private applyingLayout = false;

	sidebar = $state({
		isOpen: true,
		widthWhenOpen: 300,
		toggle: () => {
			this.sidebar.isOpen = !this.sidebar.isOpen;
			this.updateSidebarLayout();
		}
	});

	constructor() {
		this.ttabs = createTtabs({
			theme: {
				...SKELETON_THEME,
				components: {
					closeButton: TabCloseButton
				} as TtabsTheme['components']
			},
			defaultLayoutCreator: (ttabs) => this.setupDefaultLayout(ttabs),
			setupFromScratch: () => this.syncLayout(),
			defaultComponentIdForEmptyTiles: 'noTabsContent'
		});

		this.ttabs.registerComponent('sidebar', WorkspaceSidebar);
		this.ttabs.registerComponent('chat', ConversationView);
		this.ttabs.registerComponent('sidebarToggle', SidebarToggle);
		this.ttabs.registerComponent('sidebarSettings', WorkspaceSettingsButton);
		this.ttabs.registerComponent('noTabsContent', DefaultWorkspacePage);
		this.ttabs.registerComponent('tabBarNewThreadButton', TabBarNewThreadButton);
		this.ttabs.resetToDefaultLayout();
		this.ttabs.subscribeDebounced(() => {
			this.syncLayout();
			this.saveLayout();
		});
		this.syncLayout();
	}

	setWorkspace(workspaceId: string | null) {
		if (workspaceId === this.workspaceId) return;
		this.saveLayout();
		this.workspaceId = workspaceId;
		this.applyingLayout = true;
		try {
			const stored = workspaceId ? this.readStoredLayout(workspaceId) : null;
			if (!stored || !this.restoreLayout(stored)) {
				this.ttabs.resetToDefaultLayout();
			}
			this.syncLayout();
		} finally {
			this.applyingLayout = false;
		}
	}

	openChatTab(threadId: string, name: string, targetPanelId?: string) {
		this.openThreadTab(threadId, name, targetPanelId, false);
	}

	openChatTabInNewTab(threadId: string, name: string, targetPanelId?: string) {
		this.pinFocusedLazyTab();
		this.openThreadTab(threadId, name, targetPanelId, true);
	}

	private openThreadTab(
		threadId: string,
		name: string,
		targetPanelId: string | undefined,
		pinned: boolean
	) {
		const existingTab = this.findTabByThreadId(threadId);
		if (existingTab) {
			if (pinned) this.ttabs.updateTile(existingTab, { isLazy: false });
			this.ttabs.setFocusedActiveTab(existingTab);
			return;
		}

		if (!this.layoutRefs.contentGrid) this.syncLayout();
		const targetPanel = targetPanelId
			? this.ttabs.getTile(targetPanelId)
			: null;
		const parentId =
			targetPanel?.type === 'panel'
				? targetPanel.id
				: this.layoutRefs.contentGrid;
		if (!parentId) return;

		const lazyTab = this.ttabs.getLazyTabs(parentId)[0];
		const tabId =
			lazyTab?.id ?? this.ttabs.addTab(parentId, name, true, !pinned);
		if (lazyTab) {
			this.ttabs.updateTile(tabId, { name, isLazy: !pinned });
		}
		this.ttabs.setComponent(tabId, 'chat', { threadId });
		this.ttabs.setFocusedActiveTab(tabId);
	}

	updateThreads(threads: ThreadSummary[]) {
		const threadsById = new Map(threads.map((thread) => [thread.id, thread]));
		const tabs = Object.values(this.ttabs.getTiles()).filter((tile) => tile.type === 'tab');

		for (const tab of tabs) {
			const content = this.ttabs.getTabContent(tab.id);
			if (content?.componentId !== 'chat') continue;
			const threadId = content.data?.componentProps?.threadId;
			const thread = typeof threadId === 'string' ? threadsById.get(threadId) : null;
			if (!thread) {
				this.ttabs.closeTab(tab.id);
			} else if (tab.name !== thread.title) {
				this.ttabs.updateTile(tab.id, { name: thread.title });
			}
		}
	}

	closeFocusedTab() {
		const tab = this.ttabs.getFocusedActiveTabTile();
		if (tab) this.ttabs.closeTab(tab.id);
	}

	setupDefaultLayout(ttabs: TTabs) {
		ttabs.resetTiles();
		const root = ttabs.addGrid();
		const row = ttabs.addRow(root);
		this.layoutRefs.sidebarColumn = ttabs.addColumn(row, '300px');
		ttabs.setComponent(this.layoutRefs.sidebarColumn, 'sidebar');
		const contentColumn = ttabs.addColumn(row);
		this.layoutRefs.contentGrid = ttabs.addGrid(contentColumn);
		ttabs.updateTile(this.layoutRefs.contentGrid, { dontClean: true });
	}

	private findTabByThreadId(threadId: string) {
		for (const tile of Object.values(this.ttabs.getTiles())) {
			if (tile.type !== 'tab') continue;
			const content = this.ttabs.getTabContent(tile.id);
			if (
				content?.componentId === 'chat' &&
				content.data?.componentProps?.threadId === threadId
			) {
				return tile.id;
			}
		}
		return null;
	}

	private pinFocusedLazyTab() {
		const focusedTab = this.ttabs.getFocusedActiveTabTile();
		if (focusedTab?.isLazy) {
			this.ttabs.updateTile(focusedTab.id, { isLazy: false });
		}
	}

	private syncLayout() {
		const tiles = this.ttabs.getTiles();
		const sidebarContent = Object.values(tiles).find(
			(tile) => tile.type === 'content' && tile.componentId === 'sidebar'
		);
		if (sidebarContent?.parent) {
			this.layoutRefs.sidebarColumn = sidebarContent.parent;
			const sidebarColumn = this.ttabs.getTile(sidebarContent.parent);
			if (sidebarColumn?.type === 'column') {
				const width = sidebarColumn.width?.value ?? 0;
				this.sidebar.isOpen = width > 50;
				if (this.sidebar.isOpen) {
					this.sidebar.widthWhenOpen = Math.max(50, width);
				}
			}
			const row = sidebarColumn?.parent ? this.ttabs.getTile(sidebarColumn.parent) : null;
			if (row?.type === 'row') {
				const contentColumnId = row.columns.find((id) => id !== sidebarContent.parent);
				const contentColumn = contentColumnId ? this.ttabs.getTile(contentColumnId) : null;
				if (contentColumn?.type === 'column' && contentColumn.child) {
					const child = this.ttabs.getTile(contentColumn.child);
					if (child?.type === 'grid') this.layoutRefs.contentGrid = child.id;
				}
			}
		}

		const panels = Object.values(tiles).filter(
			(tile): tile is TilePanel => tile.type === 'panel'
		);
		const topLeftPanelId = this.findTopLeftPanelId();
		for (const panel of panels) {
			const components = panel.tabBarComponents ?? [];
			if (!components.some((item) => item.componentId === 'tabBarNewThreadButton')) {
				this.ttabs.updateTile(panel.id, {
					tabBarComponents: [...components, { componentId: 'tabBarNewThreadButton' }]
				});
			}
			const shouldShowToggle =
				!this.sidebar.isOpen && panel.id === topLeftPanelId;
			const leftComponents = shouldShowToggle
				? [
						{ componentId: 'sidebarSettings' },
						{ componentId: 'sidebarToggle' }
					]
				: [];
			if (!sameComponentIds(panel.leftComponents ?? [], leftComponents)) {
				this.ttabs.updateTile(panel.id, { leftComponents });
			}
		}
	}

	private findTopLeftPanelId() {
		const contentGridId = this.layoutRefs.contentGrid;
		if (!contentGridId) return null;

		let gridId: string | null = contentGridId;
		while (gridId) {
			const grid = this.ttabs.getGrid(gridId);
			const rowId = grid.rows[0];
			if (!rowId) return null;
			const row = this.ttabs.getRow(rowId);
			const columnId = row.columns[0];
			if (!columnId) return null;
			const column = this.ttabs.getColumn(columnId);
			if (!column.child) return null;
			const child = this.ttabs.getTile<TileState>(column.child);
			if (child?.type === 'panel') return child.id;
			if (child?.type !== 'grid') return null;
			gridId = child.id;
		}
		return null;
	}

	private updateSidebarLayout() {
		const sidebarColumnId = this.layoutRefs.sidebarColumn;
		if (!sidebarColumnId) return;
		this.ttabs.updateTile(sidebarColumnId, {
			width: {
				value: this.sidebar.isOpen ? this.sidebar.widthWhenOpen : 0,
				unit: 'px'
			}
		});
		this.syncLayout();
	}

	private saveLayout() {
		if (
			this.applyingLayout ||
			!this.workspaceId ||
			typeof localStorage === 'undefined'
		) {
			return;
		}
		try {
			localStorage.setItem(
				this.storageKey(this.workspaceId),
				this.ttabs.serializeLayout()
			);
		} catch {
			// Layout persistence is optional; the default layout remains usable.
		}
	}

	private readStoredLayout(workspaceId: string) {
		if (typeof localStorage === 'undefined') return null;
		try {
			return localStorage.getItem(this.storageKey(workspaceId));
		} catch {
			return null;
		}
	}

	private restoreLayout(serializedLayout: string) {
		try {
			return this.ttabs.deserializeLayout(serializedLayout);
		} catch {
			return false;
		}
	}

	private storageKey(workspaceId: string) {
		return `heswe:layout:${workspaceId}`;
	}
}

function sameComponentIds(
	left: Array<{ componentId: string }>,
	right: Array<{ componentId: string }>
) {
	return (
		left.length === right.length &&
		left.every((component, index) => component.componentId === right[index]?.componentId)
	);
}
