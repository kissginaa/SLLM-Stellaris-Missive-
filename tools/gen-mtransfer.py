# -*- coding: utf-8 -*-
# 정기 송금(sllm_mt) 모드 파일 생성기 — 2026-11-09. 쓰는 법: python gen-mtransfer.py <tester-mod 폴더> (app\SLLM-Tester\tester-mod 와 payload\app\tester-mod 둘 다에 돌릴 것)
# 출력: common/scripted_effects/sllm_mtransfer.txt · events/sllm_mtransfer_events.txt · common/on_actions/sllm_mtransfer_on_actions.txt
import sys, os
out = sys.argv[1]
K = range(1, 7)  # 상대 나라마다 칸 6개
RES = [(1, 'energy'), (2, 'minerals'), (3, 'food'), (4, 'alloys'), (5, 'consumer_goods')]
F = ['r', 'd', 'a', 'l', 'm', 'g', 'o']  # 자원 · 방향 · 양 · 남은 달 · 못 낸 달 · 묶음 번호 · 기능

E = []
w = E.append
w('''# SLLM 정기 송금(2026-11-09 사용자: 「매달 확인이 필요 없는 것은 바뀔 때만」 · 회랑 방식). 생성기 SLLM_Dev_20261016/tools/gen-mtransfer.py 로 만든 파일 — 손으로 고치지 말고 생성기를 고칠 것.
# 외교 거래 매달 지급·반란군 후원처럼 「매달 얼마씩 보낸다」를 앱이 매달 콘솔로 보내지 않고, 모드가 매달 직접 한다.
# 칸은 상대 나라 범위에 6개(sllm_mt<K>_*): r 자원(1 에너지 2 광물 3 식량 4 합금 5 소비재 6 에너지+광물 같이) · d 방향(1 우리가 냄, 2 상대가 냄) ·
#   a 한 달 양 · l 남은 달 · m 연속으로 못 낸 달 · g 묶음 번호(앱이 매김: 거래 하나·후원 하나) · o 기능(1 외교 거래, 2 반란군 후원).
# 앱에 보내는 줄(로그 자리 MTRANSFER): MTSET(등록·해제 응답) · MT(ev = short 못 냄 · stop 두 달 못 내서 끊김 · end 다 냄). 잘 낸 달은 아무 줄도 없다.
# 국고가 모자라면 아무것도 빠지지 않는다(2026-11-08 사용자 공통 규칙). 로그 문구에는 $매개변수$ 를 쓰지 않는다(F-39) — 변수로만 찍는다.
''')
# 찾기(플레이어 범위에서 부른다, 부르기 전에 event_target:sllm_mt_p 를 저장해 둔다)
w('''sllm_mt_find = {
	set_variable = { which = sllm_mt_fok value = 0 }
	random_country = {
		limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = $TID$ } sllm_is_empire = yes }
		save_event_target_as = sllm_mt_x
		event_target:sllm_mt_p = { set_variable = { which = sllm_mt_fok value = 1 } }
	}
}
''')
# 한 칸 비우기(상대 범위)
for k in K:
    w('sllm_mt_clear_%d = {\n' % k + ''.join('\tclear_variable = sllm_mt%d_%s\n' % (k, f) for f in F) + '}\n')
# 등록(플레이어 범위): 같은 묶음·자원·방향 칸이 있으면 그 칸(KEEP = yes 면 그대로 두고 응답만), 없으면 빈 칸
w('''# 등록: REQ TID R D A L G O KEEP CHECK. 응답 MTSET st = 1 넣음 · 2 칸이 모자람 · 3 이미 있음(KEEP) · 4 없음(CHECK — 만들지 않음) · 0 상대 없음.
# CHECK = yes(2026-11-09): 세이브를 불러온 뒤 앱이 칸을 다시 확인할 때. 칸이 없으면 새로 만들지 않는다 — 앱이 꺼져 있던 동안 모드가 끝내거나 끊은 송금이 다시 나가지 않게(앱은 끝난 것으로 본다).
sllm_mt_set = {
	set_variable = { which = sllm_mt_req value = $REQ$ }
	set_variable = { which = sllm_mt_st value = 0 }
	set_variable = { which = sllm_mt_k value = 0 }
	save_event_target_as = sllm_mt_p
	sllm_mt_find = { TID = $TID$ }
	if = {
		limit = { check_variable = { which = sllm_mt_fok value = 1 } }
		event_target:sllm_mt_x = {
''')
for k in K:
    w('''			if = {
				limit = { event_target:sllm_mt_p = { check_variable = { which = sllm_mt_k value = 0 } } is_variable_set = sllm_mt%(k)d_l check_variable = { which = sllm_mt%(k)d_g value = $G$ } check_variable = { which = sllm_mt%(k)d_o value = $O$ } check_variable = { which = sllm_mt%(k)d_r value = $R$ } check_variable = { which = sllm_mt%(k)d_d value = $D$ } }
				event_target:sllm_mt_p = { set_variable = { which = sllm_mt_k value = %(k)d } set_variable = { which = sllm_mt_st value = 3 } }
			}
''' % {'k': k})
for k in K:
    w('''			if = {
				limit = { event_target:sllm_mt_p = { check_variable = { which = sllm_mt_k value = 0 } } NOT = { is_variable_set = sllm_mt%(k)d_l } }
				event_target:sllm_mt_p = { set_variable = { which = sllm_mt_k value = %(k)d } set_variable = { which = sllm_mt_st value = 1 } }
			}
''' % {'k': k})
w('''		}
		if = { limit = { check_variable = { which = sllm_mt_k value = 0 } } set_variable = { which = sllm_mt_st value = 2 } }
		if = { limit = { check_variable = { which = sllm_mt_st value = 3 } always = $KEEP$ } set_variable = { which = sllm_mt_k value = 0 } }   # 이미 있고 그대로 둠
		else_if = { limit = { check_variable = { which = sllm_mt_st value = 3 } } set_variable = { which = sllm_mt_st value = 1 } }   # 이미 있음 → 새 값으로 덮기
		if = { limit = { always = $CHECK$ OR = { check_variable = { which = sllm_mt_st value = 1 } check_variable = { which = sllm_mt_st value = 2 } } } set_variable = { which = sllm_mt_st value = 4 } set_variable = { which = sllm_mt_k value = 0 } }   # 확인만: 없으면 만들지 않음
''')
for k in K:
    w('''		if = {
			limit = { check_variable = { which = sllm_mt_k value = %(k)d } }
			event_target:sllm_mt_x = {
				set_variable = { which = sllm_mt%(k)d_r value = $R$ }
				set_variable = { which = sllm_mt%(k)d_d value = $D$ }
				set_variable = { which = sllm_mt%(k)d_a value = $A$ }
				set_variable = { which = sllm_mt%(k)d_l value = $L$ }
				set_variable = { which = sllm_mt%(k)d_m value = 0 }
				set_variable = { which = sllm_mt%(k)d_g value = $G$ }
				set_variable = { which = sllm_mt%(k)d_o value = $O$ }
				set_country_flag = sllm_mt_has
			}
			set_country_flag = sllm_mt_on
		}
''' % {'k': k})
w('''	}
	log = "SLLM:MTSET/;/req=\\\\[This.sllm_mt_req]/;/sid=\\\\[This.sllm_save_id]/;/st=\\\\[This.sllm_mt_st]/;/k=\\\\[This.sllm_mt_k]"
}
''')
# 해제(플레이어 범위): 묶음 G·기능 O 의 칸을 모두 비운다
w('''# 해제: REQ TID G O — 그 묶음의 칸을 모두 비운다(앱이 약속을 끝낼 때·파기할 때). 응답 MTSET st = 1(상대가 없어도 1: 지울 것이 없을 뿐).
sllm_mt_unset = {
	set_variable = { which = sllm_mt_req value = $REQ$ }
	set_variable = { which = sllm_mt_k value = 0 }
	save_event_target_as = sllm_mt_p
	sllm_mt_find = { TID = $TID$ }
	if = {
		limit = { check_variable = { which = sllm_mt_fok value = 1 } }
		event_target:sllm_mt_x = {
''')
for k in K:
    w('\t\t\tif = { limit = { is_variable_set = sllm_mt%(k)d_g check_variable = { which = sllm_mt%(k)d_g value = $G$ } check_variable = { which = sllm_mt%(k)d_o value = $O$ } } sllm_mt_clear_%(k)d = yes }\n' % {'k': k})
w('''		}
	}
	set_variable = { which = sllm_mt_st value = 1 }
	log = "SLLM:MTSET/;/req=\\\\[This.sllm_mt_req]/;/sid=\\\\[This.sllm_save_id]/;/st=\\\\[This.sllm_mt_st]/;/k=\\\\[This.sllm_mt_k]"
}
''')
# 한 칸 지급(상대 범위, event_target:sllm_mt_p = 플레이어). 성공하면 sllm_mt_ok = 1(상대 범위)
for k in K:
    for code, res in RES:
        w('''sllm_mt_pay_%(k)d_%(c)d = {
	if = {
		limit = { check_variable = { which = sllm_mt%(k)d_d value = 1 } }
		event_target:sllm_mt_p = { export_resource_stockpile_to_variable = { resource = %(res)s variable = sllm_mt_stock } set_variable = { which = sllm_mt_amt value = prev.sllm_mt%(k)d_a } }
		if = {
			limit = { event_target:sllm_mt_p = { check_variable = { which = sllm_mt_stock value >= sllm_mt_amt } } }
			event_target:sllm_mt_p = { add_resource = { %(res)s = -1 mult = sllm_mt_amt } }
			add_resource = { %(res)s = 1 mult = sllm_mt%(k)d_a }
			set_variable = { which = sllm_mt_ok value = 1 }
		}
	}
	else = {
		export_resource_stockpile_to_variable = { resource = %(res)s variable = sllm_mt_stock }
		if = {
			limit = { check_variable = { which = sllm_mt_stock value >= sllm_mt%(k)d_a } }
			add_resource = { %(res)s = -1 mult = sllm_mt%(k)d_a }
			event_target:sllm_mt_p = { set_variable = { which = sllm_mt_amt value = prev.sllm_mt%(k)d_a } add_resource = { %(res)s = 1 mult = sllm_mt_amt } }
			set_variable = { which = sllm_mt_ok value = 1 }
		}
	}
}
''' % {'k': k, 'c': code, 'res': res})
    # 6 = 에너지+광물 같이(둘 다 있어야 보낸다 — 반란군 후원)
    w('''sllm_mt_pay_%(k)d_6 = {
	if = {
		limit = { check_variable = { which = sllm_mt%(k)d_d value = 1 } }
		event_target:sllm_mt_p = {
			export_resource_stockpile_to_variable = { resource = energy variable = sllm_mt_stock }
			export_resource_stockpile_to_variable = { resource = minerals variable = sllm_mt_stock2 }
			set_variable = { which = sllm_mt_amt value = prev.sllm_mt%(k)d_a }
		}
		if = {
			limit = { event_target:sllm_mt_p = { check_variable = { which = sllm_mt_stock value >= sllm_mt_amt } check_variable = { which = sllm_mt_stock2 value >= sllm_mt_amt } } }
			event_target:sllm_mt_p = { add_resource = { energy = -1 minerals = -1 mult = sllm_mt_amt } }
			add_resource = { energy = 1 minerals = 1 mult = sllm_mt%(k)d_a }
			set_variable = { which = sllm_mt_ok value = 1 }
		}
	}
	else = {
		export_resource_stockpile_to_variable = { resource = energy variable = sllm_mt_stock }
		export_resource_stockpile_to_variable = { resource = minerals variable = sllm_mt_stock2 }
		if = {
			limit = { check_variable = { which = sllm_mt_stock value >= sllm_mt%(k)d_a } check_variable = { which = sllm_mt_stock2 value >= sllm_mt%(k)d_a } }
			add_resource = { energy = -1 minerals = -1 mult = sllm_mt%(k)d_a }
			event_target:sllm_mt_p = { set_variable = { which = sllm_mt_amt value = prev.sllm_mt%(k)d_a } add_resource = { energy = 1 minerals = 1 mult = sllm_mt_amt } }
			set_variable = { which = sllm_mt_ok value = 1 }
		}
	}
}
''' % {'k': k})
# 줄에 찍을 값 옮기기(상대 범위) — 로그는 변수로만
w('''# 줄에 찍을 값(상대 범위의 sllm_mt_l*): 칸 번호 · 묶음 · 기능 · 자원 · 방향 · 못 낸 달
''')
for k in K:
    w('''sllm_mt_note_%(k)d = {
	set_variable = { which = sllm_mt_lk value = %(k)d }
	set_variable = { which = sllm_mt_lg value = sllm_mt%(k)d_g }
	set_variable = { which = sllm_mt_lo value = sllm_mt%(k)d_o }
	set_variable = { which = sllm_mt_lr value = sllm_mt%(k)d_r }
	set_variable = { which = sllm_mt_ld value = sllm_mt%(k)d_d }
	set_variable = { which = sllm_mt_lm value = sllm_mt%(k)d_m }
}
''' % {'k': k})
LOG = 'log = "SLLM:MT/;/ev=%s/;/sid=\\\\[Root.sllm_save_id]/;/tid=\\\\[This.sllm_idx]/;/k=\\\\[This.sllm_mt_lk]/;/g=\\\\[This.sllm_mt_lg]/;/o=\\\\[This.sllm_mt_lo]/;/r=\\\\[This.sllm_mt_lr]/;/d=\\\\[This.sllm_mt_ld]/;/miss=\\\\[This.sllm_mt_lm]/;/date=\\\\[GetDate]"'
# 한 칸 한 달(상대 범위)
for k in K:
    w('''sllm_mt_slot_%(k)d = {
	if = {
		limit = { is_variable_set = sllm_mt%(k)d_l check_variable = { which = sllm_mt%(k)d_l value > 0 } }
		set_variable = { which = sllm_mt_ok value = 0 }
''' % {'k': k})
    for code in range(1, 7):
        w('\t\t%sif = { limit = { check_variable = { which = sllm_mt%d_r value = %d } } sllm_mt_pay_%d_%d = yes }\n' % ('' if code == 1 else 'else_', k, code, k, code))
    w('''		if = {
			limit = { check_variable = { which = sllm_mt_ok value = 1 } }
			change_variable = { which = sllm_mt%(k)d_l value = -1 }
			set_variable = { which = sllm_mt%(k)d_m value = 0 }
			if = { limit = { check_variable = { which = sllm_mt%(k)d_l value <= 0 } } sllm_mt_note_%(k)d = yes %(end)s sllm_mt_clear_%(k)d = yes }
		}
		else = {
			change_variable = { which = sllm_mt%(k)d_m value = 1 }
			sllm_mt_note_%(k)d = yes
			if = { limit = { check_variable = { which = sllm_mt%(k)d_m value >= 2 } } %(stop)s sllm_mt_drop_g = yes }
			else = { %(short)s }
		}
		event_target:sllm_mt_p = { change_variable = { which = sllm_mt_live value = 1 } }
	}
}
''' % {'k': k, 'end': LOG % 'end', 'stop': LOG % 'stop', 'short': LOG % 'short'})
# 끊긴 묶음의 다른 칸도 비운다(상대 범위, sllm_mt_lg·lo 기준) — 외교 거래 약속 하나가 통째로 끝난다
w('sllm_mt_drop_g = {\n')
for k in K:
    w('\tif = { limit = { is_variable_set = sllm_mt%(k)d_g check_variable = { which = sllm_mt%(k)d_g value = sllm_mt_lg } check_variable = { which = sllm_mt%(k)d_o value = sllm_mt_lo } } sllm_mt_clear_%(k)d = yes }\n' % {'k': k})
w('}\n')
# 매달(플레이어 범위)
w('''# 매달(sllm_mt.1, 플레이어 범위): 칸이 있는 나라만 돈다. 칸이 다 비면 깃발을 떼어 다음 달부터 이 이벤트가 아예 돌지 않는다.
sllm_mt_monthly = {
	save_event_target_as = sllm_mt_p
	set_variable = { which = sllm_mt_live value = 0 }
	every_country = {
		limit = { has_country_flag = sllm_mt_has }
''')
for k in K:
    w('\t\tsllm_mt_slot_%d = yes\n' % k)
w('''		if = {
			limit = { NOR = { ''' + ' '.join('is_variable_set = sllm_mt%d_l' % k for k in K) + ''' } }
			remove_country_flag = sllm_mt_has
		}
	}
	if = { limit = { check_variable = { which = sllm_mt_live value = 0 } NOT = { any_country = { has_country_flag = sllm_mt_has } } } remove_country_flag = sllm_mt_on }
}
''')
open(os.path.join(out, 'common/scripted_effects/sllm_mtransfer.txt'), 'w', encoding='utf-8', newline='\n').write(''.join(E))

open(os.path.join(out, 'events/sllm_mtransfer_events.txt'), 'w', encoding='utf-8', newline='\n').write('''# SLLM 정기 송금(2026-11-09) — 매달 한 번, 정기 송금 칸이 있을 때만(sllm_mt_on). 효과: common/scripted_effects/sllm_mtransfer.txt
namespace = sllm_mt

country_event = {
	id = sllm_mt.1
	hide_window = yes
	is_triggered_only = yes
	trigger = {
		is_ai = no
		has_country_flag = sllm_mt_on
	}
	immediate = {
		sllm_mt_monthly = yes
	}
}
''')
open(os.path.join(out, 'common/on_actions/sllm_mtransfer_on_actions.txt'), 'w', encoding='utf-8', newline='\n').write('''# SLLM 정기 송금(2026-11-09) — 매달 맥박(4.5: events 만). 칸이 없으면 이벤트 trigger 에서 바로 끝난다.
on_monthly_pulse_country = {
	events = { sllm_mt.1 }
}
''')
print('ok')
