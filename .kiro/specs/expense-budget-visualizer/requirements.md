# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, manage budgets, and visualize spending patterns through an intuitive, minimal interface. Built with HTML, CSS, and Vanilla JavaScript, it runs entirely in the browser with all data persisted via the Local Storage API - no backend server or external dependencies required. The application supports five core interactive features: custom expense categories, monthly summary views, transaction sorting, spending-limit highlights, and a dark/light mode toggle.

---

## Glossary

- **App**: The Expense and Budget Visualizer web application running in the user's browser.
- **Transaction**: A single recorded expense entry consisting of a name, amount, date, and category.
- **Category**: A user-defined or default label used to group transactions (e.g., Food, Transport).
- **Budget_Limit**: A numeric spending threshold set by the user for a given category or overall monthly spend.
- **Monthly_Summary**: An aggregated view of total spending and per-category breakdowns for a selected calendar month.
- **Local_Storage**: The browser's Local Storage API used to persist all application data client-side.
- **Transaction_List**: The rendered list of all transactions currently visible in the UI.
- **Chart**: A visual representation (bar or pie) of spending data rendered on an HTML canvas element.
- **Theme**: The active color scheme of the App, either "light" or "dark".
- **Sort_Order**: The current ordering applied to the Transaction_List, either by amount (ascending/descending) or by category (alphabetical).

---

## Requirements

### Requirement 1: Add and Manage Transactions

**User Story:** As a user, I want to add, view, and delete expense transactions, so that I can maintain an accurate record of my spending.

#### Acceptance Criteria

1. THE App SHALL provide a form with fields for transaction name (1-100 characters), amount (numeric, between 0.01 and 999,999,999.99 inclusive), date (not in the future), and category (selected from a predefined list).
2. WHEN the user submits the transaction form with all valid fields filled, THE App SHALL save the transaction to Local_Storage and display it in the Transaction_List within 500 milliseconds without requiring a page reload.
3. IF the user submits the transaction form with any required field empty, THEN THE App SHALL display an inline validation error message identifying each empty field and SHALL NOT save the transaction.
4. IF the user submits the transaction form with an amount that is not numeric, is zero, is negative, or exceeds 999,999,999.99, THEN THE App SHALL display an inline validation error on the amount field and SHALL NOT save the transaction.
5. WHEN the user activates the delete control for a transaction, THE App SHALL display a confirmation prompt before removing the transaction.
6. IF the user confirms deletion, THEN THE App SHALL remove that transaction from Local_Storage and remove it from the Transaction_List within 500 milliseconds.
7. WHEN the App loads in the browser, THE App SHALL retrieve all previously saved transactions from Local_Storage and render them in the Transaction_List within 1000 milliseconds of the page load event.
8. IF Local_Storage is unavailable when the App attempts to load transactions, THEN THE App SHALL display an error notification informing the user that saved data could not be retrieved and SHALL render an empty Transaction_List.

---

### Requirement 2: Custom Categories

**User Story:** As a user, I want to create and manage custom expense categories, so that I can organise transactions in a way that reflects my personal spending habits.

#### Acceptance Criteria

1. THE App SHALL provide a set of default categories (e.g., Food, Transport, Entertainment, Health, Other) available to all users on first load.
2. WHEN the user submits a new category name that is non-empty, not a duplicate of an existing category (case-insensitive), and does not exceed 50 characters, THE App SHALL add the category to the category list, persist it in Local_Storage, and make it immediately available in the transaction form's category selector.
3. IF the user submits a category name that is empty or already exists (case-insensitive), THEN THE App SHALL display an inline validation error below the category name input field and SHALL NOT create a duplicate category.
4. IF the user submits a category name that exceeds 50 characters, THEN THE App SHALL display an inline validation error below the category name input field and SHALL NOT create the category.
5. WHEN the user deletes a category that has no associated transactions, THE App SHALL remove the category from Local_Storage and from the category selector.
6. IF the user attempts to delete a category that has one or more associated transactions, THEN THE App SHALL display a warning message indicating that all associated transactions must be reassigned or deleted before the category can be removed, and SHALL NOT delete the category.
7. WHEN the App loads, THE App SHALL retrieve all user-created categories from Local_Storage, merge them with the default categories by treating any user-created category whose name matches a default category name (case-insensitive) as the same entry without duplication, and render the combined list in the category selector.

---

### Requirement 3: Monthly Summary View

**User Story:** As a user, I want to view a summary of my spending grouped by month, so that I can understand my financial patterns over time.

#### Acceptance Criteria

1. THE App SHALL provide a month/year selector listing all months for which at least one transaction exists, ordered reverse-chronologically (most recent first).
2. WHEN the user selects a month, THE App SHALL display the total amount spent during that month (summing all transactions in that month) and a per-category breakdown showing each category name and its total spend for that month; categories with zero spend in the selected month SHALL NOT appear in the breakdown.
3. WHEN the user selects a month, THE App SHALL render a Chart showing the per-category spending distribution for that month; each category segment SHALL be labelled with the category name and its percentage of the total spend.
4. IF no transactions exist for the selected month, THEN THE App SHALL display a message indicating no data is available for that period and SHALL render the Chart as empty with a visible "No data" label.
5. THE App SHALL default to displaying the current calendar month on initial load, showing an empty state message and placeholder Chart if no transactions exist for the current month.

---

### Requirement 4: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or category, so that I can quickly find and compare specific expenses.

#### Acceptance Criteria

1. THE App SHALL provide sort controls that allow the user to sort the Transaction_List by amount ascending, amount descending, or category name alphabetically (A-Z, case-insensitive); when two transactions have equal amounts, THE App SHALL order them by date descending as a tie-breaker.
2. WHEN the user selects a Sort_Order, THE App SHALL re-render the Transaction_List in the chosen order without modifying the underlying transaction data in Local_Storage.
3. WHEN a new transaction is added WHILE a Sort_Order is active, THE App SHALL insert the new transaction into the Transaction_List at the position that maintains the current Sort_Order.
4. WHEN a transaction is deleted WHILE a Sort_Order is active, THE App SHALL re-render the remaining Transaction_List in the current Sort_Order.
5. THE App SHALL persist the last selected Sort_Order to Local_Storage so that it is restored on the next App load; IF no Sort_Order has been previously saved, THEN THE App SHALL default to amount ascending order.

---

### Requirement 5: Spending Limit Highlights

**User Story:** As a user, I want to set a spending limit per category and receive a visual alert when I exceed it, so that I can stay within my budget.

#### Acceptance Criteria

1. THE App SHALL provide an input for the user to set a numeric Budget_Limit for each category, accepting values between 0.01 and 999,999,999.99 inclusive.
2. WHEN a valid Budget_Limit is saved for a category, THE App SHALL persist it in Local_Storage and associate it with that category.
3. WHILE the total spending for a category in the current month meets or exceeds the category's Budget_Limit, THE App SHALL visually highlight that category in the Monthly_Summary in a manner that is visually distinguishable from non-highlighted categories.
4. WHILE the total spending for a category in the current month meets or exceeds the category's Budget_Limit, THE App SHALL display a text warning alongside the highlighted category stating that the spending limit has been reached.
5. IF the user has not set a Budget_Limit for a category, THEN THE App SHALL display no highlight or warning for that category regardless of its total spend.
6. WHEN spending for a category drops below its Budget_Limit (e.g., after a transaction is deleted), THE App SHALL remove the highlight and warning for that category within 1 second.
7. IF the user submits a Budget_Limit value that is non-numeric, zero, negative, or exceeds 999,999,999.99, THEN THE App SHALL display an inline validation error on the Budget_Limit input and SHALL NOT save the invalid value.

---

### Requirement 6: Dark / Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light display modes, so that I can use the App comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a toggle control that switches the active Theme between "light" and "dark", where the control visually indicates the currently active Theme at all times.
2. WHEN the user activates the theme toggle, THE App SHALL apply the corresponding Theme to all UI elements within 300 milliseconds without requiring a page reload.
3. THE App SHALL persist the user's chosen Theme in Local_Storage so that it is restored on the next App load within 500 milliseconds of the App's initial render.
4. WHEN the App loads with a valid Theme value stored in Local_Storage, THE App SHALL apply that stored Theme instead of the operating system color scheme preference.
5. WHEN the App loads for the first time with no stored Theme preference, THE App SHALL apply the Theme that matches the user's operating system color scheme preference via the prefers-color-scheme media query.
6. IF the App loads with no stored Theme preference and the operating system color scheme preference is unavailable, THEN THE App SHALL apply the "light" Theme as the default.
7. WHILE the "dark" Theme is active, THE App SHALL maintain a minimum contrast ratio of 4.5:1 for normal text (below 18pt or 14pt bold) and 3:1 for large text (18pt or above, or 14pt bold or above) on all text and interactive elements, in compliance with WCAG 2.1 AA standards.
8. WHILE the "light" Theme is active, THE App SHALL maintain a minimum contrast ratio of 4.5:1 for normal text (below 18pt or 14pt bold) and 3:1 for large text (18pt or above, or 14pt bold or above) on all text and interactive elements, in compliance with WCAG 2.1 AA standards.

---

### Requirement 7: Data Persistence and Storage

**User Story:** As a user, I want my data to be saved automatically, so that I do not lose my transactions or settings when I close or refresh the browser.

#### Acceptance Criteria

1. THE App SHALL use only the browser Local_Storage API for all data persistence; no server-side storage or external API calls SHALL be made.
2. WHEN any transaction, category, Budget_Limit, Sort_Order, or Theme setting is created, updated, or deleted, THE App SHALL write the updated state to Local_Storage before rendering the resulting UI change.
3. IF Local_Storage is unavailable or throws an error during a write operation, THEN THE App SHALL retain the current in-memory state without rolling back the user action and SHALL display an error notification informing the user that the change could not be persisted.
4. THE App SHALL store all data as a single JSON-serialisable structure within Local_Storage, and IF the stored value cannot be parsed as valid JSON on read, THEN THE App SHALL discard the corrupted value, initialise the App with empty default state, and display an error notification informing the user that saved data could not be loaded.
5. WHEN the App initialises, THE App SHALL read all persisted data from Local_Storage and restore transactions, categories, Budget_Limits, Sort_Order, and Theme settings to their last saved state before rendering the main UI.

---

### Requirement 8: Performance and Compatibility

**User Story:** As a user, I want the App to load quickly and work reliably in my browser, so that I can access my expense data without delay or errors.

#### Acceptance Criteria

1. THE App SHALL load and become interactive - defined as all navigation controls, form inputs, and action buttons accepting user input with no loading indicators remaining - in modern browsers (Chrome, Firefox, Edge, Safari - latest two major versions) using only a single HTML file, a single CSS file inside css/, and a single JavaScript file inside js/.
2. WHEN the App loads with fewer than 1,000 stored transactions, THE App SHALL render the full Transaction_List and Monthly_Summary - defined as all transaction rows and summary values present in the DOM and visually painted - within 500 milliseconds of the page load event completing.
3. THE App SHALL produce no JavaScript console errors during the following operations across all supported browsers: initial page load, adding a transaction, editing a transaction, deleting a transaction, and navigating between views.
4. THE App SHALL function as a standalone web application openable directly from the file system (using a file:// URL) without requiring a local server.
