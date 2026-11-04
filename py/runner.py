# 학생 코드를 실행하고, 오류가 나면 "몇 번째 줄, 무슨 문제"를 쉬운 말로 돌려줘요.
# 기종(model)에 따라 불러 주는 알티노 도구가 달라요.
#  - 'lite'   : AltinoLite.py (알티노 라이트)
#  - 'altino' : Altino.py (일반 알티노). 'from AltinoLite import *' 라고 써도 같은 도구로 이어 줘요.
import json
import sys

FILENAME = '내 코드'
MODULE = {'lite': 'AltinoLite', 'altino': 'Altino'}


def _hint(e, model='lite'):
    name = type(e).__name__
    msg = str(e)
    mod = MODULE.get(model, 'AltinoLite')
    other = 'Altino' if model == 'lite' else 'AltinoLite'
    if name == 'NameError':
        return "코드에 쓴 이름을 파이썬이 몰라요. 철자가 맞는지, 맨 위에 'from %s import *' 가 있는지 보세요." % mod
    if name == 'ModuleNotFoundError':
        if other in msg:
            if model == 'lite':
                return "지금은 '알티노 라이트'를 골랐어요. 코드의 'from Altino import *' 를 'from AltinoLite import *' 로 바꾸거나, 위에서 기종을 '알티노'로 바꿔 보세요."
            return "이 기종에서는 'from %s import *' 를 써야 해요." % mod
        return "불러오려는 도구가 이 웹앱에는 없어요. 'from %s import *' 만 쓰고, serial 같은 건 빼 달라고 AI에게 말하세요." % mod
    if name == 'AttributeError' and ('BAT' in msg or 'Bat' in msg):
        if model == 'lite':
            return "알티노 라이트에서 배터리 값은 sensor.BAT (대문자) 예요."
        return "일반 알티노에서 배터리 값은 sensor.Bat (맨 앞만 대문자) 예요."
    if name == 'IndentationError':
        return "줄 앞의 빈칸(들여쓰기)이 맞지 않아요. 같은 묶음의 줄은 앞 빈칸 수가 같아야 해요."
    if name == 'SyntaxError':
        return "문법이 틀렸어요. 괄호 (), 따옴표 '', 콜론 : 이 빠지지 않았는지 그 줄 근처를 보세요."
    if name == 'TypeError':
        return "명령에 넣은 숫자의 개수나 종류가 달라요. 예: Go(300, 300) 처럼 숫자 두 개가 필요해요."
    if name == 'ZeroDivisionError':
        return "0으로 나눌 수 없어요."
    return ''


def run_user(code, model='lite'):
    # 지난 실행에서 불러 둔 도구를 모두 비우고 새로 시작해요 (알티노 상태도 처음부터)
    for m in ('AltinoLite', 'Altino'):
        sys.modules.pop(m, None)
    if model == 'altino':
        import Altino
        sys.modules['AltinoLite'] = Altino   # 'from AltinoLite import *' 도 같은 도구로
    else:
        sys.modules['Altino'] = None         # 일부러 막아서 "기종이 달라요" 힌트를 보여 줘요
    g = {'__name__': '__main__'}
    try:
        exec(compile(code, FILENAME, 'exec'), g)
        return json.dumps({'ok': True})
    except SystemExit:
        return json.dumps({'ok': True})
    except BaseException as e:
        line = getattr(e, 'lineno', None) if isinstance(e, SyntaxError) else None
        tb = e.__traceback__
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == FILENAME:
                line = tb.tb_lineno
            tb = tb.tb_next
        return json.dumps({
            'ok': False,
            'type': type(e).__name__,
            'msg': str(e),
            'line': line,
            'hint': _hint(e, model),
        })
