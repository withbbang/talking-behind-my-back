package com.example.chat.chatroom;

import java.security.SecureRandom;

/**
 * 초대 코드 생성 (SCHEMA.md #4). 8자 base32 — 혼동 문자 0/O/1/I 를 뺀 32자 알파벳.
 * 유일성은 chat_rooms.invite_code UNIQUE 가 보장하고, 충돌은 서비스가 재시도한다.
 */
public final class InviteCodes {

	public static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	public static final int LENGTH = 8;

	private static final SecureRandom RANDOM = new SecureRandom();

	private InviteCodes() {
	}

	public static String generate() {
		StringBuilder sb = new StringBuilder(LENGTH);
		for (int i = 0; i < LENGTH; i++) {
			sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
		}
		return sb.toString();
	}
}
