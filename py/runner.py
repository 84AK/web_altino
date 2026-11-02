# 학생 코드를 실행하고, 오류가 나면 "몇 번째 줄, 무슨 문제"를 쉬운 말로 돌려줘요.
import json
import sys

FILENAME = '내 코드'


def _hint(e):
    name = type(e).__name__
    msg = str(e)
    if name == 'NameError':
        return "코드에 쓴 이름을 파이썬이 몰라요. 철자가 맞는지, 맨 위에 'from AltinoLite import *' 가 있는지 보세요."
    if name == 'ModuleNotFoundError':
        return "불러오려는 도구가 이 웹앱에는 없어요. 'from AltinoLite import *' 만 쓰고, serial 같은 건 빼 달라고 AI에게 말하세요."
    if name == 'IndentationError':
        return "줄 앞의 빈칸(들여쓰기)이 맞지 않아요. 같은 묶음의 줄은 앞 빈칸 수가 같아야 해요."
    if name == 'SyntaxError':
        return "문법이 틀렸어요. 괄호 (), 따옴표 '', 콜론 : 이 빠지지 않았는지 그 줄 근처를 보세요."
    if name == 'TypeError':
        return "명령에 넣은 숫자의 개수나 종류가 달라요. 예: Go(300, 300) 처럼 숫자 두 개가 필요해요."
    if name == 'ZeroDivisionError':
        return "0으로 나눌 수 없어요."
    return ''


def run_user(code):
    sys.modules.pop('AltinoLite', None)
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
            'hint': _hint(e),
        })
