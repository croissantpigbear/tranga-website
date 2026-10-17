<span id="readme-top"></span>
<div align="center">

<h1>Tranga-Plus Website</h1>

<p><b>The website for <a href="https://github.com/croissantpigbear/tranga">Tranga-Plus</a></b>, the automatic manga downloader.<br/>
Search for manga, add them, and watch them download. Everything is set up from your browser.</p>

![GitHub License](https://img.shields.io/github/license/croissantpigbear/tranga-website)

<p>
Fork of <a href="https://github.com/C9Glax/tranga-website">C9Glax/tranga-website</a>. It needs the matching API,
<a href="https://github.com/croissantpigbear/tranga">croissantpigbear/tranga</a>, and both are installed together.
</p>

</div>

---

> ## 👉 To install, go to the [Tranga-Plus README](https://github.com/croissantpigbear/tranga/tree/tranga-plus#readme)
> It has step-by-step instructions for a PC, Mac, Raspberry Pi and Unraid. One `docker compose` file installs both the
> website and the API. There's nothing to install from this repository on its own.

---

## Contents

1. [What's on each page](#whats-on-each-page)
2. [Using it on a phone](#using-it-on-a-phone)
3. [How it connects to the API](#how-it-connects-to-the-api)
4. [For developers](#for-developers)
5. [Credits and licence](#credits-and-licence)

---

## What's on each page

### Home: your manga

- Every series with its cover, alternative title, writer and artist, synopsis, release status and age rating.
- At a glance: chapters downloaded, latest chapter, last download, newer chapters on MangaUpdates, volumes, years published, rating.
- Website icons show where each series downloads from.
- **Filter** by status, age rating, genre, writer, artist or publisher. Sort A–Z with a jump bar. Switch between list and cover view.
- **Select** several series to check them for new chapters or delete them together.

### Add manga (search)

- Search one website or all of them, or **paste a link** to a manga's page on any supported website.
- Detailed results: cover, writers, year, synopsis, status, age rating, MangaUpdates rating and genres, and which websites have it.
- Shows what's already in your library and warns about likely duplicates. "Title" and "Title [R18]" are recognised as different series.
- Add one result or **select several** to add at once.
- When adding: pick the library, the website, and optionally **start from chapter N** to skip chapters you've read.
- Remembers recent searches. Search results you don't add are cleaned out of the database when you leave.

### Series page

- Cover, all details, links, and buttons to open it in Kavita or Komga.
- **Download card:**
  - Which **library** it saves to.
  - Which **websites** it downloads from, switched on or off.
  - ☆ **Preferred website**: chapters come from the starred one when it has them, and the others fill gaps.
  - **Start from chapter**: change it any time. "Download all" goes back to every chapter.
- **Chapter list:** search, filter by volume or chapter, show downloaded or missing. File sizes and dates.
  Download a single chapter from a chosen website, **Re-download** one (deletes the file and fetches it again, from any
  website that has it), or **delete** a chapter's file.
- **Check for new chapters** now, view the **reader metadata** (ComicInfo.xml), **merge** a duplicate, or delete the series.

### Calendar

- A month view of **new chapters by day**. Click a day to list them.
- **Expected:** when each series' next chapter is likely, based on how often it has released. Overdue ones are highlighted.
- On a phone it's a simple list of days.

### Activity

- **History:** what Tranga has done (downloads, chapter checks, covers, details, file moves).
- **Download queue:**
  - Series waiting to download, in order. Move a series up, pause it, or **pause all** downloads.
  - **Failed chapters** are listed at the top with the reason and the next try. Retry one or all, and choose whether to be notified when Tranga gives up on one.
- **Running now:** jobs in progress, queued, and on a schedule, in plain English.
- **Logs:** live log lines with a level filter. **Download** saves them to a file to share when asking for help.

### More websites (FMD2)

- Step-by-step instructions for adding websites from [FMD2](https://github.com/dazedcat19/FMD2) modules.
- Upload modules, templates and helpers (drag and drop several at once).
- For each website: switch on or off, **Test** it on a manga link (with a log of every request), build its title list for search, delete it.
- **Updates:** see which of your modules have a newer version on FMD2, update one or all (with undo), or switch on automatic updates.

### Settings

Changes save immediately; no restart needed.

| Section | What you can do |
|---|---|
| **Libraries** | Download folders, **Import existing** series folders, connect Komga / Kavita (with a connection test), when to tell them to rescan, send Tranga's covers to Kavita |
| **Downloads** | Language, image compression, black and white |
| **Performance** | Presets for a Raspberry Pi / NAS or a desktop, or set downloads at once in total, per website, and pages at once |
| **Schedules** | How often Tranga checks for new chapters, refreshes details and covers, sends notifications and tidies up, with recommended values and "Run now" |
| **More websites** | Number of FMD2 websites, and a link to manage them |
| **Naming** | Series folder and chapter file names, with a preview and a tool to rename existing folders |
| **Reader metadata** | ComicInfo.xml for Kavita / Komga. Update every downloaded chapter in one go. |
| **Network** | FlareSolverr and the browser identity Tranga uses |
| **Login** | Switch the optional login on or off, change user name and password, make an API key for other apps |
| **Notifications** | Add, test and remove Gotify, Ntfy, Pushover or any webhook |
| **Maintenance** | Daily backup status, **download or restore a settings backup**, remove search leftovers, clear the activity log |
| **Stats** | Your library in numbers, and disk use |

### Import existing folders

Lists folders in a library that Tranga doesn't know about yet, with their file count and chapter range.
**Find series** searches every website for it. Add the right result, and Tranga uses that folder and counts the chapters
already there as downloaded. Only missing ones get downloaded.

### Login page

Shown only when the login is switched on (Settings → Login). It has a "Stay logged in for 30 days" option. Use the
logout button at the top right to log out.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Using it on a phone

The whole website works on a phone.

- Pages scroll normally.
- The header gets smaller. **Activity**, **Calendar** and the **light/dark** switch move into the ☰ menu.
- Lists and settings stack into one column.

**Tip:** in your phone's browser, use "Add to Home Screen" to open Tranga-Plus like an app.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## How it connects to the API

The website container runs nginx. It serves the website and passes requests to the API, so **only the website's port
(9555) needs to be reachable**. The API has no port of its own.

| Path | Goes to |
|---|---|
| `/` | The website |
| `/api/…` and `/v2/…` | The Tranga-Plus API (`API_URL`, default `http://tranga-api:6531`) |
| `/swagger` | The API's documentation |
| `/mangaupdates/…`, `/mangadex/…` | Read-only lookups for series details, cached for a day |

The only setting is the environment variable **`API_URL`**: where the API is. You only change it if your API container
isn't called `tranga-api`. Uploads (FMD2 modules, settings backups) can be up to 64 MB.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## For developers

- Branch: **`tranga-plus`**. Each push builds and publishes `ghcr.io/croissantpigbear/tranga-website:latest` for amd64
  and arm64 (`.github/workflows/build-images.yml`).
- Built with [Nuxt 4](https://nuxt.com) (static site), [Nuxt UI 4](https://ui.nuxt.com), Vue, Vite and Tailwind CSS, served by nginx.
- Run it locally against a running API:
  ```bash
  cd website
  npm install
  NUXT_PUBLIC_OPEN_FETCH_API_BASE_URL=http://<server>:9555/api/ npm run dev
  ```
- Build the image: `docker build -t tranga-plus-website:local .`, or build everything with `docker-compose.local.yaml`
  in the [API repository](https://github.com/croissantpigbear/tranga/tree/tranga-plus).
- Endpoints the published API schema doesn't know yet are called with `useTrangaApi()` (`app/composables/useTrangaApi.ts`).
  It also sends you to the login page when the API answers 401.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Credits and licence

- [tranga-website](https://github.com/C9Glax/tranga-website) and [Tranga](https://github.com/C9Glax/tranga) by
  [C9Glax](https://github.com/C9Glax) and contributors. 💙 Blåhaj 🦈
- Series details from [AniList](https://anilist.co), [MangaUpdates](https://www.mangaupdates.com) and [MangaDex](https://mangadex.org).
- Website modules from [FMD2](https://github.com/dazedcat19/FMD2).

Licensed under the GNU GPLv3. See [LICENSE](LICENSE).

<p align="right">(<a href="#readme-top">back to top</a>)</p>
