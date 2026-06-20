# Nodes Homepage Extension

A clean, minimal new tab homepage with a responsive digital clock, customizable pinned sites, search console, and live utility controls designed with futuristic networking vibes.

## How to Load and Test Locally (Developer Mode)

1. Ensure dependencies are installed and the extension is compiled:
   ```bash
   npm install
   npm run build
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the **`dist`** directory in this project folder (`/home/talal/Downloads/Nodes Homepage Extension/dist`).

## Distribution

The extension is compiled and ready for distribution:
* **ZIP Archive:** The `nodes-homepage-extension.zip` file contains the complete build ready to be uploaded directly to the Chrome Web Store or shared.
* **Rebuilding:** If you make changes in the `src` folder, simply run `npm run build` again to recompile, then click **Reload** in `chrome://extensions/`.
