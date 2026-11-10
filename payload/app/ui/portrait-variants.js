// 초상화 변형(2026-10-16): 같은 종족 계열·의원 그림을 여러 장(기본 + #2..#8) 넣으면, 인물마다 정해진 한 장을 고른다.
// 같은 인물(시드)은 늘 같은 얼굴. 플레이어 통치자(ruler:player)와 연설 지도자(leader:)는 변형을 쓰지 않는다.
// 인물마다 직접 넣은 초상화(name:<이름>)가 있으면 그것을 먼저 쓴다(2026-10-24).
(function () {
  const MAX = 8;
  const hash = (s) => { let h = 2166136261; for (const c of String(s ?? '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  /** keys 를 앞에서부터 보며 그 키(또는 변형)가 있는 첫 묶음에서 seed 로 한 장. 마지막 키의 기본 그림이 없으면 def 를 기본으로 친다. */
  function pick(images, keys, seed, def) {
    images = images || {};
    // 지도자 개인 초상화(2026-10-24): 집무실 인물 카드에서 이 인물에게 넣은 그림이 있으면 무엇보다 먼저(앱이 지금 세이브의 것만 name:<이름> 으로 깔아 준다).
    if (seed && images['name:' + seed]) return images['name:' + seed];
    for (let n = 0; n < keys.length; n++) {
      const key = keys[n], vars = [];
      for (let i = 2; i <= MAX; i++) if (images[key + '#' + i]) vars.push(images[key + '#' + i]);
      const base = images[key] || (n === keys.length - 1 && vars.length ? def : null);
      const pool = [base, ...vars].filter(Boolean);
      if (pool.length) return pool[hash(seed) % pool.length];
    }
    return def || null;
  }
  window.SLLMVariant = { MAX, pick, hash };
})();
