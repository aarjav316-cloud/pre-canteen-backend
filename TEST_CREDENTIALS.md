# Test Credentials for Pre-Canteen 🔐

This document contains all test user credentials for development and testing.

## 📋 How to Create Test Users

### Create Admin User

```bash
cd backend
node createAdmin.js
```

### Create Staff User

```bash
cd backend
node createStaff.js
```

---

## 👤 Admin Credentials

**Use for:** Admin dashboard, managing menu, viewing analytics, managing orders

```
Login Method: Password-based
Mobile:   9999999999
Email:    admin@precanteen.com
Password: admin123
Role:     admin
```

**Login API:**

```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "mobile": "9999999999",
  "password": "admin123"
}
```

---

## 👨‍🍳 Staff Credentials

**Use for:** Counter operations, order fulfillment, kitchen management

```
Login Method: Password-based
Mobile:   8888888888
Email:    staff@precanteen.com
Password: staff123
Role:     staff
```

**Login API:**

```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "mobile": "8888888888",
  "password": "staff123"
}
```

---

## 🎓 Student Account

**Use for:** Ordering food, managing cart, wallet top-up

Students register via OTP, so you need to:

### Option 1: Register New Student (Production - with SMS)

```bash
# 1. Send OTP
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "Test Student",
  "mobile": "YOUR_MOBILE_NUMBER",
  "password": "student123"
}

# 2. You'll receive OTP via SMS
# 3. Verify OTP
POST http://localhost:5000/api/auth/verify-otp
Content-Type: application/json

{
  "mobile": "YOUR_MOBILE_NUMBER",
  "otp": "123456"
}
```

### Option 2: Create Student Manually (Development)

```javascript
// In MongoDB or via script
{
  "name": "Test Student",
  "mobile": "7777777777",
  "password": "$2a$10$hashedpassword", // hash of "student123"
  "role": "student",
  "email": "student@example.com",
  "walletBalance": 1000
}
```

---

## 🔑 Login Methods by Role

| Role        | Login Method | Credentials                                 |
| ----------- | ------------ | ------------------------------------------- |
| **Admin**   | Password     | Mobile: `9999999999` / Password: `admin123` |
| **Staff**   | Password     | Mobile: `8888888888` / Password: `staff123` |
| **Student** | OTP          | Register → Receive OTP → Verify             |

---

## 🚀 Quick Test Flow

### 1. Setup (One-time)

```bash
# Create admin
node createAdmin.js

# Create staff
node createStaff.js
```

### 2. Test Admin Flow

1. Login with `9999999999` / `admin123`
2. Add menu items
3. View orders
4. Manage settings

### 3. Test Staff Flow

1. Login with `8888888888` / `staff123`
2. View pending orders
3. Update order status
4. Verify pickup codes

### 4. Test Student Flow

1. Register with your mobile number
2. Receive OTP (via SMS or console log in dev mode)
3. Verify OTP
4. Browse menu
5. Add to cart
6. Place order

---

## 🔓 Accessing Different Dashboards

### Admin Dashboard

```
URL: http://localhost:5173/admin
Login: 9999999999 / admin123
```

### Staff Dashboard

```
URL: http://localhost:5173/staff
Login: 8888888888 / staff123
```

### Student Interface

```
URL: http://localhost:5173/student
Register via OTP
```

---

## 🛠️ Troubleshooting

### Can't login as admin?

1. Run `node createAdmin.js` to create/reset admin account
2. Make sure you're using the `/api/auth/login` endpoint (password-based)
3. Not the OTP endpoint

### Can't login as student?

1. Students must register via OTP
2. In dev mode, OTP is logged to console
3. Make sure `NODE_ENV=development` to see OTPs

### Forgot admin password?

1. Run `node createAdmin.js`
2. Choose "yes" when asked to update password
3. Password will be reset to `admin123`

---

## 🔐 Security Notes

### Development

- ✅ These credentials are for development ONLY
- ✅ OTPs are logged to console when `SMS_ENABLED=false`
- ✅ Passwords are simple for easy testing

### Production

- ⚠️ Change admin password immediately
- ⚠️ Remove or secure test accounts
- ⚠️ Enable real SMS (`SMS_ENABLED=true`)
- ⚠️ Use strong passwords
- ⚠️ Enable rate limiting
- ⚠️ Set up proper access controls

---

## 📞 Support

If you can't access any account:

1. Check if MongoDB is running
2. Verify `.env` configuration
3. Run the create scripts again
4. Check backend logs for errors

For OTP issues:

- See `SMS_SETUP.md` for Twilio configuration
- In dev mode, OTPs appear in terminal
- Check if `SMS_ENABLED=true` for production
