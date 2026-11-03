# The app itself uses only org.json and platform HTTP; nothing reflective to keep.

# security-crypto bundles Tink, which references compile-time-only Error Prone annotations.
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
