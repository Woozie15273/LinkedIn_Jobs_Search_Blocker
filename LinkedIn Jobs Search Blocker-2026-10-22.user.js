// ==UserScript==
// @name         LinkedIn Jobs Search Blocker
// @description  Block certain job posts by keywords on LinkedIn Jobs search results
// @version      2026-10-22
// @author       https://woozie15273.github.io/Portfolio/
// @license      MIT
// @supportURL   https://github.com/Woozie15273/LinkedIn_Jobs_Search_Blocker/issues
// @match        https://www.linkedin.com/jobs/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @namespace https://greasyfork.org/users/1574228
// @downloadURL https://update.greasyfork.org/scripts/567415/LinkedIn%20Jobs%20Search%20Blocker.user.js
// @updateURL https://update.greasyfork.org/scripts/567415/LinkedIn%20Jobs%20Search%20Blocker.meta.js
// ==/UserScript==


(async function() {
    'use strict';

    // -------------------------------
    // Helpers
    // -------------------------------
    let menuIds = []; // To add or remove menu items on TemperMonkey, serving GM_registerMenuCommand
    let cachedPatterns = []; // Store regex patterns for quick checking

    const JOB_LIST_CONTAINER = '[componentkey="SearchResultsMainContent"]'; // CSS selector pointing to the main list of job postings on LinkedIn
    const JOB_CARD_SELECTOR = '[componentkey^="job-card-component"][tabindex="0"]';

    // Hide blocked jobs from view
    const injectCSS = () => {
        const style = document.createElement('style');
        style.textContent = `.blocked-job { display: none !important; }`;
        document.head.appendChild(style);
    };

    // Wait until the job posts are loaded properly
    const waitForSelector = (selector) => {
        return new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    };

    // Prevent a function from running too often by adding a delay
    const debounce = (fn, delay = 200) => {
        let timeout;

        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    };

    // Returns the current LinkedIn jobs results container.
    // LinkedIn may recreate this container during SPA updates.
    const getCurrentContainer = () =>
        document.querySelector(JOB_LIST_CONTAINER);

    // -------------------------------
    // 1. Keyword Management Module
    // -------------------------------
    const keywordsStore = {

        // Gets the current list of blocked keywords from storage
        get: () => GM_getValue('blockedKeywords', []),

        // Checks if the text entered is a valid regex pattern
        isValidRegex: (str) => {
            try {
                new RegExp(str);
                return true;
            } catch {
                return false;
            }
        },

        // Adds a new keyword or regex pattern to the blocked list
        add: (keyword) => {
            const trimmed = keyword?.trim();

            if (!trimmed) return false;

            // Warn the user if the regex pattern is invalid
            if (!keywordsStore.isValidRegex(trimmed)) {
                alert(`Invalid Regex Pattern: "${trimmed}"\nPlease check your syntax.`);
                return false;
            }

            const current = new Set(
                GM_getValue('blockedKeywords', [])
            );

            current.add(trimmed);

            GM_setValue(
                'blockedKeywords',
                [...current]
            );

            refreshPatterns();

            return true;
        },

        // Removes a keyword from the blocked list
        remove: (keyword) => {
            const current = new Set(
                GM_getValue('blockedKeywords', [])
            );

            current.delete(keyword);

            GM_setValue(
                'blockedKeywords',
                [...current]
            );

            refreshPatterns();
        },

        // Clears all blocked keywords
        clear: () => {
            GM_setValue('blockedKeywords', []);
            refreshPatterns();
        }
    };

    // Refreshes the cached regex patterns
    const refreshPatterns = () => {

        const keywords = keywordsStore.get();

        cachedPatterns = keywords
            .map(k => {
                try {
                    return new RegExp(k, 'i');
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
    };

    // -------------------------------
    // 2. Blocking Module
    // -------------------------------
    const blockJobs = (container) => {

        if (cachedPatterns.length === 0) {
            return; // Skip when no blocked keywords
        }

        // Iterate through all visible job cards.
        // If a card matches any blocked keyword or pattern,
        // apply the 'blocked-job' class to hide it.
        const jobCards =
            container.querySelectorAll(
                JOB_CARD_SELECTOR
            );

        jobCards.forEach(card => {

            const shouldBlock =
                cachedPatterns.some(
                    pattern => pattern.test(card.innerText)
                );

            card.classList.toggle(
                'blocked-job',
                shouldBlock
            );
        });
    };

    // Re-apply filtering using the latest container and keyword list.
    const refreshJobFiltering = () => {

        const container = getCurrentContainer();

        if (!container) {
            return;
        }

        // Reset previous filtering state.
        container
            .querySelectorAll('.blocked-job')
            .forEach(card => card.classList.remove('blocked-job'));

        // Apply current filtering rules.
        blockJobs(container);
    };

    // -------------------------------
    // 3. Dynamic Loading Module
    // -------------------------------
    const observeJobPagination = () => {

        const observer = new MutationObserver(
            debounce(() => {

                // Re-locate the jobs container because LinkedIn
                // may recreate it after a page update.
                const container =
                    document.querySelector(
                        JOB_LIST_CONTAINER
                    );

                // Re-apply filtering to newly rendered jobs.
                if (container) {
                    blockJobs(container);
                }

            }, 200)
        );

        // Observe the entire page since LinkedIn can replace
        // the original jobs container during dynamic rendering.
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    };

    // -------------------------------
    // 4. UI Layer
    // -------------------------------
    const setupMenu = () => {

        const buildMenu = () => {

            const addMenu = (name, fn) => {
                const id =
                    GM_registerMenuCommand(name, fn);

                menuIds.push(id);
            };

            // Remove old menu commands before rebuilding
            menuIds.forEach(id => {

                if (
                    typeof GM_unregisterMenuCommand ===
                    'function'
                ) {
                    GM_unregisterMenuCommand(id);
                }

            });

            menuIds = [];

            // Add keyword
            addMenu(
                'Block Keyword / Regex',
                () => {

                    const keyword =
                        prompt('Enter keyword:');

                    if (
                        keyword &&
                        keywordsStore.add(keyword)
                    ) {
                        refreshJobFiltering();
                        buildMenu();
                    }

                }
            );

            // Remove single keyword
            const currentKeywords =
                keywordsStore.get();

            currentKeywords.forEach(word => {

                addMenu(
                    `Unblock: ${word}`,
                    () => {

                        keywordsStore.remove(word);

                        refreshJobFiltering();

                        buildMenu();

                    }
                );

            });

            // Remove all keywords
            if (currentKeywords.length > 0) {

                addMenu(
                    'Unblock All Keywords',
                    () => {

                        if (
                            confirm(
                                'Unblock all?'
                            )
                        ) {

                            keywordsStore.clear();

                            refreshJobFiltering();

                            buildMenu();

                        }

                    }
                );

            }
        };

        buildMenu();
    };

    // -------------------------------
    // 5. Initialization Layer
    // -------------------------------
    const init = async (listSelector) => {

        try {

            injectCSS(); // Add CSS rules
            refreshPatterns(); // Load saved keywords

            const container =
                await waitForSelector(
                    listSelector
                );

            setupMenu();

            // Initial scan of existing jobs
            blockJobs(container);

            // Watch for dynamically loaded jobs
            observeJobPagination();

        } catch (error) {

            console.error(
                'LinkedIn Jobs Search Blocker: Initialization failed',
                error
            );

        }
    };

    await init(JOB_LIST_CONTAINER);

})();
