// ==UserScript==
// @name         LinkedIn Jobs Search Blocker
// @description  Block certain job posts by keywords on LinkedIn Jobs search results
// @version      2026-02-25
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
    const JOB_LIST_CONTAINER = '.scaffold-layout__list'; // CSS selector pointing to the main list of job postings on LinkedIn

    // Hide blocked jobs from view
    const injectCSS = () => {
        const style = document.createElement('style');
        style.textContent = `.blocked-job { display: none !important; } `;
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
            observer.observe(document.body, { childList: true, subtree: true });
        });
    };

    // Prevent a function from running to often by adding a delay
    const debounce = (fn, delay = 200) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    };

    // -------------------------------
    // 1. Keyword Management Module
    // -------------------------------
    const keywordsStore = {

        // Gets the current list of blocked keywords from storage
        get: () => GM_getValue('blockedKeywords', []),

        // Checks if the text entered is a valid regex pattern (so it won’t break the script)
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

            // Warns the user if the regex pattern is invalid
            if (!keywordsStore.isValidRegex(trimmed)) {
                alert(`Invalid Regex Pattern: "${trimmed}"\nPlease check your syntax.`);
                return false;
            }

            const current = new Set(GM_getValue('blockedKeywords', []));
            current.add(trimmed);
            GM_setValue('blockedKeywords', [...current]);
            refreshPatterns();
            return true;
        },

        // Removes a keyword from the blocked list
        remove: (keyword) => {
            const current = new Set(GM_getValue('blockedKeywords', []));
            current.delete(keyword);
            GM_setValue('blockedKeywords', [...current]);
            refreshPatterns();
        },

        // Clears all blocked keywords at once
        clear: () => {
            GM_setValue('blockedKeywords', []);
            refreshPatterns();
        },
    };

    // Refreshes the cached regex patterns so the script can quickly check job listings
    const refreshPatterns = () => {
        const keywords = keywordsStore.get();
        cachedPatterns = keywords.map(k => {
            try { return new RegExp(k, 'i'); } catch { return null; }
        }).filter(Boolean);
    };

    // -------------------------------
    // 2. Blocking Module
    // -------------------------------
    const blockJobs = (container) => {
        if (cachedPatterns.length === 0) return; // Skip when no blocked keywords
        // Iterate through the job cards. If any text matches keyword,
        // add class 'blocked-job' (populated by injectCSS())to hide the element.
        // Otherwise remove the class to make it visible
        const jobCards = container.querySelectorAll('li');
        jobCards.forEach(card => {
            const shouldBlock = cachedPatterns.some(pattern => pattern.test(card.innerText));
            card.classList.toggle('blocked-job', shouldBlock);
        });
    };

    // -------------------------------
    // 3. Dynamic Loading Module
    // -------------------------------
    // Creates a "slowed down" version of blockJobs so it doesn’t run too often
    const debouncedBlockJobs = debounce(blockJobs, 200);

    const observeJobPagination = (container) => {
        // Set up an observer that reacts whenever new elements appear
        const observer = new MutationObserver((mutations) => {
            // Check if any new job cards were added
            const hasNewElements = mutations.some(m =>
                Array.from(m.addedNodes).some(node => node.nodeType === 1)
            );
            // If new jobs are found, run the blocking function (with a small delay for efficiency)
            if (hasNewElements) {
                window.requestAnimationFrame(() => {
                    debouncedBlockJobs(container);
                });
            }
        });

        // Start watching the container for changes in its children (new job cards)
        observer.observe(container, {
            childList: true,
            subtree: true
        });

        // Return the observer so it can be stopped later if needed
        return observer;
    };

    // -------------------------------
    // 4. UI Layer
    // -------------------------------
    const setupMenu = (container) => {
        const buildMenu = () => {
            // Helper function to add a new menu command
            const addMenu = (name, fn) => {
                const id = GM_registerMenuCommand(name, fn);
                menuIds.push(id);
            };

            // Remove old menu commands before rebuilding
            menuIds.forEach(id => {
                if (typeof GM_unregisterMenuCommand === 'function') {
                    GM_unregisterMenuCommand(id);
                }
            });
            menuIds = [];

            // Menu option: Add a new keyword or regex to block
            addMenu('Block Keyword / Regex', () => {
                const keyword = prompt('Enter keyword:');
                if (keyword && keywordsStore.add(keyword)) {
                    blockJobs(container);
                    buildMenu();
                }
            });

            // Menu options: Unblock each currently blocked keyword
            const currentKeywords = keywordsStore.get();
            currentKeywords.forEach(word => {
                addMenu(`Unblock: ${word}`, () => {
                    keywordsStore.remove(word);
                    // Show jobs again by removing .blocked-job
                    container.querySelectorAll('.blocked-job').forEach(card => card.classList.remove('blocked-job'));
                    blockJobs(container);
                    buildMenu(); // Refresh menu after removing
                });
            });

            // Menu option: Unblock all keywords at once
            if (currentKeywords.length > 0) {
                addMenu('Unblock All Keywords', () => {
                    if (confirm('Unblock all?')) {
                        keywordsStore.clear();
                        container.querySelectorAll('.blocked-job').forEach(el => el.classList.remove('blocked-job'));
                        buildMenu(); // Refresh menu after removing
                    }
                });
            }
        };

        buildMenu(); // Build the menu when the script starts
    };

    // -------------------------------
    // 5. Initialization Layer
    // -------------------------------
    const init = async (listSelector) => {
        try {
            injectCSS(); // Add the CSS rule that hides blocked jobs
            refreshPatterns(); // Load the saved keywords and prepare them as patterns
            const container = await waitForSelector(listSelector); // Wait until the job list appears on the page
            setupMenu(container); // Build the menu so the user can add/remove keywords
            blockJobs(container); // Immediately check the current jobs and block any that match
            observeJobPagination(container); // Keep watching for new jobs being loaded and block them too
        } catch (error) {
            console.error("LinkedIn Jobs Search Blocker: Initialization failed", error);
        }
    };

    await init(JOB_LIST_CONTAINER); // Run the initialization using the job list container selector
})();
