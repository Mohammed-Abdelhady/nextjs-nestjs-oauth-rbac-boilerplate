# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - alert [ref=e2]: Auth Boilerplate
    - link "Skip to main content" [ref=e3] [cursor=pointer]:
        - /url: '#main'
    - main [ref=e5]:
        - generic [ref=e7]:
            - heading "Access Denied" [level=1] [ref=e8]
            - paragraph [ref=e9]: '403'
            - paragraph [ref=e10]: You don't have permission to access this resource. Please contact support if you believe this is an error.
            - generic [ref=e11]:
                - link "Go to Dashboard" [ref=e12] [cursor=pointer]:
                    - /url: /en
                    - img
                    - text: Go to Dashboard
                - button "Contact Support" [ref=e13]:
                    - img
                    - text: Contact Support
        - generic [ref=e15]:
            - img [ref=e16]
            - paragraph [ref=e18]: Access restricted
    - region "Notifications alt+T":
        - list:
            - listitem [ref=e19]:
                - img [ref=e21]
                - generic [ref=e24]: 'Missing required permissions: users:list:all'
            - listitem [ref=e25]:
                - img [ref=e27]
                - generic [ref=e30]: 'Missing required permissions: roles:list:all'
```
