# Persistence layers in SpaceManager

## Purpose

SpaceManager loads and saves a space through one or more persistence layers.
A layer stores RepTree operations and optional secrets.

## How layers are chosen

The client creates layers from the workspace URI.
Examples:

- `local://` uses IndexedDB only.
- `file:///path` uses IndexedDB + filesystem.
- `https://` will add a server layer later.

See `createPersistenceLayersForURI` for the mapping.

## How loading works

SpaceManager connects all layers in parallel.
It builds a space from the first layer that returns operations.
It then merges operations from other layers that succeed.

This keeps startup fast while still converging state.
If all layers fail, the space load fails.

## How saving works

SpaceManager writes new operations to every active layer.
If a layer stops working, the remaining layers still persist data.

## Implications

- Use more than one layer for redundancy.
- A fast layer makes startup faster.
- A slow or failing layer should not block the workspace.

## Adding a new layer

Implement the `PersistenceLayer` interface.
Register it in the URI mapping.

Server sync is a new layer that can:

- Fetch ops on load.
- Push local ops to the server.
- Listen for remote ops and merge them.

Add it next to IndexedDB so offline still works.
