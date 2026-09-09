# Page snapshot

```yaml
- generic [ref=e1]:
    - alert [ref=e2]: Forgot Your Password? | Auth Boilerplate
    - link "Skip to main content" [ref=e3] [cursor=pointer]:
        - /url: '#main'
    - generic [ref=e4]:
        - banner [ref=e5]:
            - generic [ref=e6]:
                - button "Switch to English" [ref=e7]: English
                - button "Switch to Arabic" [ref=e8]: العربية
            - button "Switch to light mode" [ref=e9]:
                - img
        - main [ref=e10]:
            - region "Forgot Your Password?" [ref=e14]:
                - heading "Forgot Your Password?" [level=1] [ref=e15]
                - paragraph [ref=e16]: Enter your email address and we'll send you a reset link
                - form "Forgot Your Password?" [ref=e18]:
                    - generic [ref=e19]:
                        - text: Email Address
                        - textbox "Email Address" [ref=e20]:
                            - /placeholder: name@example.com
                        - paragraph [ref=e21]: Email is required
                    - button "Send Reset Link" [ref=e22]:
                        - img
                        - generic [ref=e23]: Send Reset Link
                    - link "Back to Login" [active] [ref=e25] [cursor=pointer]:
                        - /url: /en/auth/login
    - region "Notifications alt+T":
        - list:
            - listitem [ref=e28]:
                - img [ref=e30]
                - generic [ref=e32]:
                    - generic [ref=e33]: toast.error.networkError
                    - generic [ref=e34]: Failed to GET getCurrentUser
```
