# Page snapshot

```yaml
- generic [ref=e1]:
    - alert [ref=e2]
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
            - region "نسيت كلمة المرور؟" [ref=e14]:
                - heading "نسيت كلمة المرور؟" [level=1] [ref=e15]
                - paragraph [ref=e16]: أدخل عنوان بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
                - form "نسيت كلمة المرور؟" [ref=e18]:
                    - generic [ref=e19]:
                        - text: عنوان البريد الإلكتروني
                        - textbox "عنوان البريد الإلكتروني" [active] [ref=e20]:
                            - /placeholder: name@example.com
                    - button "إرسال رابط إعادة التعيين" [ref=e21]:
                        - img
                        - generic [ref=e22]: إرسال رابط إعادة التعيين
                    - link "العودة لتسجيل الدخول" [ref=e24] [cursor=pointer]:
                        - /url: /ar/auth/login
    - region "Notifications alt+T":
        - list:
            - listitem [ref=e27]:
                - img [ref=e29]
                - generic [ref=e31]:
                    - generic [ref=e32]: toast.error.networkError
                    - generic [ref=e33]: Failed to GET getCurrentUser
```
