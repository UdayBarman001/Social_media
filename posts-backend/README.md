# KrishiVerse Backend

A production-ready, feature-based Node.js/Express/MongoDB backend for the KrishiVerse app, redesigned from scratch around the existing React Native frontend's needs.

## Stack

Node.js · Express · MongoDB/Mongoose · JWT (access + refresh) · ImageKit · bcrypt · express-validator · helmet · cors · compression · morgan

## Getting started

```bash
cp .env.example .env      # fill in real MongoDB/ImageKit/JWT secrets
npm install
npm run seed               # optional: populate demo data
npm run dev                 # nodemon server.js
```

The API is served under `/api/v1`, e.g. `GET http://localhost:4000/api/v1/posts`.

## Why feature-based architecture?

Every domain concept (auth, users, posts, comments, likes, follows, bookmarks, notifications, reports, search) is a self-contained folder under `features/`, each with the same five files: `*.controller.js`, `*.service.js`, `*.repository.js`, `*.routes.js`, `*.validation.js`, and `*.model.js` (when it owns a collection). A new developer only needs to open one folder to understand a whole feature — nothing about "posts" is scattered across unrelated top-level folders.

### The layers, and the rule for each

| Layer | Owns | Never contains |
|---|---|---|
| **routes** | URL → controller wiring, middleware composition | any logic |
| **controller** | reading `req`, calling one service function, shaping the HTTP response | business rules, DB queries |
| **service** | business rules, authorization checks, orchestration across repositories | raw Mongoose queries, `req`/`res` |
| **repository** | all Mongoose queries for one model | business rules, authorization |
| **model** | Mongoose schema, indexes, virtuals | logic |
| **validation** | express-validator chains for that feature's inputs | logic |

This means: to change a business rule (e.g. "you can only edit your own post"), you always know it lives in `*.service.js`. To change a query's shape or add an index, it's always in `*.repository.js`. Controllers are thin enough that swapping REST for GraphQL later would only touch controllers + routes.

## Folder-by-folder rationale

- **config/** — Anything read from `process.env` or that configures a third-party client (MongoDB, JWT, ImageKit, logger) lives here so it's never duplicated or read directly with `process.env.X` elsewhere. Never put business logic here.
- **middleware/** — Cross-cutting concerns that wrap requests: auth verification, role checks, centralized error handling, the async wrapper, rate limiting, upload handling, validation execution. Never put feature-specific business logic here — a "can this user edit this post" check belongs in `post.service.js`, not middleware.
- **utils/** — Small, stateless, reusable helpers (API response shaping, pagination math, JWT signing, token hashing, ImageKit upload/delete wrappers, the custom `ApiError`/`asyncHandler`). Never put anything here that depends on Express `req`/`res` or holds state.
- **constants/** — Enum-like values (roles, audience options, notification types, report statuses, pagination defaults) so no feature hardcodes a magic string that another feature might misspell.
- **database/** — Currently just `seed.js` (dev-only sample data). Future migration scripts belong here too. Never put the live Mongoose connection setup here — that's `config/database.js`.
- **routes/index.js** — The one place every feature's router gets mounted onto `/api/v1`. Adding a feature means adding one line here; `app.js` never needs to change.
- **features/*** — See above. Comments and per-post likes are intentionally *nested* under `posts/:postId/...` (mounted from `post.routes.js`) since they can't exist without a parent post — this mirrors the URL hierarchy the frontend actually calls.
- **app.js** — Express app + middleware pipeline only. No `listen()` call, so it can be imported by tests without opening a port.
- **server.js** — Process entry point: connects to MongoDB, starts listening, and handles graceful shutdown (`SIGTERM`/`SIGINT`) plus unhandled-rejection/exception logging.

## Standard API response

```jsonc
// success
{ "success": true, "message": "Post created", "data": { "post": { ... } }, "meta": { ... } }

// error
{ "success": false, "message": "Post not found", "errors": [] }
```

`utils/ApiResponse.js` and `utils/ApiError.js` are the only places that should ever build these shapes — controllers call `ApiResponse.success(...)`, and any failure is thrown as an `ApiError` and rendered by the single centralized `middleware/errorHandler.js`. No route ever writes its own try/catch or its own error JSON.

## Authentication

- Register/login issue a short-lived **access token** (returned in the JSON body, for the mobile client to hold in memory/secure storage) and a longer-lived **refresh token** (set as an httpOnly cookie, scoped to `/api/v1/auth`, so it's never readable from JS).
- `POST /api/v1/auth/refresh` rotates both tokens. Refresh tokens are stored server-side only as a SHA-256 hash (`user.refreshTokenHash`) — a raw token is never persisted, so a DB leak alone doesn't grant a valid session.
- Email verification and password reset both work the same way: a random token is generated, only its hash is stored with an expiry, and the raw token is "sent" via `sendEmailStub()` in `auth.service.js` (logged to the console for now). Swapping in a real email provider/queue later means editing exactly that one function.
- `middleware/authMiddleware.js` exports `protect` (401s if not authenticated) and `optionalAuth` (attaches `req.user` if a valid token is present, otherwise continues as anonymous) — used on the feed so it can render the same way for logged-out browsing later if needed.
- `middleware/roleMiddleware.js`'s `authorize(...roles)` composes after `protect` for admin-only routes (e.g. the reports moderation queue).

## Images (ImageKit)

`utils/imageHelper.js` wraps upload/delete so every feature handles images identically:
- `uploadMiddleware.js` uses **memory storage** (not disk) — files are held in a buffer just long enough to stream to ImageKit, so the container stays stateless and horizontally scalable.
- Only `{ url, fileId }` is stored per image (not full ImageKit metadata) — `fileId` is what's needed to delete the file later.
- Deleting/replacing a post or avatar always cleans up the old ImageKit file (`deleteImage`), and a delete failure is logged, never allowed to block the parent resource's own update/delete.

## Data model notes

- **Auth has no separate collection.** Auth fields (password hash, refresh/verification/reset token hashes) live on `User` because they're strictly 1:1 with a user and always needed together during login — see `features/auth/auth.model.js` for the explicit reasoning left in-code.
- **Likes and Reports are polymorphic** (`targetType` + `targetId`) instead of one collection per likeable/reportable feature, so "like a comment" and "like a post" (and, later, "like anything else") share one unique-per-user index and one code path.
- **Denormalized counters** (`Post.likeCount`, `Post.commentCount`, `User.followerCount/followingCount/postCount`) are updated via `$inc` in the same service call that creates/deletes the underlying row, so the feed never needs a `COUNT` aggregation to render.
- Every list/feed query uses `.lean()` + pagination + indexes (`createdAt` compound indexes on `Post`/`Comment`, unique compound indexes on `Like`/`Follow`/`Bookmark`) to avoid N+1s and keep the hot paths fast.

## Designed for growth without restructuring

- **Redis** — would slot into `config/redis.js` + a `utils/cache.js`, called from services (e.g. cache the feed's first page) without touching controllers or routes.
- **Socket.IO / real-time chat** — a new `features/chat/` folder plus a `socket.js` bootstrapped in `server.js` alongside the HTTP server.
- **Notifications** — the collection and fan-out (`notification.service.js`'s `notify()`) already exist and are called from likes/comments/follows; adding push delivery is an addition to that one function.
- **Search / Elasticsearch** — `features/search/` already isolates search behind its own repository; swapping Mongo `$text` search for an Elasticsearch client only touches `search.repository.js`.
- **Admin panel / analytics** — `constants.ROLES.ADMIN` + `roleMiddleware.authorize()` already gate the reports queue; the same pattern extends to any admin-only feature.
- **Microservices** — because every feature is already isolated (own model/service/repository/routes), extracting one (e.g. notifications) into its own service later is a folder move, not a rewrite.

## A note on the existing frontend

The frontend's `utils/api.js` currently calls unprefixed paths like `/posts` directly on the backend root. This redesigned API is versioned under `/api/v1` (`/api/v1/posts`, `/api/v1/auth/login`, etc.) and wraps every response in the `{ success, message, data, meta }` envelope described above, instead of returning raw arrays/objects. `API_URL` and the response parsing in `utils/api.js` will need small updates (e.g. `res.json().then(r => r.data.posts)`) to point at the new base path and unwrap `data`. Everything else about the contract (field names, endpoint shapes) was kept as close as possible to what the frontend already expects, specifically so those changes stay minimal.
