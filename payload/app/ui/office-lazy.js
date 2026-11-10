// 「슈뢰딩거」 방식(2026-11-03 사용자): 게임 정보를 매달 미리 읽어 두지 않고, 화면을 열 때 한 번 읽는다.
// 집무실 「연락처」(내 지도자 명단): 열 때 이 게임 날짜에 아직 명단을 안 받았으면 앱이 게임에 한 번 묻는다(src/features/people-app.ts peopleRefresh).
// 명단이 오면 앱이 집무실 화면을 다시 그린다(onPeopleChanged). 문구 없음(언어 팩 영향 없음).
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.peopleRefresh) return;
    document.addEventListener('click', (e) => {
      const b = e.target && e.target.closest ? e.target.closest('[data-app="contacts"]') : null;
      if (b) window.sllm.peopleRefresh().catch(() => {});
    }, true);
  });
})();
