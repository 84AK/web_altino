/* 코드 저장(.py) + 클래스로그AI 제출
 * - ⬇ 코드 저장: 조/개인 이름을 물어 "<이름>_코드.py"로 저장 (UTF-8)
 * - 📤 클래스로그 제출: 주소에 entryCode 와 studentName 이 모두 있을 때만 보임
 * 비밀키는 여기에 없다. 제출은 이 사이트의 /api/submit 을 거친다.
 */
(function () {
  'use strict';

  var NAME_KEY = 'altino.teamName';
  var MAX_CODE = 200 * 1024; // 코드 칸 글자 한도(200KB)

  function getCtx() {
    var p = new URLSearchParams(window.location.search);
    return {
      entryCode: (p.get('entryCode') || '').trim() || null,
      studentName: (p.get('studentName') || '').trim() || null,
      studentId: (p.get('studentId') || '').trim() || null,
    };
  }

  function loadName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; } }
  function rememberName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (_) { /* */ } }

  // 파일 이름에 못 쓰는 글자 빼기
  function cleanName(raw) {
    return String(raw || '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[.\s]+|[.\s]+$/g, '')
      .slice(0, 40);
  }

  // 조 이름 묻기 (취소하면 null)
  function askName(defaultName) {
    for (;;) {
      var raw = window.prompt('조 이름 또는 개인 이름을 입력해 주세요.\n(파일 이름이 "이름_코드.py"로 저장돼요)', defaultName || '');
      if (raw === null) return null;
      var n = cleanName(raw);
      if (n) { rememberName(n); return n; }
      window.alert('이름을 한 글자 이상 써 주세요.');
      defaultName = '';
    }
  }

  function toBase64Utf8(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  /* ---- 닫기 경고 (클래스로그로 들어왔고 코드를 건드렸을 때만) ---- */
  var dirty = false;
  var bypass = false;
  function onBeforeUnload(e) {
    if (!dirty || bypass) return;
    e.preventDefault();
    e.returnValue = '';
  }

  window.AltinoClassLog = {
    init: function (opt) {
      var getCode = opt.getCode;
      var say = opt.say || function () {};
      var sayTag = opt.sayTag || function () {};
      var ctx = getCtx();
      var viaClassLog = !!(ctx.entryCode && ctx.studentName);

      var saveBtn = document.getElementById('saveBtn');
      var submitBtn = document.getElementById('submitBtn');
      var codeBox = document.getElementById('code');

      if (saveBtn) {
        saveBtn.onclick = function () {
          var code = getCode();
          if (!code.trim()) { say('저장할 코드가 아직 없어요.', 'err'); return; }
          var name = askName(loadName());
          if (!name) return;
          var fileName = name + '_코드.py';
          var blob = new Blob([code], { type: 'text/x-python;charset=utf-8' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = fileName;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
          sayTag('저장함', fileName);
        };
      }

      if (submitBtn) submitBtn.hidden = false; // 누구에게나 보인다 (클래스로그AI 홍보)

      if (!viaClassLog) {
        // 클래스로그AI로 들어오지 않았을 때: 제출 대신 안내 창(입장 버튼 포함)
        var dlg = document.getElementById('clDlg');
        if (dlg && submitBtn) {
          submitBtn.onclick = function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); };
          dlg.addEventListener('click', function (e) {
            if (e.target === dlg || (e.target.matches && e.target.matches('[data-close]'))) dlg.close();
          });
          var saveFirst = document.getElementById('clSaveFirst');
          if (saveFirst) saveFirst.onclick = function () { dlg.close(); if (saveBtn) saveBtn.click(); };
        }
        return;
      }

      // 닫기 경고 켜기
      window.addEventListener('beforeunload', onBeforeUnload);
      if (codeBox) codeBox.addEventListener('input', function () { dirty = true; });

      if (submitBtn) {
        submitBtn.onclick = async function () {
          var code = getCode();
          if (!code.trim()) { say('제출할 코드가 아직 없어요.', 'err'); return; }
          if (code.length > MAX_CODE) { say('코드가 너무 길어요. 200KB보다 짧게 줄여 주세요.', 'err'); return; }
          var name = askName(loadName());
          if (!name) return;
          var fileName = name + '_코드.py';
          if (!window.confirm('"' + fileName + '" 을 클래스로그AI로 제출할까요?')) return;

          var lab = submitBtn.querySelector('.slabel');
          var setState = function (cls, text) {
            submitBtn.classList.remove('sending', 'done', 'fail');
            if (cls) submitBtn.classList.add(cls);
            if (lab) lab.textContent = text;
          };
          clearTimeout(submitBtn._t);
          submitBtn.disabled = true;
          setState('sending', '보내는 중…');
          var ok = false;
          try {
            var res = await fetch('/api/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entryCode: ctx.entryCode,
                studentId: ctx.studentId,
                studentName: ctx.studentName,
                title: '알티노 코드 - ' + name,
                resultType: 'file',
                fileName: fileName,
                fileData: toBase64Utf8(code),
              }),
            });
            if (!res.ok) {
              var err = await res.json().catch(function () { return {}; });
              throw new Error(err.error || ('제출 실패 (' + res.status + ')'));
            }
            dirty = false;
            ok = true;
            sayTag('제출함', fileName + ' → 클래스로그AI');
          } catch (e) {
            say('제출하지 못했어요: ' + (e && e.message ? e.message : '알 수 없는 오류') + '\n먼저 ⬇ 코드 저장으로 파일을 보관해 두세요.', 'err');
          } finally {
            submitBtn.disabled = false;
            setState(ok ? 'done' : 'fail', ok ? '제출 완료!' : '다시 시도');
            submitBtn.setAttribute('aria-live', 'polite');
            submitBtn._t = setTimeout(function () { setState('', '📤 클래스로그 제출'); }, ok ? 2500 : 3500);
          }
        };
      }
    },
  };
})();
