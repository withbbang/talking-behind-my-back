package com.example.chat.chatroom;

/**
 * GET /rooms/join/{code} 미리보기 (API.md#rooms, T-016/T-022). 입장 전 화면용 — 초대 코드·멤버 목록은 내려주지 않는다.
 * alreadyMember = 요청자가 이미 활성 멤버(프론트 "다시 들어가기" 판정, D-021).
 */
public record JoinPreviewResponse(Long roomId, String title, String ownerNickname, int memberCount, boolean alreadyMember) {
}
