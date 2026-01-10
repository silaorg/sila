import ChatAppLoader from "@sila/client/comps/apps/chat/ChatAppLoader.svelte";
import FilesAppLoader from "@sila/client/comps/apps/files/FilesAppLoader.svelte";
import Sidebar from "@sila/client/comps/sidebar/Sidebar.svelte";
import SidebarToggle from "@sila/client/comps/sidebar/SidebarToggle.svelte";
import FileViewerTab from "@sila/client/comps/vertex-viewer/FileViewerTab.svelte";
import {
  createTtabs,
  type TtabsTheme,
  type LayoutValidator,
  LayoutValidationError,
  type TTabs,
  type TilePanelState,
} from "ttabs-svelte";
import { SKELETON_THEME } from "@sila/client/ttabs/themes/skeleton";
import TabCloseButton from "@sila/client/ttabs/components/TabCloseButton.svelte";
import TabBarNewThreadButton from "@sila/client/ttabs/components/TabBarNewThreadButton.svelte";
import DefaultAppPage from "@sila/client/comps/apps/DefaultAppPage.svelte";
import { getTtabsLayout, saveTtabsLayout } from "@sila/client/localDb";

type LayoutRefs = {
  contentGrid: string | undefined,
  sidebarColumn: string | undefined
}

export class LayoutStore {
  // Key used to persist/load UI layout (tabs/tiling). This should be a unique per-pointer
  // identifier (typically the space pointer URI), not necessarily the underlying space id.
  spaceUri: string;
  ttabs: TTabs;
  layoutRefs: LayoutRefs = $state({
    contentGrid: undefined,
    sidebarColumn: undefined
  });
  
  sidebar = $state({
    isOpen: true,
    widthWhenOpen: 300,

    toggle: () => {
      this.sidebar.isOpen = !this.sidebar.isOpen;
      this._updateSidebarLayout();
    },

    open: () => {
      this.sidebar.isOpen = true;
      this._updateSidebarLayout();
    },

    close: () => {
      this.sidebar.isOpen = false;
      this._updateSidebarLayout();
    }
  });

  constructor(spaceUri: string) {
    this.spaceUri = spaceUri;
    this.ttabs = this._createTtabs();
    this._setupTtabs();
  }

  private _createTtabs(): TTabs {
    /**
     * SidebarValidator ensures that the layout has a sidebar column.
     * It doesn't matter if the sidebar has width 0, it just needs to exist.
     */
    const sidebarValidator: LayoutValidator = (ttabs: TTabs): boolean => {
      const tiles = ttabs.getTiles();
      const rootGridId = ttabs.rootGridId as string;
      const rootGrid = tiles[rootGridId];

      // Check that root grid has only 1 row
      if (!rootGrid || rootGrid.type !== 'grid' || rootGrid.rows.length !== 1) {
        throw new LayoutValidationError(
          "Root grid must have exactly one row",
          "INVALID_ROOT_GRID"
        );
      }

      // Get the row and check its columns
      const rowId = rootGrid.rows[0];
      const row = tiles[rowId];

      if (!row || row.type !== 'row' || row.columns.length < 1) {
        throw new LayoutValidationError(
          "Root grid's row must have at least one column",
          "INVALID_ROW_STRUCTURE"
        );
      }

      // Find sidebar components
      const sidebarTiles = Object.values(tiles).filter(tile =>
        tile.type === 'content' && tile.componentId === 'sidebar'
      );

      // Check that there is exactly one sidebar
      if (sidebarTiles.length === 0) {
        throw new LayoutValidationError(
          "Layout must include a sidebar component",
          "MISSING_SIDEBAR"
        );
      }

      if (sidebarTiles.length > 1) {
        throw new LayoutValidationError(
          "Layout must include only one sidebar component",
          "MULTIPLE_SIDEBARS"
        );
      }

      // Check that sidebar is in a column
      const sidebarTile = sidebarTiles[0];
      if (!sidebarTile.parent) {
        throw new LayoutValidationError(
          "Sidebar must have a parent column",
          "INVALID_SIDEBAR_PARENT"
        );
      }

      const sidebarParent = tiles[sidebarTile.parent];
      if (!sidebarParent || sidebarParent.type !== 'column') {
        throw new LayoutValidationError(
          "Sidebar must be placed in a column",
          "INVALID_SIDEBAR_PARENT"
        );
      }

      // Check that sidebar is in the first column of the row
      if (row.columns[0] !== sidebarParent.id) {
        throw new LayoutValidationError(
          "Sidebar must be in the first column of the root row",
          "SIDEBAR_NOT_FIRST_COLUMN"
        );
      }

      return true;
    };

    return createTtabs({
      theme: {
        ...SKELETON_THEME,
        components: {
          closeButton: TabCloseButton
        } as TtabsTheme['components']
      },
      validators: [sidebarValidator],
      defaultLayoutCreator: (tt: TTabs) => this.setupDefaultLayout(tt),
      setupFromScratch: () => this._findAndUpdateLayoutRefs(),
      defaultComponentIdForEmptyTiles: 'noTabsContent'
    });
  }

  private _setupTtabs(): void {
    this.ttabs.registerComponent('sidebar', Sidebar);
    this.ttabs.registerComponent('chat', ChatAppLoader);
    this.ttabs.registerComponent('files', FilesAppLoader);
    this.ttabs.registerComponent('fileViewer', FileViewerTab);
    this.ttabs.registerComponent('sidebarToggle', SidebarToggle);
    this.ttabs.registerComponent('noTabsContent', DefaultAppPage);
    this.ttabs.registerComponent('tabBarNewThreadButton', TabBarNewThreadButton);

    this.ttabs.subscribeDebounced(() => {
      this._findAndUpdateLayoutRefs();
    });
  }

  // Load layout from IndexedDB for this specific space
  async loadSpaceLayout(): Promise<void> {
    try {
      const saved = await getTtabsLayout(this.spaceUri);
      if (saved) {
        this.ttabs.deserializeLayout(saved);
      } else {
        this.ttabs.resetToDefaultLayout();
      }
      this._findAndUpdateLayoutRefs();
    } catch (error) {
      console.error(`Failed to load layout for space ${this.spaceUri}:`, error);
      // Fall back to default layout
      this.ttabs.resetToDefaultLayout();
      this._findAndUpdateLayoutRefs();
    }
  }

  // Save layout to IndexedDB
  async saveLayout(): Promise<void> {
    try {
      const layoutJson = this.ttabs.serializeLayout();
      await saveTtabsLayout(this.spaceUri, layoutJson);
    } catch (error) {
      console.error(`Failed to save layout for space ${this.spaceUri}:`, error);
    }
  }

  setupLayout(layoutJson?: string): void {
    if (!layoutJson) {
      this.ttabs.resetToDefaultLayout();
      return;
    }

    this.ttabs.deserializeLayout(layoutJson);
  }

  private _updateSidebarLayout(): void {
    if (!this.layoutRefs.sidebarColumn) return;

    this.ttabs.updateTile(this.layoutRefs.sidebarColumn, {
      width: {
        value: this.sidebar.isOpen ? this.sidebar.widthWhenOpen : 0,
        unit: "px"
      },
    });
  }

  openChatTab(treeId: string, name: string, targetPanelId?: string): void {
    // First, check if a tab with this treeId already exists
    const existingTabId = this._findTabByTreeId(treeId);
    if (existingTabId) {
      // If tab exists, just activate it
      this.ttabs.setFocusedActiveTab(existingTabId);
      return;
    }

    const resolvedPanelId = targetPanelId && this._isPanel(targetPanelId) ? targetPanelId : undefined;

    if (!resolvedPanelId && !this.layoutRefs.contentGrid) {
      // Find the first non root grid
      const grids = Object.values(this.ttabs.getTiles()).filter(tile => tile.type === 'grid' && !tile.parent);
      if (grids.length === 0) {
        console.error("No non root grid found");
        return;
      }
      this.layoutRefs.contentGrid = grids[0].id;
    }

    const parentContainerId = resolvedPanelId ?? this.layoutRefs.contentGrid;
    if (!parentContainerId) {
      console.error("No parent container for new chat tab");
      return;
    }

    let tab: string;

    // Check for a lazy tab and if it exists, update it
    const lazyTabs = this.ttabs.getLazyTabs(parentContainerId);

    if (lazyTabs.length > 0) {
      // Reuse the first lazy tab we found
      const lazyTab = lazyTabs[0];
      tab = lazyTab.id;

      // Update the tab name
      this.ttabs.updateTile(tab, {
        name
      });
    } else {
      // No lazy tabs found, create a new one
      tab = this.ttabs.addTab(parentContainerId, name, true, true);
    }

    // Set the component for the tab
    this.ttabs.setComponent(tab, 'chat', { treeId });
    this.ttabs.setFocusedActiveTab(tab);
  }

  openFilesTab(treeId: string, name: string): void {
    // First, check if a tab with this treeId already exists
    const existingTabId = this._findTabByTreeId(treeId);
    if (existingTabId) {
      // If tab exists, just activate it
      this.ttabs.setFocusedActiveTab(existingTabId);
      return;
    }

    if (!this.layoutRefs.contentGrid) {
      // Find the first non root grid
      const grids = Object.values(this.ttabs.getTiles()).filter(tile => tile.type === 'grid' && !tile.parent);
      if (grids.length === 0) {
        console.error("No non root grid found");
        return;
      }
      this.layoutRefs.contentGrid = grids[0].id;
    }

    const grid = this.ttabs.getGrid(this.layoutRefs.contentGrid);
    let tab: string;

    // Check for a lazy tab and if it exists, update it
    const lazyTabs = this.ttabs.getLazyTabs(grid.id);

    if (lazyTabs.length > 0) {
      // Reuse the first lazy tab we found
      const lazyTab = lazyTabs[0];
      tab = lazyTab.id;

      // Update the tab name
      this.ttabs.updateTile(tab, {
        name
      });
    } else {
      // No lazy tabs found, create a new one
      tab = this.ttabs.addTab(grid.id, name, true, true);
    }

    // Set the component for the tab
    this.ttabs.setComponent(tab, 'files', { treeId });
    this.ttabs.setFocusedActiveTab(tab);
  }

  openFileViewerTab(treeId: string, vertexId: string, name: string): void {
    const existingTabId = this._findTabByFileRef(treeId, vertexId);
    if (existingTabId) {
      this.ttabs.setFocusedActiveTab(existingTabId);
      return;
    }

    if (!this.layoutRefs.contentGrid) {
      const grids = Object.values(this.ttabs.getTiles()).filter(
        (tile) => tile.type === 'grid' && !tile.parent
      );
      if (grids.length === 0) {
        console.error("No non root grid found");
        return;
      }
      this.layoutRefs.contentGrid = grids[0].id;
    }

    const grid = this.ttabs.getGrid(this.layoutRefs.contentGrid);
    const tab = this.ttabs.addTab(grid.id, name, true, false);

    this.ttabs.setComponent(tab, 'fileViewer', { treeId, vertexId, name });
    this.ttabs.setFocusedActiveTab(tab);
  }

  private _updateHoverSidebarState(): void {
    try {
      if (this.layoutRefs.sidebarColumn) {
        const sidebarColumn = this.ttabs.getColumn(this.layoutRefs.sidebarColumn);
        if (sidebarColumn) {
          this.sidebar.isOpen = (sidebarColumn.width?.value || 0) > 50;

          if (this.sidebar.isOpen) {
            this.sidebar.widthWhenOpen = Math.max(50, sidebarColumn.width?.value || 300);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  private _findTopLeftPanelId(): string | undefined {
    try {
      if (!this.layoutRefs.contentGrid) return undefined;

      // Recursively find the top-left panel in a grid
      const findTopLeftPanelInGrid = (gridId: string): string | undefined => {
        try {
          const grid = this.ttabs.getGrid(gridId);
          if (!grid || grid.rows.length === 0) return undefined;

          // Get the first row
          const firstRowId = grid.rows[0];
          const firstRow = this.ttabs.getRow(firstRowId);
          if (!firstRow || firstRow.columns.length === 0) return undefined;

          // Get the first column
          const firstColId = firstRow.columns[0];
          const firstCol = this.ttabs.getColumn(firstColId);
          if (!firstCol || !firstCol.child) return undefined;

          // Get the child tile
          const childId = firstCol.child;
          const child = this.ttabs.getTile(childId);

          if (!child) return undefined;

          // If child is a panel, we found our top-left panel
          if (child.type === 'panel') {
            return childId;
          }
          // If child is a grid, recursively search within it
          else if (child.type === 'grid') {
            return findTopLeftPanelInGrid(childId);
          }

          return undefined;
        } catch (error) {
          console.error(`Error finding top-left panel in grid ${gridId}:`, error);
          return undefined;
        }
      };

      return findTopLeftPanelInGrid(this.layoutRefs.contentGrid);
    } catch (e) {
      console.error('Error in findTopLeftPanelId:', e);
      return undefined;
    }
  }

  private _updateSidebarToggleVisibility(): void {
    const allPanels = Object.values(this.ttabs.getTiles())
      .filter((tile) => tile.type === 'panel');

    const firstPanelId = this._findTopLeftPanelId();

    allPanels.forEach(panel => {
      if (panel.id === firstPanelId && !this.sidebar.isOpen) {
        panel.leftComponents = [{ componentId: 'sidebarToggle' }];
      } else {
        panel.leftComponents = [];
      }
    });

    for (const panel of allPanels) {
      this.ttabs.updateTile(panel.id, panel);
    }
  }

  private _updateTabBarComponents(): void {
    const tabBarComponentId = 'tabBarNewThreadButton';
    const panels = Object.values(this.ttabs.getTiles())
      .filter((tile): tile is TilePanelState => tile.type === 'panel');

    for (const panel of panels) {
      const components = panel.tabBarComponents ?? [];
      const hasTabButton = components.some(
        (component) => component.componentId === tabBarComponentId
      );

      if (!hasTabButton) {
        this.ttabs.updateTile(panel.id, {
          tabBarComponents: [...components, { componentId: tabBarComponentId }]
        });
      }
    }
  }

  private _findAndUpdateLayoutRefs(): void {
    // Find the sidebar column
    const tiles = this.ttabs.getTiles();

    // Find sidebar component
    const sidebarTiles = Object.values(tiles).filter(tile =>
      tile.type === 'content' && tile.componentId === 'sidebar'
    );

    if (sidebarTiles.length > 0) {
      const sidebarTile = sidebarTiles[0];
      if (sidebarTile.parent) {
        // Update the sidebar column reference
        this.layoutRefs.sidebarColumn = sidebarTile.parent;

        // Find the content grid (sibling column's child grid)
        const sidebarParent = tiles[sidebarTile.parent]?.parent;
        if (sidebarParent) {
          const row = tiles[sidebarParent];
          if (row && row.type === 'row') {
            // Find the other column in this row (not the sidebar column)
            const otherColumns = row.columns.filter(colId => colId !== sidebarTile.parent);
            if (otherColumns.length > 0) {
              const contentColumn = tiles[otherColumns[0]];
              if (contentColumn && contentColumn.type === 'column' && contentColumn.child) {
                const childTile = tiles[contentColumn.child];
                if (childTile && childTile.type === 'grid') {
                  // Found the content grid
                  this.layoutRefs.contentGrid = childTile.id;
                }
              }
            }
          }
        }
      }
    }

    this._updateHoverSidebarState();
    this._updateSidebarToggleVisibility();
    this._updateTabBarComponents();
  }

  public setupDefaultLayout(tt: TTabs): void {
    tt.resetTiles();
    const root = tt.addGrid();
    const row = tt.addRow(root);
    this.layoutRefs.sidebarColumn = tt.addColumn(row, "0px");
    tt.setComponent(this.layoutRefs.sidebarColumn, 'sidebar');
    const parentColumn = tt.addColumn(row);
    this.layoutRefs.contentGrid = tt.addGrid(parentColumn);
    tt.updateTile(this.layoutRefs.contentGrid, { dontClean: true });
  }

  private _findTabByTreeId(treeId: string): string | undefined {
    // Search through all content tiles to find one with the matching treeId
    for (const tileId in this.ttabs.tiles) {
      const tile = this.ttabs.tiles[tileId];
      if (tile.type === 'tab') {
        const content = this.ttabs.getTabContent(tile.id);
        if (
          content?.componentId === 'chat' &&
          content?.data?.componentProps?.treeId === treeId
        ) {
          return tile.id;
        }
      }
    }
    return undefined;
  }

  private _findTabByFileRef(treeId: string, vertexId: string): string | undefined {
    for (const tileId in this.ttabs.tiles) {
      const tile = this.ttabs.tiles[tileId];
      if (tile.type === 'tab') {
        const content = this.ttabs.getTabContent(tile.id);
        if (
          content?.componentId === 'fileViewer' &&
          content?.data?.componentProps?.treeId === treeId &&
          content?.data?.componentProps?.vertexId === vertexId
        ) {
          return tile.id;
        }
      }
    }
    return undefined;
  }

  private _isPanel(tileId: string): boolean {
    const tile = this.ttabs.getTile(tileId);
    return Boolean(tile && tile.type === 'panel');
  }
}
