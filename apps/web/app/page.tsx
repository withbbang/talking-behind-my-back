// 임시 진입 페이지. T-005(로그인/라우트 가드), T-008(채팅 셸 + draft 방)에서 교체된다.
export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">chat-app</h1>
        <p className="mt-2 text-sm opacity-70">스캐폴드 단계 — 로그인/채팅 화면은 T-005, T-008 에서 추가</p>
      </div>
    </main>
  );
}
