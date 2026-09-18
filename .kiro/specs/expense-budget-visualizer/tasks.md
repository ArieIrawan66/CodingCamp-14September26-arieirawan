# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a fully client-side expense tracker as three flat files — `index.html`, `css/style.css`, and `js/app.js` — with no build step, no npm, and no external dependencies. All business logic lives in `app.js` organised into 12 labelled sections; data is persisted as a single JSON blob in `localStorage["ebv_data"]`. The implementation follows a unidirectional data flow: User Action → Controller → State Mutation → Storage Write → View Render.

## Tasks

- [x] 1. Scaffold the project file structure and static HTML skeleton
  - Create `index.html` with semantic HTML5 boilerplate: `<html data-theme>`, `<head>` with viewport/charset meta, link to `css/style.css`, and a `<script src="js/app.js" defer>` tag
  - Add all static section containers: `#app-header` (with theme toggle button), `#transaction-form` (name, amount, date, category inputs + submit), `#category-manager` (add-category form + list), `#transaction-list` section, `#monthly-summary` section (month selector, total, per-category breakdown, canvas `#chart`), `#budget-limits` section
  - Pre-render all inline validation `<span role="alert">` elements adjacent to each form field (hidden by default via CSS class)
  - Create `css/` and `js/` directories; create empty `css/style.css` and `js/app.js`
  - _Requirements: 8.1_

- [x] 2. Implement CSS custom properties, themes, and base layout
  - [x] 2.1 Define CSS custom properties for both themes in `style.css`
    - Declare `[data-theme="light"]` and `[data-theme="dark"]` variable sets covering background, surface, text, border, accent, error, and warning colours
    - Ensure all colour pairs meet WCAG 2.1 AA contrast ratios (4.5:1 normal text, 3:1 large text) in both themes
    - _Requirements: 6.7, 6.8_
  - [x] 2.2 Implement layout, component, and state styles
    - Style all form elements, the transaction list table/rows, the monthly summary card, budget limit inputs, the canvas chart container, and the theme toggle button
    - Add `.has-error` class rule to show validation `<span role="alert">` elements
    - Add `.budget-exceeded` highlight class used by the budget warning feature
    - Add `.theme-toggle--dark` / `.theme-toggle--light` indicator states
    - _Requirements: 5.3, 5.4, 6.1_

- [x] 3. Implement CONSTANTS and STATE sections in `app.js`
  - [x] 3.1 Write the CONSTANTS section
    - Define `STORAGE_KEY = "ebv_data"`, `MAX_AMOUNT = 999_999_999.99`, `MAX_NAME_LEN = 100`, `MAX_CATEGORY_NAME_LEN = 50`, and the five default categories array: `[{ id: 'food', name: 'Food', isDefault: true }, …]` (Food, Transport, Entertainment, Health, Other)
    - Define the `SORT_ORDERS` enum and the chart colour palette array
    - _Requirements: 1.1, 2.1, 4.5_
  - [x] 3.2 Write the STATE section
    - Define the `AppState` object shape: `{ transactions: [], categories: [], budgetLimits: {}, sortOrder: 'amountAsc', theme: 'light', selectedMonth: '' }`
    - Initialise `selectedMonth` to the current `'YYYY-MM'` value using `new Date()`
    - _Requirements: 4.5, 6.6, 7.5_

- [x] 4. Implement STORAGE module in `app.js`
  - [x] 4.1 Write `StorageModule.isAvailable()`, `StorageModule.save()`, and `StorageModule.load()`
    - `isAvailable`: probe `localStorage` with a test write/delete; return `boolean`
    - `save(state)`: `JSON.stringify` the full `AppState` and write to `localStorage[STORAGE_KEY]`; catch `QuotaExceededError` / `SecurityError` and call `RenderModule.showNotification` with the error message
    - `load()`: read and `JSON.parse` `localStorage[STORAGE_KEY]`; return `null` if key absent, storage unavailable, or JSON is invalid (catch parse errors)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 4.2 Write property test for AppState JSON round-trip (Property 16)
    - **Property 16: App State JSON Round-Trip**
    - **Validates: Requirements 7.4**
    - In `tests/property.test.html`, using fast-check: generate an arbitrary `AppState` composed of valid transactions, categories, budgetLimits, sortOrder, and theme; assert `JSON.parse(JSON.stringify(state))` deeply equals the original
    - Tag comment: `// Feature: expense-budget-visualizer, Property 16`

- [x] 5. Implement VALIDATION module in `app.js`
  - [x] 5.1 Write `ValidationModule.validateTransaction(fields)`
    - Validate `name`: non-empty, ≤ 100 chars; `amount`: numeric, between 0.01 and 999,999,999.99 inclusive; `date`: valid ISO date not in the future; `categoryId`: non-empty string
    - Return `{ valid: boolean, errors: { name?, amount?, date?, categoryId? } }`
    - _Requirements: 1.3, 1.4_
  - [x] 5.2 Write `ValidationModule.validateCategory(name, existingCategories)` and `ValidationModule.validateBudgetLimit(value)`
    - `validateCategory`: non-empty, ≤ 50 chars, not a case-insensitive duplicate of any name in `existingCategories`
    - `validateBudgetLimit`: numeric, between 0.01 and 999,999,999.99 inclusive
    - _Requirements: 2.3, 2.4, 5.7_
  - [ ]* 5.3 Write property test for invalid transaction rejection (Property 2)
    - **Property 2: Invalid Transaction Rejection**
    - **Validates: Requirements 1.3, 1.4**
    - Generate arbitraries for each invalid field combination (empty name, out-of-range amount, future date); assert `validateTransaction` returns `valid: false` for every case
    - Tag comment: `// Feature: expense-budget-visualizer, Property 2`
  - [ ]* 5.4 Write property test for category duplicate rejection (Property 5)
    - **Property 5: Category Duplicate Rejection**
    - **Validates: Requirements 2.3, 2.4**
    - Draw a category name from the existing list with random casing; assert `validateCategory` returns `valid: false`
    - Tag comment: `// Feature: expense-budget-visualizer, Property 5`
  - [ ]* 5.5 Write property test for budget limit validation (Property 14)
    - **Property 14: Budget Limit Validation**
    - **Validates: Requirements 5.7**
    - Generate values in `[0.01, 999999999.99]` → assert `valid: true`; generate zero, negative, above-max, and non-numeric strings → assert `valid: false`
    - Tag comment: `// Feature: expense-budget-visualizer, Property 14`

- [x] 6. Implement TRANSACTIONS module in `app.js`
  - [x] 6.1 Write `TransactionModule.add(state, fields)` and `TransactionModule.delete(state, transactionId)`
    - `add`: generate `id` via `crypto.randomUUID()` with `Date.now().toString()` fallback; return new state (do not mutate argument) with transaction appended
    - `delete`: return new state with the matching transaction removed
    - _Requirements: 1.2, 1.6_
  - [x] 6.2 Write `TransactionModule.getForMonth(state, year, month)`
    - Filter `state.transactions` where `transaction.date.slice(0, 7) === \`${year}-${String(month).padStart(2,'0')}\``
    - Return new array; do not mutate
    - _Requirements: 3.1, 3.2_
  - [ ]* 6.3 Write property test for transaction add round-trip (Property 1)
    - **Property 1: Transaction Add Round-Trip**
    - **Validates: Requirements 1.2, 7.2**
    - Generate valid transaction fields; call `TransactionModule.add`; assert the transaction appears in `getForMonth` for its month AND in state returned by `StorageModule.load()` after `StorageModule.save()`
    - Tag comment: `// Feature: expense-budget-visualizer, Property 1`
  - [ ]* 6.4 Write property test for transaction deletion (Property 3)
    - **Property 3: Transaction Deletion Removes from State**
    - **Validates: Requirements 1.6**
    - Generate a state with ≥1 transaction; pick a random index; call `delete`; assert the id is absent and `transactions.length` is exactly one less
    - Tag comment: `// Feature: expense-budget-visualizer, Property 3`

- [x] 7. Implement CATEGORIES module in `app.js`
  - [x] 7.1 Write `CategoryModule.getAll(state)`, `CategoryModule.add(state, name)`, and `CategoryModule.delete(state, categoryId)`
    - `getAll`: merge `DEFAULT_CATEGORIES` with `state.categories`; deduplicate case-insensitively (user-created wins if names clash); always include all five defaults
    - `add`: generate UUID for id; append to `state.categories`; return new state
    - `delete`: throw if any transaction in `state.transactions` references the `categoryId`; otherwise return new state with category removed
    - _Requirements: 2.1, 2.2, 2.5, 2.6_
  - [ ]* 7.2 Write property test for category add round-trip (Property 4)
    - **Property 4: Category Add Round-Trip**
    - **Validates: Requirements 2.2, 2.7**
    - Generate a valid unique category name; call `add` + `save` + `load`; assert name is present in `getAll` of the reloaded state
    - Tag comment: `// Feature: expense-budget-visualizer, Property 4`
  - [ ]* 7.3 Write property test for category delete guard (Property 6)
    - **Property 6: Category Delete Guard**
    - **Validates: Requirements 2.6**
    - Generate a state with ≥1 transaction referencing a category; attempt `delete`; assert it throws and the category and transactions remain intact
    - Tag comment: `// Feature: expense-budget-visualizer, Property 6`
  - [ ]* 7.4 Write property test for category merge deduplication (Property 7)
    - **Property 7: Category Merge Deduplication**
    - **Validates: Requirements 2.1, 2.7**
    - Generate an array of user category names including default names in random casings; assert `getAll` returns no case-insensitive duplicates and all five defaults are present
    - Tag comment: `// Feature: expense-budget-visualizer, Property 7`

- [x] 8. Checkpoint — Core data modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement SORT module in `app.js`
  - [x] 9.1 Write `SortModule.comparators` and `SortModule.apply(transactions, sortOrder)`
    - Comparators: `amountAsc` (secondary: date desc), `amountDesc` (secondary: date desc), `categoryAz` (case-insensitive name lookup via categories)
    - `apply`: return a **new** sorted array via `[...transactions].sort(comparator)`; never mutate the input
    - _Requirements: 4.1, 4.2_
  - [ ]* 9.2 Write property test for sort correctness and non-destructiveness (Property 10)
    - **Property 10: Sort Correctness and Non-Destructiveness**
    - **Validates: Requirements 4.1, 4.2**
    - Generate an arbitrary transaction array and a random `SortOrder`; assert: same length, same ids, correct ordering per criterion, and input array unchanged
    - Tag comment: `// Feature: expense-budget-visualizer, Property 10`
  - [ ]* 9.3 Write property test for sort invariant after mutation (Property 11)
    - **Property 11: Sort Invariant Preserved After Mutation**
    - **Validates: Requirements 4.3, 4.4**
    - Take a sorted list, add or delete a transaction, re-sort; assert the result equals `SortModule.apply(mutatedList, sortOrder)`
    - Tag comment: `// Feature: expense-budget-visualizer, Property 11`
  - [ ]* 9.4 Write property test for sort order persistence round-trip (Property 12)
    - **Property 12: Sort Order Persistence Round-Trip**
    - **Validates: Requirements 4.5**
    - For each of the three `SortOrder` values, save a state containing it and load it back; assert the same value is restored
    - Tag comment: `// Feature: expense-budget-visualizer, Property 12`

- [x] 10. Implement MONTHLY SUMMARY module in `app.js`
  - [x] 10.1 Write `SummaryModule.aggregate(transactions)` and `SummaryModule.toChartData(summaryData, categoryNames)`
    - `aggregate`: sum all amounts for `total`; build `byCategory` map; omit categories with zero spend
    - `toChartData`: derive `labels`, `values`, and `percentages` (percentages rounded to nearest integer; last slice absorbs floating-point remainder to guarantee sum = 100)
    - _Requirements: 3.2, 3.3_
  - [ ]* 10.2 Write property test for monthly summary aggregation (Property 8)
    - **Property 8: Monthly Summary Aggregation Correctness**
    - **Validates: Requirements 3.2**
    - Generate an arbitrary array of transactions all in the same month; assert `total` equals sum of amounts (within floating-point tolerance) and each `byCategory` value matches the per-category sum
    - Tag comment: `// Feature: expense-budget-visualizer, Property 8`
  - [ ]* 10.3 Write property test for chart percentages sum to 100 (Property 9)
    - **Property 9: Chart Percentages Sum to 100**
    - **Validates: Requirements 3.3**
    - Generate ≥1 positive floats as category totals; call `toChartData`; assert `percentages.reduce((s,v) => s+v, 0) === 100` and each percentage is proportional to its value
    - Tag comment: `// Feature: expense-budget-visualizer, Property 9`

- [x] 11. Implement BUDGET LIMITS module in `app.js`
  - [x] 11.1 Write `BudgetModule.isExceeded(categoryId, summaryData, budgetLimits)` and `BudgetModule.getExceededCategories(summaryData, budgetLimits)`
    - `isExceeded`: return `true` iff `budgetLimits[categoryId]` exists AND `summaryData.byCategory[categoryId] >= budgetLimits[categoryId]`
    - `getExceededCategories`: iterate all keys in `budgetLimits`; collect those where `isExceeded` is true; return as `Set<string>`
    - _Requirements: 5.3, 5.4, 5.5, 5.6_
  - [ ]* 11.2 Write property test for budget limit threshold detection (Property 13)
    - **Property 13: Budget Limit Threshold Detection**
    - **Validates: Requirements 5.3, 5.4, 5.5, 5.6**
    - Generate `{ spend: fc.float({min:0}), limit: fc.float({min:0.01}) }`; assert `isExceeded` returns `true` iff `spend >= limit`; assert `false` when no limit is set for the category
    - Tag comment: `// Feature: expense-budget-visualizer, Property 13`

- [x] 12. Implement THEME module in `app.js`
  - [x] 12.1 Write `ThemeModule.getPreferred()`, `ThemeModule.apply(theme)`, and `ThemeModule.toggle(currentTheme)`
    - `getPreferred`: read `window.matchMedia('(prefers-color-scheme: dark)')`; fall back to `'light'` if API unavailable
    - `apply`: set `document.documentElement.dataset.theme = theme`
    - `toggle`: return `'dark'` if current is `'light'`, else `'light'`
    - _Requirements: 6.1, 6.2, 6.5, 6.6_
  - [ ]* 12.2 Write property test for theme persistence round-trip (Property 15)
    - **Property 15: Theme Persistence Round-Trip**
    - **Validates: Requirements 6.3, 6.4**
    - For each of `'light'` and `'dark'`, save a state containing that theme and load it back; assert the same theme value is restored
    - Tag comment: `// Feature: expense-budget-visualizer, Property 15`

- [x] 13. Checkpoint — All pure-logic modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement RENDER module in `app.js`
  - [x] 14.1 Write `RenderModule.renderTransactionList(transactions, categories)`
    - Clear and rebuild the `#transaction-list` table body from the `transactions` array
    - Each row: name, amount (formatted as currency), date, category name, delete button (calls `window.confirm` before dispatching delete)
    - Show "No transactions yet" placeholder row when array is empty
    - _Requirements: 1.5, 1.7_
  - [x] 14.2 Write `RenderModule.renderMonthlySummary(summaryData, categories, budgetLimits)`
    - Render total spend and per-category breakdown rows
    - Apply `.budget-exceeded` class to any category row where `BudgetModule.isExceeded` returns `true`; render warning text alongside exceeded categories
    - Show "No data for this period" message when `summaryData.total === 0`
    - _Requirements: 3.2, 3.4, 5.3, 5.4, 5.5_
  - [x] 14.3 Write `RenderModule.renderChart(chartData)` using HTML5 Canvas 2D API
    - Draw a pie chart: for each slice, compute start/end angles proportional to `chartData.percentages`, fill with a colour from the palette (cycling), stroke a thin border
    - Draw label text outside each slice: `"{category}: {percentage}%"`
    - Render "No data" centred in the canvas when `chartData.labels` is empty
    - _Requirements: 3.3, 3.4_
  - [x] 14.4 Write remaining render helpers
    - `renderCategorySelector(categories)`: populate the `<select>` in the transaction form and category delete list
    - `renderMonthSelector(availableMonths, selectedMonth)`: populate month/year `<select>` in reverse-chronological order; default to current month
    - `renderBudgetLimitInputs(categories, budgetLimits)`: render one numeric input per category pre-filled with any saved limit
    - `showValidationErrors(errors)` / `clearValidationErrors()`: toggle `.has-error` on each field's wrapper and set the adjacent `<span role="alert">` text
    - `showNotification(message, type)`: insert a dismissible notification banner (`type: 'error' | 'info'`)
    - `applyTheme(theme)`: delegates to `ThemeModule.apply(theme)`
    - _Requirements: 2.1, 3.1, 5.1, 6.1_

- [x] 15. Implement INIT and wire all event handlers in `app.js`
  - [x] 15.1 Write the INIT section — `DOMContentLoaded` bootstrap
    - Call `StorageModule.load()`; if `null`, show error notification and initialise with empty default state
    - Restore `AppState` from loaded data; apply theme via `ThemeModule.apply`
    - Call all initial render functions: `renderCategorySelector`, `renderMonthSelector`, `renderTransactionList` (sorted), `renderMonthlySummary`, `renderChart`, `renderBudgetLimitInputs`
    - _Requirements: 1.7, 6.4, 6.5, 6.6, 7.5_
  - [x] 15.2 Wire transaction form submit handler
    - On submit: call `ValidationModule.validateTransaction`; if invalid, call `showValidationErrors` and return
    - If valid: call `TransactionModule.add`, `StorageModule.save`, re-render transaction list (with active sort applied via `SortModule.apply`), re-render monthly summary and chart
    - _Requirements: 1.2, 1.3, 1.4, 4.3_
  - [x] 15.3 Wire transaction delete handler (event-delegated on the list container)
    - Show `window.confirm`; if confirmed, call `TransactionModule.delete`, `StorageModule.save`, re-render transaction list, monthly summary, and chart
    - _Requirements: 1.5, 1.6, 4.4, 5.6_
  - [x] 15.4 Wire category form submit and delete handlers
    - Add: validate with `validateCategory(name, CategoryModule.getAll(state))`; if valid, `CategoryModule.add`, `StorageModule.save`, re-render category selector and budget limit inputs
    - Delete: call `CategoryModule.delete`; catch throw and call `showNotification` with the "reassign transactions first" warning; if no throw, `StorageModule.save`, re-render
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 15.5 Wire sort control change handler
    - Update `AppState.sortOrder`, `StorageModule.save`, re-render transaction list with new sort order
    - _Requirements: 4.1, 4.2, 4.5_
  - [x] 15.6 Wire month selector change handler
    - Update `AppState.selectedMonth`, `StorageModule.save`, re-render monthly summary and chart
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  - [x] 15.7 Wire budget limit save handlers
    - On change/blur for each budget input: validate with `validateBudgetLimit`; if valid, update `AppState.budgetLimits[categoryId]`, `StorageModule.save`, re-render monthly summary
    - _Requirements: 5.1, 5.2, 5.7_
  - [x] 15.8 Wire theme toggle handler
    - On click: compute new theme via `ThemeModule.toggle`, update `AppState.theme`, `StorageModule.save`, call `ThemeModule.apply`, update toggle button indicator class
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 16. Implement `tests/` directory with fast-check property test scaffold
  - [~] 16.1 Create `tests/property.test.html` — browser-loadable test page
    - Include a local or CDN copy of fast-check via `<script>` tag
    - Include `<script src="../js/app.js">` to import all modules under test (ensure modules are exported or accessible at global scope for testing)
    - Add a minimal test runner harness that prints PASS/FAIL with property name and failing example to the page body
    - _Requirements: 8.3_
  - [ ]* 16.2 Implement all 16 property-based tests inside `tests/property.test.html`
    - Implement Properties 1–16 as described in the individual task sub-tasks above (6.3, 6.4, 5.3–5.5, 7.2–7.4, 9.2–9.4, 10.2–10.3, 11.2, 12.2, 4.2)
    - Each test: minimum 100 iterations, tagged with feature name and property number
    - _Requirements: all_

- [~] 17. Final checkpoint — Full integration verified
  - Ensure all tests pass, ask the user if questions arise.
  - Manually verify `index.html` opens from a `file://` URL in Chrome, Firefox, Edge, and Safari without console errors
  - Verify render completes in < 500 ms with 999 pre-seeded transactions in `localStorage`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All 16 correctness properties from the design are covered by property-based test sub-tasks
- Unit tests (storage unavailable, corrupt JSON, confirm dialog, OS theme, etc.) are bundled in task 16 alongside property tests
- There is no build step — `app.js` must use no ES module syntax that breaks `file://` CORS; use an IIFE or global-scope pattern instead
- fast-check can be loaded via CDN in the test HTML; no npm or Node.js needed for the main project
- Property tests in tasks 4.2, 5.3–5.5, 6.3–6.4, 7.2–7.4, 9.2–9.4, 10.2–10.3, 11.2, 12.2 are all housed in `tests/property.test.html`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "3.2"] },
    { "id": 2, "tasks": ["2.2", "4.1", "5.1", "5.2"] },
    { "id": 3, "tasks": ["4.2", "5.3", "5.4", "5.5", "6.1", "6.2"] },
    { "id": 4, "tasks": ["6.3", "6.4", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.4", "9.1", "10.1", "11.1", "12.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4", "10.2", "10.3", "11.2", "12.2"] },
    { "id": 7, "tasks": ["14.1", "14.2", "14.3", "14.4"] },
    { "id": 8, "tasks": ["15.1"] },
    { "id": 9, "tasks": ["15.2", "15.3", "15.4", "15.5", "15.6", "15.7", "15.8"] },
    { "id": 10, "tasks": ["16.1"] },
    { "id": 11, "tasks": ["16.2"] }
  ]
}
```
