-- T-045 (D-046) 방 이름은 멤버마다 따로 — 제목 수정은 항상 "나에게만".
-- 내가 보는 이름 = COALESCE(room_members.custom_title, chat_rooms.title). chat_rooms.title 은 생성값·첫 메시지 자동 제목(공용 기본값).
ALTER TABLE room_members
  ADD COLUMN custom_title VARCHAR(100) NULL AFTER role;
