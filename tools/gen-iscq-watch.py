# -*- coding: utf-8 -*-
# 성간 임시회의 과제 감시(sllm_iqw) 모드 파일 생성기 — 2026-11-09. 쓰는 법: python gen-iscq-watch.py <tester-mod 폴더> (app\SLLM-Tester\tester-mod 와 payload\app\tester-mod 둘 다에 돌릴 것)
# 출력: common/scripted_effects/sllm_iscq_watch.txt · events/sllm_iscq_watch_events.txt · common/on_actions/sllm_iscq_watch_on_actions.txt
# 자원 목록은 앱 src/policy.ts 의 INCOME_RES · STOCK_RES 와 같아야 한다(체인 이름 income_<자원> · stock_<자원>, common/event_chains/sllm_iscq_chains.txt).
import sys, os
out = sys.argv[1]
SLOTS = [1, 2, 3]
INCOME = ['energy', 'minerals', 'food', 'alloys', 'consumer_goods', 'unity', 'physics_research', 'society_research', 'engineering_research']
STOCK = ['energy', 'minerals', 'food', 'alloys', 'consumer_goods']
CHAINS = ['peace', 'war', 'relation', 'naval'] + ['income_' + r for r in INCOME] + ['stock_' + r for r in STOCK]

def log(s, ev, now):
    return 'log = "SLLM:ISCQW/;/sid=\\\\[This.sllm_save_id]/;/slot=%d/;/ev=%s%s/;/date=\\\\[GetDate]"' % (s, ev, '/;/now=\\\\[This.sllm_iscq%d_now]' % s if now else '')

def body(s, c):
    t = 'event_target:sllm_iscq%d_target' % s
    left = '\t\tif = { limit = { check_variable = { which = sllm_iscq%d_left value > 0 } } change_variable = { which = sllm_iscq%d_left value = -1 } }\n' % (s, s)
    hit = ('\t\tset_variable = { which = sllm_iqw_d value = sllm_iscq%d_now }\n'
           '\t\tsubtract_variable = { which = sllm_iqw_d value = sllm_iscq%d_goal }\n'
           '\t\tif = { limit = { check_variable = { which = sllm_iqw_d value >= 0 } } %s }\n') % (s, s, log(s, 'hit', True))
    if c in ('peace', 'war'):
        return left + ('\t\tif = { limit = { NOT = { exists = %s } } %s }\n'
                       '\t\telse_if = { limit = { %s = { is_at_war_with = root } } %s }\n') % (t, log(s, 'gone', False), t, log(s, 'war', False))
    if c == 'relation':
        return left + ('\t\tif = { limit = { NOT = { exists = %s } } %s }\n'
                       '\t\telse = {\n'
                       '\t\t\t%s = { export_trigger_value_to_variable = { trigger = opinion parameters = { who = root } variable = sllm_iqw_v } }\n'
                       '\t\t\tset_variable = { which = sllm_iscq%d_now value = %s.sllm_iqw_v }\n'
                       '%s\t\t}\n') % (t, log(s, 'gone', False), t, s, t, hit.replace('\t\t', '\t\t\t'))
    if c == 'naval':
        return left + ('\t\texport_trigger_value_to_variable = { trigger = used_naval_capacity_percent variable = sllm_iscq%d_now }\n'
                       '\t\tmultiply_variable = { which = sllm_iscq%d_now value = 100 }\n') % (s, s) + hit
    if c.startswith('income_'):
        return left + '\t\texport_trigger_value_to_variable = { trigger = has_monthly_income parameters = { resource = %s } variable = sllm_iscq%d_now }\n' % (c[7:], s) + hit
    return left + '\t\texport_trigger_value_to_variable = { trigger = has_resource parameters = { type = %s } variable = sllm_iscq%d_now }\n' % (c[6:], s) + hit

E_ = []
w = E_.append
w('''# SLLM 성간 임시회의 과제 감시(2026-11-09 사용자: 「매달 확인이 필요 없는 것은 바뀔 때만」 · 회랑 방식). 생성기 SLLM_Dev_20261016/tools/gen-iscq-watch.py — 손으로 고치지 말 것.
# 예전: 과제가 진행 중이면 앱이 매달 콘솔로 수입·창고·해군·호감·전쟁을 재고(ISCQM), 상황 기록 숫자도 매달 콘솔로 바꿨다(sllm_iscq_tick).
# 지금: 상황 기록 칸(sllm_iscq_log.txt 의 칸 1~3)에 감시 표식(sllm_iqw<칸>_<체인>)을 붙이면, 모드가 매달 그 칸의 지금 값·남은 달을 직접 바꾸고
#   목표에 닿았을 때(hit) · 대상 제국과 전쟁 상태일 때(war) · 대상 제국이 사라졌을 때(gone)만 SLLM:ISCQW 줄을 남긴다(조건이 이어지는 동안은 그달마다 — 앱이 놓쳐도 다음 달 다시).
#   판정(성공·실패·기한)은 앱이 그 줄을 받거나 기한이 된 달에만 한 번 재서 한다(src/isc-quest.ts judge).
# 감시 켜기(앱이 세션마다 진행 중인 과제마다 한 번): sllm_iscq_watch = { SLOT = 1 CHAIN = income_energy } — 끄기는 sllm_iscq_end 가 한다.
# 비교는 차이 변수로(변수 대 변수 check_variable 이 안 먹던 일). 목표 sllm_iscq<칸>_goal 은 상황 기록 숫자(해군은 %, 나머지 소수 1자리).
sllm_iscq_watch = {
	set_country_flag = sllm_iqw$SLOT$_$CHAIN$
	set_country_flag = sllm_iqw_on
}
# 매달(sllm_iqw.1, 플레이어 나라): 감시 중인 칸마다
sllm_iscq_watch_tick = {
''')
for s in SLOTS:
    for c in CHAINS:
        w('\tif = {\n\t\tlimit = { has_country_flag = sllm_iqw%d_%s }\n%s\t}\n' % (s, c, body(s, c)))
w('}\n')

EV = '''# SLLM 성간 임시회의 과제 감시(2026-11-09). 생성기 SLLM_Dev_20261016/tools/gen-iscq-watch.py — 손으로 고치지 말 것. 효과: common/scripted_effects/sllm_iscq_watch.txt
namespace = sllm_iqw

country_event = {
	id = sllm_iqw.1
	hide_window = yes
	is_triggered_only = yes
	trigger = { is_ai = no has_country_flag = sllm_iqw_on }
	immediate = { sllm_iscq_watch_tick = yes }
}
'''
OA = '''# SLLM 성간 임시회의 과제 감시(2026-11-09) — 매달 맥박(4.5: events 만). 감시 중인 과제가 없으면 이벤트 trigger 에서 바로 끝난다.
on_monthly_pulse_country = {
	events = { sllm_iqw.1 }
}
'''
def put(rel, text):
    p = os.path.join(out, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8', newline='\n').write(text)
put('common/scripted_effects/sllm_iscq_watch.txt', ''.join(E_))
put('events/sllm_iscq_watch_events.txt', EV)
put('common/on_actions/sllm_iscq_watch_on_actions.txt', OA)
print('ok')
