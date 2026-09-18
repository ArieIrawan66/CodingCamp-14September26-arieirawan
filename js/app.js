/* =============================================================
   Expense & Budget Visualizer — app.js
   All application logic will be implemented in Tasks 3–15.

   Sections (to be filled in):
     CONSTANTS
     STATE
     STORAGE
     VALIDATION
     TRANSACTIONS
     CATEGORIES
     SORT
     MONTHLY SUMMARY
     BUDGET LIMITS
     THEME
     RENDER
     INIT
   ============================================================= */

(function () {
  'use strict';

  // =============================================================
  // CONSTANTS
  // =============================================================

  var STORAGE_KEY = 'ebv_data';
  var MAX_AMOUNT = 999999999.99;
  var MAX_NAME_LEN = 100;
  var MAX_CATEGORY_NAME_LEN = 50;

  var DEFAULT_CATEGORIES = [
    { id: 'food',          name: 'Food',          isDefault: true },
    { id: 'transport',     name: 'Transport',     isDefault: true },
    { id: 'entertainment', name: 'Entertainment', isDefault: true },
    { id: 'health',        name: 'Health',        isDefault: true },
    { id: 'other',         name: 'Other',         isDefault: true }
  ];

  var SORT_ORDERS = {
    AMOUNT_ASC:  'amountAsc',
    AMOUNT_DESC: 'amountDesc',
    CATEGORY_AZ: 'categoryAz'
  };

  var CHART_PALETTE = [
    '#4e79a7',
    '#f28e2b',
    '#e15759',
    '#76b7b2',
    '#59a14f',
    '#edc948',
    '#b07aa1',
    '#ff9da7',
    '#9c755f',
    '#bab0ac'
  ];

  // =============================================================
  // STATE
  // =============================================================

  /**
   * Returns the current month as a 'YYYY-MM' string.
   * e.g. new Date() in July 2025 → '2025-07'
   *
   * @returns {string}
   */
  function getCurrentMonthKey() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    return year + '-' + month;
  }

  /**
   * AppState — single in-memory source of truth for the entire application.
   * All mutations go through the controller layer; after each mutation the
   * state is flushed to localStorage and the relevant view is re-rendered.
   *
   * Shape:
   *   transactions  {Transaction[]}   — all recorded expense transactions
   *   categories    {Category[]}      — user-created categories only;
   *                                     defaults are always merged at runtime
   *   budgetLimits  {BudgetLimitMap}  — { [categoryId]: number }
   *   sortOrder     {SortOrder}       — active sort criterion for the list
   *   theme         {'light'|'dark'}  — active colour theme
   *   selectedMonth {string}          — 'YYYY-MM' key for the summary view
   */
  var AppState = {
    transactions:  [],
    categories:    [],
    budgetLimits:  {},
    sortOrder:     SORT_ORDERS.AMOUNT_ASC,
    theme:         'light',
    selectedMonth: getCurrentMonthKey()
  };


  // =============================================================
  // STORAGE
  // =============================================================

  var StorageModule = {

    /**
     * Probes localStorage with a test write/read/delete cycle.
     * Returns true if localStorage is available and writable.
     *
     * @returns {boolean}
     */
    isAvailable: function () {
      var TEST_KEY = '__ebv_storage_test__';
      try {
        localStorage.setItem(TEST_KEY, '1');
        localStorage.getItem(TEST_KEY);
        localStorage.removeItem(TEST_KEY);
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * Serialises the full AppState to JSON and writes it to
     * localStorage under STORAGE_KEY.  Catches QuotaExceededError,
     * SecurityError, and any other DOMException; on failure it keeps
     * the in-memory state intact and shows an error notification.
     *
     * @param {Object} state - The AppState object to persist.
     */
    save: function (state) {
      try {
        var json = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, json);
      } catch (e) {
        var msg = 'Could not save data: ' + (e.message || e.name || 'storage error');
        if (RenderModule && typeof RenderModule.showNotification === 'function') {
          RenderModule.showNotification(msg, 'error');
        }
      }
    },

    /**
     * Reads and JSON-parses the value stored at STORAGE_KEY.
     * Returns null if:
     *   - localStorage is unavailable
     *   - the key is absent
     *   - the stored value cannot be parsed as JSON
     *
     * @returns {Object|null}
     */
    load: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null || raw === undefined) {
          return null;
        }
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

  };

  // =============================================================
  // VALIDATION
  // =============================================================

  var ValidationModule = {

    /**
     * Validates fields for a new transaction.
     *
     * @param {{ name: string, amount: *, date: string, categoryId: string }} fields
     * @returns {{ valid: boolean, errors: { name?: string, amount?: string, date?: string, categoryId?: string } }}
     */
    validateTransaction: function (fields) {
      var errors = {};

      // --- name ---
      var name = (fields.name || '').trim();
      if (name.length === 0) {
        errors.name = 'Name is required.';
      } else if (name.length > MAX_NAME_LEN) {
        errors.name = 'Name must be ' + MAX_NAME_LEN + ' characters or fewer.';
      }

      // --- amount ---
      var amount = parseFloat(fields.amount);
      if (isNaN(amount)) {
        errors.amount = 'Amount must be a number.';
      } else if (amount < 0.01) {
        errors.amount = 'Amount must be at least 0.01.';
      } else if (amount > MAX_AMOUNT) {
        errors.amount = 'Amount must not exceed ' + MAX_AMOUNT + '.';
      }

      // --- date ---
      var date = (fields.date || '').trim();
      if (date.length === 0) {
        errors.date = 'Date is required.';
      } else {
        var parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
          errors.date = 'Date is not a valid date.';
        } else {
          var todayStr = new Date().toISOString().slice(0, 10);
          if (date > todayStr) {
            errors.date = 'Date must not be in the future.';
          }
        }
      }

      // --- categoryId ---
      var categoryId = (fields.categoryId || '').trim();
      if (categoryId.length === 0) {
        errors.categoryId = 'Category is required.';
      }

      return {
        valid: Object.keys(errors).length === 0,
        errors: errors
      };
    },

    /**
     * Validates a new category name.
     *
     * Rules:
     *   - trimmed name must be non-empty
     *   - trimmed name must be ≤ MAX_CATEGORY_NAME_LEN (50) characters
     *   - trimmed name must not match any existing category name
     *     case-insensitively
     *
     * @param {string} name - Proposed category name.
     * @param {Array}  existingCategories - Array of Category objects to check against.
     * @returns {{ valid: boolean, errors: { name?: string } }}
     */
    validateCategory: function (name, existingCategories) {
      var trimmed = (name || '').trim();

      if (!trimmed) {
        return { valid: false, errors: { name: 'Category name cannot be empty.' } };
      }

      if (trimmed.length > MAX_CATEGORY_NAME_LEN) {
        return {
          valid: false,
          errors: { name: 'Category name must be 50 characters or fewer.' }
        };
      }

      var lowerTrimmed = trimmed.toLowerCase();
      var categories = existingCategories || [];
      for (var i = 0; i < categories.length; i++) {
        if ((categories[i].name || '').toLowerCase() === lowerTrimmed) {
          return { valid: false, errors: { name: 'Category already exists.' } };
        }
      }

      return { valid: true, errors: {} };
    },

    /**
     * Validates a budget limit value.
     *
     * Rules:
     *   - must parse as a finite number
     *   - must be between 0.01 and MAX_AMOUNT (999,999,999.99) inclusive
     *
     * @param {*} value - The raw input value to validate.
     * @returns {{ valid: boolean, error: string }}
     */
    validateBudgetLimit: function (value) {
      var parsed = parseFloat(value);
      if (isNaN(parsed) || parsed < 0.01 || parsed > MAX_AMOUNT) {
        return {
          valid: false,
          error: 'Budget limit must be a number between 0.01 and 999,999,999.99.'
        };
      }
      return { valid: true, error: '' };
    }

  };

  // =============================================================
  // TRANSACTIONS
  // =============================================================

  var TransactionModule = {

    /**
     * Returns a new state with the given transaction fields appended.
     * Generates a unique id using crypto.randomUUID() when available,
     * falling back to Date.now().toString().
     * Does NOT mutate the input state.
     *
     * @param {Object} state  - Current AppState.
     * @param {{ name: string, amount: number, date: string, categoryId: string }} fields
     * @returns {Object} New AppState.
     */
    add: function (state, fields) {
      var id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString();

      var transaction = {
        id:         id,
        name:       fields.name,
        amount:     parseFloat(fields.amount),
        date:       fields.date,
        categoryId: fields.categoryId
      };

      return Object.assign({}, state, {
        transactions: state.transactions.concat([transaction])
      });
    },

    /**
     * Returns a new state with the transaction matching transactionId removed.
     * Does NOT mutate the input state.
     *
     * @param {Object} state         - Current AppState.
     * @param {string} transactionId - id of the transaction to remove.
     * @returns {Object} New AppState.
     */
    delete: function (state, transactionId) {
      return Object.assign({}, state, {
        transactions: state.transactions.filter(function (t) {
          return t.id !== transactionId;
        })
      });
    },

    /**
     * Returns all transactions whose date falls within the given year/month.
     * Comparison is done by slicing the ISO date string to 'YYYY-MM'.
     * Returns a new array; does not mutate state.
     *
     * @param {Object} state  - Current AppState.
     * @param {number|string} year  - 4-digit year.
     * @param {number|string} month - 1- or 2-digit month.
     * @returns {Transaction[]}
     */
    getForMonth: function (state, year, month) {
      var monthKey = String(year) + '-' + String(month).padStart(2, '0');
      return state.transactions.filter(function (t) {
        return t.date && t.date.slice(0, 7) === monthKey;
      });
    }

  };

  // =============================================================
  // CATEGORIES
  // =============================================================

  var CategoryModule = {

    /**
     * Returns the merged list of all categories: the five defaults plus any
     * user-created categories from state.categories.  Deduplication is
     * case-insensitive; when a user-created name matches a default name the
     * user-created entry wins (replaces the default in the result list).
     * Default categories are never stored in state.categories — they are
     * always injected at runtime by this function.
     *
     * @param {Object} state - Current AppState.
     * @returns {Category[]}
     */
    getAll: function (state) {
      var merged = DEFAULT_CATEGORIES.slice(); // shallow copy of defaults
      var userCats = state.categories || [];

      for (var i = 0; i < userCats.length; i++) {
        var userCat = userCats[i];
        var existingIdx = -1;

        for (var j = 0; j < merged.length; j++) {
          if (merged[j].name.toLowerCase() === (userCat.name || '').toLowerCase()) {
            existingIdx = j;
            break;
          }
        }

        if (existingIdx >= 0) {
          merged[existingIdx] = userCat; // user-created wins over default
        } else {
          merged.push(userCat);
        }
      }

      return merged;
    },

    /**
     * Returns a new state with a new user-created category appended.
     * Generates a unique id using crypto.randomUUID() when available,
     * falling back to Date.now().toString().
     * Does NOT mutate the input state.
     *
     * @param {Object} state - Current AppState.
     * @param {string} name  - Display name for the new category.
     * @returns {Object} New AppState.
     */
    add: function (state, name) {
      var id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString();

      var newCategory = {
        id:        id,
        name:      name.trim(),
        isDefault: false
      };

      return Object.assign({}, state, {
        categories: state.categories.concat([newCategory])
      });
    },

    /**
     * Returns a new state with the specified category removed from
     * state.categories.  Throws if any transaction currently references
     * the categoryId — the caller must reassign or delete those transactions
     * first.  Does NOT mutate the input state.
     *
     * Note: default categories live only in CONSTANTS and are never in
     * state.categories, so this function only operates on user-created ones.
     *
     * @param {Object} state      - Current AppState.
     * @param {string} categoryId - id of the category to remove.
     * @returns {Object} New AppState.
     * @throws {Error} If any transaction references categoryId.
     */
    delete: function (state, categoryId) {
      var inUse = state.transactions.some(function (t) {
        return t.categoryId === categoryId;
      });

      if (inUse) {
        throw new Error(
          'Cannot delete category: it has associated transactions. ' +
          'Reassign or delete those transactions first.'
        );
      }

      return Object.assign({}, state, {
        categories: state.categories.filter(function (c) {
          return c.id !== categoryId;
        })
      });
    }

  };

  // =============================================================
  // SORT
  // =============================================================

  var SortModule = {

    /**
     * Pure comparator functions for sorting transactions.
     * All comparators return negative / zero / positive integers.
     */
    comparators: {

      /**
       * Sorts by amount ascending; tie-broken by date descending
       * (most recent first when amounts are equal).
       *
       * @param {Transaction} a
       * @param {Transaction} b
       * @returns {number}
       */
      amountAsc: function (a, b) {
        var diff = a.amount - b.amount;
        if (diff !== 0) return diff;
        // tie-breaker: date descending
        if (b.date > a.date) return 1;
        if (b.date < a.date) return -1;
        return 0;
      },

      /**
       * Sorts by amount descending; tie-broken by date descending.
       *
       * @param {Transaction} a
       * @param {Transaction} b
       * @returns {number}
       */
      amountDesc: function (a, b) {
        var diff = b.amount - a.amount;
        if (diff !== 0) return diff;
        // tie-breaker: date descending
        if (b.date > a.date) return 1;
        if (b.date < a.date) return -1;
        return 0;
      }

    },

    /**
     * Returns a new sorted array without mutating the input.
     * For 'categoryAz', sorts by category name case-insensitively using
     * the provided categories array for name lookup.
     *
     * @param {Transaction[]} transactions - Transactions to sort.
     * @param {string}        sortOrder    - One of SortOrder values.
     * @param {Category[]}    [categories] - Required for 'categoryAz' sort.
     * @returns {Transaction[]} New sorted array.
     */
    apply: function (transactions, sortOrder, categories) {
      var cats = categories || [];
      var catMap = {};
      for (var i = 0; i < cats.length; i++) {
        catMap[cats[i].id] = cats[i].name || '';
      }

      var comparator;
      if (sortOrder === SORT_ORDERS.AMOUNT_ASC) {
        comparator = SortModule.comparators.amountAsc;
      } else if (sortOrder === SORT_ORDERS.AMOUNT_DESC) {
        comparator = SortModule.comparators.amountDesc;
      } else if (sortOrder === SORT_ORDERS.CATEGORY_AZ) {
        comparator = function (a, b) {
          var nameA = (catMap[a.categoryId] || '').toLowerCase();
          var nameB = (catMap[b.categoryId] || '').toLowerCase();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        };
      } else {
        comparator = SortModule.comparators.amountAsc;
      }

      return transactions.slice().sort(comparator);
    }

  };



  // =============================================================
  // MONTHLY SUMMARY
  // =============================================================

  var SummaryModule = {

    /**
     * Aggregates an array of transactions into a summary object.
     * Returns { total, byCategory } where total is the sum of all amounts
     * and byCategory is a map of categoryId → summed amount.
     * Categories with zero spend are omitted from byCategory.
     *
     * @param {Transaction[]} transactions
     * @returns {{ total: number, byCategory: { [categoryId: string]: number } }}
     */
    aggregate: function (transactions) {
      var total = 0;
      var byCategory = {};

      for (var i = 0; i < transactions.length; i++) {
        var t = transactions[i];
        total += t.amount;
        if (!byCategory[t.categoryId]) {
          byCategory[t.categoryId] = 0;
        }
        byCategory[t.categoryId] += t.amount;
      }

      // Remove categories with zero spend (defensive — shouldn't normally occur)
      var cleanByCategory = {};
      var keys = Object.keys(byCategory);
      for (var j = 0; j < keys.length; j++) {
        if (byCategory[keys[j]] > 0) {
          cleanByCategory[keys[j]] = byCategory[keys[j]];
        }
      }

      return { total: total, byCategory: cleanByCategory };
    },

    /**
     * Derives chart-ready data from a SummaryData object.
     *
     * @param {{ total: number, byCategory: Object }} summaryData
     * @param {{ [categoryId: string]: string }} categoryNames - map of id → display name
     * @returns {{ labels: string[], values: number[], percentages: number[] }}
     *
     * Percentages are rounded to the nearest integer; the last slice absorbs
     * any floating-point remainder so that percentages always sum to exactly 100.
     */
    toChartData: function (summaryData, categoryNames) {
      var byCategory = summaryData.byCategory || {};
      var total = summaryData.total || 0;
      var categoryIds = Object.keys(byCategory);

      if (categoryIds.length === 0 || total === 0) {
        return { labels: [], values: [], percentages: [] };
      }

      var labels = [];
      var values = [];
      var percentages = [];
      var sumOfRounded = 0;

      for (var i = 0; i < categoryIds.length; i++) {
        var id = categoryIds[i];
        var value = byCategory[id];
        var label = (categoryNames && categoryNames[id]) ? categoryNames[id] : id;
        labels.push(label);
        values.push(value);

        if (i < categoryIds.length - 1) {
          var pct = Math.round(value / total * 100);
          percentages.push(pct);
          sumOfRounded += pct;
        } else {
          // Last slice absorbs the remainder to guarantee sum = 100
          percentages.push(100 - sumOfRounded);
        }
      }

      return { labels: labels, values: values, percentages: percentages };
    }

  };

  // =============================================================
  // BUDGET LIMITS
  // =============================================================

  var BudgetModule = {

    /**
     * Returns true iff budgetLimits[categoryId] exists AND the category's
     * total spend in summaryData is >= that limit.
     *
     * @param {string} categoryId    - The category to check.
     * @param {Object} summaryData   - { total, byCategory: { [categoryId]: number } }
     * @param {Object} budgetLimits  - { [categoryId]: number }
     * @returns {boolean}
     */
    isExceeded: function (categoryId, summaryData, budgetLimits) {
      var limit = budgetLimits[categoryId];
      if (limit === undefined || limit === null) {
        return false;
      }
      var spend = (summaryData.byCategory && summaryData.byCategory[categoryId]) || 0;
      return spend >= limit;
    },

    /**
     * Iterates all keys in budgetLimits and collects those where isExceeded
     * returns true.  Returns a Set<string> when the Set constructor is
     * available, otherwise falls back to a plain string array.
     *
     * @param {Object} summaryData   - { total, byCategory: { [categoryId]: number } }
     * @param {Object} budgetLimits  - { [categoryId]: number }
     * @returns {Set<string>|string[]}
     */
    getExceededCategories: function (summaryData, budgetLimits) {
      var exceeded = [];
      var keys = Object.keys(budgetLimits || {});
      for (var i = 0; i < keys.length; i++) {
        var categoryId = keys[i];
        if (BudgetModule.isExceeded(categoryId, summaryData, budgetLimits)) {
          exceeded.push(categoryId);
        }
      }
      if (typeof Set !== 'undefined') {
        return new Set(exceeded);
      }
      return exceeded;
    }

  };

  // =============================================================
  // THEME
  // =============================================================

  var ThemeModule = {

    /**
     * Returns 'dark' if the OS prefers dark mode, 'light' otherwise.
     * Falls back to 'light' if window.matchMedia is unavailable or throws.
     *
     * @returns {'light'|'dark'}
     */
    getPreferred: function () {
      try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return 'dark';
        }
      } catch (e) {
        // matchMedia unavailable or threw — fall through to default
      }
      return 'light';
    },

    /**
     * Applies the given theme by setting data-theme on <html>.
     * CSS uses [data-theme="light"] / [data-theme="dark"] selectors
     * to control all visual changes.
     *
     * @param {'light'|'dark'} theme
     */
    apply: function (theme) {
      document.documentElement.dataset.theme = theme;
    },

    /**
     * Returns the opposite theme value.
     *
     * @param {'light'|'dark'} currentTheme
     * @returns {'light'|'dark'}
     */
    toggle: function (currentTheme) {
      return currentTheme === 'light' ? 'dark' : 'light';
    }

  };

  // =============================================================
  // RENDER
  // =============================================================

  /**
   * Formats a numeric amount as a USD currency string.
   * e.g. 1234.5 → '$1,234.50'
   *
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  var RenderModule = {

    /**
     * Clears and rebuilds the #transaction-list-body tbody from the
     * transactions array.  Shows a placeholder row when the array is empty.
     *
     * @param {Transaction[]} transactions - Transactions to display.
     * @param {Category[]}    categories   - Full category list for name lookup.
     */
    renderTransactionList: function (transactions, categories) {
      var tbody = document.getElementById('transaction-list-body');
      if (!tbody) return;

      // Build a categoryId → name lookup map
      var categoryMap = {};
      var cats = categories || [];
      for (var i = 0; i < cats.length; i++) {
        categoryMap[cats[i].id] = cats[i].name;
      }

      // Clear existing rows
      tbody.innerHTML = '';

      if (!transactions || transactions.length === 0) {
        // Empty-state placeholder row
        var placeholderRow = document.createElement('tr');
        placeholderRow.className = 'placeholder-row';
        placeholderRow.id = 'no-transactions-placeholder';
        var placeholderCell = document.createElement('td');
        placeholderCell.setAttribute('colspan', '5');
        placeholderCell.textContent = 'No transactions yet.';
        placeholderRow.appendChild(placeholderCell);
        tbody.appendChild(placeholderRow);
        return;
      }

      // Render one row per transaction
      for (var j = 0; j < transactions.length; j++) {
        var txn = transactions[j];

        // Format amount as currency: $1,234.56
        var formattedAmount = '$' + txn.amount.toFixed(2)
          .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

        var categoryName = categoryMap[txn.categoryId] || txn.categoryId;

        var row = document.createElement('tr');

        // Name cell
        var nameCell = document.createElement('td');
        nameCell.textContent = txn.name;
        row.appendChild(nameCell);

        // Amount cell (right-aligned)
        var amountCell = document.createElement('td');
        amountCell.className = 'amount-cell';
        amountCell.textContent = formattedAmount;
        row.appendChild(amountCell);

        // Date cell
        var dateCell = document.createElement('td');
        dateCell.textContent = txn.date;
        row.appendChild(dateCell);

        // Category cell
        var categoryCell = document.createElement('td');
        categoryCell.textContent = categoryName;
        row.appendChild(categoryCell);

        // Actions cell with delete button
        var actionsCell = document.createElement('td');
        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn--danger delete-txn-btn';
        deleteBtn.dataset.id = txn.id;
        deleteBtn.setAttribute('aria-label', 'Delete ' + txn.name);
        deleteBtn.textContent = 'Delete';
        actionsCell.appendChild(deleteBtn);
        row.appendChild(actionsCell);

        tbody.appendChild(row);
      }
    },

    /**
     * Renders the monthly summary section: total spend and per-category
     * breakdown rows, with budget-exceeded highlighting.
     *
     * @param {{ total: number, byCategory: { [categoryId: string]: number } }} summaryData
     * @param {Category[]} categories
     * @param {{ [categoryId: string]: number }} budgetLimits
     */
    renderMonthlySummary: function (summaryData, categories, budgetLimits) {
      var limits = budgetLimits || {};

      // 1. Build categoryMap: { [id]: name }
      var categoryMap = {};
      var cats = categories || [];
      for (var i = 0; i < cats.length; i++) {
        categoryMap[cats[i].id] = cats[i].name || cats[i].id;
      }

      // 2. Update total spend display
      var totalEl = document.getElementById('summary-total-value');
      if (totalEl) {
        totalEl.textContent = formatCurrency(summaryData.total || 0);
      }

      // 3. Get breakdown container
      var breakdownEl = document.getElementById('summary-breakdown');
      if (!breakdownEl) return;

      // 4. Remove any previously rendered category rows
      var existingRows = breakdownEl.querySelectorAll('.summary-category-row');
      for (var r = 0; r < existingRows.length; r++) {
        existingRows[r].parentNode.removeChild(existingRows[r]);
      }

      // 5. Get the no-data message element
      var noDataEl = document.getElementById('no-summary-data');

      // 6. No-data state
      if (!summaryData.total || summaryData.total === 0) {
        if (totalEl) totalEl.textContent = '$0.00';
        if (noDataEl) noDataEl.style.display = '';
        return;
      }

      // 7. Has data — hide no-data message and render rows
      if (noDataEl) noDataEl.style.display = 'none';

      var byCategory = summaryData.byCategory || {};
      var categoryIds = Object.keys(byCategory);

      for (var j = 0; j < categoryIds.length; j++) {
        var categoryId = categoryIds[j];
        var amount     = byCategory[categoryId];
        var exceeded   = BudgetModule.isExceeded(categoryId, summaryData, limits);

        // Row container
        var row = document.createElement('div');
        row.className = 'summary-category-row';
        if (exceeded) {
          row.className += ' budget-exceeded';
        }

        // Category name span
        var nameSpan = document.createElement('span');
        nameSpan.className = 'summary-category-row__name';
        nameSpan.textContent = categoryMap[categoryId] || categoryId;
        row.appendChild(nameSpan);

        // Amount span
        var amountSpan = document.createElement('span');
        amountSpan.className = 'summary-category-row__amount';
        amountSpan.textContent = formatCurrency(amount);
        row.appendChild(amountSpan);

        // Budget warning
        if (exceeded) {
          var warningP = document.createElement('p');
          warningP.className = 'budget-warning-text';
          warningP.textContent = 'Spending limit reached!';
          row.appendChild(warningP);
        }

        // Append before noDataEl so it stays at the bottom of the container
        if (noDataEl && noDataEl.parentNode === breakdownEl) {
          breakdownEl.insertBefore(row, noDataEl);
        } else {
          breakdownEl.appendChild(row);
        }
      }
    },

    /**
     * Draws a pie chart onto the #chart canvas element.
     * Each slice is proportional to chartData.percentages, filled with a
     * colour from CHART_PALETTE (cycling when there are more slices than
     * palette entries).  A thin white border separates slices.
     * Labels are drawn outside each slice: "{category}: {percentage}%".
     * When chartData.labels is empty (or chartData is absent), the canvas
     * renders a centred "No data" message instead.
     *
     * @param {{ labels: string[], values: number[], percentages: number[] }} chartData
     */
    renderChart: function (chartData) {
      var canvas = document.getElementById('chart');
      if (!canvas || !canvas.getContext) return;

      var ctx = canvas.getContext('2d');
      var W = canvas.width;
      var H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // No-data state
      if (!chartData || !chartData.labels || chartData.labels.length === 0) {
        ctx.fillStyle = '#888';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No data', W / 2, H / 2);
        return;
      }

      var cx = W / 2;
      var cy = H / 2;
      var radius = Math.min(W, H) * 0.35;
      var labelRadius = radius + 30;

      var startAngle = -Math.PI / 2; // start from top (12 o'clock)

      // Determine label text colour based on active theme
      var labelColor = document.documentElement.dataset.theme === 'dark' ? '#eee' : '#333';

      for (var i = 0; i < chartData.labels.length; i++) {
        var pct = chartData.percentages[i];
        var sliceAngle = (pct / 100) * 2 * Math.PI;
        var endAngle = startAngle + sliceAngle;
        var color = CHART_PALETTE[i % CHART_PALETTE.length];

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label outside the slice at the midpoint angle
        var midAngle = startAngle + sliceAngle / 2;
        var labelX = cx + Math.cos(midAngle) * labelRadius;
        var labelY = cy + Math.sin(midAngle) * labelRadius;

        ctx.fillStyle = labelColor;
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = labelX > cx ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(chartData.labels[i] + ': ' + pct + '%', labelX, labelY);

        startAngle = endAngle;
      }
    },

    renderCategorySelector: function (categories) {
      var cats = categories || [];

      // --- Transaction form select ---
      var select = document.getElementById('txn-category');
      if (select) {
        select.innerHTML = '';
        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Select a category --';
        select.appendChild(placeholder);

        for (var i = 0; i < cats.length; i++) {
          var opt = document.createElement('option');
          opt.value = cats[i].id;
          opt.textContent = cats[i].name;
          select.appendChild(opt);
        }
      }

      // --- Category list <ul> ---
      var ul = document.getElementById('category-list');
      if (ul) {
        ul.innerHTML = '';

        for (var j = 0; j < cats.length; j++) {
          var cat = cats[j];
          var li = document.createElement('li');
          li.className = 'category-item';

          var nameSpan = document.createElement('span');
          nameSpan.className = 'category-item__name';
          nameSpan.textContent = cat.name;
          li.appendChild(nameSpan);

          if (cat.isDefault) {
            var badge = document.createElement('span');
            badge.className = 'category-item__badge';
            badge.textContent = 'Default';
            li.appendChild(badge);
          } else {
            var delBtn = document.createElement('button');
            delBtn.className = 'btn btn--danger delete-cat-btn';
            delBtn.dataset.id = cat.id;
            delBtn.setAttribute('aria-label', 'Delete category ' + cat.name);
            delBtn.textContent = 'Delete';
            li.appendChild(delBtn);
          }

          ul.appendChild(li);
        }
      }
    },

    /**
     * Renders the month selector <select> options.
     * Placeholder — implemented by task 14.4.
     *
     * @param {string[]} availableMonths
     * @param {string}   selectedMonth
     */
    renderMonthSelector: function (availableMonths, selectedMonth) {
      var select = document.getElementById('month-selector');
      if (!select) return;

      select.innerHTML = '';

      var months = (availableMonths || []).slice(); // don't mutate original
      if (selectedMonth && months.indexOf(selectedMonth) === -1) {
        months.unshift(selectedMonth);
      }

      for (var i = 0; i < months.length; i++) {
        var monthKey = months[i];
        // Parse as the 1st of the month in local time to avoid UTC offset shift
        var parts = monthKey.split('-');
        var dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        var label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        var opt = document.createElement('option');
        opt.value = monthKey;
        opt.textContent = label;
        if (monthKey === selectedMonth) {
          opt.selected = true;
        }
        select.appendChild(opt);
      }
    },

    /**
     * Renders the budget limit inputs per category.
     * Placeholder — implemented by task 14.4.
     *
     * @param {Category[]} categories
     * @param {{ [categoryId: string]: number }} budgetLimits
     */
    renderBudgetLimitInputs: function (categories, budgetLimits) {
      var container = document.getElementById('budget-limit-inputs');
      if (!container) return;

      container.innerHTML = '';
      var cats = categories || [];
      var limits = budgetLimits || {};

      for (var i = 0; i < cats.length; i++) {
        var cat = cats[i];

        var row = document.createElement('div');
        row.className = 'budget-limit-row';

        // Label
        var label = document.createElement('label');
        label.className = 'budget-limit-row__label';
        label.setAttribute('for', 'budget-input-' + cat.id);
        label.textContent = cat.name;
        row.appendChild(label);

        // Input
        var input = document.createElement('input');
        input.type = 'number';
        input.id = 'budget-input-' + cat.id;
        input.className = 'budget-limit-row__input';
        input.dataset.categoryId = cat.id;
        input.setAttribute('min', '0.01');
        input.setAttribute('max', '999999999.99');
        input.setAttribute('step', '0.01');
        input.setAttribute('placeholder', 'No limit');
        input.value = limits[cat.id] !== undefined ? limits[cat.id] : '';
        row.appendChild(input);

        // Error span
        var errorSpan = document.createElement('span');
        errorSpan.className = 'budget-limit-row__error field-error';
        errorSpan.setAttribute('role', 'alert');
        errorSpan.setAttribute('aria-live', 'assertive');
        row.appendChild(errorSpan);

        container.appendChild(row);
      }
    },

    /**
     * Renders inline validation errors next to form fields.
     * Placeholder — implemented by task 14.1.
     *
     * @param {{ [field: string]: string }} errors
     */
    showValidationErrors: function (errors) {
      var fieldMap = {
        name:       { inputId: 'txn-name',     errorId: 'txn-name-error' },
        amount:     { inputId: 'txn-amount',   errorId: 'txn-amount-error' },
        date:       { inputId: 'txn-date',     errorId: 'txn-date-error' },
        categoryId: { inputId: 'txn-category', errorId: 'txn-category-error' }
      };

      var keys = Object.keys(errors || {});
      for (var i = 0; i < keys.length; i++) {
        var field = keys[i];
        var mapping = fieldMap[field];
        if (!mapping) continue;

        var inputEl = document.getElementById(mapping.inputId);
        var errorEl = document.getElementById(mapping.errorId);

        if (inputEl && inputEl.parentElement) {
          inputEl.parentElement.classList.add('has-error');
        }
        if (errorEl) {
          errorEl.textContent = errors[field];
        }
      }
    },

    /**
     * Clears all inline validation errors.
     * Placeholder — implemented by task 14.1.
     */
    clearValidationErrors: function () {
      var form = document.getElementById('transaction-form');
      if (!form) return;

      var fields = form.querySelectorAll('.form-field');
      for (var i = 0; i < fields.length; i++) {
        fields[i].classList.remove('has-error');
      }

      var errorSpans = form.querySelectorAll('.field-error');
      for (var j = 0; j < errorSpans.length; j++) {
        errorSpans[j].textContent = '';
      }
    },

    /**
     * Shows a notification banner.
     * Placeholder — implemented by task 14.1.
     *
     * @param {string} message
     * @param {'error'|'info'} type
     */
    showNotification: function (message, type) {
      var area = document.getElementById('notification-area');
      if (!area) return;

      var notificationType = type === 'error' ? 'error' : 'info';

      var notifEl = document.createElement('div');
      notifEl.className = 'notification notification--' + notificationType;
      notifEl.setAttribute('role', 'alert');

      var msgSpan = document.createElement('span');
      msgSpan.className = 'notification__message';
      msgSpan.textContent = message;
      notifEl.appendChild(msgSpan);

      var dismissBtn = document.createElement('button');
      dismissBtn.className = 'notification__dismiss';
      dismissBtn.setAttribute('aria-label', 'Dismiss notification');
      dismissBtn.textContent = '\u00d7';
      dismissBtn.addEventListener('click', function () {
        notifEl.remove();
      });
      notifEl.appendChild(dismissBtn);

      area.appendChild(notifEl);
    },

    /**
     * Applies the active theme to the toggle button UI.
     * Placeholder — implemented by task 14.1.
     *
     * @param {'light'|'dark'} theme
     */
    applyTheme: function (theme) {
      ThemeModule.apply(theme);
    }

  };

  // =============================================================
  // INIT
  // =============================================================

  /**
   * Returns an array of unique 'YYYY-MM' month keys derived from all
   * transactions that have a date, sorted in reverse-chronological order.
   *
   * @param {Transaction[]} transactions
   * @returns {string[]}
   */
  function getAvailableMonths(transactions) {
    var monthSet = {};
    for (var i = 0; i < transactions.length; i++) {
      var key = transactions[i].date ? transactions[i].date.slice(0, 7) : null;
      if (key) monthSet[key] = true;
    }
    var months = Object.keys(monthSet);
    months.sort(function (a, b) { return b > a ? 1 : b < a ? -1 : 0; }); // reverse-chrono
    return months;
  }

  function renderTotalBalance(transactions) {
    var totalEl = document.getElementById('total-balance-value');

    if (!totalEl) return;

    var total = 0;

    for (var i = 0; i < transactions.length; i++) {
      total += Number(transactions[i].amount) || 0;
    }

    totalEl.textContent = formatCurrency(total);
  }

  document.addEventListener('DOMContentLoaded', function () {

    // --- 1. Load persisted state ---
    var loaded = StorageModule.load();

    if (!loaded) {
      // Check if there was corrupt data in storage
      try {
        var rawData = localStorage.getItem(STORAGE_KEY);
        if (rawData !== null) {
          RenderModule.showNotification('Saved data could not be loaded and has been reset.', 'error');
        }
      } catch (e) {
        RenderModule.showNotification('Local storage is unavailable. Changes will not be saved.', 'error');
      }
      // Apply OS theme preference on first load
      AppState.theme = ThemeModule.getPreferred();
    } else {
      // Restore from saved data, merging with defaults for missing fields
      AppState.transactions  = loaded.transactions  || [];
      AppState.categories    = loaded.categories    || [];
      AppState.budgetLimits  = loaded.budgetLimits  || {};
      AppState.sortOrder     = loaded.sortOrder     || SORT_ORDERS.AMOUNT_ASC;
      AppState.theme         = loaded.theme         || ThemeModule.getPreferred();
      AppState.selectedMonth = loaded.selectedMonth || getCurrentMonthKey();
    }

    // --- 2. Apply stored theme ---
    ThemeModule.apply(AppState.theme);

    // Update theme toggle button indicator
    var themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
      if (AppState.theme === 'dark') {
        themeToggleBtn.classList.add('theme-toggle--dark');
        themeToggleBtn.classList.remove('theme-toggle--light');
        themeToggleBtn.querySelector('.theme-toggle__label').textContent = 'Light Mode';
        themeToggleBtn.querySelector('.theme-toggle__icon').textContent = '☀️';
      } else {
        themeToggleBtn.classList.add('theme-toggle--light');
        themeToggleBtn.classList.remove('theme-toggle--dark');
        themeToggleBtn.querySelector('.theme-toggle__label').textContent = 'Dark Mode';
        themeToggleBtn.querySelector('.theme-toggle__icon').textContent = '🌙';
      }
    }

    // --- 3. Compute derived data ---
    var allCategories = CategoryModule.getAll(AppState);

    // Get all months that have transactions
    var allMonths = getAvailableMonths(AppState.transactions);

    // Build category name map for chart data
    var catNameMap = {};
    for (var ci = 0; ci < allCategories.length; ci++) {
      catNameMap[allCategories[ci].id] = allCategories[ci].name;
    }

    // Get transactions for selected month
    var selectedParts = AppState.selectedMonth.split('-');
    var monthTransactions = TransactionModule.getForMonth(
      AppState,
      parseInt(selectedParts[0], 10),
      parseInt(selectedParts[1], 10)
    );

    // Sort transactions
    var sortedTransactions = SortModule.apply(AppState.transactions, AppState.sortOrder, allCategories);

    // Aggregate monthly data
    var summaryData = SummaryModule.aggregate(monthTransactions);
    var chartData = SummaryModule.toChartData(summaryData, catNameMap);

    // --- 4. Initial renders ---
    RenderModule.renderCategorySelector(allCategories);
    RenderModule.renderMonthSelector(allMonths, AppState.selectedMonth);
    RenderModule.renderTransactionList(sortedTransactions, allCategories);
    RenderModule.renderMonthlySummary(summaryData, allCategories, AppState.budgetLimits);
    RenderModule.renderChart(chartData);
    RenderModule.renderBudgetLimitInputs(allCategories, AppState.budgetLimits);

    renderTotalBalance(AppState.transactions);

    // --- 5. Set sort control to current value ---
    var sortSelect = document.getElementById('sort-order');
    if (sortSelect) {
      sortSelect.value = AppState.sortOrder;
    }

    // =============================================================
    // EVENT HANDLERS — Tasks 15.2–15.8
    // =============================================================

    // Re-render all views affected by a state change.
    function renderAll() {
      var categories = CategoryModule.getAll(AppState);
      var months = getAvailableMonths(AppState.transactions);

      if (!AppState.selectedMonth) {
        AppState.selectedMonth = getCurrentMonthKey();
      }

      var selectedParts = AppState.selectedMonth.split('-');
      var monthTransactions = TransactionModule.getForMonth(
        AppState,
        parseInt(selectedParts[0], 10),
        parseInt(selectedParts[1], 10)
      );

      var categoryNames = {};
      for (var i = 0; i < categories.length; i++) {
        categoryNames[categories[i].id] = categories[i].name;
      }

      var sorted = SortModule.apply(
        AppState.transactions,
        AppState.sortOrder,
        categories
      );
      var summary = SummaryModule.aggregate(monthTransactions);
      var chart = SummaryModule.toChartData(summary, categoryNames);

      RenderModule.renderCategorySelector(categories);
      RenderModule.renderMonthSelector(months, AppState.selectedMonth);
      RenderModule.renderTransactionList(sorted, categories);
      RenderModule.renderMonthlySummary(summary, categories, AppState.budgetLimits);
      RenderModule.renderChart(chart);
      RenderModule.renderBudgetLimitInputs(categories, AppState.budgetLimits);
      renderTotalBalance(AppState.transactions);

      if (sortSelect) {
        sortSelect.value = AppState.sortOrder;
      }
    }

    // --- Task 15.2: Transaction form submit ---
    var transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
      transactionForm.addEventListener('submit', function (event) {
        event.preventDefault();

        RenderModule.clearValidationErrors();

        var fields = {
          name: document.getElementById('txn-name').value,
          amount: document.getElementById('txn-amount').value,
          date: document.getElementById('txn-date').value,
          categoryId: document.getElementById('txn-category').value
        };

        var validation = ValidationModule.validateTransaction(fields);

        if (!validation.valid) {
          RenderModule.showValidationErrors(validation.errors);
          return;
        }

        AppState = TransactionModule.add(AppState, {
          name: fields.name.trim(),
          amount: fields.amount,
          date: fields.date,
          categoryId: fields.categoryId
        });

        StorageModule.save(AppState);
        transactionForm.reset();
        RenderModule.clearValidationErrors();
        renderAll();
        RenderModule.showNotification('Transaction added successfully.', 'info');
      });
    }

    // --- Task 15.3: Transaction delete ---
    var transactionListBody = document.getElementById('transaction-list-body');
    if (transactionListBody) {
      transactionListBody.addEventListener('click', function (event) {
        var button = event.target.closest('.delete-txn-btn');
        if (!button) return;

        var transactionId = button.dataset.id;
        if (!transactionId) return;

        if (!window.confirm('Delete this transaction?')) {
          return;
        }

        AppState = TransactionModule.delete(AppState, transactionId);
        StorageModule.save(AppState);
        renderAll();
        RenderModule.showNotification('Transaction deleted.', 'info');
      });
    }

    // --- Task 15.4: Category add/delete ---
    var categoryForm = document.getElementById('add-category-form');
    var categoryInput = document.getElementById('new-category-name');
    var categoryError = document.getElementById('new-category-error');

    if (categoryForm) {
      categoryForm.addEventListener('submit', function (event) {
        event.preventDefault();

        categoryForm.classList.remove('has-error');
        if (categoryError) categoryError.textContent = '';

        var name = categoryInput ? categoryInput.value : '';
        var existingCategories = CategoryModule.getAll(AppState);
        var validation = ValidationModule.validateCategory(name, existingCategories);

        if (!validation.valid) {
          categoryForm.classList.add('has-error');
          if (categoryError) {
            categoryError.textContent = validation.errors.name || 'Invalid category.';
          }
          return;
        }

        AppState = CategoryModule.add(AppState, name);
        StorageModule.save(AppState);
        categoryForm.reset();
        renderAll();
        RenderModule.showNotification('Category added successfully.', 'info');
      });
    }

    var categoryList = document.getElementById('category-list');
    if (categoryList) {
      categoryList.addEventListener('click', function (event) {
        var button = event.target.closest('.delete-cat-btn');
        if (!button) return;

        var categoryId = button.dataset.id;
        if (!categoryId) return;

        try {
          AppState = CategoryModule.delete(AppState, categoryId);
          StorageModule.save(AppState);
          renderAll();
          RenderModule.showNotification('Category deleted.', 'info');
        } catch (error) {
          RenderModule.showNotification(
            error.message || 'Cannot delete this category.',
            'error'
          );
        }
      });
    }

    // --- Task 15.5: Sort control ---
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        if (
          this.value !== SORT_ORDERS.AMOUNT_ASC &&
          this.value !== SORT_ORDERS.AMOUNT_DESC &&
          this.value !== SORT_ORDERS.CATEGORY_AZ
        ) {
          return;
        }

        AppState.sortOrder = this.value;
        StorageModule.save(AppState);
        renderAll();
      });
    }

    // --- Task 15.6: Month selector ---
    var monthSelect = document.getElementById('month-selector');
    if (monthSelect) {
      monthSelect.addEventListener('change', function () {
        if (!this.value) return;

        AppState.selectedMonth = this.value;
        StorageModule.save(AppState);
        renderAll();
      });
    }

    // --- Task 15.7: Budget limit inputs ---
    var budgetContainer = document.getElementById('budget-limit-inputs');
    if (budgetContainer) {
      budgetContainer.addEventListener('change', function (event) {
        var input = event.target.closest('.budget-limit-row__input');
        if (!input) return;

        var row = input.closest('.budget-limit-row');
        var errorEl = row ? row.querySelector('.budget-limit-row__error') : null;
        var rawValue = input.value.trim();

        if (rawValue === '') {
          delete AppState.budgetLimits[input.dataset.categoryId];
          if (row) row.classList.remove('has-error');
          if (errorEl) errorEl.textContent = '';
          StorageModule.save(AppState);
          renderAll();
          return;
        }

        var validation = ValidationModule.validateBudgetLimit(rawValue);

        if (!validation.valid) {
          if (row) row.classList.add('has-error');
          if (errorEl) errorEl.textContent = validation.error;
          return;
        }

        AppState.budgetLimits[input.dataset.categoryId] = parseFloat(rawValue);
        if (row) row.classList.remove('has-error');
        if (errorEl) errorEl.textContent = '';

        StorageModule.save(AppState);
        renderAll();
      });
    }

    // --- Task 15.8: Theme toggle ---
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', function () {
        AppState.theme = ThemeModule.toggle(AppState.theme);
        StorageModule.save(AppState);

        RenderModule.applyTheme(AppState.theme);

        if (AppState.theme === 'dark') {
          themeToggleBtn.classList.add('theme-toggle--dark');
          themeToggleBtn.classList.remove('theme-toggle--light');
          themeToggleBtn.querySelector('.theme-toggle__label').textContent = 'Light Mode';
          themeToggleBtn.querySelector('.theme-toggle__icon').textContent = '☀️';
        } else {
          themeToggleBtn.classList.add('theme-toggle--light');
          themeToggleBtn.classList.remove('theme-toggle--dark');
          themeToggleBtn.querySelector('.theme-toggle__label').textContent = 'Dark Mode';
          themeToggleBtn.querySelector('.theme-toggle__icon').textContent = '🌙';
        }

        // Repaint chart labels so they use the new theme colour.
        var categories = CategoryModule.getAll(AppState);
        var parts = AppState.selectedMonth.split('-');
        var monthTransactions = TransactionModule.getForMonth(
          AppState,
          parseInt(parts[0], 10),
          parseInt(parts[1], 10)
        );
        var categoryNames = {};
        for (var i = 0; i < categories.length; i++) {
          categoryNames[categories[i].id] = categories[i].name;
        }
        RenderModule.renderChart(
          SummaryModule.toChartData(
            SummaryModule.aggregate(monthTransactions),
            categoryNames
          )
        );
      });
    }

  }); // end DOMContentLoaded

})();
