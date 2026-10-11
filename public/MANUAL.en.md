# Photo Folder Organizer - User Manual

Thank you for using Photo Folder Organizer. This app sorts many photo folders by date and lets you rename them with a date prefix. Everything runs inside your browser, so your photos stay private while you organize them.

This manual explains the basics and the handy features.

---

## Contents

1.  Main features
2.  Requirements
3.  How to use it (step by step)
    *   Step 1: Prepare your folders
    *   Step 2: Open the app
    *   Step 3: Choose the date rule
    *   Step 4: Drag & drop the folder
    *   Step 5: Name the folders
    *   Step 6A: Copy into organized folders (recommended)
    *   Step 6B: Download the rename script
4.  Privacy and security
5.  FAQ

---

## 1. Main features

*   **📂 Local processing:** Your photos are processed only in the browser on your computer. Nothing is uploaded to a server.
*   **📅 Sorting by date:** The capture date (EXIF) of the photos in each folder is read and the folders are listed in chronological order. For folders whose photos have no capture date, the date is estimated from file modification times, and the app tells you so.
*   **✏️ Your own names:** You choose the name of each folder; the date prefix is added automatically.
*   **💻 Copy into organized folders:** In Chrome and Edge, the app creates folders with the new names and copies your photos into them (your original photos are not changed).
*   **📜 Rename script:** Download a script (`.bat` for Windows, `.sh` for Mac/Linux) that renames the folders in place.
*   **⚡ Built for large libraries:** Processing runs in the background in batches, so the page stays responsive even with many photos.

## 2. Requirements

### 🌐 Browsers
*   **Recommended:** the latest **Google Chrome** or **Microsoft Edge**
    *   Supports "Copy into Organized Folders" (File System Access API)
*   **Basic features:** latest Firefox and Safari
    *   The rename script is available
*   **Not supported:** mobile browsers (phones and tablets)

### 📁 Folder layout
The photo folders you want to organize must sit inside one parent folder.

```
Example:
My_Trip_Photos/  ← drag & drop this parent folder
├── Tokyo/
│   ├── IMG_001.jpg
│   ├── IMG_002.heic
│   └── photo.png
├── Kyoto/
│   ├── kyoto1.jpg
│   └── kyoto2.webp
└── Osaka_Food/
    ├── takoyaki.jpg
    └── okonomiyaki.gif
```

### 💾 Supported file formats
**Standard images:** JPEG, PNG, HEIC/HEIF, WebP, GIF, BMP, TIFF
**RAW files:** CR2, CR3, NEF, NRW, ARW, SRF, SR2, DNG, RAF, ORF, RW2, PEF, SRW, X3F, KDC, DCR, MRW, 3FR, FFF, IIQ, RWL

**📸 About RAW files:**
- The JPEG preview embedded in the RAW file is extracted and shown as the thumbnail
- The capture date is read from EXIF for sorting
- Works with the major brands (Canon, Nikon, Sony, Adobe, Fujifilm, Olympus, Panasonic, ...)
- When no preview can be extracted, a RAW tile is shown instead

## 3. How to use it (step by step)

### Step 1: Prepare your folders

Put the photo folders you want to organize into one parent folder.

**Example:**
```
Trip_Photos/  ← prepare this parent folder
├── Tokyo/
├── Kyoto/
└── Osaka_Food/
```

### Step 2: Open the app

Open Photo Folder Organizer in your browser. The top of the page reminds you that **your photos are processed locally in your browser and are never uploaded**.

### Step 3: Choose the date rule

Below the drop area, choose which date represents each folder:

*   **📅 Oldest Date (recommended):** the earliest capture date in the folder
    *   Best when you want folders named after the first day of a trip
*   **📅 Newest Date:** the latest capture date in the folder

### Step 4: Drag & drop the folder

Drag the **parent folder** onto the "Drag & Drop Your Folder Here" area, or click the area to choose it.

**While processing:**
*   The folders are scanned and the EXIF data of the photos is read
*   A progress bar shows how far along it is
*   Depending on the number of photos this takes a few seconds to a few minutes
*   Press "Cancel" if you want to stop

### Step 5: Name the folders

When processing finishes, every folder is shown as a card with:

*   📸 **Photo preview** (up to 4 thumbnails; click one to view it larger)
*   📅 **Representative date**
*   📁 **Original folder name**
*   ✏️ **Field for the new name**

**What to do:**
1.  **Enter a new name** for each folder
    *   Example: `Tokyo` → saved as `2023-08-15_Tokyo`
2.  **Confirm:** click 💾 "Confirm All Names"
    *   A name containing characters folders can't have (`\ / : * ? " < > |`), or two folders that would end up with the same date and name, are shown with an error under the field and are not confirmed
3.  **Edit if needed:** click a confirmed name to edit it again

**💡 Your names are saved automatically:** the names you type are kept in this browser. If you reload the page or load the same folder again, they are restored. To start over, press "Start over" in the notice that appears.

### Step 6A: Copy into organized folders (recommended)

**In Chrome or Edge, this is the easiest way!**

Once at least one folder name is confirmed, the 💻 **"Copy into Organized Folders"** button at the top becomes available.

**What to do:**
1.  **Click 💻 "Copy into Organized Folders"**
2.  **Choose the destination** in the folder picker (closing the picker does nothing)
3.  **The app then:**
    *   Creates a folder with the new name in the destination
    *   **Copies** the photos into it (your originals stay where they are)
    *   Shows the progress as it goes (you can cancel at any time)

**Safety rules:**
*   If the destination already has a different file with the same name, nothing is overwritten: the copy is saved with a number, like `IMG_0001 (2).jpg`
*   If the same file is already there (for example when you run it again into the same destination), it is skipped

**Done!** Your photos are organized in the newly named folders. The originals are unchanged; delete them yourself once you have checked the result, if you no longer need them.

### Step 6B: Download the rename script

**For Firefox and Safari, or if you prefer to rename the folders in place**

Once at least one folder name is confirmed, the 📜 **"Download Rename Script"** button at the bottom becomes available.

**What to do:**
1.  **Click 📜 "Download Rename Script"**
2.  **The script is downloaded:**
    *   Windows: `rename_folders.bat`
    *   Mac/Linux: `rename_folders.sh`

**Running the script:**
1.  Move the downloaded script into the **original parent folder**
2.  Run it:
    *   **Windows:** double-click `rename_folders.bat`
    *   **Mac/Linux:** run `sh rename_folders.sh` in a terminal

**Result:** all folders are renamed at once. If a folder with the new name already exists, that folder is skipped (nothing is overwritten or moved inside another folder).

---

## 4. Privacy and security

### 🔒 Your privacy comes first

This app is **designed around the privacy of your photos**.

**✅ Everything happens in your browser**
*   All file processing (reading EXIF data, thumbnails, analyzing folders) happens inside your browser
*   Photos and file information are **never** sent to a server

**✅ How data is handled**
*   Photo data is only held in memory while you use the app
*   It is released when processing is done
*   Photos and file information never go over the network
*   Only the folder names you type are kept in this browser's local storage, so they can be restored after a reload (they are never sent anywhere)

**✅ Open source**
*   The source code is public on GitHub
*   You can check exactly what the app does

---

## 5. FAQ

### 🔧 **Basics**

**Q: I dropped a folder but nothing shows up**
**A:** Please check:
*   📁 **Folder layout:** did you drop a parent folder that contains sub-folders?
*   📸 **Image files:** do the sub-folders contain supported images (JPEG, PNG, HEIC, ...)?
*   🌐 **Browser:** are you using the latest Chrome, Edge, Firefox or Safari?
*   🕐 **Time:** with many photos, processing can take a while

**Q: Processing is very slow**
**A:** These affect processing time:
*   📊 The number of photos (thousands of photos can take a few minutes)
*   💻 The speed of your computer
*   🔍 Reading the EXIF data

### 💻 **Browser-specific questions**

**Q: I can't find the "Copy into Organized Folders" button**
**A:** It is only available in Chrome and Edge. In Firefox and Safari, use the rename script.

**Q: A file access permission dialog appears**
**A:** Chrome and Edge ask for permission before "Copy into Organized Folders" can write to the destination. Choose "Allow".

### 📜 **Rename script**

**Q: I ran the script but the folder names didn't change**
**A:** Please check:
*   📁 The script is inside the original parent folder
*   🖱️ It was run the right way (double-click on Windows, terminal on Mac/Linux)
*   🔑 On Mac/Linux, run it as `sh rename_folders.sh` (no need to make it executable)

**Q: The script prints "Skipped"**
**A:** For safety, a folder is left unchanged when a folder with the new name already exists ("already exists") or when the original folder can't be found ("not found"). Check the folders listed. Characters that folder names can't contain are already checked when you type the names.

### 🔍 **Other**

**Q: Which image formats are supported?**
**A:**
- **Standard images:** JPEG, PNG, HEIC/HEIF, WebP, GIF, BMP, TIFF
- **RAW files:** the major formats, including CR2, CR3, NEF, NRW, ARW, SRF, SR2, DNG, RAF, ORF, RW2, PEF, SRW and X3F

**Q: My RAW files show no thumbnail**
**A:** Some RAW files have no embedded preview. A RAW tile is shown instead; the EXIF date is still read and sorting works normally.

**Q: My HEIC photos (from an iPhone) show no thumbnail**
**A:** Chrome, Edge and Firefox can't display the HEIC format, so a "HEIC" tile is shown instead (Safari shows the photo). The capture date is still read and the folders are organized normally.

**Q: RAW files are slow to process**
**A:** RAW files are much larger than regular images (typically 20–100 MB), so they take longer. Very large files (100 MB or more) can take several seconds each.

**Q: Are video files processed?**
**A:** No. Only image files are supported at the moment.
