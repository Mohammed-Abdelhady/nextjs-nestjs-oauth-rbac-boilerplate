# Page snapshot

```yaml
- generic [ref=e1]:
    - alert [ref=e2]
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
                        - textbox "Email Address" [active] [ref=e20]:
                            - /placeholder: name@example.com
                            - text: invalid-address
                        - paragraph [ref=e21]: Please enter a valid email address
                    - button "Send Reset Link" [ref=e22]:
                        - img
                        - generic [ref=e23]: Send Reset Link
                    - link "Back to Login" [ref=e25] [cursor=pointer]:
                        - /url: /en/auth/login
    - region "Notifications alt+T":
        - list:
            - listitem [ref=e26]:
                - img [ref=e28]
                - generic [ref=e30]:
                    - generic [ref=e31]: toast.error.networkError
                    - generic [ref=e32]: Failed to GET getCurrentUser
```
