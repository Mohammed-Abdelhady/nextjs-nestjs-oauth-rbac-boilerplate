# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - alert [ref=e2]: تسجيل الدخول إلى حسابك | Auth Boilerplate
    - link "تخطي إلى المحتوى الرئيسي" [ref=e3] [cursor=pointer]:
        - /url: '#main'
    - generic [ref=e4]:
        - banner [ref=e5]:
            - generic [ref=e6]:
                - button "التبديل إلى الإنجليزية" [ref=e7]: English
                - button "التبديل إلى العربية" [ref=e8]: العربية
            - button "التبديل إلى الوضع الفاتح" [ref=e9]:
                - img
        - main [ref=e10]:
            - region "تسجيل الدخول إلى حسابك" [ref=e14]:
                - heading "تسجيل الدخول إلى حسابك" [level=1] [ref=e15]
                - status [ref=e17]: لا تتوفر أي وسيلة لتسجيل الدخول. اطلب من المسؤول تفعيل إحداها.
    - region "Notifications alt+T":
        - list:
            - listitem [ref=e20]:
                - img [ref=e22]
                - generic [ref=e25]: خطأ في الشبكة. يرجى التحقق من اتصالك
            - listitem [ref=e26]:
                - img [ref=e28]
                - generic [ref=e31]: خطأ في الشبكة. يرجى التحقق من اتصالك
```
