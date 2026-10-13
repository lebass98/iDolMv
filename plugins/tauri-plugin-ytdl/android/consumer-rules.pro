# 릴리스 빌드(R8 압축)에서 지워지거나 이름이 바뀌면 안 되는 클래스
# youtubedl-android와 그 의존 라이브러리는 클래스를 이름으로 찾아 쓰기 때문에 그대로 유지
-keep class com.local.ytdl.** { *; }
-keep class com.yausername.** { *; }
-keep class org.apache.commons.compress.** { *; }
-keep class com.fasterxml.jackson.** { *; }
-keep class org.tukaani.xz.** { *; }
-dontwarn org.apache.commons.compress.**
-dontwarn com.fasterxml.jackson.**
-dontwarn org.tukaani.xz.**
