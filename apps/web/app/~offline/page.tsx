'use client';

/**
 * 오프라인 셸 (T-014, D-039 3). 서비스워커가 navigation 요청에 실패하면 이 페이지를 대신 내준다.
 * 정적 페이지라 빌드 시 프리캐시된다. proxy.ts 가드에서 제외(미인증이어도 로그인으로 보내지 않음).
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-bold">연결 없음</h1>
      <p className="text-ink/70">인터넷이 안 되는 것 같아. 다시 연결되면 이어서 하자.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full bg-surface px-6 py-3 font-semibold"
      >
        다시 시도
      </button>
    </main>
  );
}
