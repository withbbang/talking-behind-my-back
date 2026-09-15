package com.example.chat.chatroom;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** 초대 코드: 8자 base32, 혼동 문자 0/O/1/I 제외 (SCHEMA.md #4). */
class InviteCodeTest {

	@Test
	void 길이_8_알파벳_제한() {
		for (int i = 0; i < 200; i++) {
			String code = InviteCodes.generate();
			assertThat(code).hasSize(8).matches("[A-HJ-NP-Z2-9]{8}");
		}
	}

	@Test
	void 알파벳은_32자_이고_혼동문자_없음() {
		assertThat(InviteCodes.ALPHABET).hasSize(32).doesNotContain("0", "O", "1", "I");
	}

	@Test
	void 연속_생성은_대부분_다르다() {
		Set<String> seen = new HashSet<>();
		for (int i = 0; i < 100; i++) seen.add(InviteCodes.generate());
		assertThat(seen).hasSizeGreaterThan(95);
	}
}
