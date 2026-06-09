# SMS Service Setup Guide 📱

This guide will help you set up SMS OTP delivery for your Pre-Canteen application.

## Overview

The application supports three SMS providers:

- **Twilio** (recommended for production, global reach)
- **MSG91** (popular in India, competitive pricing)
- **Fast2SMS** (free tier available, India only)

## Development Mode

By default, OTPs are logged to the console in development mode. Set `SMS_ENABLED=false` in `.env` to use console logging.

```env
NODE_ENV=development
SMS_ENABLED=false
```

When SMS is disabled, you'll see OTPs in your terminal like:

```
📱 SMS OTP for 9876543210: 123456
```

---

## Production Setup

### Option 1: Twilio (Recommended) 🌍

**Best for:** Production apps, global reach, reliable delivery

1. **Sign up**: Go to [twilio.com](https://www.twilio.com/)

2. **Get credentials**:
   - Navigate to Console → Account → Keys & Credentials
   - Copy your **Account SID** and **Auth Token**
   - Get a phone number from Console → Phone Numbers

3. **Configure .env**:

```env
SMS_PROVIDER=twilio
SMS_ENABLED=true

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

4. **Pricing** (as of 2024):
   - India SMS: ~₹0.60 per SMS
   - Free trial credits available

---

### Option 2: MSG91 🇮🇳

**Best for:** India-focused apps, cost-effective

1. **Sign up**: Go to [msg91.com](https://msg91.com/)

2. **Get API Key**:
   - Go to Panel → API
   - Copy your **Auth Key**

3. **Configure .env**:

```env
SMS_PROVIDER=msg91
SMS_ENABLED=true

MSG91_AUTH_KEY=your_auth_key_here
MSG91_SENDER_ID=MSGIND
MSG91_TEMPLATE_ID=
```

4. **Optional: DLT Template** (Required for Indian numbers):
   - Register your template with TRAI DLT
   - Add template ID to `MSG91_TEMPLATE_ID`
   - Template example: "Your Pre-Canteen OTP is {#var#}. Valid for 5 minutes."

5. **Pricing**:
   - Transactional SMS: ₹0.15 - ₹0.25 per SMS
   - Free credits on signup

---

### Option 3: Fast2SMS 🚀

**Best for:** Testing, small-scale projects, India only

1. **Sign up**: Go to [fast2sms.com](https://www.fast2sms.com/)

2. **Get API Key**:
   - Navigate to Dashboard → Developer API
   - Copy your **API Key**

3. **Configure .env**:

```env
SMS_PROVIDER=fast2sms
SMS_ENABLED=true

FAST2SMS_API_KEY=your_api_key_here
```

4. **Limitations**:
   - India-only delivery
   - Rate limits on free tier
   - Sender ID restrictions

5. **Pricing**:
   - Free tier available (limited messages)
   - Paid: ₹0.15 - ₹0.20 per SMS

---

## Testing Your Setup

### 1. Enable SMS in development:

```env
NODE_ENV=development
SMS_ENABLED=true
SMS_PROVIDER=twilio  # or msg91, fast2sms
```

### 2. Test registration:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "mobile": "9876543210",
    "password": "test123"
  }'
```

### 3. Check logs:

- **Success**: You should see "SMS sent via [provider]"
- **Fallback**: If SMS fails in dev, OTP will be logged to console
- **Error**: Check credentials and provider configuration

---

## Security Best Practices

### 1. Environment Variables

✅ Never commit credentials to version control
✅ Use different credentials for dev/staging/production
✅ Rotate keys periodically

### 2. Rate Limiting

The app includes built-in rate limiting:

- 60-second cooldown between OTP requests
- 5 attempts per hour per mobile number

### 3. OTP Security

- 6-digit random OTPs
- Hashed before storage
- 5-minute expiry
- Single-use only

### 4. Phone Number Validation

- Indian mobile numbers only (10 digits, starting with 6-9)
- Extend `isValidIndianMobile()` in `smsService.js` for other countries

---

## Troubleshooting

### OTPs not being sent

1. **Check environment variables**:

```bash
# In your backend directory
node -e "console.log(process.env.SMS_PROVIDER, process.env.SMS_ENABLED)"
```

2. **Enable debug logging**:
   Check `backend/logs/` directory for error messages

3. **Test SMS provider directly**:
   Use provider's dashboard or API explorer to send a test SMS

### Common Errors

| Error                               | Solution                                           |
| ----------------------------------- | -------------------------------------------------- |
| "SMS credentials not configured"    | Check `.env` file has correct keys                 |
| "Failed to send SMS via [provider]" | Verify API credentials, check provider dashboard   |
| "Invalid mobile number"             | Ensure 10-digit Indian format (6-9 as first digit) |
| "Too many login attempts"           | Wait 60 seconds or clear Redis cache               |

### Fallback Behavior

If SMS sending fails in development:

- OTP is logged to console
- Request succeeds
- User can still verify OTP

In production:

- SMS failure returns 500 error
- User is asked to retry
- Error is logged for monitoring

---

## Cost Estimation

For **1000 OTPs/month**:

- **Twilio**: ₹600 (~$7)
- **MSG91**: ₹150-250 (~$2-3)
- **Fast2SMS**: ₹150-200 (~$2-3)

Most users need 1-2 OTPs per session, so plan accordingly.

---

## Advanced Configuration

### International Numbers

To support international numbers, modify `smsService.js`:

```javascript
// Add country code support
export const formatMobile = (mobile, countryCode = "91") => {
  return mobile.startsWith("+") ? mobile : `+${countryCode}${mobile}`;
};
```

### Custom Templates

For MSG91 with DLT templates:

```javascript
// In smsService.js, update sendViaMsg91:
const payload = {
  template_id: "your_template_id",
  mobile: `91${mobile}`,
  authkey: authKey,
  var: otp, // Template variable
};
```

### Webhook Notifications

Set up delivery receipts:

- Twilio: Console → Webhooks
- MSG91: Panel → Webhooks
- Fast2SMS: Dashboard → Webhooks

---

## Support

- **Twilio Docs**: https://www.twilio.com/docs/sms
- **MSG91 Docs**: https://docs.msg91.com/
- **Fast2SMS Docs**: https://www.fast2sms.com/docs

For issues with this implementation, check:

- `backend/src/utils/smsService.js` - SMS provider integrations
- `backend/src/controllers/otpAuthController.js` - OTP logic
- `backend/logs/` - Application logs
