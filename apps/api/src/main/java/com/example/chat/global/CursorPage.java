package com.example.chat.global;

import java.util.List;
import java.util.function.Function;

/** 커서 페이지 응답 `{ items, nextCursor }` (API.md#공통). 마지막 페이지면 nextCursor null. */
public record CursorPage<T>(List<T> items, String nextCursor) {

	/**
	 * size+1 로 조회한 결과에서 페이지를 만든다. rows 가 size 보다 많으면 마지막 항목의 커서를 nextCursor 로.
	 * @param cursorOf 마지막 항목 → 커서 문자열 (CursorCodec.encode)
	 */
	public static <R, T> CursorPage<T> of(List<R> rows, int size, Function<R, T> map, Function<R, String> cursorOf) {
		boolean hasNext = rows.size() > size;
		List<R> page = hasNext ? rows.subList(0, size) : rows;
		String next = hasNext ? cursorOf.apply(page.get(page.size() - 1)) : null;
		return new CursorPage<>(page.stream().map(map).toList(), next);
	}
}
