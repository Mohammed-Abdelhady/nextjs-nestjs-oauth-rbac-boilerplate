# SMTP production recommendations

[Guide overview](setup-smtp.md)

### Error Handling

```typescript
try {
  await this.mailService.sendActivationCode(email, code, name);
} catch (error) {
  // Log error but don't expose details to user
  console.error('Email sending failed:', error);

  // Still return success to prevent email enumeration
  return { success: true };
}
```

---

## Production Recommendations

### Don't Use Gmail/Outlook

For production applications:

- ❌ Gmail: Daily limits, spam issues, not designed for bulk
- ❌ Outlook: Same issues as Gmail
- ✅ Use dedicated service: Mailgun, SendGrid, AWS SES, Postmark

### Set Up Domain Authentication

**SPF Record** (TXT record):

```
v=spf1 include:_spf.google.com ~all
```

**DKIM**: Provider-specific (check their documentation)

**DMARC Record** (TXT record):

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

### Monitor Deliverability

- Track bounce rates
- Monitor spam complaints
- Check blacklist status: [MXToolbox](https://mxtoolbox.com/blacklists.aspx)
- Review email logs regularly

### Use Environment-Specific Configs

```typescript
// Development: Use Ethereal (fake SMTP)
if (process.env.NODE_ENV === 'development') {
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}
```

**Ethereal**: Preview emails without sending: [ethereal.email](https://ethereal.email/)

---

## Alternative: Mailtrap (Development)

For development/testing without sending real emails:

```bash
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
```

**Benefits**:

- Catch all emails in one inbox
- Test email rendering
- Check spam score
- No risk of sending to real addresses

**Setup**: [Mailtrap](https://mailtrap.io/)

---

## Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Email Authentication (SPF, DKIM, DMARC)](https://www.cloudflare.com/learning/dns/dns-records/dns-spf-record/)
- [Email Deliverability Best Practices](https://sendgrid.com/blog/email-best-practices/)

---

## Support

For SMTP issues:

- [Nodemailer GitHub](https://github.com/nodemailer/nodemailer/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/nodemailer)
- Check your email provider's SMTP documentation
