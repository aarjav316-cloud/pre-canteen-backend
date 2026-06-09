# Refund System Documentation 💰

## Overview

Your Pre-Canteen application now has a comprehensive automatic refund system that handles order cancellations with instant or scheduled refunds based on payment method and user preferences.

---

## ✅ Features Implemented

### 1. **Automatic Refund Processing**

- ✅ Instant refund to wallet
- ✅ Razorpay refund to bank account (5-7 business days)
- ✅ User refund preference system
- ✅ Fallback to wallet if bank refund fails
- ✅ Transaction history tracking
- ✅ Real-time notifications

### 2. **User-Initiated Cancellation**

- ✅ Students can cancel their own orders
- ✅ Status validation (only cancellable before preparation)
- ✅ Automatic refund on cancellation
- ✅ Real-time updates via WebSocket

### 3. **Admin/Staff Cancellation**

- ✅ Admin/Staff can cancel any order
- ✅ Same automatic refund logic applies
- ✅ Transaction logging for audit trail

---

## 🔄 How Refunds Work

### Cancellable Order Statuses

Orders can be cancelled in these statuses:

- ✅ `pending` - Order placed but not accepted
- ✅ `paid` - Payment confirmed, awaiting acceptance
- ✅ `accepted` - Order accepted by staff
- ❌ `preparing` - Cannot cancel (already being prepared)
- ❌ `ready` - Cannot cancel (food is ready)
- ❌ `completed` - Cannot cancel (already picked up)

### Refund Flow Based on Payment Method

#### 1. **Wallet Payment**

```
Order Cancelled → Instant Refund to Wallet → Notification Sent
```

- Refund is instant (within seconds)
- Amount credited to user's wallet balance
- Transaction record created

#### 2. **Razorpay Payment (User prefers Wallet)**

```
Order Cancelled → Instant Refund to Wallet → Notification Sent
```

- Money returned to wallet immediately
- Faster than bank refund
- User can use it right away

#### 3. **Razorpay Payment (User prefers Original Method)**

```
Order Cancelled → Razorpay Refund Initiated → Bank Refund (5-7 days) → Notification Sent
```

- Refund processed through Razorpay
- Money returned to original payment method (UPI/Card/Bank)
- Takes 5-7 business days
- Refund ID stored for tracking

#### 4. **Counter Payment**

```
Order Cancelled → Refund to Wallet → Notification Sent
```

- Cash orders automatically refund to wallet
- Can be used for future orders

---

## 📡 API Endpoints

### 1. User Cancel Order (NEW)

```http
DELETE /api/orders/:orderId/cancel
Authorization: Bearer <student_token>
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "refunded": true,
  "refundAmount": 250,
  "refundMethod": "wallet",
  "order": { ... }
}
```

**Error Responses:**

- `400` - Order cannot be cancelled (wrong status)
- `403` - Not your order
- `404` - Order not found

**Example:**

```bash
curl -X DELETE http://localhost:5000/api/orders/abc123/cancel \
  -H "Authorization: Bearer <token>"
```

### 2. Admin/Staff Update Order Status (Existing)

```http
PATCH /api/orders/:orderId/status
Authorization: Bearer <admin_or_staff_token>
Content-Type: application/json

{
  "status": "cancelled"
}
```

This also triggers automatic refund processing.

---

## 🎯 User Refund Preferences

Users can set their refund preference in their profile:

### Refund Preference Options:

1. **`wallet`** (Default)
   - All refunds go to wallet instantly
   - Faster and more convenient
   - Can be used immediately

2. **`original`**
   - Refunds go back to original payment method
   - For Razorpay: Bank/UPI/Card refund in 5-7 days
   - For Wallet: Still goes to wallet

### How to Set Preference:

```http
PATCH /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "refundPreference": "wallet"  // or "original"
}
```

---

## 📊 Transaction Records

All refunds are logged in the `transactions` collection:

### Refund Transaction Example:

```json
{
  "_id": "...",
  "userId": "user_id",
  "amount": 250,
  "type": "credit",
  "description": "Refund for cancelled order #A123 (Wallet credit)",
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Transaction Statuses:

- `completed` - Refund processed successfully
- `processing` - Bank refund initiated (Razorpay)
- `failed` - Refund failed (rare)

---

## 🔔 Notifications

Users receive notifications for:

### Instant Wallet Refund:

```
Title: Order Cancelled
Message: Your order #A123 has been cancelled. ₹250 will be refunded to your wallet instantly.
```

### Bank Refund (5-7 days):

```
Title: Order Cancelled
Message: Your order #A123 has been cancelled. ₹250 will be refunded to your bank account in 5-7 business days.
```

### No Payment (Counter, not paid):

```
Title: Order Cancelled
Message: Your order #A123 has been cancelled.
```

---

## 🛡️ Security & Validation

### User Cancellation:

✅ Users can only cancel their own orders  
✅ Orders can only be cancelled before preparation starts  
✅ Refund amount matches order total  
✅ Transaction history maintained

### Admin/Staff Cancellation:

✅ Can cancel any order  
✅ Same refund logic applies  
✅ Audit trail maintained

### Refund Protection:

✅ Duplicate refund prevention (order status checked)  
✅ Razorpay refund validation  
✅ Fallback to wallet if external refund fails  
✅ All refunds logged in transactions

---

## 🧪 Testing the Refund System

### Test Scenario 1: Wallet Payment Refund

```bash
# 1. Place order with wallet
POST /api/orders
{
  "items": [...],
  "paymentMethod": "wallet"
}

# 2. Cancel order
DELETE /api/orders/:orderId/cancel

# 3. Check wallet balance - should be refunded instantly
GET /api/wallet

# 4. Check transactions - should show refund
GET /api/wallet (check transactions array)
```

### Test Scenario 2: Razorpay Refund (Wallet Preference)

```bash
# 1. Set refund preference to wallet
PATCH /api/auth/profile
{ "refundPreference": "wallet" }

# 2. Place order with Razorpay
POST /api/orders
{ "paymentMethod": "razorpay" }

# 3. Complete Razorpay payment

# 4. Cancel order
DELETE /api/orders/:orderId/cancel

# 5. Check wallet - refunded instantly
GET /api/wallet
```

### Test Scenario 3: Razorpay Bank Refund

```bash
# 1. Set refund preference to original
PATCH /api/auth/profile
{ "refundPreference": "original" }

# 2. Place and pay order

# 3. Cancel order
DELETE /api/orders/:orderId/cancel

# 4. Check Razorpay dashboard for refund status
# (Refund takes 5-7 business days)
```

### Test Scenario 4: Order Cannot Be Cancelled

```bash
# Try to cancel order in 'preparing' status
DELETE /api/orders/:orderId/cancel

# Should get error:
# "Cannot cancel order in 'preparing' status"
```

---

## 📈 Monitoring Refunds

### Admin Dashboard

View refund statistics:

```http
GET /api/orders/analytics/status-summary
```

Shows:

- Total cancelled orders
- Total refund amount
- Refund methods breakdown

### Individual Order Refunds

Check if order was refunded:

```javascript
{
  "status": "cancelled",
  "isPaid": true,
  "razorpayRefundId": "rfnd_xyz..." // If Razorpay refund
}
```

### Transaction History

All refunds visible in:

```http
GET /api/wallet
```

Response includes transaction history with refund records.

---

## 🔧 Configuration

### Environment Variables

```env
# Razorpay credentials (for refunds)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_secret
```

### Refund Settings

Currently hardcoded in order controller:

- Wallet refunds: **Instant**
- Razorpay refunds: **5-7 business days** (`speed: "normal"`)

To change Razorpay refund speed to instant (higher fees):

```javascript
const refund = await razorpay.payments.refund(paymentId, {
  amount: amount * 100,
  speed: "optimum", // Instant refund (higher fees)
});
```

---

## 💡 Best Practices

### For Users:

1. **Cancel early**: Orders can only be cancelled before preparation
2. **Check wallet**: Refunds to wallet are instant
3. **Bank refunds**: Take 5-7 days, plan accordingly
4. **Set preference**: Choose wallet for faster refunds

### For Admin/Staff:

1. **Communicate**: Inform user before cancelling their order
2. **Check time**: Don't cancel orders being prepared
3. **Monitor refunds**: Check transaction logs regularly
4. **Razorpay dashboard**: Verify bank refunds are processed

### For Developers:

1. **Test refunds**: In test mode before production
2. **Monitor logs**: Check for refund errors
3. **Fallback handling**: System auto-credits wallet if Razorpay fails
4. **Transaction records**: Always maintained for audit

---

## 🐛 Troubleshooting

### Refund Not Received

1. Check order status - must show `cancelled`
2. Check wallet balance and transactions
3. For bank refunds: Wait 5-7 business days
4. Check backend logs for refund errors

### Razorpay Refund Failed

- System automatically falls back to wallet credit
- User gets full refund in wallet
- Transaction shows: "Wallet credit - Bank refund failed"

### Cannot Cancel Order

- Order might be in `preparing`, `ready`, or `completed` status
- These statuses cannot be cancelled
- Contact admin for manual intervention

---

## 📞 Support

### For Refund Issues:

1. Check `backend/logs/` for error messages
2. Verify Razorpay credentials in `.env`
3. Check MongoDB `transactions` collection
4. Review `orders` collection for refund IDs

### Razorpay Refund Tracking:

- Dashboard: https://dashboard.razorpay.com/
- Navigate to: Transactions → Refunds
- Search by Refund ID stored in order

---

## ✨ Summary

Your refund system is **fully automated** and handles:

✅ Multiple payment methods  
✅ User preferences  
✅ Instant wallet refunds  
✅ Bank refunds via Razorpay  
✅ Fallback mechanisms  
✅ Transaction tracking  
✅ Real-time notifications  
✅ User-initiated cancellations  
✅ Admin/Staff cancellations

No manual intervention needed - refunds happen automatically! 🎉
