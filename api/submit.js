// 클래스로그AI 제출 중계 (서버 쪽). 비밀키는 환경변수에만 둔다.
// 필요한 환경변수: CLASS_TOOL_API_KEY, AISERVICEHUB_BASE_URL
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const baseUrl = process.env.AISERVICEHUB_BASE_URL;
  const apiKey = process.env.CLASS_TOOL_API_KEY;
  if (!baseUrl || !apiKey) {
    return res.status(500).json({ error: '서버 설정이 필요해요' });
  }

  // 같은 사이트에서 보낸 요청인지 확인 (보조 수단)
  const origin = req.headers.origin;
  if (origin && req.headers.host && new URL(origin).host !== req.headers.host) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const raw = req.body && typeof req.body === 'object' ? req.body : null;
  if (!raw) return res.status(400).json({ error: 'Invalid body' });

  // 허용한 필드만 골라서 길이 제한
  const body = {
    entryCode: str(raw.entryCode, 100),
    studentId: str(raw.studentId, 100) || undefined,
    studentName: str(raw.studentName, 100) || undefined,
    title: str(raw.title, 200),
    resultType: raw.resultType,
    linkUrl: str(raw.linkUrl, 2000) || undefined,
    textContent: str(raw.textContent, 20000) || undefined,
    fileName: str(raw.fileName, 200) || undefined,
    fileData: str(raw.fileData, 5000000) || undefined,
  };
  if (!body.entryCode || !body.title) {
    return res.status(400).json({ error: 'entryCode, title은 필수예요' });
  }
  if (!['link', 'text', 'image', 'file'].includes(body.resultType)) {
    return res.status(400).json({ error: 'resultType이 올바르지 않아요' });
  }
  if ((body.resultType === 'image' || body.resultType === 'file') && (!body.fileName || !body.fileData)) {
    return res.status(400).json({ error: '파일 이름과 내용이 필요해요' });
  }
  if (body.linkUrl && !/^https:\/\//i.test(body.linkUrl)) {
    return res.status(400).json({ error: '링크는 https:// 로 시작해야 해요' });
  }

  try {
    const r = await fetch(`${baseUrl}/api/classlog/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json(data);
  } catch (err) {
    console.error('submit proxy failed', err); // 자세한 내용은 서버 로그에만
    return res.status(502).json({ error: '제출 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.' });
  }
};
