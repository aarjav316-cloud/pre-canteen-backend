# SMS OTP Service Integration ✅

Your Pre-Canteen backend now supports **real SMS delivery** for OTP authentication!

## 🚀 Quick Start

### Development Mode (Default)

OTPs are logged to console - **no setup required**:

```bash
npm run dev
# OTPs will appear in terminal: 📱 OTP for 9876543210: 123456
```

### Production Mode

Choose and configure an SMS provider:

1. **Select a provider** (see [SMS_SETUP.md](./SMS_SETUP.md)):
   - Twilio (recommended)
   - MSG91 (India)
   - Fast2SMS (free tier)

2. **Add credentials to `.env`**:

```env
SMS_PROVIDER=twilio
SMS_ENABLED=true
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

3. **Test the integration**:

```bash
node src/utils/testSms.js 9876543210
```

## 📋 What's New

### New Endpoints

- `POST /api/auth/send-otp` - Send OTP for login (existing users)
- Existing `POST /api/auth/register` - Now sends real SMS
- Existing `POST /api/auth/verify-otp` - Handles both registration & login
- Existing `POST /api/auth/resend-otp` - Resends OTP via SMS

### Features

✅ Multiple SMS provider support (Twilio, MSG91, Fast2SMS)
✅ Automatic fallback to console logging in dev mode
✅ 60-second cooldown between OTP requests
✅ 5-minute OTP expiry
✅ Secure OTP hashing
✅ Rate limiting built-in
✅ Comprehensive error handling

## 📖 Files Changed

| File                                   | Description                          |
| -------------------------------------- | ------------------------------------ |
| `src/utils/smsService.js`              | **NEW** - SMS provider integrations  |
| `src/controllers/otpAuthController.js` | Updated - Now uses SMS service       |
| `src/routes/authRoutes.js`             | Updated - Added `/send-otp` endpoint |
| `src/utils/testSms.js`                 | **NEW** - Test script for SMS        |
| `.env`                                 | Updated - Added SMS configuration    |
| `SMS_SETUP.md`                         | **NEW** - Complete setup guide       |

## 🧪 Testing

### Test in Dev Mode (Console Logging)

```bash
# 1. Ensure SMS is disabled
echo "SMS_ENABLED=false" >> .env

# 2. Start server
npm run dev

# 3. Send registration request
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","mobile":"9876543210","password":"test123"}'

# 4. Check terminal for OTP
```

### Test with Real SMS

```bash
# 1. Configure SMS provider in .env
SMS_PROVIDER=twilio
SMS_ENABLED=true
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# 2. Test SMS sending
node src/utils/testSms.js 9876543210

# 3. If successful, restart server and test registration
npm run dev
```

## 🔒 Security Features

- ✅ OTPs are hashed before storage (bcrypt)
- ✅ 60-second cooldown prevents spam
- ✅ 5-minute expiry window
- ✅ Single-use OTPs (deleted after verification)
- ✅ Rate limiting on endpoints
- ✅ Mobile number validation (Indian format)

## 🌍 Supported Regions

### Current: India 🇮🇳

- 10-digit mobile numbers
- Starting with 6, 7, 8, or 9

### Want International Support?

Modify `smsService.js`:

```javascript
export const isValidMobile = (mobile, country = "IN") => {
  const patterns = {
    IN: /^[6-9]\d{9}$/,
    US: /^[2-9]\d{9}$/,
    UK: /^7\d{9}$/,
  };
  return patterns[country]?.test(mobile);
};
```

## 💰 Cost Estimates

**For 1000 OTPs/month:**

- Twilio: ~₹600 ($7)
- MSG91: ~₹200 ($2.50)
- Fast2SMS: ~₹175 ($2)

Most users need 1-2 OTPs (registration + occasional login), so budget accordingly.

## 🐛 Troubleshooting

### OTPs not sending?

1. Check `.env` has correct credentials
2. Verify provider dashboard (credits, API status)
3. Check `backend/logs/` for errors
4. Run test script: `node src/utils/testSms.js`

### Common Issues

| Issue                            | Fix                                          |
| -------------------------------- | -------------------------------------------- |
| "SMS credentials not configured" | Add provider credentials to `.env`           |
| "Invalid mobile number"          | Use 10-digit Indian format (starts with 6-9) |
| "Too many requests"              | Wait 60 seconds between OTP requests         |
| SMS fails but OTP still works    | This is expected in dev mode                 |

## 📚 Documentation

- **Setup Guide**: [SMS_SETUP.md](./SMS_SETUP.md)
- **API Docs**: Check Swagger at `/api/docs` (if enabled)
- **Provider Docs**:
  - [Twilio](https://www.twilio.com/docs/sms)
  - [MSG91](https://docs.msg91.com/)
  - [Fast2SMS](https://www.fast2sms.com/docs)

## 🎯 Next Steps

1. **Choose your SMS provider** based on budget and region
2. **Sign up** and get API credentials
3. **Configure** `.env` with credentials
4. **Test** using `node src/utils/testSms.js`
5. **Deploy** with SMS_ENABLED=true

## ❓ Need Help?

Refer to [SMS_SETUP.md](./SMS_SETUP.md) for:

- Detailed provider setup instructions
- Pricing comparisons
- Advanced configurations
- Security best practices
