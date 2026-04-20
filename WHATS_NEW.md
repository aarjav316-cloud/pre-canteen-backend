# Backend API & Architecture Changes: A Complete History 🚀

This document outlines the evolutionary changes from the original foundational backend commits up to the new production-ready release today.

---

## 📅 VERSION 2.0 (Latest Production Update)
**Commit:** `chore: make backend production ready` (Today)

### 🧹 Production Cleanups
- **Removed Testing Artifacts:** Deleted the manual testing scripts (`createAdmin.js` and `fixOrders.js`).
- **Removed Dev-Dependencies:** Actively removed Swagger UI, its configurations, and dependencies from the server to minimize attack surfaces and bundle size.
- **Removed Unnecessary Files:** `.env` and trailing markdown files were cleaned from the root directory.

### 💰 Digital Wallet System
A complete wallet system has been integrated, allowing students to hold balances and transact seamlessly via Razorpay.
- **Models:** Built the `Transaction` model and updated `User` to hold `walletBalance`.
- **New APIs (`/api/wallet`)**:
  - `GET /` — Fetch the user's current wallet balance and up to 50 recent transactions.
  - `POST /add` — Directly credit the wallet (testing/admin fallback).
  - `POST /create-order` — Initialize Razorpay order for wallet top-up.
  - `POST /verify` — Verify the Razorpay payment signature & update balance securely.

### 🔔 Real-Time Notification Engine
- **Models:** Integrated a new `Notification` model to handle order scopes, wallet updates, and system alerts.
- **New APIs (`/api/notifications`)**:
  - `GET /my` — Get all notifications for the authenticated user.
  - `POST /read-all` — Mark all active alerts/notifications as "read".

### ⚙️ Global App Settings
Admin configurations are now dynamically served instead of being hardcoded into the frontend.
- **Models:** Custom `Settings` model.
- **New APIs (`/api/settings`)**:
  - `GET /` — Fetch the global canteen state / details (publicly accessible).
  - `PATCH /` — (Admin only) Update the application settings physically closing/opening the canteen.

### 👤 Profile Expansions & Order Overhauls
- **Profile APIs (`/api/auth`)**: Added `/profile` routes (PATCH, GET, DELETE) to update DP, college bounds, mobile, and notification configurations.
- **Order Upgrades:** The `Order` payload strictly enforces a `paymentMethod` check (`wallet` or `razorpay`) and heavily resolves race conditions over a new `pending_payment` workflow status.
- **Menu Items:** Supports direct `image` payload strings.

---

## 📅 VERSION 1.5 (Order Sync & Bug Fixes)
**Commit:** `Update order synchronization` & `bug fixes` (Last month)

### 🔐 Advanced Authentication Protocols
- **Passport Integration:** Merged `base/config/passport.js` configuration schemas paving the way for multi-strategy workflows (e.g. Google OAuth routing schemas).
- **Middleware Safety:** Hardened `authMiddleware` error routing and JWT payload resolution. Added localized `errorMiddleware` configurations to keep frontend responses sanitized.

### 💳 Deep Razorpay Architecture & Edge-cases 
- Heavy refactoring of `/api/orders` to improve how payments hit the server post-client fulfillment. 
- Integrated extensive `razorpay.js` webhook/verify workflows into `orderController.js` to patch issues where students got charged but the order failed.

---

## 📅 VERSION 1.0 (The API Routing Birth)
**Commit:** `changes in routes` & `minor polishing` (Early iterations)

### 📑 API Initializations
- **Swagger Documentation:** This is when Swagger JSDocs were initially added (`/api/docs`) to allow developers to dry-test route responses.
- **Core Route Bundles Built:**
  - `authRoutes`: Established registration and basic JWT authentication hooks.
  - `cartRoutes`: Standardizing user cart manipulation via backend IDs over local storage.
  - `menuRoutes`: Handlers for Admin addition, deletion, and filtering.
  - `orderRoute`: Standardized the `pending` -> `completed` pipeline.

### 🚀 Optimization Layer
- Introduced localized server indexers enforcing optimized queries within `Order.js` schemas, helping lookup-time over extensive history arrays.
