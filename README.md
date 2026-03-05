
# [LinkedIn Jobs Search Blocker](https://greasyfork.org/en/scripts/567415-linkedin-jobs-search-blocker)

A technical userscript designed to filter LinkedIn job search results using keyword matching and regular expressions. This tool allows for a cleaner browsing experience by hiding job postings that match user-defined criteria.

---

## Module Overview

The script is organized into five functional layers that work in tandem to manage data, monitor the page, and update the user interface.



### 1. Keyword Management Module
This module acts as the data controller for the script. It manages the storage and validation of filtering criteria.
* **Local Persistent Storage:** Utilizes `GM_getValue` and `GM_setValue` to store keywords directly in your browser's local script storage. This ensures your list remains private and persists across sessions without needing an external database.
* **Regex Validation:** Includes a safety check (`isValidRegex`) to ensure that any pattern entered by the user will not crash the script.
* **Pattern Caching:** To maintain performance, keywords are compiled into a `cachedPatterns` array, allowing for rapid execution during page scrolls.

### 2. Blocking Module
The core logic responsible for modifying the Document Object Model (DOM).
* **CSS Injection:** Injects a style tag into the document head that sets `.blocked-job` to `display: none !important`.
* **Class Toggling:** Scans the `innerText` of job cards. If a match is found against the cached patterns, it applies the hidden class; otherwise, it ensures the class is removed.

### 3. Dynamic Loading Module
LinkedIn uses asynchronous loading to populate job lists as users scroll. This module ensures new content is filtered as it appears.
* **MutationObserver:** Monitors the `.scaffold-layout__list` container for changes. Whenever new job cards are added to the DOM, the observer triggers a re-scan.
* **Debouncing:** Uses a `debounce` helper to limit the frequency of the blocking function, preventing performance lag during rapid scrolling.

### 4. UI Layer
Integrates directly with the browser extension interface to provide user controls without requiring manual code edits.
* **Menu Commands:** Uses `GM_registerMenuCommand` to add "Block Keyword" and "Unblock" options to the extension's popup menu.
* **Real-time Refresh:** When a user adds or removes a keyword via the menu, the script automatically re-runs the blocking logic and rebuilds the menu to reflect the current state.

### 5. Initialization Layer
The entry point of the script that orchestrates the startup sequence.
* **Lifecycle:** It waits for the specific LinkedIn job list selector to load, injects the necessary CSS, loads saved patterns, and attaches the observers.

---

## Cooperation Workflow

1. **Startup:** The Initialization Layer waits for the page to be ready and calls the Keyword Management Module to load saved filters from local storage.
2. **Filtering:** The Blocking Module performs an initial pass on visible jobs.
3. **Monitoring:** The Dynamic Loading Module starts an observer. As the user scrolls and LinkedIn fetches more jobs, these new elements are automatically sent to the Blocking Module.
4. **Interaction:** If a user interacts with the UI Layer to add a new keyword, the Keyword Management Module updates the local cache, and the Blocking Module immediately updates the visibility of all jobs on the page.

---

## Setup

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser.
2. Create a new script in the Tampermonkey dashboard.
3. Paste the code into the editor and save.
4. Navigate to the LinkedIn Jobs search page to begin filtering.
