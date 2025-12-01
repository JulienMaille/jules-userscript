// ==UserScript==
// @name         Jules Patch Downloader
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Adds a button to download the patch file for the current PR on jules.google.com
// @author       Jules
// @match        https://jules.google.com/session/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      github.com
// ==/UserScript==

(function() {
    'use strict';

    console.log('Jules Patch Downloader: Script loaded');

    // --- UTILITIES ---

    function waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                callback(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function getBranchName() {
        const branchElement = document.querySelector('.code-header-branch-name-container');
        return branchElement ? branchElement.textContent.trim() : 'patch';
    }

    /**
     * Uses GM_xmlhttpRequest to bypass CORS and force a file download
     */
    function downloadPatchFile(url, filename, buttonElement) {
        // Sanitize URL and ensure .patch extension
        const cleanUrl = url.split('?')[0];
        const patchUrl = cleanUrl.endsWith('.patch') ? cleanUrl : cleanUrl + '.patch';

        // Extract info for filename if not provided or generic
        if (!filename || filename === 'patch.patch') {
            const match = cleanUrl.match(/\/pull\/(\d+)/);
            const prNumber = match ? match[1] : 'unknown';
            const branchName = getBranchName().replace(/[^a-zA-Z0-9-_]/g, '_');
            filename = `${prNumber}-${branchName}.patch`;
        }

        const originalText = '.patch ⤓';
        buttonElement.textContent = 'Downloading...';
        buttonElement.disabled = true;

        console.log(`Jules Patch Downloader: Fetching ${patchUrl}`);

        GM_xmlhttpRequest({
            method: "GET",
            url: patchUrl,
            onload: function(response) {
                if (response.status === 200) {
                    const blob = new Blob([response.responseText], { type: "text/plain" });
                    const blobUrl = window.URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();

                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(blobUrl);
                } else {
                    console.error('Jules Patch Downloader: Failed to fetch patch', response.statusText);
                    alert('Failed to download patch. Check console for details.');
                }
                buttonElement.textContent = originalText;
                buttonElement.disabled = false;
            },
            onerror: function(err) {
                console.error('Jules Patch Downloader: Network error', err);
                alert('Network error while downloading patch.');
                buttonElement.textContent = originalText;
                buttonElement.disabled = false;
            }
        });
    }

    // --- MAIN LOGIC ---

    function init() {
        // Target .panel-buttons instead of .code-header-buttons
        waitForElement('.panel-buttons', (container) => {
            if (document.querySelector('.jules-download-patch-button')) return;

            // Clone an existing button for consistent styling (likely the "Collapse all" button)
            const templateButton = container.querySelector('button');
            let newButton;

            if (templateButton) {
                newButton = templateButton.cloneNode(true);
                newButton.classList.add('jules-download-patch-button');

                // Ensure the class is added (not removed)
                newButton.classList.add('collapse-all-button');

                // Ensure styling matches but text is correct
                newButton.textContent = '.patch 🩹';
            } else {
                newButton = document.createElement('button');
                newButton.textContent = '.patch 🩹';
                newButton.className = 'jules-download-patch-button collapse-all-button';
            }

            // Style adjustments for the new location
            newButton.style.marginRight = '8px'; // Add space to the right
            newButton.style.marginLeft = '0px';  // Reset left margin
            newButton.style.cursor = 'pointer';

            // Insert before the first child to place it at the beginning
            if (container.firstChild) {
                container.insertBefore(newButton, container.firstChild);
            } else {
                container.appendChild(newButton);
            }

            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                console.log('Jules Patch Downloader: Clicked. Starting Active Hijack...');

                // Try Active Search (Clicking the hidden button)
                const viewPrButton = document.querySelector('button.view-button') ||
                                     document.querySelector('swebot-publish-button button') ||
                                     document.querySelector('.publish-button button');

                if (viewPrButton) {
                    console.log('Jules Patch Downloader: [TRACE] Active Hijack Starting. Found button:', viewPrButton);

                    const originalWindowOpen = unsafeWindow.open;
                    let capturedUrl = null;

                    unsafeWindow.open = function(url, target, features) {
                        console.log('Jules Patch Downloader: [TRACE] Captured URL via hijack:', url);
                        capturedUrl = url;
                        return { focus: function(){}, close: function(){} };
                    };

                    try {
                        viewPrButton.click();
                    } catch (err) {
                        console.error('Jules Patch Downloader: [TRACE] Click failed', err);
                    } finally {
                        unsafeWindow.open = originalWindowOpen;
                    }

                    if (capturedUrl) {
                        console.log('Jules Patch Downloader: [TRACE] Hijack SUCCESS. Proceeding to download.');
                        downloadPatchFile(capturedUrl, null, newButton);
                    } else {
                         console.error('Jules Patch Downloader: [TRACE] Hijack FAILED. Button clicked but no URL captured.');
                         alert('Could not detect PR URL. Is the View PR button working?');
                    }

                } else {
                    console.error('Jules Patch Downloader: [TRACE] Hijack FAILED. Could not find any View PR button to hijack.');
                    alert('Could not find the PR URL or the View PR button on this page.');
                }
            });
        });
    }

    init();

})();
