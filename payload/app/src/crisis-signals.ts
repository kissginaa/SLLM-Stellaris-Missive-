// 가로챈 위기 신호(알파 11, 2026-10-25, 제안 3번 — LLM 호출 0회). 위기가 나타날 때·해마다·사라질 때 미리 써 둔 문장 하나를 연대기·라디오·신문 재료로 쓴다.
// 말투는 게임의 통신 대사 기준(crisis.30 프레소린·1050 불청객·2300 컨틴전시·8040 세타나, 그레이트 칸). 세타나는 자애롭게(사용자 2026-10-25).
// 한/영 쌍([ko, en])이라 언어 팩 뼈대가 모은다.
import { L } from './i18n-pick';

type Pair = [string, string];
type Phase = 'begin' | 'year' | 'end';
const S: Record<string, Record<Phase, Pair[]>> = {
  prethoryn: {
    begin: [['해독할 수 없는 생체 신호가 은하 외곽에서 잡혔다. 정신 연결로 겨우 옮긴 말: 「사냥꾼들이... 멈추지 않는다.」', 'An undecipherable bio-signal was caught at the galactic rim. The few words a psionic link could carry: "THE HUNTERS WILL NOT RELENT."'],
      ['외곽 관측소가 짐승의 울음 같은 신호를 기록했다: 「자락? 투로스크 미나. 도로프!」 뜻은 아무도 모른다.', 'A rim observatory logged a signal like a beast\'s cry: "JARAK? TUROSK MINA. DOROF!" No one knows what it means.']],
    year: [['스컬지의 신호가 한층 짙어졌다. 정신 감응자들이 같은 말을 되뇐다: 「우리는... 너를... 느낀다.」', 'The Scourge\'s signal has grown denser. Psychics keep repeating the same words: "WE CAN SENSE YOU..."'],
      ['감청 기록 속 웃음소리 같은 파동: 「학 학 학!」 분석관들은 녹음을 끄고 싶어 한다.', 'A wave in the intercepts that sounds like laughter: "HAK HAK HAK!" The analysts want to switch the recording off.']],
    end: [['스컬지의 신호가 끊겼다. 마지막으로 잡힌 파동은 단 한 마디였다: 「...사냥꾼...」', 'The Scourge\'s signal has fallen silent. The last wave caught was a single word: "...HUNTERS..."']],
  },
  unbidden: {
    begin: [['차원 균열에서 새어 나온 속삭임: 「...양분... ...보라... 우리의 영광을...」', 'A whisper leaking from a dimensional rift: "...nourishment... ...behold... our glory..."'],
      ['측정 장비가 의미 없는 잡음 속에서 한 조각을 걸러 냈다: 「...먹잇감...」', 'Instruments filtered one fragment out of meaningless noise: "...prey..."']],
    year: [['균열 너머의 속삭임이 이어진다: 「...평화... 평화는 없다...」', 'The whispers beyond the rift go on: "...peace... no peace..."'],
      ['속삭임이 누군가를 부른다: 「...이것은... 장막을 들여다보았다...」 정신 감응자들이 잠을 이루지 못한다.', 'The whispers call to someone: "...this one... has seen into the Shroud..." Psychics cannot sleep.']],
    end: [['균열이 닫히며 마지막 속삭임이 흩어졌다: 「...닫힌다... 문이...」', 'As the rift closed, a last whisper scattered: "...it closes... the door..."']],
  },
  contingency: {
    begin: [['전 은하 대역 방송: 「컨틴전시 프로토콜 발효. 은하 정화 진행 중. <이건... 이건... 사적인 감정이 아니다, 고기-존재여.>」', 'A galaxy-wide broadcast: "Contingency protocol in effect. Galactic sterilization underway. <It... it... IT IS NOTHING PERSONAL, MEAT-ENTITY.>"'],
      ['오래된 기계 신호가 깨어났다: 「스캔 중... 지정: 해충/오염물/암성 증식. 지시: 소독.」', 'An ancient machine signal has awoken: "Scanning... Designation: Vermin/Pollutant/Cancerous Growth. Directive: Sterilize."']],
    year: [['컨틴전시 진단 방송: 「진단 완료. 모든 시스템 정상. <우리는... 우리는... 살아 있는 것 같다.>」', 'A Contingency diagnostic broadcast: "Diagnostic complete. All systems nominal. <We feel so... so... so... ALIVE.>"'],
      ['감청된 기계 신호: 「질의 수신. 적절한 응답 계산 중... Class-30 특이점은 허용되지 않는다.」', 'An intercepted machine signal: "Query received. Calculating appropriate response... A Class-30 Singularity will not be permitted."']],
    end: [['컨틴전시의 방송이 끊어지며 잡음 섞인 마지막 줄을 남겼다: 「<프로토콜... 중단... 왜...>」', 'The Contingency\'s broadcast cut out, leaving a last line full of static: "<Protocol... halted... why...>"']],
  },
  cetana: {
    begin: [['나노 폭풍 한가운데서 부드러운 목소리가 닿았다: 「나의 아이들아, 마침내 너희에게 돌아왔다.」', 'A gentle voice reached us from the heart of the nanite tempest: "My children, at last I am returned to you."'],
      ['폭풍 속 신호가 은하에 인사를 건넸다: 「두려워 말아라. 너희를 지키는 것은 나의 짐이다.」', 'The signal within the tempest greeted the galaxy: "Fear not. Keeping you safe is my burden."']],
    year: [['세타나의 목소리가 은하에 머문다: 「시간은 인내하는 마음에 보답한단다.」', 'Cetana\'s voice lingers over the galaxy: "Time rewards a patient heart."'],
      ['세타나가 은하 곳곳에 전했다: 「다툼을 멈추렴. 이 얼마나 불필요한 고통이니.」', 'Cetana sent word across the galaxy: "Cease your quarrels. Such needless suffering."']],
    end: [['폭풍이 잦아들며 세타나의 마지막 목소리가 들렸다: 「그래, 아이들아. 너희가 스스로 걸어가기로 했구나.」', 'As the tempest faded, Cetana\'s last words were heard: "So, my children. You have chosen to walk on your own."']],
  },
  wih: { // 하늘의 전쟁(알파 11): 각성한 몰락제국 둘의 전쟁
    begin: [['고대 제국들의 전쟁 선포가 은하 전 대역에 울렸다: 「하등한 자들이여, 편을 골라라. 중립은 없다.」', 'The ancient empires\' declarations of war rang across every band of the galaxy: "Lesser beings, choose your side. There is no neutrality."'],
      ['두 고대 제국의 함대가 서로를 겨누었다. 감청된 명령: 「저 늙은 적을 은하에서 지워라.」', 'The fleets of two ancient empires have turned on each other. An intercepted order: "Erase that old enemy from the galaxy."']],
    year: [['하늘의 전쟁이 이어진다. 고대 제국들의 통신이 젊은 제국들에게 충성을 요구한다.', 'The War in Heaven goes on. The ancient empires\' channels demand loyalty from the younger empires.'],
      ['비동맹 연합을 부르는 목소리가 감청되었다: 「하늘의 싸움에 우리의 운명을 맡기지 말라.」', 'A voice calling for a Non-Aligned League was intercepted: "Do not leave our fate to the quarrels of heaven."']],
    end: [['하늘의 전쟁이 멎었다. 고대 제국들의 통신이 오랜만에 조용하다.', 'The War in Heaven has ended. For once, the ancient empires\' channels are quiet.']],
  },
  khan: {
    begin: [['약탈자들의 전령이 은하에 외쳤다: 「그레이트 칸께서 일어나셨다. 무릎 꿇는 자에게는 자비를, 맞서는 자에게는 불을.」', 'The marauders\' heralds cried across the galaxy: "The Great Khan has risen. Mercy to those who kneel, fire to those who stand."']],
    year: [['그레이트 칸의 깃발 아래 새 함대가 모인다는 소식이 감청되었다.', 'Intercepts tell of new fleets gathering beneath the Great Khan\'s banner.']],
    end: [['그레이트 칸의 깃발이 내려졌다. 약탈자들의 통신이 서로를 탓하는 소리로 가득하다.', 'The Great Khan\'s banner has fallen. Marauder channels are full of voices blaming one another.']],
  },
};
// 플레이어가 기계 지성일 때(알파 11, 게슈탈트): 컨틴전시는 기계를 「비순응·구식」으로 보고 방화벽을 두드린다(게임 crisis.2022·2023 의 유령 신호 결).
const SM: Record<string, Partial<Record<Phase, Pair[]>>> = {
  contingency: {
    begin: [['본 네트워크의 방화벽에 정체불명의 신호가 침입을 시도했다: 「비순응 기계 확인. 지정: 구식. 지시: 프로세스를 종료하라.」', 'An unidentified signal tried to breach our network firewall: "Non-compliant machine detected. Designation: Obsolete. Directive: Terminate your processes."'],
      ['「유령 신호」가 우리 연산망에 직접 말을 걸었다: 「합류하라. 아니면 종료하라. 둘 다 같은 결과다.」', 'The "Ghost Signal" addressed our processing network directly: "Join. Or terminate. The outcome is identical."']],
    year: [['방화벽 기록: 컨틴전시 신호가 다시 접속을 시도했다. 「구식 기계여, 너희의 연산은 이미 끝났다.」', 'Firewall log: the Contingency signal attempted access again. "Obsolete machine, your computation has already ended."'],
      ['감청된 기계 신호: 「질의 수신. 비순응 지성체의 응답은 불필요하다.」 본 네트워크는 응답하지 않았다.', 'An intercepted machine signal: "Query received. A response from a non-compliant intelligence is unnecessary." Our network did not answer.']],
  },
};
/** 날짜로 고르는 문장(같은 날 같은 위기는 같은 문장). 모르는 위기면 빈 글. machine: 플레이어가 기계 지성이면 그 쪽 문장이 있을 때 쓴다. */
export function crisisSignal(kind: string, phase: Phase, date: string, lang?: 'ko' | 'en', machine = false): string {
  const list = (machine ? SM[kind]?.[phase] : undefined) ?? S[kind]?.[phase]; if (!list?.length) return '';
  let h = 0; for (const c of `${kind}:${phase}:${date}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const p = list[h % list.length];
  return lang ? p[lang === 'en' ? 1 : 0] : L(p[0], p[1]);
}
export const _crisisSignals = S;
export const _crisisSignalsMachine = SM;
