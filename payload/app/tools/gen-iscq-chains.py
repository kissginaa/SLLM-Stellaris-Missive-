# 성간 임시회의 과제 → 게임 상황 기록(Situation Log) 항목 생성기(2026-10-26).
# 바닐라 몰락한 제국 과제(common/event_chains/00_fallen_empire_chains.txt)와 같은 이벤트 체인. 칸 3개(동시 3개) × 목표 종류(수입·창고는 자원별).
# 게임 글은 고정이라 AI 가 지은 제목·대사는 넣지 못한다 → 종류별 문구 + 전역 이벤트 대상(과제를 준 제국·대상 제국 이름) + 변수(목표·지금·남은 개월).
# 실행: python tools/gen-iscq-chains.py <tester-mod 폴더>
import os, sys
SLOTS = 3
INCOME = {'energy': ('에너지', 'Energy'), 'minerals': ('광물', 'Minerals'), 'food': ('식량', 'Food'), 'alloys': ('합금', 'Alloys'), 'consumer_goods': ('소비재', 'Consumer Goods'), 'unity': ('통합', 'Unity'), 'physics_research': ('물리학 연구', 'Physics Research'), 'society_research': ('사회학 연구', 'Society Research'), 'engineering_research': ('공학 연구', 'Engineering Research')}
STOCK = ['energy', 'minerals', 'food', 'alloys', 'consumer_goods']
def chains():
    out = []
    for t in ['peace', 'war', 'relation', 'naval']: out.append((t, None))
    for r in INCOME: out.append(('income', r))
    for r in STOCK: out.append(('stock', r))
    return out
def key(t, r, s): return f'sllm_iscq_{t}{"_" + r if r else ""}_{s}'
FOOT_KO = '\\n\\n성공하면 약속한 보상과 그 제국의 호감 +15, 실패하면 불이익과 호감 -15. 과제 원문과 보상은 SLLM 앱의 성간 임시회의 창에서 볼 수 있습니다.'
FOOT_EN = '\\n\\nOn success: the promised reward and +15 opinion from that empire. On failure: the penalty and -15 opinion. The full task and rewards are in the SLLM app\'s summit window.'
def texts(t, r, s):
    g, tg, v = f'[sllm_iscq{s}_giver.GetName]', f'[sllm_iscq{s}_target.GetName]', lambda n: f'[Root.sllm_iscq{s}_{n}]'
    left_ko, left_en = f'\\n\\n남은 기간: {v("left")}개월', f'\\n\\nMonths left: {v("left")}'
    by_ko, by_en = f'성간 임시회의에서 {g}이(가) 맡긴 과제입니다. ', f'A task set by {g} at the interstellar summit. '
    if t == 'peace': return (f'성간회의 과제: {tg}과(와) 평화 유지', by_ko + f'{tg}과(와) 전쟁하지 않고 기한까지 버티십시오.' + left_ko + FOOT_KO,
                             f'Summit Task: Peace with {tg}', by_en + f'Stay at peace with {tg} until the deadline.' + left_en + FOOT_EN)
    if t == 'war': return (f'성간회의 과제: 공동의 적 {tg}', by_ko + f'기한 안에 {tg}과(와) 전쟁 상태가 되십시오.' + left_ko + FOOT_KO,
                           f'Summit Task: Common Enemy {tg}', by_en + f'Be at war with {tg} before the deadline.' + left_en + FOOT_EN)
    if t == 'relation': return (f'성간회의 과제: {tg}과(와)의 관계', by_ko + f'{tg}의 우리 제국 호감을 {v("goal")}까지 올리십시오.\\n지금: {v("now")}' + left_ko + FOOT_KO,
                                f'Summit Task: Relations with {tg}', by_en + f'Raise {tg}\'s opinion of us to {v("goal")}.\\nNow: {v("now")}' + left_en + FOOT_EN)
    if t == 'naval': return ('성간회의 과제: 함대 증강', by_ko + f'해군 사용률을 {v("goal")}%까지 채우십시오.\\n지금: {v("now")}%' + left_ko + FOOT_KO,
                             'Summit Task: Build Up the Fleet', by_en + f'Fill {v("goal")}% of our naval capacity.\\nNow: {v("now")}%' + left_en + FOOT_EN)
    ko, en = (INCOME[r] if r in INCOME else INCOME[r])
    if t == 'income': return (f'성간회의 과제: {ko} 수입', by_ko + f'{ko} 월수입을 {v("goal")}까지 늘리십시오.\\n지금: {v("now")}' + left_ko + FOOT_KO,
                              f'Summit Task: {en} Income', by_en + f'Raise monthly {en} income to {v("goal")}.\\nNow: {v("now")}' + left_en + FOOT_EN)
    return (f'성간회의 과제: {ko} 비축', by_ko + f'{ko} 창고를 {v("goal")}까지 채우십시오.\\n지금: {v("now")}' + left_ko + FOOT_KO,
            f'Summit Task: {en} Stockpile', by_en + f'Raise the {en} stockpile to {v("goal")}.\\nNow: {v("now")}' + left_en + FOOT_EN)
def main(mod):
    head = '# 생성 파일: tools/gen-iscq-chains.py (2026-10-26). 성간 임시회의 과제를 게임 상황 기록에 띄운다. 손으로 고치지 말 것.\n'
    ch, ko, en = [head], ['﻿l_korean:'], ['﻿l_english:']
    for s in range(1, SLOTS + 1):
        for t, r in chains():
            k = key(t, r, s)
            ch.append(f'{k} = {{\n\tpicture = GFX_evt_diplomatic_visit\n\ticon = "gfx/interface/icons/situation_log/situation_log_quest.dds"\n\tsituation_log_category = urgent_matters\n}}\n')
            tk, dk, te, de = texts(t, r, s)
            ko += [f' {k}_title:0 "{tk}"', f' {k}_desc:0 "{dk}"']; en += [f' {k}_title:0 "{te}"', f' {k}_desc:0 "{de}"']
    w = lambda p, s: (os.makedirs(os.path.dirname(p), exist_ok=True), open(p, 'w', encoding='utf-8', newline='\n').write(s))
    w(os.path.join(mod, 'common', 'event_chains', 'sllm_iscq_chains.txt'), '\n'.join(ch))
    w(os.path.join(mod, 'localisation', 'korean', 'sllm_iscq_l_korean.yml'), '\n'.join(ko) + '\n')
    w(os.path.join(mod, 'localisation', 'english', 'sllm_iscq_l_english.yml'), '\n'.join(en) + '\n')
    print('chains', SLOTS * len(chains()))
if __name__ == '__main__': main(sys.argv[1] if len(sys.argv) > 1 else 'tester-mod')
