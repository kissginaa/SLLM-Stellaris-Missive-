// 설정 > 언론사와 브랜드. 페르소나는 신문과 산하 방송이 공유한다.
(() => {
 const $ = (id) => document.getElementById(id);
 let rows = [], current = 0, dirty = false;
 const note = (text) => { $('mediaStatus').textContent = text; };
 function fill() {
   const row = rows[current]; if (!row) return;
   $('mediaFamily').value = row.id;
   $('mediaParent').textContent = row.name + ' → ' + row.radio + '에 같은 페르소나가 적용됩니다.';
   $('mediaPaperTitle').value = row.name; $('mediaRadioTitle').value = row.radio;
   $('mediaPersona').value = row.persona; $('mediaComments').checked = row.comments; $('mediaFont').value = row.font || 'auto';
   $('mediaPaperName').textContent = row.name; $('mediaRadioName').textContent = row.radio;
   $('mediaPaperImage').src = row.paperImage || 'brands/' + row.id + '-paper.svg';
   $('mediaRadioImage').src = row.radioImage || 'brands/' + row.id + '-radio.svg';
   $('mediaPaperImage').alt = row.name + ' 브랜드'; $('mediaRadioImage').alt = row.radio + ' 브랜드';
   $('mediaWebImage').src = row.webImage || 'brands/' + row.id + '-web.webp'; $('mediaWebImage').alt = row.name + ' 홈페이지 로고'; $('mediaWebName').textContent = row.name;
   dirty = false; count();
 }
 function count() { $('mediaCount').textContent = $('mediaPersona').value.length + ' / 4000자'; }
 function accept(state, refresh = true) {
   rows = state;
   $('mediaFamily').replaceChildren(...rows.map((row) => { const option = document.createElement('option'); option.value = row.id; option.textContent = row.name + ' / ' + row.radio; return option; }));
   $('mediaFamily').value = rows[current].id;
   if (refresh) fill();
 }
 function busy(on) { document.querySelectorAll('#settings-panel-media button, #settings-panel-media select, #settings-panel-media textarea, #settings-panel-media input').forEach((el) => { el.disabled = on; }); }
 async function perform(fn, message, refresh = true) {
   busy(true); note('처리 중…');
   try {
     const result = await fn();
     if (!result.ok) { note(result.error || '저장하지 못했습니다.'); return; }
     if (result.cancelled) { note('그림 선택을 취소했습니다.'); return; }
     accept(result.state, refresh);
     if (!refresh) {
       const row = rows[current];
       $('mediaPaperImage').src = row.paperImage || 'brands/' + row.id + '-paper.svg';
       $('mediaRadioImage').src = row.radioImage || 'brands/' + row.id + '-radio.svg';
       $('mediaWebImage').src = row.webImage || 'brands/' + row.id + '-web.webp';
     }
     note(message);
   } catch { note('변경하지 못했습니다. 다시 시도해 주세요.'); }
   finally { busy(false); }
 }
 $('mediaFamily').onchange = () => {
   const id = $('mediaFamily').value;
   if (dirty && !confirm('저장하지 않은 이름·페르소나 변경을 버리고 다른 언론사를 볼까요?')) { $('mediaFamily').value = rows[current].id; return; }
   current = rows.findIndex((row) => row.id === id); fill(); note('');
 };
 for (const id of ['mediaPaperTitle', 'mediaRadioTitle']) $(id).oninput = () => { dirty = true; note('아직 저장하지 않은 변경 사항이 있습니다.'); };
 $('mediaResetNames').onclick = () => { $('mediaPaperTitle').value = rows[current].defaultName; $('mediaRadioTitle').value = rows[current].defaultRadio; dirty = true; note('기본 이름을 채웠습니다. 저장하면 적용됩니다.'); };
 $('mediaPersona').oninput = () => { dirty = true; count(); note('아직 저장하지 않은 변경 사항이 있습니다.'); };
 $('mediaFont').onchange = () => { dirty = true; note('아직 저장하지 않은 변경 사항이 있습니다.'); };
 $('mediaComments').onchange = () => { dirty = true; note('아직 저장하지 않은 변경 사항이 있습니다.'); };
 $('mediaSave').onclick = () => perform(() => window.sllm.mediaSave(rows[current].id, { paperName: $('mediaPaperTitle').value, radioName: $('mediaRadioTitle').value, persona: $('mediaPersona').value, comments: $('mediaComments').checked, font: $('mediaFont').value }), '저장했습니다. 이름은 화면에 반영되고, 페르소나는 다음 기사·방송부터 적용됩니다.');
 $('mediaResetPersona').onclick = () => { if (confirm('이 계열의 페르소나와 논평 설정을 기본값으로 되돌릴까요?')) perform(() => window.sllm.mediaSave(rows[current].id, null), '기본 페르소나로 되돌렸습니다.'); };
 for (const kind of ['paper', 'web', 'radio']) { // web = 홈페이지 로고(2026-11-10)
   document.querySelector('[data-brand-pick="' + kind + '"]').onclick = () => perform(() => window.sllm.mediaBrand(rows[current].id, kind, false), '브랜드 그림을 바꿨습니다.', false);
   document.querySelector('[data-brand-reset="' + kind + '"]').onclick = () => perform(() => window.sllm.mediaBrand(rows[current].id, kind, true), '기본 브랜드 그림으로 되돌렸습니다.', false);
 }
 busy(true);
 window.sllm.mediaGet().then((state) => { accept(state); busy(false); }).catch(() => note('언론사 설정을 불러오지 못했습니다. 설정 창을 다시 열어 주세요.'));
})();
