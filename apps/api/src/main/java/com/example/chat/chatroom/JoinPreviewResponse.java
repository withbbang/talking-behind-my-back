package com.example.chat.chatroom;

/** GET /rooms/join/{code} 미리보기 (API.md#rooms, T-016). 입장 전 화면용 — 초대 코드·멤버 목록은 내려주지 않는다. */
public record JoinPreviewResponse(Long roomId, String title, String ownerNickname, int memberCount) {
}
