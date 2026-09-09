# Page snapshot

```yaml
- generic:
    - alert: Verify Your Email | Auth Boilerplate
    - link:
        - /url: '#main'
        - text: Skip to main content
    - generic:
        - banner:
            - generic:
                - button: English
                - button: العربية
            - button:
                - img
    - region "Notifications alt+T":
        - list:
            - listitem:
                - generic:
                    - img
                - generic:
                    - generic: Email verified successfully!
            - listitem:
                - generic:
                    - img
                - generic:
                    - generic: Account created! Check your email
    - dialog "Welcome aboard, Lifecycle User!" [ref=e2]:
        - generic [ref=e3]:
            - img [ref=e5]
            - generic [ref=e9]:
                - heading "Welcome aboard, Lifecycle User!" [level=2] [ref=e10]
                - paragraph [ref=e11]: Your account is now active
                - paragraph [ref=e12]: Thank you for joining us. We're excited to have you on board!
            - button "Get Started" [active] [ref=e13]
        - button "Close" [ref=e14]:
            - img [ref=e15]
            - generic [ref=e18]: Close
```
