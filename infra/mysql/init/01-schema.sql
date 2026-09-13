-- MySQL 컨테이너 최초 기동 시 1회 실행 (docker-entrypoint-initdb.d).
-- 테이블은 여기서 만들지 않는다 — 스키마는 Flyway 가 소유한다(D-009).
--   apps/api/src/main/resources/db/migration/V1__init.sql 이 테이블 7개 + 기본 페르소나를 만든다.
-- 이 파일은 DB 레벨 설정만. (DB/유저 생성은 compose 의 MYSQL_* 환경변수가 담당)

SET NAMES utf8mb4;
