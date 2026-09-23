# KrishiVerse (Social Community Platform)

KrishiVerse is a community-driven mobile social platform designed for farmers, agronomists, and rural producers to exchange agricultural knowledge, diagnose crop issues, share field updates, and discuss farming practices. Users can publish posts containing up to six compressed photos, categorize discussions using hashtags that support regional languages, react and reply to threaded comments, bookmark practical guides for offline review, follow other community members, and search for specific agricultural topics or users.

---

## The Two-Halves Architecture

This repository is structured as a monorepo containing two decoupled systems that must run concurrently for the application to function:

```
┌─────────────────────────────────────────────────────────┐
│                      KrishiVerse                        │
├────────────────────────────┬────────────────────────────┤
│           Posts/           │       posts-backend/       │
│    (Mobile Application)    │     (REST API Backend)     │
│   React Native 0.85 + Expo │ Node.js + Express + Mongo  │
└────────────────────────────┴────────────────────────────┘
```

* **`Posts/` (Frontend):** A cross-platform mobile client built on React Native 0.85 and Expo SDK 56. It manages user presentation, local state caching via TanStack React Query v5, device image compression via `expo-image-manipulator`, and hardware-backed camera capture.
* **`posts-backend/` (Backend):** A Node.js and Express REST API service connected to MongoDB for relational-like social data, Redis for feed caching and mutation idempotency, and ImageKit for cloud image delivery and storage.

**Both halves must run together during development; the mobile application cannot authenticate, fetch feeds, or upload photos without an active backend service on the local network.**

---

## Table of Contents

### Getting It Running
1. [Prerequisites](#prerequisites)
2. [First-Time Setup](#first-time-setup)
3. [Day-to-Day Run Routine](#day-to-day-run-routine)
4. [Environment Variables Reference](#environment-variables-reference)

### Understanding It
5. [Architecture Walkthrough](#architecture-walkthrough)
6. [Feature-by-Feature Implementation Details](#feature-by-feature-implementation-details)
7. [Directory Map](#directory-map)
8. [Non-Obvious Decisions, and Why](#non-obvious-decisions-and-why)
9. [API Reference Table](#api-reference-table)
10. [Data Model & Schema Reference](#data-model--schema-reference)
11. [Database Indexes & Performance](#database-indexes--performance)

### Working On It
12. [Testing](#testing)
13. [Feature Status](#feature-status)
14. [Known Problems & Security Gaps](#known-problems--security-gaps)
15. [Troubleshooting by Symptom](#troubleshooting-by-symptom)
16. [Technical Glossary](#technical-glossary)
17. [Contributing & Conventions](#contributing--conventions)

---

## Prerequisites

Ensure the following tools are installed on your host machine before starting:

| Tool | Verified Version | Purpose | Download / Installation Source |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v22.x LTS` (min `v20.x`) | JavaScript runtime for both mobile tooling (Metro) and the API server. | [nodejs.org](https://nodejs.org/) |
| **npm** | `v10.x` | Dependency package manager. | Bundled with Node.js |
| **MongoDB** | `v6.0+` or Atlas URI | Primary document datastore for users, posts, comments, likes, and follows. | [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community) or MongoDB Atlas |
| **Redis** | `v7.x` (Optional) | In-memory cache for feed queries and distributed mutation locks (`idempotency`). | [redis.io](https://redis.io/) or [Memurai for Windows](https://www.memurai.com/) |
| **Expo Go** / Dev Client | SDK 56 Compatible | Physical mobile runtime on Android or iOS. | Google Play Store or Apple App Store |
| **ImageKit.io Account** | API v5 | Object storage, CDN delivery, and transformations for post and avatar images. | [imagekit.io](https://imagekit.io/) |
| **Git** | `v2.40+` | Version control system. | [git-scm.com](https://git-scm.com/) |

**The backend requires Node.js v20 or higher to support native Node test runners and modern fetch APIs.**

---

## First-Time Setup

Execute these steps in sequence using PowerShell on Windows or bash on Unix.

### Step 1: Clone the Repository
```powershell
git clone https://github.com/UdayBarman001/Social_media.git
cd Social_media
```

### Step 2: Configure and Start the Backend

1. Navigate to the backend directory and install dependencies:
   ```powershell
   cd posts-backend
   npm install
   ```

2. Create the `.env` configuration file from `.env.example`:
   ```powershell
   Copy-Item .env.example .env
   ```

3. Open `posts-backend/.env` and configure your credentials. The required environment variables to set (names only) are:
   - `PORT`
   - `NODE_ENV`
   - `CLIENT_ORIGINS`
   - `MONGO_URI`
   - `CURSOR_SECRET`
   - `REDIS_URL`
   - `REDIS_FEED_TTL_SECONDS`
   - `REDIS_POST_TTL_SECONDS`
   - `REDIS_COMMENTS_TTL_SECONDS`
   - `REDIS_FOLLOWS_TTL_SECONDS`
   - `REDIS_USER_TTL_SECONDS`
   - `IMAGEKIT_PUBLIC_KEY`
   - `IMAGEKIT_PRIVATE_KEY`
   - `IMAGEKIT_URL_ENDPOINT`
   - `RATE_LIMIT_WINDOW_MS`
   - `RATE_LIMIT_MAX`

> **Warning: Always include the database name (`/krishiverse`) at the end of your `MONGO_URI`. If omitted, MongoDB writes to the `test` database by default, causing data isolation issues across deployments.**

4. Seed initial mock data (optional but recommended for local UI testing):
   ```powershell
   npm run seed
   ```

5. Launch the backend development server:
   ```powershell
   npm run dev
   ```
   *Verification:* Open `http://localhost:4000/health/ready` in your browser. You should receive `{"success":true,"message":"Service is healthy and ready to accept traffic"}`.

### Step 3: Configure and Start the Frontend

1. In a new terminal window, navigate to the frontend folder and install packages:
   ```powershell
   cd Posts
   npm install
   ```

2. Create the frontend `.env` file from `.env.example`:
   ```powershell
   Copy-Item .env.example .env
   ```

3. Determine your development computer's local Wi-Fi / LAN IP address:
   ```powershell
   ipconfig
   # Look for "IPv4 Address" under your active Wi-Fi adapter (e.g., 192.168.1.36)
   ```

4. Edit `Posts/.env` and supply your variables. The required environment variables to set (names only) are:
   - `EXPO_PUBLIC_LAN_IP`
   - `EXPO_PUBLIC_API_PORT`

#### Target Device Network Routing Reference

| Runtime Target | Base URL Resolution in Code | Value for `EXPO_PUBLIC_LAN_IP` | Why This Specific Value Is Needed |
| :--- | :--- | :--- | :--- |
| **Physical Phone (Expo Go / APK)** | `http://${LAN_IP}:${PORT}` | Your machine's Wi-Fi IP (e.g., `192.168.1.36`) | **A physical phone evaluates `localhost` as itself, causing immediate connection refusal.** Phone and laptop must be on the same Wi-Fi. |
| **Android Studio Emulator** | `http://${LAN_IP}:${PORT}` | `10.0.2.2` or your machine's LAN IP | The Android emulator uses `10.0.2.2` as an internal virtual bridge to the host machine's `127.0.0.1`. |
| **iOS Simulator** | `http://${LAN_IP}:${PORT}` | `localhost` or LAN IP | iOS simulators share the host machine network namespace directly. |
| **Web Browser** (`npm run web`) | `http://localhost:${PORT}` | Handled automatically | `Platform.OS === 'web'` branches to `http://localhost:4000` regardless of env settings. |

5. Start the Metro bundler:
   ```powershell
   npx expo start
   ```
6. Scan the terminal QR code using the Expo Go application on Android or the Camera app on iOS.

---

## Day-to-Day Run Routine

After initial configuration, start both processes in two separate terminals:

```powershell
# Terminal 1: Backend API
cd posts-backend
npm run dev

# Terminal 2: Expo Metro Bundler
cd Posts
npx expo start -c
```

*Tip:* Pass `-c` to Expo to clear Metro cache whenever package exports or environment variables change.

---

## Environment Variables Reference

Every variable in this table has been verified directly in [`posts-backend/config/env.js`](file:///D:/ReactNative/posts-backend/config/env.js) and [`Posts/src/shared/services/config.js`](file:///D:/ReactNative/Posts/src/shared/services/config.js).

### Backend (`posts-backend/.env`)

| Variable | Type | Default Value | Description | Consequence If Missing / Misconfigured |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | `development` | Runtime environment mode (`development` or `production`). | Determines stack trace visibility in error responses and logging verbosity. |
| `PORT` | Number | `4000` | HTTP port on which the Express server listens. | Server cannot bind; port conflicts if occupied. |
| `CLIENT_ORIGINS` | Comma-delimited | `*` | Allowed origins for Cross-Origin Resource Sharing (CORS). | Web requests from browser clients will fail with CORS preflight errors. |
| `MONGO_URI` | String | `mongodb://127.0.0.1:27017/krishiverse` | MongoDB connection string URI. | **Fatal error on boot:** Server immediately exits with code 1 via `connectDB()`. |
| `CURSOR_SECRET` | String | `dev-insecure-cursor-secret` | Cryptographic secret for signing cursor pagination HMAC tokens. | Does not crash, but forged/tampered pagination cursors cannot be verified. |
| `REDIS_URL` | String | `redis://127.0.0.1:6379` | Connection URI for Redis cache server. | **Fail-open:** App logs a warning and falls back to MongoDB for all queries without crashing. |
| `REDIS_FEED_TTL_SECONDS` | Number | `30` | Time-to-live for cached feed pages in Redis. | Stale feed data if too high; increased DB query load if too low. |
| `REDIS_POST_TTL_SECONDS` | Number | `300` | Cache retention for individual post details. | Stale post detail reads; default 5 minutes. |
| `REDIS_COMMENTS_TTL_SECONDS` | Number | `60` | Cache retention for comment listings per post. | Delayed comment visibility across clients. |
| `REDIS_FOLLOWS_TTL_SECONDS` | Number | `300` | Cache retention for follower/following lists and counts. | Stale profile follow count metrics. |
| `REDIS_USER_TTL_SECONDS` | Number | `300` | Cache retention for user profile lookups. | Stale profile attributes (bio, name, avatar). |
| `IMAGEKIT_PUBLIC_KEY` | String | `undefined` | ImageKit client-side public API identifier. | Media uploads fail with ImageKit initialization error. |
| `IMAGEKIT_PRIVATE_KEY` | String | `undefined` | ImageKit secret key for server-side image deletion and uploads. | **Image uploads and cascading image deletions fail with 500 error.** |
| `IMAGEKIT_URL_ENDPOINT` | String | `undefined` | Base CDN URL endpoint registered with ImageKit. | Generated image URLs fail to resolve or point to invalid domains. |
| `RATE_LIMIT_WINDOW_MS` | Number | `900000` (15 mins) | Time frame window for client IP rate limiting. | Limits calculated over default 15-minute intervals. |
| `RATE_LIMIT_MAX` | Number | `300` | Maximum HTTP requests allowed per client IP within the window. | Excessive client requests rejected with HTTP 429 Too Many Requests. |

### Frontend (`Posts/.env`)

| Variable | Type | Default Value | Description | Consequence If Missing / Misconfigured |
| :--- | :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_LAN_IP` | String | `192.168.1.36` | Local IPv4 address of the computer running `posts-backend`. | **App shows "Network request failed" on physical devices; feeds and user logins will not load.** |
| `EXPO_PUBLIC_API_PORT` | Number | `4000` | Port matching the backend `PORT` setting. | Client attempts requests to the wrong network port. |

---

## Architecture Walkthrough

The backend employs a decoupled Layered Clean Architecture pattern:
1. **Controller Layer:** Handles HTTP serialization, status codes, query extraction, and input validation mapping.
2. **Service Layer:** Houses domain business logic, multi-entity orchestration, transaction lifecycles, and cache invalidations.
3. **Repository Layer:** Encapsulates direct Mongoose database queries, projection filters, and index-optimized sorting.
4. **Model Layer:** Defines Mongoose data schemas, field validations, and document lifecycle middleware.

### End-to-End Sequence: Liking a Post

```
Mobile Client               Express Router / MW        Like Service             MongoDB           Redis Cache
    │                               │                       │                      │                   │
    ├─ 1. POST /posts/:id/like ────>│                       │                      │                   │
    │  (Headers: x-user-id,         ├─ 2. requestId + CORS  │                      │                   │
    │   Idempotency-Key)            ├─ 3. Idempotency Check ──────────────────────────────────────────>│ Check In-Flight
    │                               ├─ 4. validateRequest   │                      │                   │
    │                               ├─ 5. Controller Invoke │                      │                   │
    │                               │          │            │                      │                   │
    │                               │          └───────────>├─ 6. withTransaction  │                   │
    │                               │                       │          │           │                   │
    │                               │                       │          ├─ 7. Find ─┼──────────────────>│
    │                               │                       │          ├─ 8. Insert│ (Like Model)      │
    │                               │                       │          ├─ 9. $inc ─┼──────────────────>│ Update likeCount
    │                               │                       │          │           │                   │
    │                               │                       ├─ 10. Invalidate Post Cache ─────────────>│ DEL post:{id}
    │                               │                       ├─ 11. Async Notification Fan-Out          │
    │                               │          ┌────────────┤                      │                   │
    │                               │<─────────┘            │                      │                   │
    │<─ 12. 200 OK (ApiResponse) ───┤                       │                      │                   │
    │   { success: true, ... }      │                       │                      │                   │
    ▼                               ▼                       ▼                      ▼                   ▼
```

### Layer Rationale
* **Why Controllers Don't Query MongoDB Directly:** Controllers only format inputs and outputs. Decoupling allows service logic (like triggering notifications on a like) to be reused across different routes without duplicating database logic.
* **Why Services Don't Return HTTP Responses:** Services throw standardized `ApiError` instances. The centralized `errorHandler` middleware catches these and formats consistent responses, preventing unhandled exceptions from leaking server internals.
* **Why Repositories Isolate Mongoose:** Database-specific logic (aggregation pipelines, cursor transformations, index hints) is contained in one file. If schema fields change or Atlas Search replaces regex, only the repository changes.

---

## Feature-by-Feature Implementation Details

### 1. Cursor-Based Feed Pagination
* **How It Works:** Rather than using SQL-style `skip(offset)` and `limit()`, the feed endpoint ([`features/posts/post.repository.js`](file:///D:/ReactNative/posts-backend/features/posts/post.repository.js)) uses opaque composite cursors composed of `{ createdAt, _id }`. Cursors are base64-encoded and signed via HMAC-SHA256 using `CURSOR_SECRET`.
* **The Non-Obvious Reason:** In high-velocity feeds where new posts arrive constantly, offset pagination causes "page drift" (users see identical posts repeated or skip posts entirely as new records shift the table). Furthermore, MongoDB `skip(5000)` performs an $O(N)$ linear index scan, whereas cursor queries (`createdAt: { $lt: cursorDate }`) perform an instant $O(\log N)$ binary tree seek.

### 2. Client-Side Image Pre-Compression
* **How It Works:** In [`Posts/src/shared/utils/imageCompressor.js`](file:///D:/ReactNative/Posts/src/shared/utils/imageCompressor.js), before multipart payload assembly, images straight from the camera sensor (4MB to 12MB) are processed using `expo-image-manipulator`. Dimensions are scaled down to a maximum width of 1440px at 78% JPEG quality.
* **The Non-Obvious Reason:** Rural users frequently operate on unstable 3G/4G networks. Uploading 6 uncompressed raw images (30MB–60MB) results in frequent socket timeouts and massive memory allocation spikes. Compressing on-device drops payload sizes to ~300KB per image (a 95% reduction) with no perceptual loss on mobile displays.

### 3. Unicode and Regional Indic Hashtag Extraction
* **How It Works:** [`Posts/src/shared/utils/hashtags.js`](file:///D:/ReactNative/Posts/src/shared/utils/hashtags.js) extracts tags directly from post captions using the regex:
  ```javascript
  /#([\p{L}\p{N}\p{M}_]+)/gu
  ```
* **The Non-Obvious Reason:** Standard regex `\w` in JavaScript is strictly ASCII `[A-Za-z0-9_]`. The `u` flag alone does not make `\w` Unicode-aware. For Hindi, Marathi, and other Indic scripts used by farmers, vowels and accents are classified under Unicode category `Mark` (`\p{M}`), not `Letter` (`\p{L}`). Without `\p{M}`, an input like `#खेती` truncated to `#ख` at the first matra mark. Including `\p{M}` preserves full regional words.

### 4. Nested Comments and Threading
* **How It Works:** [`features/comments/comment.model.js`](file:///D:/ReactNative/posts-backend/features/comments/comment.model.js) stores a self-referencing `parentComment` ObjectId. Comment lists are sorted chronologically.
* **The Non-Obvious Reason:** Instead of maintaining recursive comment trees or a separate "replies" collection, comments remain in a single flat collection with a parent pointer. On the frontend, [`nestComments.js`](file:///D:/ReactNative/Posts/src/features/comments/utils/nestComments.js) builds the single-depth visual tree in $O(N)$ time, avoiding complex relational joins on the server.

### 5. Polymorphic Reactions (Likes and Dislikes)
* **How It Works:** [`features/likes/like.model.js`](file:///D:/ReactNative/posts-backend/features/likes/like.model.js) uses `targetType` (`'Post'` or `'Comment'`) and `targetId` along with a `type` (`'like'` or `'dislike'`).
* **The Non-Obvious Reason:** Posts only support likes, but comments allow both likes and dislikes. Using a single polymorphic model with a unique compound index `{ user: 1, targetType: 1, targetId: 1 }` guarantees at the database engine level that a user can never hold both a like and a dislike on the same item simultaneously. Switching reaction types simply updates the existing record.

### 6. Zero-Friction Device Identity Bootstrap
* **How It Works:** [`features/users/user.controller.js`](file:///D:/ReactNative/posts-backend/features/users/user.controller.js) implements `loginDevice`, which takes a hardware-generated UUID (`deviceId`) and creates or loads a user document without password friction.
* **The Non-Obvious Reason:** In agricultural communities, complex registration screens and SMS OTP requirements cause massive onboarding drop-offs. Hardware UUIDs allow instant account provisioning while maintaining a distinct user identity for social graphs and posts.

---

## Directory Map

### Backend (`posts-backend/`)
```
posts-backend/
├── config/                  # Configuration loaders (env.js, database.js, redis.js, imagekit.js)
├── constants/               # Global enumerations (Roles, TargetTypes, Audience, ReportStatus)
├── database/                # DB connection scripts, migrations, and seed data generator
├── features/                # Domain feature modules (controller, service, repository, model, routes)
│   ├── bookmarks/           # Saved posts management
│   ├── comments/            # Post comments and reply threading
│   ├── follows/             # Social follow graph and count management
│   ├── likes/               # Polymorphic post and comment reactions
│   ├── notifications/       # Activity notification dispatch and read states
│   ├── posts/               # Core post creation, feed filtering, and media handling
│   ├── reports/             # Content reporting and moderation queue
│   └── users/               # Profiles, device login bootstrap, and user search
├── middleware/              # Global Express middlewares (error handling, idempotency, rate limiting)
├── routes/                  # API v1 central mounting router and health checks
├── scripts/                 # Migration scripts (Atlas search index, name normalization)
├── tests/                   # Backend integration and unit test suites
├── utils/                   # Shared utility classes (ApiError, ApiResponse, cache, cursor)
├── app.js                   # Express application setup and middleware pipeline definition
└── server.js                # Process entrypoint, server listener, and graceful shutdown handlers
```

### Frontend (`Posts/`)
```
Posts/
├── android/                 # Native Android project configuration and Gradle wrappers
├── assets/                  # Application icons, logos, and splash screen graphics
├── src/
│   ├── app/                 # Expo Router file-based screens (_layout.jsx, index.jsx, create.jsx)
│   ├── features/            # Feature-scoped screens, components, and custom hooks
│   │   ├── comments/        # Comment sheet, comment rows, skeleton loaders
│   │   ├── create-post/     # Post creation composer, media source pickers
│   │   ├── feed/            # Feed list screen, FeedContext state manager, skeleton cards
│   │   ├── notifications/   # Notification center screen and activity rows
│   │   ├── posts/           # PostCard UI, media carousels, action buttons
│   │   ├── profile/         # User profile views and follower counts
│   │   └── search/          # Post and user search screens
│   ├── shared/              # Shared cross-cutting components and services
│   │   ├── components/      # Global dialogs, sheets, and SheetHost root portal
│   │   ├── context/         # LocalUserContext device identity store
│   │   ├── hooks/           # useMediaPicker, useDragToDismiss
│   │   ├── queries/         # TanStack Query mutations and hooks
│   │   ├── services/        # Centralized HTTP client and sub-domain API callers
│   │   ├── theme/           # UI color palettes and style constants
│   │   ├── ui/              # Atom components (Avatar, TopBar, BottomNav, ProgressiveImage)
│   │   └── utils/           # Helper functions (hashtags, imageCompressor, userCache)
│   └── global.css           # Tailwind CSS styles compiled via NativeWind
├── app.json                 # Expo manifest configuration
└── package.json             # Mobile app dependencies and scripts
```

### Core Files to Read First
1. [`posts-backend/app.js`](file:///D:/ReactNative/posts-backend/app.js) — Understands the request pipeline, security layers, and route registrations.
2. [`Posts/src/shared/hooks/useMediaPicker.js`](file:///D:/ReactNative/Posts/src/shared/hooks/useMediaPicker.js) — Understands the native camera flow, background memory cleanup, and process recreation recovery.
3. [`posts-backend/features/posts/post.service.js`](file:///D:/ReactNative/posts-backend/features/posts/post.service.js) — Understands the core post business logic, transactions, ImageKit coordination, and cache invalidation.

---

## Non-Obvious Decisions, and Why

### 1. Lowercase Search Mirror (`nameLower` in `user.model.js`)
* **Context:** Searching for users via `@handle` or display name.
* **The Decision:** A hidden field `nameLower` is updated via Mongoose pre-save and pre-findOneAndUpdate hooks.
* **Why It Matters:** Running case-insensitive searches with `$regex: /.../i` in MongoDB forces an unindexed full collection scan (`COLLSCAN`). By keeping a pre-lowercased field and querying `{ nameLower: /^searchterm/ }`, MongoDB executes an anchored prefix index scan (`IXSCAN`), yielding sub-millisecond response times even with large user bases.

### 2. Compound Tag Index `{ tags: 1, createdAt: -1, _id: -1 }`
* **Context:** Loading tag-specific feeds (`GET /api/v1/posts?tag=agriculture`).
* **The Decision:** A compound index combining the multikey tag field with reverse creation timestamps.
* **Why It Matters:** If only `{ tags: 1 }` is indexed, MongoDB locates matching documents using the index but must pull all matches into RAM to perform the sort by `createdAt`. When a tag contains thousands of posts, the operation exceeds MongoDB's default 32MB in-memory sort limit and throws an unhandled database exception. The compound index walks pre-sorted index leaves with zero in-memory sort penalty.

### 3. Lua Scripting for Atomic Lock Release in `cache.js`
* **Context:** Redis stampede protection lock (`acquireLock` / `releaseLock`).
* **The Decision:** Locks are released using a custom Lua script:
  ```lua
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
  ```
* **Why It Matters:** If a backend query takes longer than the lock's TTL, the lock key auto-expires, and another concurrent request acquires it. If the first process simply called `client.del(key)`, it would delete the *second* process's lock prematurely. The Lua script guarantees the lock is only deleted if the unique random token matches the caller's ID.

### 4. `super.onCreate(null)` in `MainActivity.kt`
* **Context:** Android activity recreation after camera capture.
* **The Decision:** In `android/app/src/main/java/com/anonymous/Posts/MainActivity.kt`, line 19 explicitly calls `super.onCreate(null)` instead of passing `savedInstanceState`.
* **Why It Matters:** React Native navigators (`react-native-screens` and Expo Router) maintain screen navigation state entirely in JavaScript. If Android's native `FragmentManager` attempts to restore fragments (`ScreenStackFragment` or `DevMenuFragment`) using serialized Android bundles, reflection constructor lookups fail and throw fatal exceptions: `Screen fragments should never be restored`.

### 5. `Image.clearMemoryCache()` Prior to Camera Intent
* **Context:** Launching the native camera via `launchCameraAsync`.
* **The Decision:** Before opening the system camera intent, `useMediaPicker.js` calls `await Image.clearMemoryCache()`.
* **Why It Matters:** The mobile app's image cache (Glide on Android) holds hundreds of megabytes of decoded bitmaps from previous feed scrolling. High-resolution camera sensors (e.g. 50MP on modern devices) require massive hardware-allocated DMA-BUF memory buffers. Clearing the Glide cache drops the app's resident memory from ~650MB down under ~200MB, preventing the Android Low Memory Killer (`lmkd`) from killing the app process while in the background.

### 6. SheetHost Portal at Root Layout
* **Context:** Presenting bottom sheets (comments, post options).
* **The Decision:** `<SheetHost />` is placed once at the root layout in `Posts/src/app/_layout.jsx`.
* **Why It Matters:** Placing modal or sheet components inside list cells or deep view hierarchies results in clipping by ancestor containers and z-index ordering conflicts. Hosting sheets at the root allows them to mount outside any `FlashList` or native modal window.

---

## API Reference Table

All routes are prefixed with `/api/v1` except root health probes.

| Domain | Method | Full Path | Parameters / Body | Description |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/health/live` | None | Kubernetes / container liveness probe (uptime, memory). |
| **System** | `GET` | `/health/ready` | None | Readiness probe: pings MongoDB connection and Redis state. |
| **Users** | `POST` | `/api/v1/users/device` | `{ deviceId, name }` | Bootstraps or retrieves identity for a physical device UUID. |
| **Users** | `GET` | `/api/v1/users/me` | Headers: `x-user-id` | Returns profile data for the active user. |
| **Users** | `PATCH` | `/api/v1/users/me` | `{ name, bio, location }` | Updates profile attributes for current user. |
| **Users** | `PATCH` | `/api/v1/users/me/avatar` | Multipart: `avatar` | Uploads and replaces profile avatar via ImageKit. |
| **Users** | `GET` | `/api/v1/users/search` | Query: `?q=...&limit=...` | Prefix search across handles and display names. |
| **Users** | `GET` | `/api/v1/users/id/:id` | Route param: `:id` | Fetches public user profile by MongoDB ObjectId. |
| **Users** | `GET` | `/api/v1/users/:handle` | Route param: `:handle` | Fetches public user profile by `@handle`. |
| **Posts** | `GET` | `/api/v1/posts` | Query: `?cursor=&limit=&tag=&author=&filter=` | Lists paginated feed posts with optional tag/author filtering. |
| **Posts** | `GET` | `/api/v1/posts/search` | Query: `?q=...&cursor=&limit=` | Full-text search across descriptions and tags. |
| **Posts** | `GET` | `/api/v1/posts/:id` | Route param: `:id` | Retrieves single post by ObjectId. |
| **Posts** | `POST` | `/api/v1/posts` | Multipart: `images` (max 6), `description`, `tags`, `location`, `author` | Creates a new community post with media uploads. |
| **Posts** | `PATCH` | `/api/v1/posts/:id` | Multipart: `images`, `description`, `keepImages`, `userId` | Edits an existing post, replacing or retaining media. |
| **Posts** | `POST` | `/api/v1/posts/:id/images` | Multipart: `image` (single), `userId` | Appends a single image to an existing post. |
| **Posts** | `DELETE` | `/api/v1/posts/:id` | Body: `{ userId }` | Deletes a post, associated comments, and ImageKit assets. |
| **Posts** | `POST` | `/api/v1/posts/:id/like` | Body: `{ userId }` | Adds a like reaction to a post. |
| **Posts** | `POST` | `/api/v1/posts/:id/unlike` | Body: `{ userId }` | Removes like reaction from a post. |
| **Posts** | `DELETE` | `/api/v1/posts/:id/like` | Body: `{ userId }` | REST-compliant delete alternative for post unliking. |
| **Comments**| `GET` | `/api/v1/posts/:postId/comments` | Query: `?cursor=&limit=` | Fetches threaded comments for a specific post. |
| **Comments**| `POST` | `/api/v1/posts/:postId/comments` | Body: `{ text, author, parentComment }` | Adds a comment or threaded reply to a post. |
| **Comments**| `PATCH` | `/api/v1/posts/:postId/comments/:commentId` | Body: `{ text, author }` | Edits comment text and sets `editedAt` timestamp. |
| **Comments**| `DELETE` | `/api/v1/posts/:postId/comments/:commentId` | Body: `{ author }` | Deletes a comment and its associated replies. |
| **Comments**| `POST` | `/api/v1/posts/:postId/comments/:commentId/like` | Body: `{ reaction: 'like'\|'dislike'\|'none', userId }` | Sets or clears user reaction on a comment. |
| **Likes** | `GET` | `/api/v1/likes/:userId/posts` | Query: `?cursor=&limit=` | Retrieves paginated list of posts liked by a user. |
| **Likes** | `GET` | `/api/v1/likes/:userId/liked` | None | Returns flat array of liked post IDs for client cache sync. |
| **Follows** | `POST` | `/api/v1/follows/:userId` | Body: `{ followerId }` | Establishes a directed follow relationship. |
| **Follows** | `DELETE`| `/api/v1/follows/:userId` | Body: `{ followerId }` | Removes an existing follow relationship. |
| **Follows** | `GET` | `/api/v1/follows/:userId/followers` | Query: `?cursor=&limit=` | Lists users following the specified user. |
| **Follows** | `GET` | `/api/v1/follows/:userId/following` | Query: `?cursor=&limit=` | Lists users that the specified user is following. |
| **Follows** | `GET` | `/api/v1/follows/:userId/counts` | None | Returns `{ followerCount, followingCount }`. |
| **Bookmarks**| `GET` | `/api/v1/bookmarks` | Query: `?userId=&cursor=&limit=` | Lists bookmarked posts for a user. |
| **Bookmarks**| `POST` | `/api/v1/bookmarks/:postId` | Body: `{ userId }` | Saves a post to the user's bookmarks list. |
| **Bookmarks**| `DELETE`| `/api/v1/bookmarks/:postId` | Body: `{ userId }` | Removes a post from bookmarks. |
| **Notifications**| `GET` | `/api/v1/notifications` | Query: `?userId=&cursor=&limit=` | Lists activity notifications received by a user. |
| **Notifications**| `PATCH` | `/api/v1/notifications/read-all` | Body: `{ userId }` | Marks all notifications as read for a user. |
| **Notifications**| `PATCH` | `/api/v1/notifications/:id/read` | Body: `{ userId }` | Marks a single notification as read. |
| **Reports** | `POST` | `/api/v1/reports` | Body: `{ reporter, targetType, targetId, reason }` | Submits a content moderation report. |
| **Reports** | `GET` | `/api/v1/reports` | None | Lists pending moderation reports (admin view). |
| **Reports** | `PATCH` | `/api/v1/reports/:id` | Body: `{ status: 'RESOLVED'\|'DISMISSED' }` | Updates report resolution status. |

---

## Data Model & Schema Reference

### User Schema (`features/users/user.model.js`)
* `deviceId`: `String` (Indexed, unique, sparse) — Hardware UUID for instant authentication.
* `name`: `String` (Required, max 80 chars) — Display name.
* `nameLower`: `String` (Indexed, select: false) — Lowercase mirror for prefix search queries.
* `handle`: `String` (Required, unique, lowercase) — Unique username handle `@handle`.
* `avatarUrl`: `String` (Default: null) — ImageKit CDN image link.
* `avatarFileId`: `String` (Default: null, select: false) — ImageKit asset identifier for deletion.
* `bio`: `String` (Max 300 chars) — User biography.
* `location`: `String` — Geographical area or district.
* `role`: `String` (Enum: `['user', 'moderator', 'admin']`, default: `'user'`).
* `verified`: `Boolean` (Default: false) — Verification badge status.
* `followerCount` / `followingCount` / `postCount`: `Number` (Default: 0) — Denormalized counters.

### Post Schema (`features/posts/post.model.js`)
* `author`: `ObjectId` (Ref: `User`, required, indexed) — Post creator.
* `description`: `String` (Required, max 2000 chars) — Post text caption.
* `images`: `[{ url: String, fileId: String }]` — Up to 6 media attachments.
* `location`: `String` (Default: null) — Field location or market name.
* `audience`: `String` (Enum: `['public', 'followers', 'only_me']`, default: `'public'`).
* `tags`: `[String]` (Default: [], indexed) — Cleaned lowercase hashtag strings.
* `likeCount` / `commentCount`: `Number` (Default: 0, min: 0) — Denormalized metric counters.
* `verified`: `Boolean` (Default: false) — Agronomist verified observation.

### Comment Schema (`features/comments/comment.model.js`)
* `post`: `ObjectId` (Ref: `Post`, required, indexed) — Target post.
* `author`: `ObjectId` (Ref: `User`, required) — Comment creator.
* `parentComment`: `ObjectId` (Ref: `Comment`, default: null) — Parent comment ID for replies.
* `text`: `String` (Required, max 500 chars) — Comment content.
* `likeCount` / `dislikeCount`: `Number` (Default: 0, min: 0) — Reaction counts.
* `editedAt`: `Date` (Default: null) — Timestamp marking when comment text was updated.

### Follow Schema (`features/follows/follow.model.js`)
* `follower`: `ObjectId` (Ref: `User`, required) — Initiator of the follow.
* `following`: `ObjectId` (Ref: `User`, required) — Account being followed.

### Like Schema (`features/likes/like.model.js`)
* `user`: `ObjectId` (Ref: `User`, required) — User reacting.
* `targetType`: `String` (Enum: `['Post', 'Comment']`, required).
* `targetId`: `ObjectId` (Required) — Target document ID.
* `type`: `String` (Enum: `['like', 'dislike']`, default: `'like'`).

---

## Database Indexes & Performance

| Collection | Key Definition | Type / Option | Primary Query Served | Performance Impact Without Index |
| :--- | :--- | :--- | :--- | :--- |
| **users** | `{ deviceId: 1 }` | Unique, Sparse | Fast lookup on device boot (`loginDevice`). | $O(N)$ full collection scan on every app launch. |
| **users** | `{ handle: 1 }` | Unique | Direct profile routing by `@handle`. | Sequential scan through user base. |
| **users** | `{ nameLower: 1 }` | Index | Prefix autocompletion in search (`searchUsers`). | Slow regex scans; memory spikes under concurrent typing. |
| **posts** | `{ createdAt: -1 }` | B-Tree | Chronological global feed (`GET /api/v1/posts`). | Entire database sorted in memory; fails if collection exceeds 32MB. |
| **posts** | `{ author: 1, createdAt: -1 }`| Compound | Author profile posts tab (`GET /api/v1/posts?author=...`). | Scans all posts across all users to filter by one author. |
| **posts** | `{ tags: 1, createdAt: -1, _id: -1 }` | Multikey Compound | Tag-filtered feed (`GET /api/v1/posts?tag=...`). | **Prevents MongoDB 32MB in-memory sort abort error on popular tags.** |
| **comments** | `{ post: 1, createdAt: 1 }` | Compound | Fetching comments for a post in chronological order. | Full collection scan over all comments in system. |
| **follows** | `{ follower: 1, following: 1 }` | Compound Unique | Duplicate follow prevention & follow check. | Accidental duplicate follows; slow un-follow lookups. |
| **follows** | `{ following: 1 }` | B-Tree | Reverse lookup: fetching a user's followers list. | Scans entire follow graph to find reverse relations. |
| **likes** | `{ user: 1, targetType: 1, targetId: 1 }` | Compound Unique | Duplicate like check & toggles. | Double-liking bug; $O(N)$ check before every like mutation. |
| **likes** | `{ targetType: 1, targetId: 1 }` | Compound | Fetching all likes belonging to a specific post/comment. | Inability to quickly aggregate like history. |
| **bookmarks**| `{ user: 1, post: 1 }` | Compound Unique | User bookmark retrieval & duplicates check. | Duplicate bookmark records. |
| **notifications**| `{ recipient: 1, read: 1 }` | Compound | Unread badge counters (`meta.unreadCount`). | Scans read and unread records alike; slows down as history grows. |
| **notifications**| `{ recipient: 1, createdAt: -1 }`| Compound | User notification center feed. | In-memory sort of notification records. |

---

## Testing

### Backend Test Suite
The backend utilizes Node.js's native test runner (`node:test`) and assertion library, requiring zero third-party testing dependencies.

* **Execute all tests:**
  ```powershell
  cd posts-backend
  npm test
  ```
* **Test File Count:** 1 comprehensive test file ([`tests/sprint3.test.js`](file:///D:/ReactNative/posts-backend/tests/sprint3.test.js)).
* **Coverage Scope:** Verifies feed retrieval, cursor pagination contracts, post creation, comments, follow cycles, and error handlers.

### Frontend Test Suite
The frontend uses Jest with `jest-expo` and React Native Testing Library.

* **Execute all unit tests:**
  ```powershell
  cd Posts
  npm run test:unit
  ```
* **Test File Count:** 3 unit test suites:
  1. [`src/features/comments/utils/__tests__/nestComments.test.js`](file:///D:/ReactNative/Posts/src/features/comments/utils/__tests__/nestComments.test.js) — Validates recursive comment tree generation.
  2. [`src/features/feed/context/__tests__/interactionMembershipStore.test.js`](file:///D:/ReactNative/Posts/src/features/feed/context/__tests__/interactionMembershipStore.test.js) — Validates local Set-based like/bookmark cache sync.
  3. [`src/shared/utils/__tests__/hashtags.test.js`](file:///D:/ReactNative/Posts/src/shared/utils/__tests__/hashtags.test.js) — Validates Unicode hashtag extraction, boundary caps, and matra preservation.

---

## Feature Status

| Feature Domain | Sub-Component / Screen | Implementation Status | Implementation Notes / Location |
| :--- | :--- | :--- | :--- |
| **Identity** | Device ID Login | **Completed** | Hardware UUID bootstrap in `LocalUserContext.jsx` and `user.controller.js`. |
| **Identity** | Display Name Onboarding | **Completed** | `DisplayNamePrompt.jsx` displays modal on first launch if no name exists. |
| **Identity** | Email / Password Auth | **Pending** | User schema supports hashes and tokens; route endpoints are not yet implemented. |
| **Feed** | Cursor Pagination | **Completed** | Supported in `useFeed` and `post.repository.js`. |
| **Feed** | Infinite Scroll | **Completed** | Shopify FlashList with `onEndReached` thresholding in `FeedScreen.jsx`. |
| **Feed** | Offline Cache Hydration | **Completed** | AsyncStorage TanStack persister restores cache instantly in `queryPersister.js`. |
| **Post Creation** | Camera Capture | **Completed** | Integrated via `expo-image-picker` with native background kill recovery. |
| **Post Creation** | Multi-Image Upload (max 6) | **Completed** | Compressed on client to ~300KB each, uploaded sequentially to ImageKit. |
| **Comments** | Single-Level Threaded Replies | **Completed** | Parent comment referencing in `CommentSheet.jsx` and `comment.model.js`. |
| **Comments** | Edit & Delete | **Completed** | Comments can be edited (tracks `editedAt`) or deleted by author. |
| **Reactions** | Post Likes | **Completed** | Optimistic UI toggles with server reconciliation in `useLikePostMutation.js`. |
| **Reactions** | Comment Thumbs Up/Down | **Completed** | Polymorphic reaction toggle via `comment-like.controller.js`. |
| **Social Graph** | Follow / Unfollow | **Completed** | Directed edges with denormalized follower/following count counters. |
| **Discovery** | Tag Feeds (`/tag/[tag]`) | **Completed** | Filtering via compound multikey index. |
| **Discovery** | User / Post Search | **Completed** | Sub-domain search screen querying `searchPosts` and `searchUsers`. |
| **Notifications** | In-App Activity Center | **Completed** | Unread badges, mark-one-read, mark-all-read. |
| **Notifications** | Push Notifications (FCM / APNs) | **Pending** | Database records are generated, but external push gateways are not wired. |
| **Moderation** | Report Content | **Completed** | Post and comment reporting to backend queue in `report.model.js`. |

---

## Known Problems & Security Gaps

Ranked in order of real architectural and security severity:

1. **Absence of User Authentication & Request Signing (High Severity):**
   * *Problem:* Endpoints currently accept `userId` or `author` directly from the client request body or `x-user-id` header without cryptographic verification (no JWT or session cookies).
   * *Risk:* A malicious user can forge requests and delete posts, edit comments, or like content on behalf of any other user ID.
   * *Required Solution:* Implement JWT token issuance on `loginDevice` and verify identity using an `authMiddleware.js` on all mutating routes.

2. **Absence of Push Notification Dispatcher (Medium Severity):**
   * *Problem:* Activity notifications (likes, replies, follows) are inserted into the MongoDB `notifications` collection, but no external notification payload is sent to Expo Push servers or Firebase Cloud Messaging.
   * *Risk:* Users do not receive alerts when their phone is locked or the app is closed.
   * *Required Solution:* Integrate `expo-server-sdk` in `notification.service.js` to dispatch push tokens stored on the User document.

3. **Production Deployment Containerization (Low Severity):**
   * *Problem:* Enterprise health checks (`/health/live`, `/health/ready`) exist, but no `Dockerfile` or cloud orchestration template is checked into the repository.
   * *Required Solution:* Add multi-stage Docker build files for deployment to cloud containers (e.g. AWS ECS, Render, or Railway).

---

## Troubleshooting by Symptom

### 1. Symptom: "Network request failed" on Physical Device
* **Root Cause:** The mobile app is trying to connect to `localhost` or an unreachable private IP address.
* **Fix:** Open `Posts/.env`. Set `EXPO_PUBLIC_LAN_IP` to your laptop's current Wi-Fi IPv4 address (found via `ipconfig`). Confirm your laptop's Wi-Fi network profile is set to **Private** so the Windows Defender firewall does not block incoming connections on port 4000.

### 2. Symptom: Camera App Closes Directly to Phone Home Screen
* **Root Cause:** Android OS low-memory termination. Either the native heap held too many bitmaps when the camera opened, or Android's `FragmentManager` crashed on activity restoration due to `savedInstanceState`.
* **Fix:** Ensure [`MainActivity.kt`](file:///D:/ReactNative/Posts/android/app/src/main/java/com/anonymous/Posts/MainActivity.kt#L19) has `super.onCreate(null)` and rebuild the APK. Confirm `Image.clearMemoryCache()` is called in `useMediaPicker.js` before launching the camera intent.

### 3. Symptom: "MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017"
* **Root Cause:** Local MongoDB daemon is not running.
* **Fix:** Start MongoDB service via Windows Services (`services.msc`) or run `mongod` in a terminal. If using cloud Atlas, verify your machine's current public IP address is allowlisted in the MongoDB Atlas Network Access panel.

### 4. Symptom: "File upload failed: Each image must be under 10MB"
* **Root Cause:** Multer file filter rejection in `uploadMiddleware.js`.
* **Fix:** Ensure image compression in `imageCompressor.js` is running before the upload request is dispatched.

### 5. Symptom: Redis ECONNREFUSED warnings in backend console
* **Root Cause:** Redis service is not installed or not running locally on port 6379.
* **Fix:** KrishiVerse backend is designed to **fail-open**. Redis is purely a performance and caching enhancement; the application will function normally using direct MongoDB queries even if Redis is completely unavailable.

---

## Technical Glossary

* **Expo:** A developer framework and ecosystem of tools and libraries built on top of React Native that simplifies cross-platform mobile development and native module integration.
* **Metro:** The dedicated JavaScript bundler for React Native that takes your code and assets, compiles JSX/CSS, and serves the bundle to the mobile client over HTTP/WebSockets.
* **Cursor Pagination:** A pagination strategy where the client passes an opaque token representing the last seen record rather than an offset page number, preventing duplicated or skipped records when data changes dynamically.
* **Idempotency:** A property of an API mutation where making the exact same request multiple times produces the identical side-effect as making it once (e.g. using `Idempotency-Key` headers to prevent double-posting on weak mobile networks).
* **Atomic Operation:** A database update that executes entirely or not at all without interference from concurrent operations (e.g., using `$inc` to update post counters).
* **Multikey Index:** A MongoDB index created on an array field that builds a separate index entry for every single item inside the array (e.g. the `{ tags: 1 }` index).
* **Polymorphic Model:** A database design pattern where a single collection stores references that can point to multiple different types of entities (e.g. `Like` pointing to either a `Post` or a `Comment`).
* **Fail-Open:** An architectural resilience pattern where the failure of a non-critical subsystem (such as Redis caching) allows operations to proceed through the primary store rather than crashing the system.
* **Resident Set Size (RSS):** The portion of physical RAM occupied by a process, including native allocations, code, and shared libraries.
* **Low Memory Killer Daemon (lmkd):** The Android kernel subsystem responsible for terminating background processes under high system memory pressure to protect foreground activity performance.
* **TanStack React Query:** An asynchronous state management library that coordinates server state fetching, caching, deduplication, and optimistic mutations on mobile clients.

---

## Contributing & Conventions

### Branch Naming Convention
* `feature/<feature-name>` — New capabilities (e.g., `feature/voice-notes`)
* `fix/<bug-description>` — Bug fixes (e.g., `fix/camera-orientation`)
* `refactor/<module-name>` — Internal code cleanup with no behavior change
* `docs/<topic>` — Documentation updates

### Commit Message Guidelines
Follow the Conventional Commits specification:
```
feat(comments): add single-level reply threading support
fix(camera): prevent low-memory termination during sensor handoff
docs(readme): add troubleshooting instructions for Windows firewall
test(hashtags): add test cases for Hindi devanagari matras
```

### Documentation Maintenance
**Whenever you modify API endpoints, Mongoose schema fields, or environment variables, update this `README.md` in the same commit to keep the engineering runbook accurate.**
