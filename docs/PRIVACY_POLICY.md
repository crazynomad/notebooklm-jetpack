# Privacy Policy — NotebookLM Jetpack

**Last updated:** February 24, 2025

## Overview

NotebookLM Jetpack is a free, open-source Chrome extension that helps you import content into Google NotebookLM. We are committed to protecting your privacy.

## Data Collection

**We do not collect, store, or transmit any personal data.** Period.

- No analytics or tracking
- No user accounts or registration
- No data sent to third-party servers
- No cookies for tracking purposes

## How the Extension Works

All processing happens **entirely in your browser**:

- **Web page content** is fetched and processed locally to extract article text
- **Bookmarks** are stored in Chrome's local storage (`chrome.storage.local`) on your device only
- **Import history** is stored locally and never leaves your browser
- **RSS feeds** are fetched directly from the feed URL by your browser
- **AI conversation extraction** reads the current page DOM locally — nothing is transmitted externally

## Permissions Used

| Permission | Purpose |
|---|---|
| `activeTab` | Access the current tab to extract content for import |
| `storage` | Store bookmarks, settings, and import history locally |
| `scripting` | Inject content scripts to extract page content and interact with NotebookLM |
| `tabs` | Read tab URLs to detect supported platforms (NotebookLM, AI chat sites, doc sites) |
| `contextMenus` | Add "Import to NotebookLM" to the right-click menu |
| `notifications` | Show import completion notifications |
| Host permissions (`notebooklm.google.com`, `claude.ai`, `chatgpt.com`, `gemini.google.com`) | Interact with these specific sites for content extraction and import |

## Third-Party Services

The extension communicates **only** with the websites you choose to import from, and with NotebookLM to perform the import. No other third-party services are contacted.

## Data Storage

All data is stored locally using `chrome.storage.local`:
- Bookmarks and collections
- Import history (last 100 entries)
- Language preference

You can clear all stored data by removing the extension.

## Open Source

This extension is fully open source. You can audit the code at any time:
https://github.com/crazynomad/notebooklm-jetpack

## Children's Privacy

This extension is not directed at children under 13 and does not knowingly collect information from children.

## Changes to This Policy

We may update this policy from time to time. Changes will be posted to this page and reflected in the "Last updated" date.

## Contact

If you have questions about this privacy policy, please open an issue on GitHub:
https://github.com/crazynomad/notebooklm-jetpack/issues

---

*NotebookLM Jetpack is made by Green Train Podcast (绿皮火车播客)*
