# Spring Boot API — Gradle 빌드, JRE 런타임. Java 17 (build.gradle toolchain 과 동일)
# 빌드 컨텍스트: apps/api

FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
# 의존성 레이어 캐시: 빌드 스크립트만 먼저 복사
COPY gradlew settings.gradle* build.gradle* ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon -q || true
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test   # 테스트는 CI(ci.yml)에서 별도 실행

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring \
    && mkdir -p /tmp/audio && chown spring:spring /tmp/audio
COPY --from=build --chown=spring:spring /app/build/libs/*.jar app.jar
USER spring
EXPOSE 8080
# 힙 크기 등은 compose의 JAVA_TOOL_OPTIONS로 주입
ENTRYPOINT ["java", "-Duser.timezone=Asia/Seoul", "-jar", "app.jar"]
