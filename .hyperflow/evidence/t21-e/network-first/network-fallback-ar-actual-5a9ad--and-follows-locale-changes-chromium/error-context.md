# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - alert [ref=e2]: Login to your account | Auth Boilerplate
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
            - region "Login to your account" [ref=e14]:
                - heading "Login to your account" [level=1] [ref=e15]
                - status [ref=e17]: No sign-in method is available. Ask an administrator to turn one on.
    - region "Notifications alt+T":
        - list:
            - listitem [ref=e20]:
                - img [ref=e22]
                - generic [ref=e25]: Network error. Please check your connection
            - listitem [ref=e26]:
                - img [ref=e28]
                - generic [ref=e31]: Network error. Please check your connection
```
