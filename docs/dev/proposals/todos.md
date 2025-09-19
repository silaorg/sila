# TODO Items Analysis and Proposals

This document contains all 44 @TODO comments found in the codebase, prioritized by importance and impact, along with detailed proposals for implementation.

## High Priority (Critical for Core Functionality)

### 1. **Context Menu Detection** - `packages/client/src/lib/comps/ContextMenuHandler.svelte:33`
```typescript
// @TODO: detect if the element has a context menu and show it
```
**Impact**: Core UX functionality - users expect right-click context menus
**Proposal**: 
- Implement element attribute checking for `data-context-menu` or similar
- Create a registry of elements with context menus
- Add event delegation to handle context menu display
- Consider using a context menu provider pattern

### 2. **Message Update Observation** - `packages/core/src/spaces/ChatAppData.ts:125`
```typescript
// @TODO: observe NOT only new messages but also when messages are updated
```
**Impact**: Real-time chat functionality - messages don't update properly
**Proposal**:
- Extend the observation system to track property changes on existing vertices
- Implement a more comprehensive vertex change observer
- Add specific handlers for message content, role, and metadata updates
- Consider using a reactive property system

### 3. **App Configs Data Structure** - `packages/core/src/spaces/AppConfigsData.ts:17`
```typescript
// @TODO: fix this, make sure we do have _c in our configs
```
**Impact**: Data integrity - sorting by creation date fails
**Proposal**:
- Add validation to ensure `_c` (creation timestamp) exists on all configs
- Implement migration logic for existing configs without timestamps
- Add type safety with proper interfaces
- Consider using a more robust timestamp system

### 4. **Space Manager Refactoring** - `packages/core/src/spaces/SpaceManager.ts:26`
```typescript
// @TODO: refactor to put layers in 'spaces' map
```
**Impact**: Architecture - separation of concerns and data consistency
**Proposal**:
- Create a unified Space class that includes both space and persistence layers
- Refactor the Map structure to store complete space objects
- Update all references to use the new structure
- Add proper cleanup and lifecycle management

### 5. **Secrets Management** - `packages/core/src/spaces/persistence/FileSystemPersistenceLayer.ts:476`
```typescript
// @TODO: Implement this
```
**Impact**: Security - secrets not properly saved/managed
**Proposal**:
- Implement secret comparison logic between current and stored secrets
- Add encryption for sensitive data
- Create a secrets management service
- Integrate with SpaceManager for proper secret lifecycle

## Medium Priority (Important for User Experience)

### 6. **Thread Message Reactive Wrapper** - `packages/client/src/lib/comps/apps/ChatAppMessage.svelte:49`
```typescript
// @TODO: try to use reactives ThreadMessage that will wrap the vertex data under the hood
```
**Impact**: Code maintainability and reactivity
**Proposal**:
- Create a TypedVertex<ThreadMessage> class
- Implement reactive property binding
- Add type safety for message properties
- Consider using Svelte 5 runes for better reactivity

### 7. **Thread Operations** - `packages/client/src/lib/comps/popups/AppTreeOptionsPopup.svelte:14,19,24`
```typescript
// @TODO: implement renaming
// @TODO: implement opening in new tab
// @TODO: implement duplication
```
**Impact**: User workflow efficiency
**Proposal**:
- Implement thread renaming with validation and conflict resolution
- Add new tab functionality using the existing tab system
- Create thread duplication with proper ID generation
- Add undo/redo support for these operations

### 8. **Space Duplication** - `packages/client/src/lib/comps/popups/SpaceOptionsPopup.svelte:27`
```typescript
// @TODO: implement duplicate functionality
```
**Impact**: User productivity
**Proposal**:
- Implement space copying with file system operations
- Handle space metadata and configuration copying
- Add progress indication for large spaces
- Consider implementing space templates

### 9. **Path Handling** - `packages/client/src/lib/comps/spaces/SpaceOpener.svelte:59`
```typescript
// @TODO: should I handle path as array or string?
```
**Impact**: API consistency and usability
**Proposal**:
- Standardize on string paths for simplicity
- Add path validation and normalization
- Consider supporting both formats with conversion utilities
- Document the path format requirements

### 10. **Agent Input/Output Generics** - `packages/core/src/agents/Agent.ts:23`
```typescript
// @TODO: consider making input and output generic
```
**Impact**: Type safety and code reusability
**Proposal**:
- Make Agent class generic with input/output type parameters
- Update all agent implementations to use proper typing
- Add validation for input/output types
- Consider using discriminated unions for different agent types

## Medium-Low Priority (Code Quality and Architecture)

### 11. **Model Selection Logic** - `packages/core/src/agents/AgentServices.ts:153`
```typescript
// @TODO: consider picking the most capable model from the list
```
**Impact**: AI model optimization
**Proposal**:
- Implement model capability scoring system
- Add model performance metrics
- Create model selection strategy (cost vs capability)
- Add user preferences for model selection

### 12. **Localization** - `packages/core/src/agents/SimpleChatAgent.ts:23`
```typescript
// @TODO: move this to localized texts file
```
**Impact**: Internationalization support
**Proposal**:
- Extract hardcoded strings to localization files
- Implement proper i18n system
- Add language detection and switching
- Create translation management workflow

### 13. **System Prompt Clarity** - `packages/core/src/agents/SimpleChatAgent.ts:31`
```typescript
// @TODO: make it clear for the LLM.
```
**Impact**: AI response quality
**Proposal**:
- Improve system prompt structure and clarity
- Add context about the application and user intent
- Implement dynamic prompt generation based on context
- Add prompt versioning and A/B testing

### 14. **TypedVertex Implementation** - `packages/core/src/apps/ChatAppBackend.ts:105,106`
```typescript
// @TODO: consider making TypedVertex<ThreadMessage> that can be used to set properties
// @TODO: or consider just having data.updateMessage(message)
```
**Impact**: Type safety and API consistency
**Proposal**:
- Implement TypedVertex<T> generic class
- Add type-safe property setters
- Create updateMessage method with proper validation
- Consider using builder pattern for message updates

### 15. **Client State Optimization** - `packages/client/src/lib/state/clientState.svelte.ts:44,47,65`
```typescript
// @TODO: consider making it a derived state
// @TODO: can we get rid of them and instead rely on _spaceStates?
// @TODO: consider to remove these and just use the status directly
```
**Impact**: Performance and state management
**Proposal**:
- Refactor to use derived states where appropriate
- Consolidate state management into _spaceStates
- Remove redundant state properties
- Implement proper state lifecycle management

## Low Priority (Nice to Have)

### 16. **Mobile Setup Simplification** - `packages/mobile/README.md:3`
```typescript
@TODO: we need to change it to a simpler setup of just Svelte without SvelteKit
```
**Impact**: Development complexity
**Proposal**:
- Migrate from SvelteKit to plain Svelte
- Update build configuration
- Simplify routing and state management
- Update documentation and examples

### 17. **Vertex Property Search** - `packages/core/src/spaces/Space.ts:160`
```typescript
// @TODO: make part of Vertex
```
**Impact**: API organization
**Proposal**:
- Move findObjectWithPropertyAtPath to Vertex class
- Add more search methods to Vertex
- Implement indexing for better performance
- Add query builder for complex searches

### 18. **Tab Management Optimization** - `packages/client/src/lib/comps/sidebar/VertexItem.svelte:35`
```typescript
// @TODO: consider having an array of open tabs in ttabs so it's cheaper to check
```
**Impact**: Performance optimization
**Proposal**:
- Implement tab array in ttabs for O(1) lookups
- Add tab state management
- Optimize tab switching performance
- Add tab lifecycle events

### 19. **Space Validation** - `packages/core/src/spaces/Space.ts:71`
```typescript
// @TODO: or perhaps a migration should be here
```
**Impact**: Data migration and validation
**Proposal**:
- Implement space structure migration system
- Add version tracking for spaces
- Create migration scripts for different versions
- Add rollback capabilities

### 20. **Model Provider Final Properties** - `packages/core/src/apps/ChatAppBackend.ts:152`
```typescript
// @TODO: huh, do we need this? I don't think so.
```
**Impact**: Data model cleanup
**Proposal**:
- Remove redundant modelProviderFinal and modelIdFinal properties
- Update all references to use the non-final versions
- Add proper data model documentation
- Consider using immutable snapshots instead

## Documentation and Testing TODOs

### 21. **New Thread UI** - `packages/client/src/lib/ttabs/components/NoTabsContent.svelte:66`
```typescript
@TODO: add new thread here
```
**Impact**: User onboarding
**Proposal**:
- Implement new thread creation UI
- Add thread templates and presets
- Create guided onboarding flow
- Add thread import functionality

### 22. **Server Connection** - `packages/client/src/lib/state/clientState.svelte.ts:159`
```typescript
// @TODO: implement connection to server
```
**Impact**: Multi-device sync
**Proposal**:
- Implement WebSocket connection to server
- Add real-time synchronization
- Handle connection state management
- Add offline/online mode switching

### 23. **Authentication Implementation** - `packages/client/src/lib/state/clientState.svelte.ts:311,319`
```typescript
// TODO: Implement when auth is needed
```
**Impact**: User management and security
**Proposal**:
- Implement user authentication system
- Add user profile management
- Create space sharing and permissions
- Add audit logging

### 24. **Current Space Update Method** - `packages/client/src/lib/state/clientState.svelte.ts:352`
```typescript
// @TODO: not sure if we need this
```
**Impact**: Code cleanup
**Proposal**:
- Evaluate if _updateCurrentSpace is needed
- Remove if redundant
- Document space selection logic
- Add proper state transition handling

### 25. **Agent Input Specificity** - `packages/core/src/agents/ThreadTitleAgent.ts:7`
```typescript
// @TODO: decide if I can make input more specific for agents
```
**Impact**: Type safety
**Proposal**:
- Create specific input types for each agent
- Add input validation
- Implement agent-specific input processing
- Add input transformation utilities

## Remaining TODOs (26-44)

### 26. **App Config ID Resolution** - `packages/core/src/spaces/AppConfigsData.ts:24`
```typescript
// @TODO: answer: should I resolve 'id' into vertex id? And same for _n to 'name'?
```

### 27. **Generic Data Class** - `packages/core/src/spaces/AppConfigsData.ts:26`
```typescript
// @TODO: could it be based on a generic data class? SpaceArray<T>(rootVertex: Vertex)
```

### 28. **Automatic Config Addition** - `packages/core/src/spaces/AppConfigsData.ts:52`
```typescript
// @TODO: consider adding automatically
```

### 29. **Config ID Requirement** - `packages/core/src/spaces/AppConfigsData.ts:54`
```typescript
// @TODO: Require ID
```

### 30. **Temporary Update Callbacks** - `packages/core/src/spaces/ChatAppData.ts:14`
```typescript
// @TODO temporary: support update callback for message edits/branch switching
```

### 31. **Temporary Message Updates** - `packages/client/src/lib/comps/apps/ChatApp.svelte:88`
```typescript
// @TODO temporary: subscribe to message updates for edits/branch switching
```

### 32. **Temporary Update Notification** - `packages/core/src/spaces/ChatAppData.ts:380`
```typescript
// @TODO temporary: notify subscribers of message update for branch change
```

### 33. **Vision Capability Check** - `packages/core/src/agents/SimpleChatAgent.ts:47`
```typescript
// TODO: Check Lang.models using the model id and, if in our DB, verify vision capability.
```

### 34. **Modal Bindable Fix** - `packages/client/src/lib/comps/popups/PopupWindow.svelte:20`
```typescript
<!-- TODO: fix bindable, so it's pssible to re-open the modal -->
```

### 35. **Illegal Move Detection** - `packages/client/src/lib/comps/trees/TreeBlockViz.svelte:24`
```typescript
// TODO: detect illigal moves and show it (or at least don't higlight the vertex when it's not allowed to move a vertex in)
```

### 36. **Documentation TODOs** - Various documentation files
- `docs/how-to/use-ai.md:5` - Examples for each
- `docs/how-to/setup-providers/README.md:8` - Other providers
- `docs/features/import-from-chatgpt.md:5` - Implement in Sila
- `docs/getting-started.md:8` - Video
- `docs/dev/testing.md:160` - Missing documentation

### 37. **RTL Support** - `packages/core/src/localization/ai-generated/arabicTexts.ts:3`
```typescript
// TODO: This file requires RTL (Right-to-Left) support in the UI
```

### 38. **Migration Functions** - `packages/core/src/spaces/persistence/FileSystemPersistenceLayer.ts:580`
```typescript
// TODO: Implement migration functions later
```

## Implementation Priority Recommendations

1. **Immediate (Next Sprint)**: Items 1-5 (High Priority)
2. **Short Term (1-2 Sprints)**: Items 6-15 (Medium Priority)
3. **Medium Term (2-4 Sprints)**: Items 16-25 (Medium-Low Priority)
4. **Long Term (Future Releases)**: Items 26-44 (Low Priority and Documentation)

## Success Metrics

- **Code Quality**: Reduced technical debt and improved maintainability
- **User Experience**: Better performance and more intuitive interactions
- **Developer Experience**: Cleaner APIs and better type safety
- **System Reliability**: Proper error handling and data validation

## Notes

- All 44 @TODO comments have been accounted for in this document
- Priority is based on impact on core functionality, user experience, and technical debt
- Some items may be combined or split during implementation
- Regular review of this document is recommended as the codebase evolves